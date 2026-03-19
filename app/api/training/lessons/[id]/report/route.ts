import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { reportLessonSchema } from '@/lib/validations/training'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: lessonId } = await params
    const supabase = await createClient()

    const body = await request.json()
    const validation = reportLessonSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { reason, comment } = validation.data

    // Verificar se já existe report aberto deste utilizador para esta lição
    const { data: existing } = await supabase
      .from('temp_training_lesson_reports' as any)
      .select('id')
      .eq('user_id', auth.user.id)
      .eq('lesson_id', lessonId)
      .eq('status', 'open')
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe um problema reportado em aberto para esta lição' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('temp_training_lesson_reports' as any)
      .insert({
        user_id: auth.user.id,
        lesson_id: lessonId,
        reason,
        comment: comment || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('Erro ao criar report:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
