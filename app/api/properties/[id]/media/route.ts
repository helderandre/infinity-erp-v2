import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { uploadImageToR2 } from '@/lib/r2/images'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar media:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

const ALLOWED_TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/jpg']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const isCover = formData.get('is_cover') === 'true'

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

    const { data: media, error } = await supabase
      .from('dev_property_media')
      .insert({
        property_id: id,
        url,
        media_type: 'image',
        order_index: nextOrder,
        is_cover: isCover,
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
