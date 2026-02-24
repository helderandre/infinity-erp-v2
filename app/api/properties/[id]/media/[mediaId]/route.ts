import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { deleteImageFromR2 } from '@/lib/r2/images'
import { R2_PUBLIC_DOMAIN } from '@/lib/r2/client'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const { id, mediaId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

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
    const { mediaId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get the media record to extract the R2 key
    const { data: media, error: fetchError } = await supabase
      .from('dev_property_media')
      .select('url')
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

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao eliminar imagem:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
