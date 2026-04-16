import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import { uploadImageToR2 } from '@/lib/r2/images'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id, mediaId } = await params
    const supabase = await createClient()

    const { data: media, error: mediaError } = await supabase
      .from('dev_property_media')
      .select('id, url, property_id')
      .eq('id', mediaId)
      .eq('property_id', id)
      .single()

    if (mediaError || !media) {
      return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 })
    }

    // Fetch the original image as a buffer
    const imageResponse = await fetch(media.url)
    if (!imageResponse.ok) {
      return NextResponse.json({ error: 'Erro ao descarregar imagem original' }, { status: 502 })
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
    const imageFile = await toFile(imageBuffer, 'image.png', { type: 'image/png' })

    // Use GPT Image to improve lighting and make it look premium
    const result = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt:
        'Improve this real estate photo to look more professional and premium. ' +
        'Enhance the lighting to be bright and warm. Improve color balance and contrast. ' +
        'Make shadows softer. Keep the room layout, furniture, and architecture exactly the same. ' +
        'Do not add or remove any objects. Only improve the photographic quality.',
      quality: 'medium',
      size: '1024x1024',
    })

    const b64 = result.data?.[0]?.b64_json
    if (!b64) {
      return NextResponse.json({ error: 'Sem resposta da IA' }, { status: 502 })
    }

    // Upload the enhanced image to R2
    const enhancedBuffer = Buffer.from(b64, 'base64')
    const { url: enhancedUrl } = await uploadImageToR2(
      enhancedBuffer,
      `enhanced-${mediaId}.webp`,
      'image/webp',
      id
    )

    // Save the enhanced URL
    const { error: updateError } = await supabase
      .from('dev_property_media')
      .update({ ai_enhanced_url: enhancedUrl })
      .eq('id', mediaId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao guardar imagem melhorada', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ai_enhanced_url: enhancedUrl })
  } catch (error) {
    console.error('Erro ao melhorar iluminação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
