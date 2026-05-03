import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { personalExpenseRecurrenceUpdateSchema } from '@/lib/validations/personal-expense'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json()
    const parsed = personalExpenseRecurrenceUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('agent_personal_expense_recurrences')
      .update(parsed.data)
      .eq('id', id)
      .eq('agent_id', auth.user.id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Recorrência não encontrada' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar recorrência:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE: hard delete da regra. As despesas já geradas (`recurrence_id`)
// permanecem (FK ON DELETE SET NULL).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { error } = await (supabase as any)
      .from('agent_personal_expense_recurrences')
      .delete()
      .eq('id', id)
      .eq('agent_id', auth.user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao apagar recorrência:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
