import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'

/**
 * GET /api/leads/analytics/items?from=ISO&to=ISO[&agent_id=UUID|all]
 *
 * Returns the raw entries + negocios in the period — used by the drill-down
 * sheet on /dashboard/crm/analise → Análise. Each card on that tab decides
 * which slice to show; the client filters/buckets locally to avoid a fan-out
 * of endpoints per KPI.
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
    const wantsCompanyScope = canSeeAll && (agentParam === 'all' || agentParam === 'empresa')
    const agent_id: string | null = wantsCompanyScope
      ? null
      : canSeeAll
        ? (agentParam || auth.user.id)
        : auth.user.id

    const now = new Date()
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
    const from = fromParam ? new Date(fromParam) : defaultFrom
    const to = toParam ? new Date(toParam) : now

    // Cap to keep payloads sane.
    const LIMIT = 500

    let entriesQ = supabase
      .from('leads_entries')
      .select(`
        id, source, status, created_at, first_contact_at, processed_at,
        lost_reason, form_data, raw_name, raw_email, raw_phone, contact_id,
        contact:leads!leads_entries_contact_id_fkey(id, nome, email, telemovel)
      `)
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .order('created_at', { ascending: false })
      .limit(LIMIT)
    if (agent_id) entriesQ = entriesQ.eq('assigned_consultant_id', agent_id)

    let negociosQ = supabase
      .from('negocios')
      .select(`
        id, created_at, won_date, lost_date, lost_reason, expected_value,
        orcamento, preco_venda, business_type, tipo, pipeline_stage_id, lead_id,
        lead:leads!negocios_lead_id_fkey(id, nome)
      `)
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .order('created_at', { ascending: false })
      .limit(LIMIT)
    if (agent_id) negociosQ = negociosQ.eq('assigned_consultant_id', agent_id)

    const [{ data: entriesRaw }, { data: negociosRaw }] = await Promise.all([entriesQ, negociosQ])

    return NextResponse.json({
      entries: entriesRaw ?? [],
      negocios: negociosRaw ?? [],
      range: { from: from.toISOString(), to: to.toISOString() },
    })
  } catch (error) {
    console.error('Erro a obter analytics items:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
