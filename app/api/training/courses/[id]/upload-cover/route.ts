// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { uploadCourseCover, ALLOWED_IMAGE_EXTENSIONS, MAX_COVER_SIZE } from '@/lib/r2/training'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id: courseId } = await params
    const supabase = await createClient()

    const { data: course, error: courseError } = await supabase
      .from('forma_training_courses')
      .select('id')
      .eq('id', courseId)
      .single()

    if (courseError || !course) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro é obrigatório' }, { status: 400 })
    }

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !ALLOWED_IMAGE_EXTENSIONS.includes(extension as any)) {
      return NextResponse.json(
        { error: `Extensão não permitida. Extensões aceites: ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}` },
        { status: 400 }
      )
    }

    if (file.size > MAX_COVER_SIZE) {
      return NextResponse.json({ error: 'Ficheiro excede o tamanho máximo de 5MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { url } = await uploadCourseCover(buffer, file.name, courseId)

    const { error: updateError } = await supabase
      .from('forma_training_courses')
      .update({ cover_image_url: url, updated_at: new Date().toISOString() })
      .eq('id', courseId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ url }, { status: 201 })
  } catch (error) {
    console.error('Erro ao fazer upload da capa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
