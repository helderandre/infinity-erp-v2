// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createLessonSchema } from '@/lib/validations/training'
import { getYouTubeDuration } from '@/lib/youtube'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id: module_id } = await params
    const supabase = await createClient()

    // Verify module exists
    const { data: module, error: moduleError } = await supabase
      .from('forma_training_modules')
      .select('id')
      .eq('id', module_id)
      .single()

    if (moduleError || !module) {
      return NextResponse.json(
        { error: 'Módulo não encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validation = createLessonSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('forma_training_lessons')
      .insert({
        ...validation.data,
        module_id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auto-detectar duração YouTube se não fornecida
    if (
      data.content_type === 'video' &&
      data.video_provider === 'youtube' &&
      data.video_url &&
      !data.video_duration_seconds
    ) {
      const duration = await getYouTubeDuration(data.video_url)
      if (duration) {
        await supabase
          .from('forma_training_lessons')
          .update({ video_duration_seconds: duration })
          .eq('id', data.id)
        data.video_duration_seconds = duration
      }
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar lição:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
