import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

// Lista de consultores activos com KPIs financeiros agregados.
// Usado pela tab "Por consultor" da Vista Empresa.
//
// GET /api/financial/consultants-summary
// Permissão: requer `users` (gestão).
//
// Resposta:
//   {
//     consultants: [{
//       id, commercial_name, profile_photo_url,
//       comissoes_ytd, loja_ytd, saldo_cc, credit_limit, a_receber,
//     }]
//   }

export async function GET() {
  const auth = await requirePermission('users')
  if (!auth.authorized) return auth.response

  const supabase = await createClient()
  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString()
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1).toISOString()

  // Active consultants
  const { data: agents } = await (supabase as any)
    .from('dev_users')
    .select(`
      id,
      commercial_name,
      is_active,
      dev_consultant_profiles(profile_photo_url)
    `)
    .eq('is_active', true)
    .order('commercial_name', { ascending: true })

  if (!agents || agents.length === 0) {
    return NextResponse.json({ consultants: [] })
  }

  const agentIds = agents.map((a: any) => a.id)

  // CC YTD aggregates per agent
  const { data: ccYtd } = await (supabase as any)
    .from('conta_corrente_transactions')
    .select('agent_id, type, category, amount')
    .in('agent_id', agentIds)
    .gte('date', yearStart)
    .lt('date', yearEnd)

  const ytdMap = new Map<string, { comissoes: number; loja: number }>()
  for (const r of ccYtd || []) {
    const entry = ytdMap.get(r.agent_id) ?? { comissoes: 0, loja: 0 }
    if (r.type === 'CREDIT' && r.category === 'commission') {
      entry.comissoes += Number(r.amount || 0)
    } else if (r.type === 'DEBIT' && r.category === 'marketing_purchase') {
      entry.loja += Number(r.amount || 0)
    }
    ytdMap.set(r.agent_id, entry)
  }

  // Last balance per agent (latest by date)
  const { data: lastTxs } = await (supabase as any)
    .from('conta_corrente_transactions')
    .select('agent_id, balance_after, date')
    .in('agent_id', agentIds)
    .order('date', { ascending: false })

  const balanceMap = new Map<string, number>()
  for (const r of lastTxs || []) {
    if (!balanceMap.has(r.agent_id)) {
      balanceMap.set(r.agent_id, Number(r.balance_after || 0))
    }
  }

  // Credit limits per agent
  const { data: limits } = await (supabase as any)
    .from('conta_corrente_limits')
    .select('agent_id, credit_limit')
    .in('agent_id', agentIds)

  const limitMap = new Map<string, number>()
  for (const r of limits || []) {
    limitMap.set(r.agent_id, Number(r.credit_limit || 0))
  }

  // A receber: signed_not_received from deals owned by each agent
  const { data: signedDeals } = await (supabase as any)
    .from('deals')
    .select(`
      consultant_id,
      deal_payments(consultant_amount, is_signed, is_received)
    `)
    .in('consultant_id', agentIds)

  const aReceberMap = new Map<string, number>()
  for (const d of signedDeals || []) {
    const sum = (d.deal_payments || [])
      .filter((p: any) => p.is_signed && !p.is_received)
      .reduce((s: number, p: any) => s + Number(p.consultant_amount || 0), 0)
    aReceberMap.set(d.consultant_id, (aReceberMap.get(d.consultant_id) ?? 0) + sum)
  }

  // Splits: agent receives part of someone else's deal
  const { data: splits } = await (supabase as any)
    .from('deal_payment_splits')
    .select(`
      agent_id,
      amount,
      deal_payment:deal_payments(is_signed, is_received)
    `)
    .in('agent_id', agentIds)

  for (const s of splits || []) {
    if (s.deal_payment?.is_signed && !s.deal_payment?.is_received) {
      aReceberMap.set(
        s.agent_id,
        (aReceberMap.get(s.agent_id) ?? 0) + Number(s.amount || 0)
      )
    }
  }

  const consultants = agents.map((a: any) => {
    const ytd = ytdMap.get(a.id) ?? { comissoes: 0, loja: 0 }
    return {
      id: a.id,
      commercial_name: a.commercial_name,
      profile_photo_url: a.dev_consultant_profiles?.profile_photo_url ?? null,
      comissoes_ytd: ytd.comissoes,
      loja_ytd: ytd.loja,
      saldo_cc: balanceMap.get(a.id) ?? 0,
      credit_limit: limitMap.get(a.id) ?? null,
      a_receber: aReceberMap.get(a.id) ?? 0,
    }
  })

  return NextResponse.json({ consultants })
}
