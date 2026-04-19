import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { deleteImageFromR2 } from '@/lib/r2/images'
import { R2_PUBLIC_DOMAIN } from '@/lib/r2/client'
import { requirePermission } from '@/lib/auth/permissions'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id, mediaId } = await params
    const supabase = await createClient()

    const body = await request.json()

    // If setting as cover, clear previous cover
    if (body.is_cover === true) {
      await supabase
        .from('dev_property_media')
        .update({ is_cover: false })
        .eq('property_id', id)
    }

    const { error } = await supabase
      .from('dev_property_media')
      .update(body)
      .eq('id', mediaId)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao actualizar media', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao actualizar media:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id, mediaId } = await params
    const supabase = await createClient()

    // Get the media record to extract the R2 key
    const { data: media, error: fetchError } = await supabase
      .from('dev_property_media')
      .select('url, is_cover, media_type')
      .eq('id', mediaId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 })
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Extract R2 key from URL
    const key = R2_PUBLIC_DOMAIN
      ? media.url.replace(`${R2_PUBLIC_DOMAIN}/`, '')
      : media.url

    try {
      await deleteImageFromR2(key)
    } catch (r2Error) {
      console.error('Erro ao eliminar imagem do R2:', r2Error)
      // Continue with DB deletion even if R2 fails
    }

    const { error } = await supabase
      .from('dev_property_media')
      .delete()
      .eq('id', mediaId)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao eliminar imagem', details: error.message },
        { status: 500 }
      )
    }

    // If we just removed the cover from a gallery image, promote the next one
    const wasGalleryCover =
      media.is_cover &&
      media.media_type !== 'planta' &&
      media.media_type !== 'planta_3d'
    if (wasGalleryCover) {
      const { data: next } = await supabase
        .from('dev_property_media')
        .select('id')
        .eq('property_id', id)
        .not('media_type', 'in', '("planta","planta_3d")')
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (next?.id) {
        await supabase
          .from('dev_property_media')
          .update({ is_cover: true })
          .eq('id', next.id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao eliminar imagem:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
