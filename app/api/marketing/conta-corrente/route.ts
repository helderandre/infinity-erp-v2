import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { manualTransactionSchema } from '@/lib/validations/marketing'

// GET — List transactions (for a specific agent or all)
export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { searchParams } = new URL(request.url)

    const agent_id = searchParams.get('agent_id')
    const type = searchParams.get('type')
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)
    const offset = Number(searchParams.get('offset')) || 0

    // If requesting balances summary
    if (searchParams.get('summary') === 'true') {
      return await getBalancesSummary(supabase)
    }

    let query = supabase
      .from('conta_corrente_transactions')
      .select(`
        *,
        agent:dev_users!conta_corrente_transactions_agent_id_fkey(id, commercial_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (agent_id) query = query.eq('agent_id', agent_id)
    if (type === 'DEBIT' || type === 'CREDIT') query = query.eq('type', type)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('Erro ao listar transacções:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST — Manual adjustment (admin only)
export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = manualTransactionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { agent_id, type, amount, description } = parsed.data

    // Get current balance
    const { data: lastTx } = await supabase
      .from('conta_corrente_transactions')
      .select('balance_after')
      .eq('agent_id', agent_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const currentBalance = lastTx?.balance_after ?? 0
    const newBalance = type === 'CREDIT'
      ? currentBalance + amount
      : currentBalance - amount

    const { data, error } = await supabase
      .from('conta_corrente_transactions')
      .insert({
        agent_id,
        type,
        category: 'manual_adjustment',
        amount,
        description,
        reference_type: 'manual',
        balance_after: newBalance,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar transacção manual:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

async function getBalancesSummary(supabase: any) {
  // Get all agents with their latest balance
  const { data: agents, error: agentsError } = await supabase
    .from('dev_users')
    .select('id, commercial_name')
    .eq('is_active', true)
    .order('commercial_name')

  if (agentsError) return NextResponse.json({ error: agentsError.message }, { status: 500 })

  const balances = await Promise.all(
    (agents || []).map(async (agent: any) => {
      const { data: lastTx } = await supabase
        .from('conta_corrente_transactions')
        .select('balance_after')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const { data: limitData } = await supabase
        .from('conta_corrente_limits')
        .select('credit_limit')
        .eq('agent_id', agent.id)
        .single()

      return {
        agent_id: agent.id,
        commercial_name: agent.commercial_name,
        current_balance: lastTx?.balance_after ?? 0,
        credit_limit: limitData?.credit_limit ?? null,
      }
    })
  )

  return NextResponse.json(balances)
}
