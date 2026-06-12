/**
 * GET /api/analise-meta/leads?q=&page=&status=
 *
 * Paginated, searchable Meta leads inbox for the CRM → Análise → Meta → Leads
 * sub-tab.
 *
 * Scope:
 *   - gestão (management role) vê todos os leads Meta;
 *   - consultor vê apenas os leads das campanhas/anúncios que lhe estão
 *     atribuídos via `leads_assignment_rules` (consultant_id = self) —
 *     o mesmo modelo de atribuição do /api/leads/meta-performance.
 *
 * Each row comes enriched with the human names of the related form/campaign/ad,
 * and the response carries `can_manage` (whether the caller can assign leads
 * manually) and `mode` ('all' | 'mine').
 */

import { NextResponse } from 'next/server'

import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { canManageAttribution } from '@/lib/analise-meta/can-manage-attribution'
import { getConsultantAssignmentScope } from '@/lib/analise-meta/consultant-scope'
import { parseDateRange, timestampBounds } from '@/lib/meta/date-range'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    const canSeeAll = isManagementRole(auth.roles)

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() ?? ''
    const onlyUnattributed = searchParams.get('status') === 'por_atribuir'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const range = parseDateRange(searchParams)
    const leadBounds = timestampBounds(range)
    // Management may scope to one consultor; consultores are always self-scoped.
    const consultantFilter = canSeeAll ? (searchParams.get('consultant_id')?.trim() || null) : null

    const supabase = createCrmAdminClient()
    const canManage = await canManageAttribution(supabase, auth.user.id)

    // Restrict to the leads of the campaigns/ads attributed to a consultor:
    // the viewer themselves (consultor) or the chosen consultor (management).
    const scopeConsultantId = !canSeeAll ? auth.user.id : consultantFilter
    let scopeOr: string | null = null
    if (scopeConsultantId) {
      const { campaignIds, adIds } = await getConsultantAssignmentScope(supabase, scopeConsultantId)

      if (campaignIds.length === 0 && adIds.length === 0) {
        // Sem campanhas atribuídas — inbox vazia (não é um erro).
        return NextResponse.json({
          leads: [], total: 0, page, page_size: PAGE_SIZE,
          can_manage: canManage, mode: canSeeAll ? 'all' : 'mine',
        })
      }

      const parts: string[] = []
      if (campaignIds.length) parts.push(`campaign_id.in.(${campaignIds.join(',')})`)
      if (adIds.length) parts.push(`ad_id.in.(${adIds.join(',')})`)
      scopeOr = parts.join(',')
    }

    let query = supabase
      .schema('meta')
      .from('meta_leads_raw')
      .select(
        'id, leadgen_id, email, full_name, phone, page_id, form_id, ad_id, campaign_id, signature_valid, received_at, fb_created_time, processed, processed_at, lead_id',
        { count: 'exact' },
      )

    // Os vários .or() são combinados em AND pelo PostgREST — o scope do
    // consultor e a pesquisa não se sobrepõem.
    if (scopeOr) {
      query = query.or(scopeOr)
    }

    if (onlyUnattributed) {
      query = query.eq('processed', false)
    }

    if (leadBounds.gte) query = query.gte('fb_created_time', leadBounds.gte)
    if (leadBounds.lte) query = query.lte('fb_created_time', leadBounds.lte)

    if (q) {
      const safe = q.replace(/%/g, '\\%').replace(/_/g, '\\_')
      query = query.or(
        `email.ilike.%${safe}%,full_name.ilike.%${safe}%,phone.ilike.%${safe}%,leadgen_id.ilike.%${safe}%`,
      )
    }

    // Ordena pela data real do lead no Facebook (mais útil que received_at, que
    // colapsa para "agora" sempre que há backfill/replay).
    const { data, count, error } = await query
      .order('fb_created_time', { ascending: false, nullsFirst: false })
      .order('received_at', { ascending: false })
      .range(from, to)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const leads = (data ?? []) as {
      id: string
      form_id: string | null
      campaign_id: string | null
      ad_id: string | null
      [k: string]: unknown
    }[]

    // Batch lookup dos nomes humanos (form/campanha/ad) — 3 queries pequenas.
    const formIds = Array.from(new Set(leads.map((l) => l.form_id).filter(Boolean) as string[]))
    const campaignIds = Array.from(new Set(leads.map((l) => l.campaign_id).filter(Boolean) as string[]))
    const adIds = Array.from(new Set(leads.map((l) => l.ad_id).filter(Boolean) as string[]))

    const [formsRes, campaignsRes, adsRes] = await Promise.all([
      formIds.length
        ? supabase.schema('meta').from('meta_forms_raw').select('form_id, form_name').in('form_id', formIds)
        : Promise.resolve({ data: [] as { form_id: string; form_name: string | null }[] }),
      campaignIds.length
        ? supabase.schema('meta').from('meta_campaigns_raw').select('campaign_id, name').in('campaign_id', campaignIds)
        : Promise.resolve({ data: [] as { campaign_id: string; name: string | null }[] }),
      adIds.length
        ? supabase.schema('meta').from('meta_ads_raw').select('ad_id, name').in('ad_id', adIds)
        : Promise.resolve({ data: [] as { ad_id: string; name: string | null }[] }),
    ])

    const formNameById = new Map((formsRes.data ?? []).map((f) => [f.form_id, f.form_name]))
    const campaignNameById = new Map((campaignsRes.data ?? []).map((c) => [c.campaign_id, c.name]))
    const adNameById = new Map((adsRes.data ?? []).map((a) => [a.ad_id, a.name]))

    const enriched = leads.map((l) => ({
      ...l,
      form_name: l.form_id ? formNameById.get(l.form_id) ?? null : null,
      campaign_name: l.campaign_id ? campaignNameById.get(l.campaign_id) ?? null : null,
      ad_name: l.ad_id ? adNameById.get(l.ad_id) ?? null : null,
    }))

    return NextResponse.json({
      leads: enriched,
      total: count ?? 0,
      page,
      page_size: PAGE_SIZE,
      can_manage: canManage,
      mode: canSeeAll ? 'all' : 'mine',
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro a carregar leads.' },
      { status: 500 },
    )
  }
}
