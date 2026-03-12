import { notFound } from "next/navigation"
import { getMetaLeads, getMetaCampaignById, getMetaAdSetById, getMetaAdById, getMetaAdSets, getMetaAds, getMetaAdCreative } from "../../actions"
import { isValidDatePreset } from "../../constants"
import type { MetaDatePreset } from "../../constants"
import { MetaDetailClient } from "./meta-detail-client"

export default async function MetaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>
  searchParams: Promise<{ period?: string }>
}) {
  const { type, id } = await params
  const { period: rawPeriod } = await searchParams
  const period: MetaDatePreset = rawPeriod && isValidDatePreset(rawPeriod) ? rawPeriod : "maximum"

  if (!["campaigns", "adsets", "ads"].includes(type)) notFound()

  const leads = await getMetaLeads()

  if (type === "campaigns") {
    const campaign = await getMetaCampaignById(id, leads, period)
    if (!campaign) notFound()
    const [{ adSets }, { ads }] = await Promise.all([
      getMetaAdSets(leads, period),
      getMetaAds(leads, period),
    ])
    const campaignAdSets = adSets.filter((as_) => as_.campaign_id === id)
    const campaignAds = ads.filter((a) => a.campaign_id === id)
    const campaignLeads = leads.filter((lead) => {
      const meta = lead.meta_data as Record<string, unknown> | null
      return meta?.campaign_id === id || meta?.campaign_name === campaign.name
    })
    return (
      <MetaDetailClient
        type="campaign"
        campaign={campaign}
        adSets={campaignAdSets}
        ads={campaignAds}
        leads={campaignLeads}
        currentPeriod={period}
      />
    )
  }

  if (type === "adsets") {
    const adSet = await getMetaAdSetById(id, leads, period)
    if (!adSet) notFound()
    const { ads } = await getMetaAds(leads, period)
    const adSetAds = ads.filter((a) => a.adset_id === id)
    const adSetLeads = leads.filter((lead) => {
      const meta = lead.meta_data as Record<string, unknown> | null
      return meta?.adset_id === id || meta?.adset_name === adSet.name
    })
    return (
      <MetaDetailClient
        type="adset"
        adSet={adSet}
        ads={adSetAds}
        leads={adSetLeads}
        currentPeriod={period}
      />
    )
  }

  // type === "ads"
  const [ad, creative] = await Promise.all([
    getMetaAdById(id, leads, period),
    getMetaAdCreative(id),
  ])
  if (!ad) notFound()
  ad.creative = creative
  const adLeads = leads.filter((lead) => {
    const meta = lead.meta_data as Record<string, unknown> | null
    return meta?.ad_id === id || meta?.ad_name === ad.name
  })
  return (
    <MetaDetailClient
      type="ad"
      ad={ad}
      leads={adLeads}
      currentPeriod={period}
    />
  )
}
