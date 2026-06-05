import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { uploadToR2 } from '@/lib/r2/upload'
import { sanitizeFileName } from '@/lib/r2/documents'
import { requirePermission } from '@/lib/auth/permissions'

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
const MAX_SIZE = 200 * 1024 * 1024 // 200MB

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

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro obrigatório' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de vídeo não suportado. Use MP4, MOV ou WebM.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Vídeo demasiado grande. Máximo 200MB.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const sanitized = sanitizeFileName(file.name)
    const key = `imoveis-videos/${id}/${Date.now()}-${sanitized}`
    const { url } = await uploadToR2({
      key,
      body: buffer,
      contentType: file.type,
    })

    const { data: maxOrderData } = await supabase
      .from('dev_property_media')
      .select('order_index')
      .eq('property_id', id)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder =
      maxOrderData?.order_index != null ? maxOrderData.order_index + 1 : 0

    const { data: media, error } = await supabase
      .from('dev_property_media')
      .insert({
        property_id: id,
        url,
        media_type: 'video',
        order_index: nextOrder,
        is_cover: false,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao registar vídeo', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(media, { status: 201 })
  } catch (error) {
    console.error('Erro ao fazer upload de vídeo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
