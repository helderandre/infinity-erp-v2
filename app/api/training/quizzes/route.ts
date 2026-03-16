// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createQuizSchema } from '@/lib/validations/training'

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    const body = await request.json()
    const validation = createQuizSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const insertData: Record<string, unknown> = {
      title: validation.data.title,
      description: validation.data.description || null,
      passing_score: validation.data.passing_score,
      max_attempts: validation.data.max_attempts,
      time_limit_minutes: validation.data.time_limit_minutes || null,
      shuffle_questions: validation.data.shuffle_questions,
      show_correct_answers: validation.data.show_correct_answers,
    }

    if (validation.data.module_id && validation.data.module_id !== '') {
      insertData.module_id = validation.data.module_id
    }
    if (validation.data.course_id && validation.data.course_id !== '') {
      insertData.course_id = validation.data.course_id
    }

    const { data, error } = await supabase
      .from('temp_training_quizzes')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar questionário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
