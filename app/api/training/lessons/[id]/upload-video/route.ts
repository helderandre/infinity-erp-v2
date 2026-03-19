// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { uploadLessonVideo, ALLOWED_VIDEO_EXTENSIONS, MAX_VIDEO_SIZE } from '@/lib/r2/training'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id: lessonId } = await params
    const supabase = await createClient()

    const { data: lesson, error: lessonError } = await supabase
      .from('forma_training_lessons')
      .select('id')
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lição não encontrada' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro é obrigatório' }, { status: 400 })
    }

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !ALLOWED_VIDEO_EXTENSIONS.includes(extension as any)) {
      return NextResponse.json(
        { error: `Extensão não permitida. Extensões aceites: ${ALLOWED_VIDEO_EXTENSIONS.join(', ')}` },
        { status: 400 }
      )
    }

    if (file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json({ error: 'Ficheiro excede o tamanho máximo de 500MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { url } = await uploadLessonVideo(buffer, file.name, lessonId)

    // Update lesson with the video URL and provider
    const { error: updateError } = await supabase
      .from('forma_training_lessons')
      .update({ video_url: url, video_provider: 'r2' })
      .eq('id', lessonId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ url }, { status: 201 })
  } catch (error) {
    console.error('Erro ao fazer upload do vídeo:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
