// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { updateQuizSchema } from '@/lib/validations/training'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id: quizId } = await params
    const supabase = await createClient()

    const body = await request.json()
    const validation = updateQuizSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = { ...validation.data, updated_at: new Date().toISOString() }

    // Handle optional string fields that might be empty
    if (validation.data.module_id === '') updateData.module_id = null
    if (validation.data.course_id === '') updateData.course_id = null

    const { data, error } = await supabase
      .from('forma_training_quizzes')
      .update(updateData)
      .eq('id', quizId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Questionário não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar questionário:', error)
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

    const { id: quizId } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('forma_training_quizzes')
      .delete()
      .eq('id', quizId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar questionário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
