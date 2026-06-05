import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requirePermission, requireAuth } from '@/lib/auth/permissions'

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
  | 'forecast_revenue'
  | 'forecast_margin'

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
  entityRef?: { type: 'deal_payment' | 'company_transaction' | 'negocio'; id: string }
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

export interface SideBreakdown {
  vendedor: number
  comprador: number
  arrendador: number
  arrendatario: number
  total: number
}

export interface DrilldownPayload {
  kind: DrilldownKind
  total: number
  entries: DrilldownEntry[]
  /** Populated only when kind === 'margin'. */
  breakdown?: MarginBreakdown
  /** Populated for revenue/result/forecast kinds — distribution by deal side. */
  side_breakdown?: SideBreakdown
}

// Heuristic side classification from a deal's business_type + deal_type.
// `pleno` indicates the agency represents both sides — split 50/50.
function classifySide(
  businessType: string | null | undefined,
  dealType: string | null | undefined,
): { vendedor: number; comprador: number; arrendador: number; arrendatario: number } {
  const isRental = businessType === 'arrendamento'
  const bothSides = dealType === 'pleno' || dealType === 'pleno_agencia'
  if (isRental) {
    return bothSides
      ? { vendedor: 0, comprador: 0, arrendador: 0.5, arrendatario: 0.5 }
      : { vendedor: 0, comprador: 0, arrendador: 1, arrendatario: 0 }
  }
  // Default to sale (covers null business_type — most current data)
  return bothSides
    ? { vendedor: 0.5, comprador: 0.5, arrendador: 0, arrendatario: 0 }
    : { vendedor: 1, comprador: 0, arrendador: 0, arrendatario: 0 }
}

function emptySideBreakdown(): SideBreakdown {
  return { vendedor: 0, comprador: 0, arrendador: 0, arrendatario: 0, total: 0 }
}

function addToSideBreakdown(
  acc: SideBreakdown,
  amount: number,
  businessType: string | null | undefined,
  dealType: string | null | undefined,
) {
  const split = classifySide(businessType, dealType)
  acc.vendedor += amount * split.vendedor
  acc.comprador += amount * split.comprador
  acc.arrendador += amount * split.arrendador
  acc.arrendatario += amount * split.arrendatario
  acc.total += amount
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const consultantId = searchParams.get('consultant_id') || null
    const scope = (searchParams.get('scope') || 'month') as 'month' | 'year'

    // Self-scope (consultant viewing their own data) bypasses the financial
    // permission gate. All other access still requires it.
    let auth
    if (consultantId) {
      const baseAuth = await requireAuth()
      if (!baseAuth.authorized) return baseAuth.response
      if (baseAuth.user.id !== consultantId && !baseAuth.permissions.financial) {
        return NextResponse.json(
          { error: 'Sem permissão para ver dados de outro consultor' },
          { status: 403 },
        )
      }
      auth = baseAuth
    } else {
      auth = await requirePermission('financial')
      if (!auth.authorized) return auth.response
    }

    const kind = (searchParams.get('kind') || '') as DrilldownKind
    const validKinds: DrilldownKind[] = [
      'revenue', 'expenses', 'result', 'margin',
      'signed_pending_receipt', 'received_pending_report', 'pending_consultant_payment',
      'forecast_revenue', 'forecast_margin',
    ]
    if (!validKinds.includes(kind)) {
      return NextResponse.json({ error: 'kind inválido' }, { status: 400 })
    }

    const now = new Date()
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()))
    const startDate = scope === 'year'
      ? `${year}-01-01`
      : `${year}-${String(month).padStart(2, '0')}-01`
    let endDate: string
    if (scope === 'year') {
      endDate = `${year + 1}-01-01`
    } else {
      const endMonth = month === 12 ? 1 : month + 1
      const endYear = month === 12 ? year + 1 : year
      endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
    }

    // Admin client — bypasses RLS on `deals` (otherwise nested deal joins
    // come back NULL and entries lose their property/consultant context).
    // Authorization already enforced by requirePermission('financial').
    const supabase = createAdminClient()

    // ── Margin breakdown — pie chart shape, no entries list ───────────────
    if (kind === 'margin') {
      let mq = (supabase as any)
        .from('deal_payments')
        .select(`
          amount, agency_amount, consultant_amount, network_amount, partner_amount,
          deals:deal_id ( consultant_id, business_type, deal_type )
        `)
        .eq('is_received', true)
        .gte('received_date', startDate)
        .lt('received_date', endDate)
      const { data: payments } = await mq
      const filteredMargin = consultantId
        ? (payments || []).filter((p: any) => p.deals?.consultant_id === consultantId)
        : (payments || [])

      const sum = (key: string) => filteredMargin.reduce((s: number, p: any) => s + Number(p[key] || 0), 0)
      const revenueTotal = sum('amount')
      const agency = sum('agency_amount')
      const consultant = sum('consultant_amount')
      const network = sum('network_amount')
      const partners = sum('partner_amount')

      // Side breakdown of total revenue
      const sideMargin = emptySideBreakdown()
      for (const p of filteredMargin) {
        addToSideBreakdown(sideMargin, Number(p.amount || 0), p.deals?.business_type, p.deals?.deal_type)
      }

      const { data: expenseRows } = consultantId
        ? { data: [] } // per-consultant expenses aren't tracked here
        : await (supabase as any)
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
      return NextResponse.json({
        kind,
        total: marginPct,
        entries: [],
        breakdown,
        side_breakdown: sideMargin,
      })
    }

    // ── Revenue / Result entries from deal_payments ───────────────────────
    if (kind === 'revenue' || kind === 'result') {
      const { data: rawPayments } = await (supabase as any)
        .from('deal_payments')
        .select(`
          id, payment_moment, amount, agency_amount, received_date,
          deals:deal_id ( id, pv_number, deal_type, business_type, consultant_id,
            property:property_id ( id, title, external_ref ),
            consultant:consultant_id ( id, commercial_name ),
            external_property_id, external_property_zone )
        `)
        .eq('is_received', true)
        .gte('received_date', startDate)
        .lt('received_date', endDate)
        .order('received_date', { ascending: false })

      const payments = consultantId
        ? (rawPayments || []).filter((p: any) => p.deals?.consultant_id === consultantId)
        : (rawPayments || [])

      const sideRev = emptySideBreakdown()
      for (const p of payments) {
        addToSideBreakdown(sideRev, Number(p.amount || 0), p.deals?.business_type, p.deals?.deal_type)
      }

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
        return NextResponse.json({ kind, total, entries: revenueEntries, side_breakdown: sideRev })
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

      // Per-consultant scope skips the agency expenses overlay.
      const { data: expenses } = consultantId
        ? { data: [] }
        : await (supabase as any)
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

      // Side breakdown for result uses agency margin amounts.
      const sideRes = emptySideBreakdown()
      for (const p of payments) {
        addToSideBreakdown(sideRes, Number(p.agency_amount || 0), p.deals?.business_type, p.deals?.deal_type)
      }

      const merged = [...resultRevenue, ...resultExpenses].sort((a, b) =>
        b.date.localeCompare(a.date),
      )
      const total =
        resultRevenue.reduce((s, e) => s + e.amount, 0) -
        resultExpenses.reduce((s, e) => s + e.amount, 0)
      return NextResponse.json({ kind, total, entries: merged, side_breakdown: sideRes })
    }

    // ── Expenses ──────────────────────────────────────────────────────────
    if (kind === 'expenses') {
      // Per-consultant scope: agency expenses don't belong to a single consultant
      if (consultantId) {
        return NextResponse.json({ kind, total: 0, entries: [] })
      }
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

    // ── Forecast revenue / margin (negocios with expected_close in period) ─
    if (kind === 'forecast_revenue' || kind === 'forecast_margin') {
      let fq = (supabase as any)
        .from('negocios')
        .select(`
          id, tipo, expected_value, probability_pct, expected_close_date,
          assigned_consultant_id,
          leads:lead_id ( nome ),
          leads_pipeline_stages!negocios_pipeline_stage_id_fkey(name, pipeline_type, is_terminal, terminal_type, probability_pct)
        `)
        .gte('expected_close_date', startDate)
        .lt('expected_close_date', endDate)
        .order('expected_close_date', { ascending: true })

      if (consultantId) {
        fq = fq.eq('assigned_consultant_id', consultantId)
      }
      const { data: deals } = await fq
      const active = (deals || []).filter((d: any) => !d.leads_pipeline_stages?.is_terminal)

      // Read margin rate from agency settings
      const { data: settings } = await (supabase as any)
        .from('temp_agency_settings')
        .select('value').eq('key', 'margin_rate').single()
      const marginRate = settings?.value ? parseFloat(settings.value) : 0.30

      const sideF = emptySideBreakdown()
      const entries: DrilldownEntry[] = active.map((d: any) => {
        const stage = d.leads_pipeline_stages
        const stageProb = (stage?.probability_pct ?? d.probability_pct ?? 0) / 100
        const expVal = Number(d.expected_value || 0)
        const weighted = expVal * stageProb
        const amount = kind === 'forecast_margin' ? weighted * marginRate : weighted

        // Map pipeline_type → side breakdown
        const pt: string = stage?.pipeline_type ?? ''
        if (pt === 'vendedor') sideF.vendedor += amount
        else if (pt === 'comprador') sideF.comprador += amount
        else if (pt === 'arrendador') sideF.arrendador += amount
        else if (pt === 'arrendatario') sideF.arrendatario += amount
        sideF.total += amount

        const meta: DrilldownEntry['meta'] = []
        if (stage?.name) meta.push({ label: 'Fase', value: stage.name })
        if (stage?.pipeline_type) meta.push({ label: 'Pipeline', value: stage.pipeline_type })
        meta.push({ label: 'Probabilidade', value: `${Math.round(stageProb * 100)}%` })

        return {
          id: d.id,
          date: d.expected_close_date,
          amount,
          side: 'in' as const,
          primary: d.leads?.nome || d.tipo || 'Negócio',
          secondary: stage?.name || undefined,
          meta,
          href: `/dashboard/crm/negocios/${d.id}`,
          entityRef: { type: 'negocio' as const, id: d.id },
        }
      })
      const total = entries.reduce((s, e) => s + e.amount, 0)
      return NextResponse.json({ kind, total, entries, side_breakdown: sideF })
    }

    // ── Pipeline kinds (cumulative, no month filter) ──────────────────────
    let pq = (supabase as any)
      .from('deal_payments')
      .select(`
        id, payment_moment, amount, agency_amount, consultant_amount,
        signed_date, received_date, is_signed, is_received, is_reported, consultant_paid,
        deals:deal_id ( id, pv_number, deal_type, business_type, consultant_id,
          property:property_id ( id, title, external_ref ),
          consultant:consultant_id ( id, commercial_name ),
          external_property_id, external_property_zone )
      `)
      .order('signed_date', { ascending: false, nullsFirst: false })
    const { data: pipelinePayments } = await pq

    const filterFns: Record<string, (p: any) => boolean> = {
      signed_pending_receipt: (p) => p.is_signed === true && p.is_received === false,
      received_pending_report: (p) => p.is_received === true && p.is_reported === false,
      pending_consultant_payment: (p) => p.is_received === true && p.consultant_paid === false,
    }
    const filtered = (pipelinePayments || [])
      .filter(filterFns[kind])
      .filter((p: any) => !consultantId || p.deals?.consultant_id === consultantId)

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
