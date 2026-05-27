/**
 * GET /api/analise-meta/ads/[ad_id]
 *
 * Ad-detail bundle for the glassmorphic AdDetailSheet (opened from the campaign
 * funnel). Returns the ad, its parent campaign, lead totals, the forms it
 * produced (derived from its leads), and the most recent leads.
 *
 * Reads the `meta` schema via the admin client; gated by an authenticated session.
 */

import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LEAD_SCAN = 500

export async function GET(_req: NextRequest, { params }: { params: Promise<{ ad_id: string }> }) {
  const { ad_id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const db = createCrmAdminClient()

  const { data: ad } = await db
    .schema('meta')
    .from('meta_ads_raw')
    .select('id, ad_id, name, status, adset_id, creative_id, creative_name, campaign_id, fb_created_time, received_at')
    .eq('ad_id', ad_id)
    .maybeSingle()

  if (!ad) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const [campRes, countRes, scanRes] = await Promise.all([
    ad.campaign_id
      ? db.schema('meta').from('meta_campaigns_raw').select('campaign_id, name, status').eq('campaign_id', ad.campaign_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.schema('meta').from('meta_leads_raw').select('id', { count: 'exact', head: true }).eq('ad_id', ad_id),
    db
      .schema('meta')
      .from('meta_leads_raw')
      .select('id, full_name, email, phone, form_id, processed, fb_created_time, received_at')
      .eq('ad_id', ad_id)
      .order('fb_created_time', { ascending: false, nullsFirst: false })
      .order('received_at', { ascending: false })
      .limit(LEAD_SCAN),
  ])

  const scan = (scanRes.data ?? []) as Array<{
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
    form_id: string | null
    processed: boolean
    fb_created_time: string | null
    received_at: string
  }>

  // Forms produced by this ad (+ counts), and the in-CRM tally within the scan.
  const formCounts = new Map<string, number>()
  let inCrm = 0
  for (const l of scan) {
    if (l.processed) inCrm++
    if (l.form_id) formCounts.set(l.form_id, (formCounts.get(l.form_id) ?? 0) + 1)
  }
  const formIds = [...formCounts.keys()]
  const formsRes = formIds.length
    ? await db.schema('meta').from('meta_forms_raw').select('form_id, form_name').in('form_id', formIds)
    : { data: [] as { form_id: string; form_name: string | null }[] }
  const formNameById = new Map((formsRes.data ?? []).map((f) => [f.form_id, f.form_name]))
  const forms = [...formCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([form_id, count]) => ({ form_id, name: formNameById.get(form_id) ?? null, count }))

  return NextResponse.json({
    ad,
    campaign: campRes.data ?? null,
    totalLeads: countRes.count ?? 0,
    inCrm,
    forms,
    recentLeads: scan.slice(0, 10),
  })
}
