import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { updateContaCorrenteTransactionSchema } from '@/lib/validations/marketing'

// PUT/DELETE — edição e eliminação de entradas da conta corrente do consultor.
// Reservado a gestão (permissions.users ou financial). Depois de qualquer
// mutação o encadeamento de saldos (balance_after) do agente é recalculado
// do início, porque alterar/remover uma entrada invalida os saldos seguintes.

function canManage(auth: { permissions: Record<string, unknown> }) {
  return auth.permissions.users === true || auth.permissions.financial === true
}

async function recomputeBalances(supabase: any, agentId: string) {
  const { data: rows, error } = await supabase
    .from('conta_corrente_transactions')
    .select('id, type, amount, balance_after')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  let running = 0
  for (const row of rows || []) {
    running = row.type === 'CREDIT' ? running + Number(row.amount) : running - Number(row.amount)
    if (Number(row.balance_after) !== running) {
      const { error: updError } = await supabase
        .from('conta_corrente_transactions')
        .update({ balance_after: running })
        .eq('id', row.id)
      if (updError) throw new Error(updError.message)
    }
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    if (!canManage(auth)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = updateContaCorrenteTransactionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = await createClient() as any

    const { data: existing, error: fetchError } = await supabase
      .from('conta_corrente_transactions')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Transacção não encontrada' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.description !== undefined) updates.description = parsed.data.description
    if (parsed.data.amount !== undefined) updates.amount = parsed.data.amount
    if (parsed.data.type !== undefined) updates.type = parsed.data.type

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('conta_corrente_transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message || 'Erro ao actualizar' }, { status: 500 })
    }

    await recomputeBalances(supabase, existing.agent_id)

    await supabase.from('log_audit').insert({
      user_id: auth.user.id,
      entity_type: 'conta_corrente_transaction',
      entity_id: id,
      action: 'update',
      old_data: { description: existing.description, amount: existing.amount, type: existing.type },
      new_data: updates,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro ao actualizar transacção da conta corrente:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    if (!canManage(auth)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient() as any

    const { data: existing, error: fetchError } = await supabase
      .from('conta_corrente_transactions')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Transacção não encontrada' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from('conta_corrente_transactions')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    await recomputeBalances(supabase, existing.agent_id)

    await supabase.from('log_audit').insert({
      user_id: auth.user.id,
      entity_type: 'conta_corrente_transaction',
      entity_id: id,
      action: 'delete',
      old_data: existing,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar transacção da conta corrente:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
