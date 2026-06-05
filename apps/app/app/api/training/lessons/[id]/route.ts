// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { updateLessonSchema } from '@/lib/validations/training'
import { getYouTubeDuration } from '@/lib/youtube'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const body = await request.json()
    const validation = updateLessonSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('forma_training_lessons')
      .update(validation.data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Lição não encontrada' },
        { status: 404 }
      )
    }

    // Auto-detectar duração YouTube se URL mudou e duração não foi fornecida
    if (
      data.content_type === 'video' &&
      data.video_provider === 'youtube' &&
      data.video_url &&
      !validation.data.video_duration_seconds &&
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

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar lição:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('forma_training_lessons')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Lição eliminada com sucesso' })
  } catch (error) {
    console.error('Erro ao eliminar lição:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
