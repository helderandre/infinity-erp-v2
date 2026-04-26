import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

// Drilldown for the dashboard "Resumo" cards. Returns the underlying entries
// that compose each KPI/Pipeline value, using the same filters as
// /api/financial/dashboard so totals match.
export type DrilldownKind =
  | 'revenue'
  | 'expenses'
  | 'result'
  | 'margin'
  | 'signed_pending_receipt'
  | 'received_pending_report'
  | 'pending_consultant_payment'

export interface DrilldownEntry {
  id: string
  date: string
  amount: number
  side: 'in' | 'out'
  primary: string
  secondary?: string
  meta?: Array<{ label: string; value: string }>
  href?: string
  /** Reference to the underlying record so the UI can open it in a nested sheet. */
  entityRef?: { type: 'deal_payment' | 'company_transaction'; id: string }
}

export interface MarginBreakdown {
  revenue_total: number
  agency: number
  consultant: number
  network: number
  partners: number
  expenses: number
  agency_net: number
  margin_pct: number
}

export interface DrilldownPayload {
  kind: DrilldownKind
  total: number
  entries: DrilldownEntry[]
  /** Populated only when kind === 'margin'. */
  breakdown?: MarginBreakdown
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const kind = (searchParams.get('kind') || '') as DrilldownKind
    const validKinds: DrilldownKind[] = [
      'revenue', 'expenses', 'result', 'margin',
      'signed_pending_receipt', 'received_pending_report', 'pending_consultant_payment',
    ]
    if (!validKinds.includes(kind)) {
      return NextResponse.json({ error: 'kind inválido' }, { status: 400 })
    }

    const now = new Date()
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()))
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endMonth = month === 12 ? 1 : month + 1
    const endYear = month === 12 ? year + 1 : year
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

    const supabase = await createClient()

    // ── Margin breakdown — pie chart shape, no entries list ───────────────
    if (kind === 'margin') {
      const { data: payments } = await (supabase as any)
        .from('deal_payments')
        .select('amount, agency_amount, consultant_amount, network_amount, partner_amount')
        .eq('is_received', true)
        .gte('received_date', startDate)
        .lt('received_date', endDate)

      const sum = (key: string) => (payments || []).reduce((s: number, p: any) => s + Number(p[key] || 0), 0)
      const revenueTotal = sum('amount')
      const agency = sum('agency_amount')
      const consultant = sum('consultant_amount')
      const network = sum('network_amount')
      const partners = sum('partner_amount')

      const { data: expenseRows } = await (supabase as any)
        .from('company_transactions')
        .select('amount_gross, amount_net')
        .eq('type', 'expense')
        .neq('status', 'cancelled')
        .gte('date', startDate)
        .lt('date', endDate)

      const expenses = (expenseRows || []).reduce(
        (s: number, t: any) => s + Number(t.amount_gross || t.amount_net || 0),
        0,
      )
      const agencyNet = agency - expenses
      const marginPct = revenueTotal > 0 ? Math.round((agencyNet / revenueTotal) * 100) : 0

      const breakdown: MarginBreakdown = {
        revenue_total: revenueTotal,
        agency,
        consultant,
        network,
        partners,
        expenses,
        agency_net: agencyNet,
        margin_pct: marginPct,
      }
      return NextResponse.json({ kind, total: marginPct, entries: [], breakdown })
    }

    // ── Revenue / Result entries from deal_payments ───────────────────────
    if (kind === 'revenue' || kind === 'result') {
      const { data: payments } = await (supabase as any)
        .from('deal_payments')
        .select(`
          id, payment_moment, amount, agency_amount, received_date,
          deals:deal_id ( id, pv_number, deal_type,
            property:property_id ( id, title, external_ref ),
            consultant:consultant_id ( id, commercial_name ),
            external_property_id, external_property_zone )
        `)
        .eq('is_received', true)
        .gte('received_date', startDate)
        .lt('received_date', endDate)
        .order('received_date', { ascending: false })

      const revenueEntries: DrilldownEntry[] = (payments || []).map((p: any) => {
        const deal = p.deals
        const propTitle = deal?.property?.title
          || deal?.external_property_zone
          || deal?.external_property_id
          || '—'
        const propRef = deal?.property?.external_ref || deal?.pv_number || ''
        const meta: DrilldownEntry['meta'] = []
        if (deal?.consultant?.commercial_name) meta.push({ label: 'Consultor', value: deal.consultant.commercial_name })
        if (deal?.deal_type) meta.push({ label: 'Tipo', value: deal.deal_type })
        meta.push({ label: 'Margem', value: fmtCurrency(Number(p.agency_amount || 0)) })

        return {
          id: p.id,
          date: p.received_date,
          amount: Number(p.amount || 0),
          side: 'in' as const,
          primary: `${p.payment_moment ?? 'Pagamento'} · ${propTitle}`,
          secondary: propRef ? `Ref. ${propRef}` : undefined,
          meta,
          href: deal?.id ? `/dashboard/financeiro/deals/${deal.id}` : undefined,
          entityRef: { type: 'deal_payment' as const, id: p.id },
        }
      })

      if (kind === 'revenue') {
        const total = revenueEntries.reduce((s, e) => s + e.amount, 0)
        return NextResponse.json({ kind, total, entries: revenueEntries })
      }

      // ── Result: combine agency_amount from receipts + expenses ─────────
      const resultRevenue: DrilldownEntry[] = (payments || []).map((p: any) => {
        const deal = p.deals
        const propTitle = deal?.property?.title
          || deal?.external_property_zone
          || deal?.external_property_id
          || '—'
        return {
          id: `revenue:${p.id}`,
          date: p.received_date,
          amount: Number(p.agency_amount || 0),
          side: 'in' as const,
          primary: `Margem · ${propTitle}`,
          secondary: p.payment_moment ?? undefined,
          href: deal?.id ? `/dashboard/financeiro/deals/${deal.id}` : undefined,
          entityRef: { type: 'deal_payment' as const, id: p.id },
        }
      })

      const { data: expenses } = await (supabase as any)
        .from('company_transactions')
        .select('id, date, description, category, subcategory, entity_name, amount_gross, amount_net')
        .eq('type', 'expense')
        .neq('status', 'cancelled')
        .gte('date', startDate)
        .lt('date', endDate)
        .order('date', { ascending: false })

      const resultExpenses: DrilldownEntry[] = (expenses || []).map((t: any) => ({
        id: `expense:${t.id}`,
        date: t.date,
        amount: Number(t.amount_gross || t.amount_net || 0),
        side: 'out' as const,
        primary: t.description || t.subcategory || t.category || 'Despesa',
        secondary: [t.category, t.entity_name].filter(Boolean).join(' · ') || undefined,
        entityRef: { type: 'company_transaction' as const, id: t.id },
      }))

      const merged = [...resultRevenue, ...resultExpenses].sort((a, b) =>
        b.date.localeCompare(a.date),
      )
      const total =
        resultRevenue.reduce((s, e) => s + e.amount, 0) -
        resultExpenses.reduce((s, e) => s + e.amount, 0)
      return NextResponse.json({ kind, total, entries: merged })
    }

    // ── Expenses ──────────────────────────────────────────────────────────
    if (kind === 'expenses') {
      const { data: expenses } = await (supabase as any)
        .from('company_transactions')
        .select('id, date, description, category, subcategory, entity_name, amount_gross, amount_net')
        .eq('type', 'expense')
        .neq('status', 'cancelled')
        .gte('date', startDate)
        .lt('date', endDate)
        .order('date', { ascending: false })

      const entries: DrilldownEntry[] = (expenses || []).map((t: any) => ({
        id: t.id,
        date: t.date,
        amount: Number(t.amount_gross || t.amount_net || 0),
        side: 'out' as const,
        primary: t.description || t.subcategory || t.category || 'Despesa',
        secondary: [t.category, t.entity_name].filter(Boolean).join(' · ') || undefined,
        entityRef: { type: 'company_transaction' as const, id: t.id },
      }))
      const total = entries.reduce((s, e) => s + e.amount, 0)
      return NextResponse.json({ kind, total, entries })
    }

    // ── Pipeline kinds (cumulative, no month filter) ──────────────────────
    const { data: pipelinePayments } = await (supabase as any)
      .from('deal_payments')
      .select(`
        id, payment_moment, amount, agency_amount, consultant_amount,
        signed_date, received_date, is_signed, is_received, is_reported, consultant_paid,
        deals:deal_id ( id, pv_number, deal_type,
          property:property_id ( id, title, external_ref ),
          consultant:consultant_id ( id, commercial_name ),
          external_property_id, external_property_zone )
      `)
      .order('signed_date', { ascending: false, nullsFirst: false })

    const filterFns: Record<string, (p: any) => boolean> = {
      signed_pending_receipt: (p) => p.is_signed === true && p.is_received === false,
      received_pending_report: (p) => p.is_received === true && p.is_reported === false,
      pending_consultant_payment: (p) => p.is_received === true && p.consultant_paid === false,
    }
    const filtered = (pipelinePayments || []).filter(filterFns[kind])

    const entries: DrilldownEntry[] = filtered.map((p: any) => {
      const deal = p.deals
      const propTitle = deal?.property?.title
        || deal?.external_property_zone
        || deal?.external_property_id
        || '—'
      const propRef = deal?.property?.external_ref || deal?.pv_number || ''
      const date = (kind === 'pending_consultant_payment'
        ? p.received_date
        : p.signed_date) || p.received_date || p.signed_date

      const amount = kind === 'pending_consultant_payment'
        ? Number(p.consultant_amount || 0)
        : Number(p.amount || 0)

      const meta: DrilldownEntry['meta'] = []
      if (deal?.consultant?.commercial_name) meta.push({ label: 'Consultor', value: deal.consultant.commercial_name })
      if (deal?.deal_type) meta.push({ label: 'Tipo', value: deal.deal_type })

      return {
        id: p.id,
        date: date || new Date().toISOString().slice(0, 10),
        amount,
        side: kind === 'pending_consultant_payment' ? 'out' as const : 'in' as const,
        primary: `${p.payment_moment ?? 'Pagamento'} · ${propTitle}`,
        secondary: propRef ? `Ref. ${propRef}` : undefined,
        meta,
        href: deal?.id ? `/dashboard/financeiro/deals/${deal.id}` : undefined,
        entityRef: { type: 'deal_payment' as const, id: p.id },
      }
    })
    const total = entries.reduce((s, e) => s + e.amount, 0)
    return NextResponse.json({ kind, total, entries })
  } catch (error) {
    console.error('Erro drilldown dashboard:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
