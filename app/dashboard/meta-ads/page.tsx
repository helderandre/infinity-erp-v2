import { getMetaLeads, getMetaCampaigns, getMetaAdSets, getMetaAds, getLeadQualityByCampaign, getMetaPages } from "./actions"
import { isValidDatePreset } from "./constants"
import type { MetaDatePreset } from "./constants"
import { MetaAdsClient } from "./meta-ads-client"

export const metadata = { title: "Meta Ads — ERP Infinity" }

export default async function MetaAdsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: rawPeriod } = await searchParams
  const period: MetaDatePreset = rawPeriod && isValidDatePreset(rawPeriod) ? rawPeriod : "maximum"

  const leads = await getMetaLeads()
  const [
    { campaigns, error: campaignsError },
    { adSets, error: adSetsError },
    { ads, error: adsError },
  ] = await Promise.all([
    getMetaCampaigns(leads, period),
    getMetaAdSets(leads, period),
    getMetaAds(leads, period),
  ])

  const [leadQuality, pages] = await Promise.all([
    getLeadQualityByCampaign(leads, campaigns),
    getMetaPages(),
  ])

  return (
    <MetaAdsClient
      initialLeads={leads}
      campaigns={campaigns}
      adSets={adSets}
      ads={ads}
      leadQuality={leadQuality}
      apiError={campaignsError?.message ?? adSetsError?.message ?? adsError?.message ?? null}
      currentPeriod={period}
      pages={pages}
    />
  )
}
