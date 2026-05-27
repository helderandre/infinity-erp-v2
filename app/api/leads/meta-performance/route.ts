/**
 * GET /api/leads/meta-performance
 *
 * Powers the Leads → Meta tab.
 *   - Consultor: the campaigns/ads attributed to them (assignment rules they own)
 *     + results (leads received, how many entered the CRM). mode='mine'.
 *   - Management: ALL Meta campaigns with results + who they're attributed to
 *     (if anyone). mode='all'.
 *
 * Lead counts live in the `meta` schema (service_role), so we use the admin
 * client. Auth/role come from the session.
 */

import { NextResponse } from 'next/server'

import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

const CAMPAIGN_LIMIT = 200
const LEAD_SCAN_LIMIT = 8000

interface Item {
  key: string
  scope: 'campaign' | 'ad'
  target_id: string
  name: string | null
  status: string | null
  total_leads: number
  in_crm: number
  has_referral: boolean
  referral_pct: number | null
  assigned_to: string | null
}

export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const canSeeAll = isManagementRole(auth.roles)
    const db = createCrmAdminClient()

    // One scan of the raw leads → per-campaign / per-ad counts.
    const { data: leadRows } = await db
      .schema('meta')
      .from('meta_leads_raw')
      .select('campaign_id, ad_id, processed')
      .limit(LEAD_SCAN_LIMIT)

    const totalByCamp: Record<string, number> = {}
    const crmByCamp: Record<string, number> = {}
    const totalByAd: Record<string, number> = {}
    const crmByAd: Record<string, number> = {}
    for (const r of (leadRows ?? []) as Array<{ campaign_id: string | null; ad_id: string | null; processed: boolean }>) {
      if (r.campaign_id) {
        totalByCamp[r.campaign_id] = (totalByCamp[r.campaign_id] ?? 0) + 1
        if (r.processed) crmByCamp[r.campaign_id] = (crmByCamp[r.campaign_id] ?? 0) + 1
      }
      if (r.ad_id) {
        totalByAd[r.ad_id] = (totalByAd[r.ad_id] ?? 0) + 1
        if (r.processed) crmByAd[r.ad_id] = (crmByAd[r.ad_id] ?? 0) + 1
      }
    }

    let items: Item[] = []

    if (canSeeAll) {
      // All campaigns + attribution lookup.
      const [{ data: camps }, { data: rules }] = await Promise.all([
        db.schema('meta').from('meta_campaigns_raw').select('campaign_id, name, status').order('received_at', { ascending: false }).limit(CAMPAIGN_LIMIT),
        db.from('leads_assignment_rules').select('campaign_external_id_match, consultant_id, has_referral, referral_pct').eq('is_active', true).not('campaign_external_id_match', 'is', null),
      ])

      const ruleByCamp = new Map<string, any>()
      const consultantIds = new Set<string>()
      for (const r of (rules ?? []) as any[]) {
        ruleByCamp.set(r.campaign_external_id_match, r)
        if (r.consultant_id) consultantIds.add(r.consultant_id)
      }
      const nameById = new Map<string, string>()
      if (consultantIds.size) {
        const { data: users } = await db.from('dev_users').select('id, commercial_name').in('id', [...consultantIds])
        for (const u of (users ?? []) as any[]) nameById.set(u.id, u.commercial_name)
      }

      items = ((camps ?? []) as any[]).map((c) => {
        const rule = ruleByCamp.get(c.campaign_id)
        return {
          key: c.campaign_id,
          scope: 'campaign' as const,
          target_id: c.campaign_id,
          name: c.name,
          status: c.status,
          total_leads: totalByCamp[c.campaign_id] ?? 0,
          in_crm: crmByCamp[c.campaign_id] ?? 0,
          has_referral: !!rule?.has_referral,
          referral_pct: rule?.referral_pct ?? null,
          assigned_to: rule?.consultant_id ? nameById.get(rule.consultant_id) ?? null : null,
        }
      })
      items.sort((a, b) => b.total_leads - a.total_leads)
    } else {
      // Consultor: their own attribution rules (campaign + ad level).
      const { data: rules } = await db
        .from('leads_assignment_rules')
        .select('id, campaign_external_id_match, ad_id_match, has_referral, referral_pct, priority')
        .eq('consultant_id', auth.user.id)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(CAMPAIGN_LIMIT)

      const metaRules = ((rules ?? []) as any[]).filter((r) => r.campaign_external_id_match || r.ad_id_match)
      const campIds = metaRules.filter((r) => r.campaign_external_id_match).map((r) => r.campaign_external_id_match)
      const adIds = metaRules.filter((r) => r.ad_id_match).map((r) => r.ad_id_match)

      const [{ data: camps }, { data: ads }] = await Promise.all([
        campIds.length ? db.schema('meta').from('meta_campaigns_raw').select('campaign_id, name, status').in('campaign_id', campIds) : Promise.resolve({ data: [] }),
        adIds.length ? db.schema('meta').from('meta_ads_raw').select('ad_id, name, status').in('ad_id', adIds) : Promise.resolve({ data: [] }),
      ])
      const campById = new Map(((camps ?? []) as any[]).map((c) => [c.campaign_id, c]))
      const adById = new Map(((ads ?? []) as any[]).map((a) => [a.ad_id, a]))

      items = metaRules.map((r) => {
        const scope: 'campaign' | 'ad' = r.ad_id_match ? 'ad' : 'campaign'
        const targetId = (r.ad_id_match ?? r.campaign_external_id_match) as string
        const meta = scope === 'ad' ? adById.get(targetId) : campById.get(targetId)
        return {
          key: r.id,
          scope,
          target_id: targetId,
          name: meta?.name ?? null,
          status: meta?.status ?? null,
          total_leads: scope === 'ad' ? totalByAd[targetId] ?? 0 : totalByCamp[targetId] ?? 0,
          in_crm: scope === 'ad' ? crmByAd[targetId] ?? 0 : crmByCamp[targetId] ?? 0,
          has_referral: !!r.has_referral,
          referral_pct: r.referral_pct ?? null,
          assigned_to: null,
        }
      })
      items.sort((a, b) => (a.scope === b.scope ? b.total_leads - a.total_leads : a.scope === 'ad' ? -1 : 1))
    }

    const totals = items.reduce(
      (acc, it) => ({ total_leads: acc.total_leads + it.total_leads, in_crm: acc.in_crm + it.in_crm }),
      { total_leads: 0, in_crm: 0 },
    )

    return NextResponse.json({ items, totals, mode: canSeeAll ? 'all' : 'mine' })
  } catch (err) {
    console.error('Erro em /api/leads/meta-performance:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
