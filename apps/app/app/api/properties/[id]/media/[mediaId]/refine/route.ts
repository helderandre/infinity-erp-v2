import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import { uploadImageToR2 } from '@/lib/r2/images'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id, mediaId } = await params
    const supabase = await createClient()

    const body = await request.json()
    const instructions = body.instructions as string

    if (!instructions?.trim()) {
      return NextResponse.json({ error: 'Instruções obrigatórias' }, { status: 400 })
    }

    const { data: media, error: mediaError } = await supabase
      .from('dev_property_media')
      .select('id, url, property_id, ai_staged_url, ai_room_label')
      .eq('id', mediaId)
      .eq('property_id', id)
      .single()

    if (mediaError || !media) {
      return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 })
    }

    const sourceUrl = media.ai_staged_url || media.url

    const imgResponse = await fetch(sourceUrl)
    if (!imgResponse.ok) {
      return NextResponse.json({ error: 'Erro ao descarregar imagem' }, { status: 502 })
    }
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
    const imageFile = await toFile(imgBuffer, 'image.png', { type: 'image/png' })

    const roomContext = media.ai_room_label
      ? `This is a ${media.ai_room_label}. `
      : ''

    const prompt = `${roomContext}Apply these changes to the image: ${instructions}. Keep the room structure, dimensions, camera angle, and perspective exactly the same. Only make the requested changes. Photorealistic result.`

    const result = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt,
      quality: 'medium',
      size: '1024x1024',
    })

    const b64 = result.data?.[0]?.b64_json
    if (!b64) {
      return NextResponse.json({ error: 'Sem resposta da IA' }, { status: 502 })
    }

    const refinedBuffer = Buffer.from(b64, 'base64')
    const { url: refinedUrl } = await uploadImageToR2(
      refinedBuffer,
      `refined-${mediaId}-${Date.now()}.webp`,
      'image/webp',
      id
    )

    const { error: updateError } = await supabase
      .from('dev_property_media')
      .update({ ai_staged_url: refinedUrl })
      .eq('id', mediaId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao guardar imagem refinada', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: refinedUrl, field: 'ai_staged_url' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Erro ao refinar imagem:', message, error)
    return NextResponse.json(
      { error: message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
