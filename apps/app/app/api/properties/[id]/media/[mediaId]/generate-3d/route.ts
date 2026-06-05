import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { uploadImageToR2 } from '@/lib/r2/images'
import {
  buildPlanta3DPrompt,
  buildPlanta3DVariantPrompts,
} from '@/lib/ai/plantas-3d-prompts'

const MODEL_ID = 'gemini-3-pro-image-preview'

async function generateRender(
  ai: GoogleGenAI,
  prompt: string,
  imgBase64: string,
  sourceMime: string
): Promise<{ buffer: Buffer; mime: string }> {
  const result = await ai.models.generateContent({
    model: MODEL_ID,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: sourceMime, data: imgBase64 } },
        ],
      },
    ],
  })

  const parts = result.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p) => p.inlineData?.mimeType?.startsWith('image/'))
  const generatedB64 = imagePart?.inlineData?.data

  if (!generatedB64) {
    const textPart = parts.find((p) => p.text)
    throw new Error(textPart?.text || 'Gemini não devolveu imagem')
  }

  return {
    buffer: Buffer.from(generatedB64, 'base64'),
    mime: imagePart?.inlineData?.mimeType || 'image/png',
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY não configurada no servidor' },
        { status: 500 }
      )
    }

    const { id, mediaId } = await params
    const supabase = await createClient()

    const body = await request.json().catch(() => ({}))
    const notes = typeof body.notes === 'string' ? body.notes : undefined
    const variants = body.variants === 2 ? 2 : 1

    const { data: source, error: sourceError } = await supabase
      .from('dev_property_media')
      .select('id, url, property_id, media_type, ai_room_label')
      .eq('id', mediaId)
      .eq('property_id', id)
      .single()

    if (sourceError || !source) {
      return NextResponse.json({ error: 'Planta não encontrada' }, { status: 404 })
    }

    const isPlanta = source.media_type === 'planta' || source.ai_room_label === 'planta'
    if (!isPlanta) {
      return NextResponse.json(
        { error: 'A imagem de origem não está marcada como planta' },
        { status: 400 }
      )
    }

    if (source.url.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Plantas em PDF ainda não são suportadas. Carregue a planta como imagem (PNG/JPG/WebP).' },
        { status: 400 }
      )
    }

    const imgResponse = await fetch(source.url)
    if (!imgResponse.ok) {
      return NextResponse.json(
        { error: 'Erro ao descarregar imagem da planta' },
        { status: 502 }
      )
    }
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
    const sourceMime = imgResponse.headers.get('content-type') || 'image/png'
    const imgBase64 = imgBuffer.toString('base64')

    const prompts =
      variants === 2 ? buildPlanta3DVariantPrompts(notes) : [buildPlanta3DPrompt(notes)]

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const settled = await Promise.allSettled(
      prompts.map((p) => generateRender(ai, p, imgBase64, sourceMime))
    )

    const generated: { buffer: Buffer; mime: string }[] = []
    const errors: string[] = []
    for (const r of settled) {
      if (r.status === 'fulfilled') generated.push(r.value)
      else errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason))
    }

    if (generated.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum render foi gerado', details: errors.join('; ') },
        { status: 502 }
      )
    }

    const { data: maxOrderData } = await supabase
      .from('dev_property_media')
      .select('order_index')
      .eq('property_id', id)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()

    let nextOrder = maxOrderData?.order_index != null ? maxOrderData.order_index + 1 : 0

    const inserted = []
    for (const g of generated) {
      const ext = g.mime.split('/')[1] || 'png'
      const { url: renderUrl } = await uploadImageToR2(
        g.buffer,
        `planta-3d-${mediaId}-${Date.now()}-${nextOrder}.${ext}`,
        g.mime,
        id
      )

      const { data: render, error: insertError } = await supabase
        .from('dev_property_media')
        .insert({
          property_id: id,
          url: renderUrl,
          media_type: 'planta_3d',
          order_index: nextOrder,
          is_cover: false,
          source_media_id: mediaId,
        })
        .select()
        .single()

      if (insertError) {
        errors.push(insertError.message)
        continue
      }
      inserted.push(render)
      nextOrder++
    }

    return NextResponse.json(
      {
        renders: inserted,
        generated: generated.length,
        requested: prompts.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Erro ao gerar planta 3D:', message, error)
    return NextResponse.json(
      { error: message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
