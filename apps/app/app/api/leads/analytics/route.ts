import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'

/**
 * GET /api/leads/analytics?from=ISO&to=ISO[&agent_id=UUID]
 *
 * Aggregated KPIs for the /dashboard/crm/analise → Análise tab.
 * Covers leads (`leads_entries`) AND opportunities (`negocios`) for the
 * consultor. Returns the same shape for `previous` (preceding window of
 * equal length) so the UI can render delta %.
 *
 * - `from`/`to` are inclusive ISO timestamps. Default = last 30 days.
 * - Management roles may pass `agent_id` to scope to another consultor.
 *   Consultores always see their own data (param is ignored).
 */
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any
    const { searchParams } = new URL(request.url)

    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const agentParam = searchParams.get('agent_id')
    const canSeeAll = isManagementRole(auth.roles)
    // `agent_id=all` (or `=empresa`) → no consultor filter (Empresa / Visão
    // global). Reserved for management. Consultores always see themselves.
    const wantsCompanyScope = canSeeAll && (agentParam === 'all' || agentParam === 'empresa')
    const agent_id: string | null = wantsCompanyScope
      ? null
      : canSeeAll
        ? (agentParam || auth.user.id)
        : auth.user.id

    // Default range = last 30 days (rolling).
    const now = new Date()
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
    const from = fromParam ? new Date(fromParam) : defaultFrom
    const to = toParam ? new Date(toParam) : now
    // Previous window of equal length for delta % comparisons.
    const span = to.getTime() - from.getTime()
    const prevTo = new Date(from.getTime() - 1)
    const prevFrom = new Date(prevTo.getTime() - span)

    async function loadEntries(start: Date, end: Date) {
      let q = supabase
        .from('leads_entries')
        .select('id, source, status, created_at, first_contact_at, processed_at, lost_reason, form_data')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
      if (agent_id) q = q.eq('assigned_consultant_id', agent_id)
      const { data } = await q
      return (data ?? []) as Array<Record<string, unknown>>
    }

    async function loadNegocios(start: Date, end: Date) {
      let q = supabase
        .from('negocios')
        .select(`
          id, created_at, won_date, lost_date, lost_reason, expected_value,
          orcamento, preco_venda, business_type, tipo, pipeline_stage_id,
          entry:leads_entries!negocios_entry_id_fkey(source, form_data)
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
      if (agent_id) q = q.eq('assigned_consultant_id', agent_id)
      const { data } = await q
      return (data ?? []) as Array<Record<string, unknown>>
    }

    const [entries, negocios, prevEntries, prevNegocios] = await Promise.all([
      loadEntries(from, to),
      loadNegocios(from, to),
      loadEntries(prevFrom, prevTo),
      loadNegocios(prevFrom, prevTo),
    ])

    function aggregateLeads(rows: Array<Record<string, unknown>>) {
      const total = rows.length
      const bySource: Record<string, number> = {}
      const byPortal: Record<string, number> = {}
      const funnel = { novo: 0, contactado: 0, qualificado: 0, perdido: 0 }
      const lostReasons: Record<string, number> = {}
      let qualified = 0
      let firstContactMs = 0
      let firstContactN = 0
      let qualifyMs = 0
      let qualifyN = 0

      for (const e of rows) {
        const src = (e.source as string | null) || 'unknown'
        bySource[src] = (bySource[src] || 0) + 1
        const formData = e.form_data as { portal?: string | null } | null
        if (formData?.portal) byPortal[formData.portal] = (byPortal[formData.portal] || 0) + 1

        const status = e.status as string
        if (status === 'new' || status === 'seen') funnel.novo++
        else if (status === 'processing') funnel.contactado++
        else if (status === 'converted') funnel.qualificado++
        else if (status === 'discarded') funnel.perdido++

        if (status === 'converted') {
          qualified++
          if (e.created_at && e.processed_at) {
            qualifyMs += new Date(e.processed_at as string).getTime() - new Date(e.created_at as string).getTime()
            qualifyN++
          }
        }
        if (e.first_contact_at && e.created_at) {
          firstContactMs +=
            new Date(e.first_contact_at as string).getTime() - new Date(e.created_at as string).getTime()
          firstContactN++
        }
        if (status === 'discarded' && e.lost_reason) {
          const key = e.lost_reason as string
          lostReasons[key] = (lostReasons[key] || 0) + 1
        }
      }

      return {
        total,
        qualified,
        qualifyRate: total > 0 ? qualified / total : 0,
        bySource,
        byPortal,
        funnel,
        lostReasons,
        avgFirstContactHours: firstContactN > 0 ? firstContactMs / firstContactN / 3_600_000 : null,
        avgQualifyHours: qualifyN > 0 ? qualifyMs / qualifyN / 3_600_000 : null,
      }
    }

    function aggregateNegocios(rows: Array<Record<string, unknown>>) {
      const total = rows.length
      let won = 0
      let lost = 0
      let open = 0
      let pipelineOpenEur = 0
      let wonEur = 0
      let valueTotal = 0
      let valueN = 0
      let closeMs = 0
      let closeN = 0
      const bySector: Record<string, number> = {}
      const bySource: Record<string, number> = {}
      const byPortal: Record<string, number> = {}
      const lostReasons: Record<string, number> = {}
      // Mirrors the leads funnel but at the deal level.
      const statusFunnel = { aberto: 0, ganho: 0, perdido: 0 }

      for (const n of rows) {
        const rawValue = (n.preco_venda ?? n.expected_value ?? n.orcamento) as number | string | null
        const value = rawValue != null ? Number(rawValue) || 0 : 0
        const wonDate = n.won_date as string | null
        const lostDate = n.lost_date as string | null
        if (wonDate) {
          won++
          wonEur += value
          statusFunnel.ganho++
          if (n.created_at) {
            closeMs += new Date(wonDate).getTime() - new Date(n.created_at as string).getTime()
            closeN++
          }
        } else if (lostDate) {
          lost++
          statusFunnel.perdido++
          if (n.lost_reason) {
            const key = n.lost_reason as string
            lostReasons[key] = (lostReasons[key] || 0) + 1
          }
        } else {
          open++
          pipelineOpenEur += value
          statusFunnel.aberto++
        }
        if (value > 0) {
          valueTotal += value
          valueN++
        }
        const sector = (n.business_type as string | null) || 'Outro'
        bySector[sector] = (bySector[sector] || 0) + 1
        // Source / portal — inherited from the entry that spawned the deal.
        const entry = n.entry as { source?: string | null; form_data?: { portal?: string | null } | null } | null
        const src = entry?.source ?? 'unknown'
        bySource[src] = (bySource[src] || 0) + 1
        const portal = entry?.form_data?.portal
        if (portal) byPortal[portal] = (byPortal[portal] || 0) + 1
      }

      return {
        total,
        won,
        lost,
        open,
        winRate: total > 0 ? won / total : 0,
        avgValueEur: valueN > 0 ? valueTotal / valueN : null,
        pipelineOpenEur,
        wonEur,
        avgCloseDays: closeN > 0 ? closeMs / closeN / 86_400_000 : null,
        bySector,
        bySource,
        byPortal,
        statusFunnel,
        lostReasons,
      }
    }

    const leads = aggregateLeads(entries)
    const neg = aggregateNegocios(negocios)
    const prevLeads = aggregateLeads(prevEntries)
    const prevNeg = aggregateNegocios(prevNegocios)

    return NextResponse.json({
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        previousFrom: prevFrom.toISOString(),
        previousTo: prevTo.toISOString(),
      },
      leads,
      negocios: neg,
      previous: { leads: prevLeads, negocios: prevNeg },
    })
  } catch (error) {
    console.error('Erro a obter analytics de leads:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
