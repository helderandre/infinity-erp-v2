import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

    // Visits — read with the admin client so the company-wide scope (management,
    // no agent filter) isn't undercounted by per-user RLS. Scope is enforced
    // in-query below; non-management callers are already pinned to their own id.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    async function loadVisits(start: Date, end: Date) {
      let q = admin
        .from('visits')
        .select('id, consultant_id, seller_consultant_id, status, visit_date')
        // `visit_date` is a DATE — filter on the day portion of the window.
        .gte('visit_date', start.toISOString().slice(0, 10))
        .lte('visit_date', end.toISOString().slice(0, 10))
      if (agent_id) {
        if (UUID_RE.test(agent_id)) {
          // A visit credits BOTH the conducting agent and the listing agent,
          // so for a specific consultor we match either side.
          q = q.or(`consultant_id.eq.${agent_id},seller_consultant_id.eq.${agent_id}`)
        } else {
          // Invalid id → return nothing rather than a broken/injected filter.
          q = q.eq('id', '00000000-0000-0000-0000-000000000000')
        }
      }
      const { data } = await q
      return (data ?? []) as Array<Record<string, unknown>>
    }

    const [entries, negocios, prevEntries, prevNegocios, visitRows, prevVisitRows] =
      await Promise.all([
        loadEntries(from, to),
        loadNegocios(from, to),
        loadEntries(prevFrom, prevTo),
        loadNegocios(prevFrom, prevTo),
        loadVisits(from, to),
        loadVisits(prevFrom, prevTo),
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

    // Visitas — agendadas vs realizadas + taxa de realização.
    // `scope='company'` conta um crédito por cada agente DISTINTO envolvido
    // (visita entre agentes diferentes = 2; visita a imóvel próprio = 1).
    // `scope='agent'` conta 1 por linha (as linhas já estão filtradas para
    // envolverem esse consultor, em qualquer dos lados).
    // A taxa usa só agendamentos JÁ VENCIDOS (exclui os ainda por realizar).
    function aggregateVisits(
      rows: Array<Record<string, unknown>>,
      scope: 'company' | 'agent',
    ) {
      let completed = 0
      let noShow = 0
      let cancelled = 0
      let pending = 0

      for (const v of rows) {
        let credits = 1
        if (scope === 'company') {
          const agents = new Set<string>()
          if (v.consultant_id) agents.add(v.consultant_id as string)
          if (v.seller_consultant_id) agents.add(v.seller_consultant_id as string)
          credits = agents.size || 1
        }
        switch (v.status as string) {
          case 'completed':
            completed += credits
            break
          case 'no_show':
            noShow += credits
            break
          case 'cancelled':
            cancelled += credits
            break
          case 'scheduled':
            pending += credits
            break
          // 'proposal' / 'rejected' nunca chegaram a agendamento real → ignorados.
        }
      }

      const due = completed + noShow + cancelled
      return {
        scheduled: due + pending, // agendadas (todos os agendamentos reais)
        completed, // realizadas
        noShow,
        cancelled,
        pending, // ainda por realizar (data futura)
        due, // agendamentos já vencidos
        completionRate: due > 0 ? completed / due : 0,
      }
    }

    const visitsScope: 'company' | 'agent' = agent_id ? 'agent' : 'company'

    const leads = aggregateLeads(entries)
    const neg = aggregateNegocios(negocios)
    const visits = aggregateVisits(visitRows, visitsScope)
    const prevLeads = aggregateLeads(prevEntries)
    const prevNeg = aggregateNegocios(prevNegocios)
    const prevVisits = aggregateVisits(prevVisitRows, visitsScope)

    return NextResponse.json({
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        previousFrom: prevFrom.toISOString(),
        previousTo: prevTo.toISOString(),
      },
      leads,
      negocios: neg,
      visits,
      previous: { leads: prevLeads, negocios: prevNeg, visits: prevVisits },
    })
  } catch (error) {
    console.error('Erro a obter analytics de leads:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
