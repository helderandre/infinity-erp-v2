/**
 * Resolve which Meta campaigns/ads a consultor "owns" via their active
 * `leads_assignment_rules` (consultant_id = the consultor). Shared by the
 * Campanhas grid and the Leads inbox so the consultor self-scope and the
 * management "filter by consultor" path use identical logic.
 */

import type { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

type AdminClient = ReturnType<typeof createCrmAdminClient>

export interface ConsultantScope {
  /** campaign_external_id_match values on the consultor's rules */
  campaignIds: string[]
  /** ad_id_match values on the consultor's rules */
  adIds: string[]
}

/** Raw assignment scope (campaign + ad ids) for one consultor. */
export async function getConsultantAssignmentScope(
  supabase: AdminClient,
  consultantId: string,
): Promise<ConsultantScope> {
  const { data: rules } = await supabase
    .from('leads_assignment_rules')
    .select('campaign_external_id_match, ad_id_match')
    .eq('consultant_id', consultantId)
    .eq('is_active', true)

  const campaignIds = Array.from(
    new Set(
      ((rules ?? []) as { campaign_external_id_match: string | null }[])
        .map((r) => r.campaign_external_id_match)
        .filter(Boolean) as string[],
    ),
  )
  const adIds = Array.from(
    new Set(
      ((rules ?? []) as { ad_id_match: string | null }[])
        .map((r) => r.ad_id_match)
        .filter(Boolean) as string[],
    ),
  )

  return { campaignIds, adIds }
}

/**
 * Campaign ids a consultor is attributed to — the campaign-level rules plus the
 * parent campaigns of any ad-level rules. Used to scope the campaign grid to a
 * chosen consultor. Returns an empty array when the consultor owns nothing.
 */
export async function getConsultantCampaignIds(
  supabase: AdminClient,
  consultantId: string,
): Promise<string[]> {
  const { campaignIds, adIds } = await getConsultantAssignmentScope(supabase, consultantId)
  const all = new Set(campaignIds)

  if (adIds.length) {
    const { data: ads } = await supabase
      .schema('meta')
      .from('meta_ads_raw')
      .select('campaign_id')
      .in('ad_id', adIds)
    for (const a of (ads ?? []) as { campaign_id: string | null }[]) {
      if (a.campaign_id) all.add(a.campaign_id)
    }
  }

  return Array.from(all)
}
