import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createPayoutSchema } from '@/lib/validations/marketing'

// GET — List payouts (optionally filtered by agent_id, status)
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const supabase = await createClient() as any
    const { searchParams } = new URL(request.url)

    const agent_id = searchParams.get('agent_id')
    const status = searchParams.get('status')
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)
    const offset = Number(searchParams.get('offset')) || 0

    // If requesting available transactions for a specific agent (for payout creation UI)
    if (searchParams.get('available') === 'true' && agent_id) {
      return await getAvailableTransactions(supabase, agent_id)
    }

    let query = supabase
      .from('consultant_payouts')
      .select(`
        *,
        agent:dev_users!consultant_payouts_agent_id_fkey(id, commercial_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (agent_id) query = query.eq('agent_id', agent_id)
    if (status) query = query.eq('status', status)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('Erro ao listar pagamentos:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST — Create a payout (draft → pending_invoice)
export async function POST(request: Request) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const supabase = await createClient() as any
    const body = await request.json()
    const parsed = createPayoutSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { agent_id, credit_transaction_ids, deduction_transaction_ids, notes } = parsed.data

    // Validate all credit transactions belong to this agent, are CREDIT, and are 'available'
    const { data: credits, error: creditsError } = await supabase
      .from('conta_corrente_transactions')
      .select('id, amount, settlement_status, type, agent_id')
      .in('id', credit_transaction_ids)

    if (creditsError) return NextResponse.json({ error: creditsError.message }, { status: 500 })

    const invalidCredits = (credits || []).filter(
      (c: any) => c.agent_id !== agent_id || c.type !== 'CREDIT' || c.settlement_status !== 'available'
    )
    if (invalidCredits.length > 0) {
      return NextResponse.json({
        error: 'Alguns créditos seleccionados não estão disponíveis ou não pertencem a este consultor',
      }, { status: 400 })
    }

    // Validate all deduction transactions belong to this agent, are DEBIT, and are 'confirmed'
    let debits: any[] = []
    if (deduction_transaction_ids.length > 0) {
      const { data: debitData, error: debitsError } = await supabase
        .from('conta_corrente_transactions')
        .select('id, amount, settlement_status, type, agent_id')
        .in('id', deduction_transaction_ids)

      if (debitsError) return NextResponse.json({ error: debitsError.message }, { status: 500 })

      const invalidDebits = (debitData || []).filter(
        (d: any) => d.agent_id !== agent_id || d.type !== 'DEBIT' || d.settlement_status !== 'confirmed'
      )
      if (invalidDebits.length > 0) {
        return NextResponse.json({
          error: 'Alguns débitos seleccionados não estão confirmados ou não pertencem a este consultor',
        }, { status: 400 })
      }
      debits = debitData || []
    }

    // Calculate amounts
    const grossCommission = (credits || []).reduce((s: number, c: any) => s + Number(c.amount), 0)
    const totalDeductions = debits.reduce((s: number, d: any) => s + Number(d.amount), 0)
    const netAmount = grossCommission - totalDeductions

    if (netAmount < 0) {
      return NextResponse.json({
        error: 'O valor líquido não pode ser negativo. As deduções excedem os créditos.',
      }, { status: 400 })
    }

    // Create the payout
    const { data: payout, error: payoutError } = await supabase
      .from('consultant_payouts')
      .insert({
        agent_id,
        status: 'pending_invoice',
        gross_commission: grossCommission,
        total_deductions: totalDeductions,
        net_amount: netAmount,
        notes,
        created_by: auth.user.id,
      })
      .select()
      .single()

    if (payoutError) return NextResponse.json({ error: payoutError.message }, { status: 500 })

    // Create payout lines
    const lines = [
      ...(credits || []).map((c: any) => ({
        payout_id: payout.id,
        transaction_id: c.id,
        line_type: 'credit',
        amount: Number(c.amount),
      })),
      ...debits.map((d: any) => ({
        payout_id: payout.id,
        transaction_id: d.id,
        line_type: 'deduction',
        amount: Number(d.amount),
      })),
    ]

    const { error: linesError } = await supabase
      .from('consultant_payout_lines')
      .insert(lines)

    if (linesError) {
      // Rollback payout
      await supabase.from('consultant_payouts').delete().eq('id', payout.id)
      return NextResponse.json({ error: linesError.message }, { status: 500 })
    }

    // Mark all selected transactions as 'allocated' and link to payout
    const allTransactionIds = [...credit_transaction_ids, ...deduction_transaction_ids]
    const { error: updateError } = await supabase
      .from('conta_corrente_transactions')
      .update({ settlement_status: 'allocated', payout_id: payout.id })
      .in('id', allTransactionIds)

    if (updateError) {
      console.error('Erro ao actualizar transacções:', updateError)
    }

    return NextResponse.json(payout, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar pagamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// Helper: get available credits and confirmed debits for an agent
async function getAvailableTransactions(supabase: any, agentId: string) {
  const [creditsRes, debitsRes, limitRes] = await Promise.all([
    supabase
      .from('conta_corrente_transactions')
      .select('id, date, amount, description, category, reference_type, reference_id, created_at')
      .eq('agent_id', agentId)
      .eq('type', 'CREDIT')
      .eq('settlement_status', 'available')
      .order('created_at', { ascending: true }),
    supabase
      .from('conta_corrente_transactions')
      .select('id, date, amount, description, category, reference_type, reference_id, created_at')
      .eq('agent_id', agentId)
      .eq('type', 'DEBIT')
      .eq('settlement_status', 'confirmed')
      .order('created_at', { ascending: true }),
    supabase
      .from('conta_corrente_limits')
      .select('credit_limit')
      .eq('agent_id', agentId)
      .single(),
  ])

  return NextResponse.json({
    available_credits: creditsRes.data || [],
    confirmed_debits: debitsRes.data || [],
    debit_limit: limitRes.data?.credit_limit ?? 0,
  })
}
