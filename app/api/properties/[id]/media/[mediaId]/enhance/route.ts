import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { NextResponse } from 'next/server'
import Replicate from 'replicate'
import { uploadImageToR2 } from '@/lib/r2/images'

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

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

    // Download image and convert to data URI (R2 URLs may not be publicly accessible to Replicate)
    const imgResponse = await fetch(media.url)
    if (!imgResponse.ok) {
      return NextResponse.json({ error: 'Erro ao descarregar imagem original' }, { status: 502 })
    }
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
    const imgBase64 = `data:image/webp;base64,${imgBuffer.toString('base64')}`

    // Run Real-ESRGAN for 4x upscaling
    const output = await replicate.run(
      'nightmareai/real-esrgan:b3ef194191d13140337468c916c2c5b96dd0cb06dffc032a022a31807f6a5ea8',
      {
        input: {
          image: imgBase64,
          scale: 4,
          face_enhance: false,
        },
      }
    )

    // output is a temporary Replicate URL — download and persist to R2
    const replicateUrl = typeof output === 'string' ? output : String(output)
    const imageResponse = await fetch(replicateUrl)
    if (!imageResponse.ok) {
      return NextResponse.json({ error: 'Erro ao descarregar imagem do Replicate' }, { status: 502 })
    }
    const buffer = Buffer.from(await imageResponse.arrayBuffer())
    const { url: enhancedUrl } = await uploadImageToR2(
      buffer,
      `enhanced-${mediaId}.webp`,
      'image/webp',
      id
    )

    // Save the R2 URL
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
    console.error('Erro ao melhorar imagem:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
