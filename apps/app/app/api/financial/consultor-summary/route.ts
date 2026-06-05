import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

// Personal P&L para um consultor.
//
// GET /api/financial/consultor-summary?agent_id=<uuid>
//   - Caller deve ser o próprio OU ter permissions.users (gestão).
//   - agent_id é opcional; default = caller.
//
// Resposta:
//   {
//     agent: { id, commercial_name },
//     kpis: {
//       comissoes_mes, comissoes_ytd, a_receber, loja_mes,
//       saldo_cc, credit_limit, liquido_mes,
//     },
//     monthly_series: [{ month, comissoes, despesas, liquido }] (12 meses),
//     loja_breakdown: [{ category, amount }] (YTD),
//     proximas_entradas: [{ id, deal_ref, deal_date, amount, payment_moment, signed_date }] (top 5),
//     ultimas_movimentacoes: [{ id, date, type, category, amount, description, balance_after }] (top 10),
//   }

export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const { searchParams } = new URL(request.url)
  const requestedAgentId = searchParams.get('agent_id') ?? auth.user.id

  // Permission check: self OR gestão (users permission)
  const isSelf = requestedAgentId === auth.user.id
  const canSeeAll = auth.permissions.users === true
  if (!isSelf && !canSeeAll) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const supabase = await createClient()

  // Reference dates
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString()
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1).toISOString()
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString()

  // ── Agent name ──────────────────────────────────────────────────────────
  const { data: agentRow } = await (supabase as any)
    .from('dev_users')
    .select('id, commercial_name')
    .eq('id', requestedAgentId)
    .single()

  if (!agentRow) {
    return NextResponse.json({ error: 'Consultor não encontrado' }, { status: 404 })
  }

  // ── KPIs from conta_corrente_transactions ─────────────────────────────
  const { data: ccMonth } = await (supabase as any)
    .from('conta_corrente_transactions')
    .select('type, category, amount')
    .eq('agent_id', requestedAgentId)
    .gte('date', monthStart)
    .lt('date', monthEnd)

  const { data: ccYtd } = await (supabase as any)
    .from('conta_corrente_transactions')
    .select('type, category, amount')
    .eq('agent_id', requestedAgentId)
    .gte('date', yearStart)
    .lt('date', yearEnd)

  const sumWhere = (
    rows: any[] | null,
    type: 'CREDIT' | 'DEBIT',
    category?: string
  ) =>
    (rows || [])
      .filter((r) => r.type === type && (!category || r.category === category))
      .reduce((s, r) => s + Number(r.amount || 0), 0)

  const comissoes_mes = sumWhere(ccMonth, 'CREDIT', 'commission')
  const comissoes_ytd = sumWhere(ccYtd, 'CREDIT', 'commission')
  const loja_mes = sumWhere(ccMonth, 'DEBIT', 'marketing_purchase')
  const ajustes_mes = sumWhere(ccMonth, 'CREDIT', 'manual_adjustment') -
    sumWhere(ccMonth, 'DEBIT', 'manual_adjustment')
  const liquido_mes = comissoes_mes + ajustes_mes - loja_mes

  // ── Saldo conta corrente (último balance_after) + limite ────────────────
  const { data: lastTx } = await (supabase as any)
    .from('conta_corrente_transactions')
    .select('balance_after')
    .eq('agent_id', requestedAgentId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: limitRow } = await (supabase as any)
    .from('conta_corrente_limits')
    .select('credit_limit')
    .eq('agent_id', requestedAgentId)
    .maybeSingle()

  const saldo_cc = Number(lastTx?.balance_after ?? 0)
  const credit_limit = limitRow?.credit_limit != null ? Number(limitRow.credit_limit) : null

  // ── A receber: signed_not_received ──────────────────────────────────────
  // Inclui deal_payments cujo deal pertence ao consultor + deal_payment_splits onde é parte
  const { data: ownDeals } = await (supabase as any)
    .from('deals')
    .select('id')
    .eq('consultant_id', requestedAgentId)

  const ownDealIds = (ownDeals || []).map((d: any) => d.id)

  const { data: ownPayments } = ownDealIds.length
    ? await (supabase as any)
        .from('deal_payments')
        .select('id, deal_id, consultant_amount, amount, signed_date, payment_moment, is_signed, is_received')
        .in('deal_id', ownDealIds)
        .eq('is_signed', true)
        .eq('is_received', false)
    : { data: [] }

  const { data: splitPayments } = await (supabase as any)
    .from('deal_payment_splits')
    .select(`
      id,
      amount,
      deal_payment:deal_payments(id, deal_id, signed_date, payment_moment, is_signed, is_received)
    `)
    .eq('agent_id', requestedAgentId)

  const a_receber_own = (ownPayments || []).reduce(
    (s: number, p: any) => s + Number(p.consultant_amount || 0),
    0
  )
  const a_receber_split = (splitPayments || [])
    .filter((s: any) => s.deal_payment?.is_signed && !s.deal_payment?.is_received)
    .reduce((s: number, sp: any) => s + Number(sp.amount || 0), 0)

  const a_receber = a_receber_own + a_receber_split

  // ── Próximas entradas (top 5 ordered by signed_date asc) ───────────────
  const proximas_entradas = [
    ...(ownPayments || []).map((p: any) => ({
      id: p.id,
      deal_id: p.deal_id,
      amount: Number(p.consultant_amount || 0),
      payment_moment: p.payment_moment,
      signed_date: p.signed_date,
      kind: 'own' as const,
    })),
    ...(splitPayments || [])
      .filter((s: any) => s.deal_payment?.is_signed && !s.deal_payment?.is_received)
      .map((s: any) => ({
        id: s.id,
        deal_id: s.deal_payment.deal_id,
        amount: Number(s.amount || 0),
        payment_moment: s.deal_payment.payment_moment,
        signed_date: s.deal_payment.signed_date,
        kind: 'split' as const,
      })),
  ]
    .sort((a, b) =>
      String(a.signed_date || '').localeCompare(String(b.signed_date || ''))
    )
    .slice(0, 5)

  // ── Últimas movimentações (top 10) ────────────────────────────────────
  const { data: ultimas } = await (supabase as any)
    .from('conta_corrente_transactions')
    .select('id, date, type, category, amount, description, balance_after')
    .eq('agent_id', requestedAgentId)
    .order('date', { ascending: false })
    .limit(10)

  // ── Monthly series (last 12 months) ───────────────────────────────────
  const { data: cc12m } = await (supabase as any)
    .from('conta_corrente_transactions')
    .select('date, type, category, amount')
    .eq('agent_id', requestedAgentId)
    .gte('date', twelveMonthsAgo)

  const monthlyMap = new Map<string, { comissoes: number; despesas: number }>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap.set(key, { comissoes: 0, despesas: 0 })
  }
  for (const r of cc12m || []) {
    const d = new Date(r.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const entry = monthlyMap.get(key)
    if (!entry) continue
    if (r.type === 'CREDIT' && r.category === 'commission') {
      entry.comissoes += Number(r.amount || 0)
    } else if (r.type === 'DEBIT' && r.category === 'marketing_purchase') {
      entry.despesas += Number(r.amount || 0)
    }
  }
  const monthly_series = Array.from(monthlyMap.entries()).map(([month, v]) => ({
    month,
    comissoes: v.comissoes,
    despesas: v.despesas,
    liquido: v.comissoes - v.despesas,
  }))

  // ── Loja breakdown (YTD) ─────────────────────────────────────────────
  const { data: ytdMarketingOrders } = await (supabase as any)
    .from('conta_corrente_transactions')
    .select(`
      amount,
      reference_id
    `)
    .eq('agent_id', requestedAgentId)
    .eq('type', 'DEBIT')
    .eq('category', 'marketing_purchase')
    .gte('date', yearStart)
    .lt('date', yearEnd)

  const orderIds = (ytdMarketingOrders || [])
    .map((r: any) => r.reference_id)
    .filter(Boolean)

  let loja_breakdown: Array<{ category: string; amount: number }> = []
  if (orderIds.length > 0) {
    const { data: items } = await (supabase as any)
      .from('marketing_order_items')
      .select('order_id, name, price, quantity')
      .in('order_id', orderIds)

    const totals = new Map<string, number>()
    for (const it of items || []) {
      const key = (it.name as string) || 'Outro'
      const amt = Number(it.price || 0) * Number(it.quantity || 1)
      totals.set(key, (totals.get(key) || 0) + amt)
    }
    loja_breakdown = Array.from(totals.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  }

  return NextResponse.json({
    agent: {
      id: agentRow.id,
      commercial_name: agentRow.commercial_name,
    },
    kpis: {
      comissoes_mes,
      comissoes_ytd,
      a_receber,
      loja_mes,
      saldo_cc,
      credit_limit,
      liquido_mes,
    },
    monthly_series,
    loja_breakdown,
    proximas_entradas,
    ultimas_movimentacoes: ultimas || [],
  })
}
