/**
 * GET /api/analise-meta/unattributed-leads
 *
 * Raw Meta leads still "por atribuir" — they arrived without an attribution
 * rule and haven't been ingested into the CRM yet (meta.meta_leads_raw,
 * processed=false). Powers the "Por atribuir" tab inside Gestão de Leads
 * (/dashboard/crm/gestora), replacing the standalone page.
 *
 * Gated by the `leads_management` permission (same as the Gestora page).
 * `can_manage` (whether the caller may actually assign a lead) is resolved via
 * canManageAttribution.
 *
 * Query: ?q=<search> · ?limit=<n, max 200> · ?count_only=1 (just the total).
 * Returns: { data: HydratedLead[], total, can_manage }
 */

import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { canManageAttribution } from '@/lib/analise-meta/can-manage-attribution'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200

export async function GET(request: Request) {
  const auth = await requirePermission('leads_management')
  if (!auth.authorized) return auth.response

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const countOnly = searchParams.get('count_only') === '1'
  const limit = Math.min(
    Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    MAX_LIMIT,
  )

  const supabase = createCrmAdminClient()
  const canManage = await canManageAttribution(supabase, auth.user.id)

  // ── Count-only fast path (tab badge) — ignores the search filter. ──
  if (countOnly) {
    const { count } = await supabase
      .schema('meta')
      .from('meta_leads_raw')
      .select('id', { count: 'exact', head: true })
      .eq('processed', false)
    return NextResponse.json({ data: [], total: count ?? 0, can_manage: canManage })
  }

  let query = supabase
    .schema('meta')
    .from('meta_leads_raw')
    .select(
      'id, leadgen_id, email, full_name, phone, form_id, campaign_id, ad_id, signature_valid, received_at, fb_created_time, processed, lead_id',
      { count: 'exact' },
    )
    .eq('processed', false)

  if (q) {
    const safe = q.replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.or(
      `email.ilike.%${safe}%,full_name.ilike.%${safe}%,phone.ilike.%${safe}%,leadgen_id.ilike.%${safe}%`,
    )
  }

  const { data, count, error } = await query
    .order('fb_created_time', { ascending: false, nullsFirst: false })
    .order('received_at', { ascending: false })
    .range(0, limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type RawLead = {
    id: string
    leadgen_id: string
    email: string | null
    full_name: string | null
    phone: string | null
    form_id: string | null
    campaign_id: string | null
    ad_id: string | null
    signature_valid: boolean
    received_at: string
    fb_created_time: string | null
    processed: boolean
    lead_id: string | null
  }
  const rows = (data ?? []) as RawLead[]

  // Hydrate form/campaign/ad names so the UI never shows raw IDs.
  const formIds = Array.from(new Set(rows.map((r) => r.form_id).filter((v): v is string => !!v)))
  const campaignIds = Array.from(new Set(rows.map((r) => r.campaign_id).filter((v): v is string => !!v)))
  const adIds = Array.from(new Set(rows.map((r) => r.ad_id).filter((v): v is string => !!v)))

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

  const formName = new Map((formsRes.data ?? []).map((f) => [f.form_id, f.form_name]))
  const campaignName = new Map((campaignsRes.data ?? []).map((c) => [c.campaign_id, c.name]))
  const adName = new Map((adsRes.data ?? []).map((a) => [a.ad_id, a.name]))

  const hydrated = rows.map((r) => ({
    id: r.id,
    leadgen_id: r.leadgen_id,
    email: r.email,
    full_name: r.full_name,
    phone: r.phone,
    form_id: r.form_id,
    campaign_id: r.campaign_id,
    ad_id: r.ad_id,
    form_name: r.form_id ? formName.get(r.form_id) ?? null : null,
    campaign_name: r.campaign_id ? campaignName.get(r.campaign_id) ?? null : null,
    ad_name: r.ad_id ? adName.get(r.ad_id) ?? null : null,
    signature_valid: r.signature_valid,
    processed: r.processed,
    lead_id: r.lead_id,
    fb_created_time: r.fb_created_time,
    received_at: r.received_at,
  }))

  return NextResponse.json({ data: hydrated, total: count ?? 0, can_manage: canManage })
}
