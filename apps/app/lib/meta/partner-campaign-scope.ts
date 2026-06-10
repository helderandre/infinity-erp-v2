/**
 * Resolve the set of Meta campaign ids a partner (referral consultant)
 * "manages / references". A partner is wired to Meta campaigns through
 * `leads_assignment_rules`, where each rule routes a campaign's leads to a
 * consultor and credits a referral slice to `referral_consultant_id`.
 *
 * A rule points at a campaign in one of two ways:
 *   • `campaign_external_id_match` — the Facebook campaign id (text), used
 *     directly as `meta_campaigns_raw.campaign_id`.
 *   • `campaign_id_match` — a uuid FK to `leads_campaigns`, whose
 *     `external_campaign_id` is the Facebook campaign id.
 *
 * Returns the de-duplicated list of Facebook campaign ids. An empty array
 * means the partner references no campaigns (→ they should see none).
 */

import type { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

type AdminClient = ReturnType<typeof createCrmAdminClient>

export async function getPartnerCampaignIds(
  supabase: AdminClient,
  partnerUserId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('leads_assignment_rules')
    .select('campaign_id_match, campaign_external_id_match')
    .eq('referral_consultant_id', partnerUserId)

  if (error) throw new Error(error.message)

  const rules = (data ?? []) as Array<{
    campaign_id_match: string | null
    campaign_external_id_match: string | null
  }>

  const externalIds = new Set<string>()
  const internalIds = new Set<string>()
  for (const r of rules) {
    if (r.campaign_external_id_match) externalIds.add(r.campaign_external_id_match)
    if (r.campaign_id_match) internalIds.add(r.campaign_id_match)
  }

  // Resolve the uuid-style matches to their Facebook campaign ids.
  if (internalIds.size > 0) {
    const { data: camps } = await supabase
      .from('leads_campaigns')
      .select('id, external_campaign_id')
      .in('id', Array.from(internalIds))
    for (const c of (camps ?? []) as Array<{ external_campaign_id: string | null }>) {
      if (c.external_campaign_id) externalIds.add(c.external_campaign_id)
    }
  }

  return Array.from(externalIds)
}

/**
 * All Facebook campaign ids referenced by ANY partner (rules with a non-null
 * `referral_consultant_id`). Used by management/admin viewing the partner
 * portal — they aren't a partner themselves, so this gives them the full set
 * of partner-managed campaigns instead of an empty self-scoped list.
 */
export async function getAllPartnerReferencedCampaignIds(
  supabase: AdminClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('leads_assignment_rules')
    .select('campaign_id_match, campaign_external_id_match')
    .not('referral_consultant_id', 'is', null)

  if (error) throw new Error(error.message)

  const rules = (data ?? []) as Array<{
    campaign_id_match: string | null
    campaign_external_id_match: string | null
  }>

  const externalIds = new Set<string>()
  const internalIds = new Set<string>()
  for (const r of rules) {
    if (r.campaign_external_id_match) externalIds.add(r.campaign_external_id_match)
    if (r.campaign_id_match) internalIds.add(r.campaign_id_match)
  }

  if (internalIds.size > 0) {
    const { data: camps } = await supabase
      .from('leads_campaigns')
      .select('id, external_campaign_id')
      .in('id', Array.from(internalIds))
    for (const c of (camps ?? []) as Array<{ external_campaign_id: string | null }>) {
      if (c.external_campaign_id) externalIds.add(c.external_campaign_id)
    }
  }

  return Array.from(externalIds)
}
