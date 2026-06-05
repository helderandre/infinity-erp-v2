import { NextResponse } from 'next/server'
import { z } from 'zod'
import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

/**
 * POST /api/properties/[id]/legal-data/extract-from-document
 *
 * Recebe um `doc_id` de `doc_registry`, faz fetch do ficheiro (PDF ou
 * imagem) e usa GPT-4o vision para extrair os campos legais que a
 * Chrome extension MUBE Casa Pronta consome em `dev_property_legal_data`.
 *
 * Tipos de documentos esperados:
 *   - Certidão Permanente do Registo Predial (CRP) — preenche
 *     descricao_ficha + ano, conservatoria_crp, freguesia, fracao_autonoma,
 *     quota_parte (e potencialmente distrito/concelho/codigo_ine).
 *   - Caderneta Predial — preenche artigo_matricial + tipo, freguesia_fiscal,
 *     distrito, concelho, fracao_autonoma.
 *
 * UPSERT semântico: campos null no resultado da extracção NÃO sobrepõem
 * valores existentes — assim, fazer upload da CRP primeiro e depois da
 * Caderneta acumula os campos sem perda.
 */

const bodySchema = z.object({
  doc_id: z.string().uuid(),
})

interface ExtractedFields {
  descricao_ficha: string | null
  descricao_ficha_ano: number | null
  conservatoria_crp: string | null
  fracao_autonoma: string | null
  artigo_matricial: string | null
  artigo_matricial_tipo: 'urbano' | 'rustico' | 'misto' | null
  freguesia_fiscal: string | null
  distrito: string | null
  concelho: string | null
  freguesia: string | null
  codigo_ine_freguesia: string | null
  quota_parte: string | null
}

const SYSTEM_PROMPT = `Analisa o documento português que recebeste. Pode ser:

- CRP (Certidão Permanente do Registo Predial) — emitida pela Conservatória do Registo Predial. Tem secção "DESCRIÇÃO" com número e ano da ficha (ex: "12345/2015"), nome da conservatória que emitiu, freguesia (registo predial), letra da fracção autónoma se aplicável, e quotas de comproprietários.

- Caderneta Predial — emitida pela Autoridade Tributária. Tem "ARTIGO MATRICIAL" (número), classificação "URBANO"/"RÚSTICO"/"MISTO", "DISTRITO", "CONCELHO", "FREGUESIA" (fiscal) e a letra da fracção autónoma se aplicável.

Extrai os seguintes campos em JSON, retornando APENAS o objecto JSON sem markdown nem comentários:

{
  "descricao_ficha": string | null,           // CRP — número da descrição (ex: "12345"). null se Caderneta.
  "descricao_ficha_ano": number | null,       // CRP — ano da descrição (ex: 2015). null se Caderneta.
  "conservatoria_crp": string | null,         // CRP — nome da conservatória. null se Caderneta.
  "fracao_autonoma": string | null,           // Letra/identificação da fracção (ex: "A", "F", "AA"). Pode estar em ambos.
  "artigo_matricial": string | null,          // Caderneta — número do artigo (ex: "12345"). null se CRP.
  "artigo_matricial_tipo": "urbano"|"rustico"|"misto"|null,  // Caderneta. null se CRP.
  "freguesia_fiscal": string | null,          // Caderneta — freguesia da matriz fiscal. null se CRP.
  "distrito": string | null,                  // Pode estar em ambos.
  "concelho": string | null,                  // Pode estar em ambos.
  "freguesia": string | null,                 // CRP — freguesia do registo predial. null se Caderneta.
  "codigo_ine_freguesia": string | null,      // 6 dígitos. Só se EXPLICITAMENTE visível no documento.
  "quota_parte": string | null                // CRP, comproprietários (ex: "1/2", "100%"). null se Caderneta.
}

Para campos não visíveis ou não aplicáveis ao tipo de documento, usa null. NÃO inventes valores. NÃO inferes códigos INE — só os retornas se estiverem escritos no documento.`

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id: propertyId } = await params
    const body = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'doc_id inválido', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { doc_id: docId } = parsed.data
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    // Fetch the doc registry row
    const { data: doc, error: docErr } = await adminDb
      .from('doc_registry')
      .select('id, file_url, file_name, property_id')
      .eq('id', docId)
      .maybeSingle()

    if (docErr || !doc) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
    }

    const docRow = doc as { id: string; file_url: string; file_name: string; property_id: string }

    if (docRow.property_id !== propertyId) {
      return NextResponse.json(
        { error: 'Documento não pertence a este imóvel' },
        { status: 400 }
      )
    }

    // Fetch the file → base64
    let fileBase64: string
    let mimeType: string
    try {
      const fileRes = await fetch(docRow.file_url)
      if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`)
      const buf = Buffer.from(await fileRes.arrayBuffer())
      fileBase64 = buf.toString('base64')
      const isPdf = docRow.file_url.toLowerCase().endsWith('.pdf') || docRow.file_name.toLowerCase().endsWith('.pdf')
      mimeType = isPdf ? 'application/pdf' : 'image/jpeg' // Fallback to jpeg for images
      // Try to detect specific image type from extension
      const lower = (docRow.file_url + docRow.file_name).toLowerCase()
      if (lower.includes('.png')) mimeType = 'image/png'
      else if (lower.includes('.webp')) mimeType = 'image/webp'
    } catch (err) {
      console.error('[legal-data/extract] fetch error:', err)
      return NextResponse.json({ error: 'Falha a aceder ao documento' }, { status: 502 })
    }

    // Call GPT-4o vision
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 800,
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${fileBase64}` } } as any,
          ],
        },
      ],
    })

    const text = completion.choices[0]?.message?.content?.trim() || '{}'
    let extracted: ExtractedFields
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      extracted = JSON.parse(cleaned)
    } catch {
      console.error('[legal-data/extract] parse error, raw:', text)
      return NextResponse.json(
        { error: 'IA não retornou JSON válido', raw: text.slice(0, 500) },
        { status: 422 }
      )
    }

    // Fetch existing row (if any) to merge — only overwrite fields where
    // extracted value is non-null. This way, applying CRP and then Caderneta
    // accumulates fields without loss.
    const { data: existing } = await adminDb
      .from('dev_property_legal_data')
      .select('*')
      .eq('property_id', propertyId)
      .maybeSingle()

    const existingRow = (existing ?? {}) as Partial<ExtractedFields>

    const merged: Record<string, unknown> = {
      property_id: propertyId,
      descricao_ficha: extracted.descricao_ficha ?? existingRow.descricao_ficha ?? null,
      descricao_ficha_ano: extracted.descricao_ficha_ano ?? existingRow.descricao_ficha_ano ?? null,
      conservatoria_crp: extracted.conservatoria_crp ?? existingRow.conservatoria_crp ?? null,
      fracao_autonoma: extracted.fracao_autonoma ?? existingRow.fracao_autonoma ?? null,
      artigo_matricial: extracted.artigo_matricial ?? existingRow.artigo_matricial ?? null,
      artigo_matricial_tipo: extracted.artigo_matricial_tipo ?? existingRow.artigo_matricial_tipo ?? null,
      freguesia_fiscal: extracted.freguesia_fiscal ?? existingRow.freguesia_fiscal ?? null,
      distrito: extracted.distrito ?? existingRow.distrito ?? null,
      concelho: extracted.concelho ?? existingRow.concelho ?? null,
      freguesia: extracted.freguesia ?? existingRow.freguesia ?? null,
      codigo_ine_freguesia: extracted.codigo_ine_freguesia ?? existingRow.codigo_ine_freguesia ?? null,
      quota_parte: extracted.quota_parte ?? existingRow.quota_parte ?? null,
      extracted_from_document_id: docRow.id,
      extracted_at: new Date().toISOString(),
      extracted_by: auth.user.id,
      // Reset verified state — extraído de novo precisa de revisão humana.
      verified_by: null,
      verified_at: null,
    }

    const { data: saved, error: saveErr } = await adminDb
      .from('dev_property_legal_data')
      .upsert(merged, { onConflict: 'property_id' })
      .select('*')
      .single()

    if (saveErr) {
      return NextResponse.json({ error: saveErr.message }, { status: 500 })
    }

    // Conta quantos campos foram efectivamente extraídos (não-null no resultado da IA)
    const fieldsExtracted = Object.entries(extracted).filter(([, v]) => v !== null && v !== '').length

    return NextResponse.json({
      data: saved,
      extracted,
      fields_extracted: fieldsExtracted,
    })
  } catch (err) {
    console.error('[legal-data/extract]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
