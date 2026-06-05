import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const EXTRACTION_PROMPT = `You are analyzing scanned visit report forms ("fichas de visita") from a real estate agency.

Each form contains feedback from a property visitor. The image may contain ONE or MULTIPLE forms.

For EACH form found, extract:
- client_name (string)
- client_phone (string or null)
- client_email (string or null)
- client_id_number (string or null)
- visit_date (YYYY-MM-DD format or null)
- visit_time (HH:MM format or null)
- rating_floorplan (1-5 integer or null) — "Planta do Imóvel"
- rating_construction (1-5 integer or null) — "Qualidade de construção"
- rating_finishes (1-5 integer or null) — "Acabamentos"
- rating_sun_exposition (1-5 integer or null) — "Exposição solar"
- rating_location (1-5 integer or null) — "Localização"
- rating_value (1-5 integer or null) — "Valor"
- rating_overall (1-5 integer or null) — "Apreciação Global"
- rating_agent_service (1-5 integer or null) — "Serviço do Agente"
- liked_most (string or null) — "O que mais gostou?"
- liked_least (string or null) — "O que menos gostou?"
- would_buy (boolean or null) — "Compraria/arrendaria este imóvel?"
- would_buy_reason (string or null) — "Porquê?"
- perceived_value (number or null) — "Quanto vale para si este imóvel?" in euros
- has_property_to_sell (boolean or null) — "Tem algum Imóvel para vender?"
- discovery_source (one of: internet, magazine, sign, storefront, flyers, agent, other — or null)

The ratings on the form may use: Mau=1, Médio=2, Bom=3, Muito Bom=4. If checkmarks or circles are used, map them accordingly. If a 1-5 numeric scale is used, take as-is. If the scale only has 4 options, map: Mau=1, Médio=2, Bom=4, Muito Bom=5.

Return a JSON array of objects, one per form found. Even if there's only one form, return an array.
Return ONLY valid JSON, no markdown, no explanation.`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const formData = await request.formData()
    const property_id = formData.get('property_id') as string
    const files = formData.getAll('files') as File[]

    if (!property_id) return NextResponse.json({ error: 'property_id é obrigatório.' }, { status: 400 })
    if (!files.length) return NextResponse.json({ error: 'Nenhum ficheiro enviado.' }, { status: 400 })

    const admin = createAdminClient() as any

    // Upload images to R2 and convert to base64 for GPT-4o
    const imageContents: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []
    const scanUrls: string[] = []

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const contentType = file.type || 'image/jpeg'

      // Upload to R2 for storage
      try {
        const { uploadImageToR2 } = await import('@/lib/r2/images')
        const result = await uploadImageToR2(buffer, `scan-${Date.now()}-${file.name}`, contentType, property_id)
        scanUrls.push(result.url)
      } catch (err) {
        console.error('[fichas/scan] R2 upload error:', err)
      }

      // Convert to base64 for GPT-4o
      const base64 = buffer.toString('base64')
      imageContents.push({
        type: 'image_url',
        image_url: {
          url: `data:${contentType};base64,${base64}`,
          detail: 'high',
        },
      })
    }

    // Call GPT-4o vision
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: EXTRACTION_PROMPT,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all visit report forms from these images. Return JSON array.' },
            ...imageContents,
          ],
        },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content?.trim() || '[]'

    // Parse JSON response
    let extracted: any[]
    try {
      // Remove potential markdown code blocks
      const jsonStr = content.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '')
      extracted = JSON.parse(jsonStr)
      if (!Array.isArray(extracted)) extracted = [extracted]
    } catch {
      console.error('[fichas/scan] Failed to parse GPT response:', content)
      return NextResponse.json({ error: 'Não foi possível extrair dados das fichas. Tente novamente.' }, { status: 422 })
    }

    // Save each extracted ficha
    const created: any[] = []
    for (let i = 0; i < extracted.length; i++) {
      const entry = extracted[i]
      const fichaData = {
        property_id,
        source: 'scan',
        client_name: entry.client_name || null,
        client_phone: entry.client_phone || null,
        client_email: entry.client_email || null,
        client_id_number: entry.client_id_number || null,
        visit_date: entry.visit_date || null,
        visit_time: entry.visit_time || null,
        rating_floorplan: clampRating(entry.rating_floorplan),
        rating_construction: clampRating(entry.rating_construction),
        rating_finishes: clampRating(entry.rating_finishes),
        rating_sun_exposition: clampRating(entry.rating_sun_exposition),
        rating_location: clampRating(entry.rating_location),
        rating_value: clampRating(entry.rating_value),
        rating_overall: clampRating(entry.rating_overall),
        rating_agent_service: clampRating(entry.rating_agent_service),
        liked_most: entry.liked_most || null,
        liked_least: entry.liked_least || null,
        would_buy: entry.would_buy ?? null,
        would_buy_reason: entry.would_buy_reason || null,
        perceived_value: entry.perceived_value ? Number(entry.perceived_value) : null,
        has_property_to_sell: entry.has_property_to_sell ?? null,
        discovery_source: entry.discovery_source || null,
        scan_image_url: scanUrls[Math.min(i, scanUrls.length - 1)] || null,
        created_by: user.id,
      }

      const { data, error } = await admin
        .from('visit_fichas')
        .insert(fichaData)
        .select()
        .single()

      if (data) created.push(data)
      if (error) console.error('[fichas/scan] insert error:', error)
    }

    return NextResponse.json({
      data: created,
      extracted_count: extracted.length,
      saved_count: created.length,
    }, { status: 201 })
  } catch (err) {
    console.error('[fichas/scan POST]', err)
    return NextResponse.json({ error: 'Erro interno ao processar fichas.' }, { status: 500 })
  }
}

function clampRating(val: any): number | null {
  if (val === null || val === undefined) return null
  const n = Number(val)
  if (isNaN(n)) return null
  return Math.max(1, Math.min(5, Math.round(n)))
}
