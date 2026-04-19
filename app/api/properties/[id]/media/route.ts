import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { uploadImageToR2 } from '@/lib/r2/images'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('dev_property_media')
      .select('*')
      .eq('property_id', id)
      .order('order_index', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data || []
    const gallery = rows.filter(
      (m) => m.media_type !== 'planta' && m.media_type !== 'planta_3d'
    )
    if (gallery.length > 0 && !gallery.some((m) => m.is_cover)) {
      const first = gallery[0]
      await supabase
        .from('dev_property_media')
        .update({ is_cover: true })
        .eq('id', first.id)
      const idx = rows.findIndex((m) => m.id === first.id)
      if (idx !== -1) rows[idx] = { ...rows[idx], is_cover: true }
    }

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Erro ao listar media:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

const ALLOWED_TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const isCover = formData.get('is_cover') === 'true'
    const mediaType = (formData.get('media_type') as string) || 'image'

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro obrigatório' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de ficheiro não suportado. Use JPEG, PNG ou WebP.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Ficheiro demasiado grande. Máximo 5MB.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { url } = await uploadImageToR2(buffer, file.name, file.type, id)

    // Clear previous cover if setting new one
    if (isCover) {
      await supabase
        .from('dev_property_media')
        .update({ is_cover: false })
        .eq('property_id', id)
    }

    // Determine next order_index
    const { data: maxOrderData } = await supabase
      .from('dev_property_media')
      .select('order_index')
      .eq('property_id', id)
      .order('order_index', { ascending: false })
      .limit(1)
      .single()

    const nextOrder = maxOrderData?.order_index != null ? maxOrderData.order_index + 1 : 0

    // If this is a regular gallery image and no cover exists yet, auto-promote it
    let finalIsCover = isCover
    if (!finalIsCover && mediaType !== 'planta' && mediaType !== 'planta_3d') {
      const { data: existingCover } = await supabase
        .from('dev_property_media')
        .select('id')
        .eq('property_id', id)
        .eq('is_cover', true)
        .not('media_type', 'in', '("planta","planta_3d")')
        .limit(1)
      if (!existingCover || existingCover.length === 0) {
        finalIsCover = true
      }
    }

    const { data: media, error } = await supabase
      .from('dev_property_media')
      .insert({
        property_id: id,
        url,
        media_type: mediaType,
        order_index: nextOrder,
        is_cover: finalIsCover,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao registar imagem', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(media, { status: 201 })
  } catch (error) {
    console.error('Erro ao fazer upload de imagem:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
