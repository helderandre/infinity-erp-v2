/**
 * Relatório de Atividade ao Proprietário — agregação de dados.
 *
 * Recebe um `property_id` + config (que blocos, campos manuais, limiar de
 * anonimato, modo do gasto Meta, período) e devolve um SNAPSHOT de agregados
 * prontos a renderizar. NUNCA inclui linhas individuais de ficha/visita — só
 * números agregados — para que o snapshot guardado seja seguro à luz do RGPD.
 *
 * Privacidade das fichas:
 *  - só conta fichas com `consent_share_with_owner = true`;
 *  - o bloco de feedback só é elegível com >= `minFichas` fichas (k-anonimato);
 *  - não exporta texto livre (liked_most/least, would_buy_reason). A "objeção"
 *    é expressa de forma agregada via a dimensão pior avaliada.
 */

import { RATING_FIELDS } from '@/types/visit-ficha'

// ── Config ────────────────────────────────────────────────────────────

export const REPORT_BLOCKS = [
  'funnel',
  'meta',
  'visits',
  'feedback',
  'price',
  'portals',
] as const
export type ReportBlock = (typeof REPORT_BLOCKS)[number]

export const REPORT_BLOCK_LABELS: Record<ReportBlock, string> = {
  funnel: 'Funil de conversão',
  meta: 'Campanhas Meta',
  visits: 'Detalhe de visitas',
  feedback: 'Feedback das visitas',
  price: 'Preço pedido vs. valor percebido',
  portals: 'Visualizações nos portais',
}

export interface PortalViews {
  idealista: number | null
  imovirtual: number | null
  casaSapo: number | null
  website: number | null
}

export interface OwnerReportConfig {
  blocks: Record<ReportBlock, boolean>
  /** Mostrar o gasto estimado dentro do bloco Meta (off por defeito). */
  metaShowSpend: boolean
  /** 'prorata' = rateia pelo nº de leads do imóvel; 'real' = usa o total da campanha. */
  metaMode: 'prorata' | 'real'
  /** Visualizações por portal, preenchidas manualmente pelo consultor. */
  portalViews: PortalViews
  /** Limiar mínimo de fichas para mostrar feedback agregado (k-anonimato). */
  minFichas: number
  /** Nota de fecho do consultor (recomendações / próximos passos). */
  agentNote: string | null
  periodFrom: string | null
  periodTo: string | null
}

export const DEFAULT_REPORT_CONFIG: OwnerReportConfig = {
  blocks: {
    funnel: true,
    meta: true,
    visits: true,
    feedback: true,
    price: true,
    portals: false,
  },
  metaShowSpend: false,
  metaMode: 'prorata',
  portalViews: { idealista: null, imovirtual: null, casaSapo: null, website: null },
  minFichas: 2,
  agentNote: null,
  periodFrom: null,
  periodTo: null,
}

// ── Snapshot ──────────────────────────────────────────────────────────

export interface OwnerReportData {
  property: {
    id: string
    title: string | null
    externalRef: string | null
    addressLine: string | null
    city: string | null
    zone: string | null
    listingPrice: number | null
    energyCertificate: string | null
    coverUrl: string | null
    createdAt: string | null
  }
  generatedAt: string
  generatedByName: string | null
  daysOnMarket: number | null
  period: { from: string | null; to: string | null }

  visits: {
    total: number
    scheduled: number
    completed: number
    noShow: number
    cancelled: number
    rejected: number
    proposal: number
  }

  funnel: {
    impressions: number | null
    clicks: number | null
    leads: number
    visitRequests: number
    visitsDone: number
    interested: number
  }

  fichas: {
    consideredCount: number
    meetsThreshold: boolean
    threshold: number
    avgRatings: { key: string; label: string; avg: number }[]
    avgOverall: number | null
    avgPerceivedValue: number | null
    wouldBuyYes: number
    wouldBuyNo: number
    wouldBuyPct: number | null
    lowestDimension: { label: string; avg: number } | null
    highestDimension: { label: string; avg: number } | null
    discoveryBreakdown: { label: string; count: number }[]
  }

  interest: {
    very_interested: number
    interested: number
    neutral: number
    not_interested: number
  }

  leads: {
    total: number
    bySource: { source: string; count: number }[]
  }

  meta: {
    hasData: boolean
    mode: 'prorata' | 'real'
    showSpend: boolean
    campaigns: {
      name: string
      platform: string | null
      leadsForProperty: number
      totalLeads: number
      ratio: number
      impressions: number
      clicks: number
      estSpend: number
    }[]
    totals: { impressions: number; clicks: number; leads: number; estSpend: number }
  }

  portalViews: PortalViews & { total: number | null }

  priceComparison: {
    listingPrice: number | null
    avgPerceivedValue: number | null
    deltaPct: number | null
  }

  agentNote: string | null
}

const SOURCE_LABELS: Record<string, string> = {
  portal_idealista: 'Idealista',
  portal_imovirtual: 'Imovirtual',
  portal_casa_sapo: 'Casa Sapo',
  website: 'Website',
  meta: 'Meta (Facebook/Instagram)',
  referral: 'Referência',
  walk_in: 'Presencial',
  phone_call: 'Telefone',
  social_media: 'Redes sociais',
  other: 'Outro',
}

const DISCOVERY_LABELS: Record<string, string> = {
  internet: 'Internet',
  magazine: 'Revista',
  sign: 'Placa de venda',
  storefront: 'Montra de loja',
  flyers: 'Folhetos',
  agent: 'Agente',
  other: 'Outro',
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}
function round1(n: number | null): number | null {
  return n == null ? null : Math.round(n * 10) / 10
}

/** Aplica filtro de período (created_at/date) a um query builder do PostgREST. */
function applyPeriod(q: any, column: string, from: string | null, to: string | null) {
  let out = q
  if (from) out = out.gte(column, from)
  if (to) out = out.lte(column, `${to}T23:59:59`)
  return out
}

export async function aggregateOwnerReportData(
  admin: any,
  propertyId: string,
  config: OwnerReportConfig,
  generatedByName: string | null,
  nowIso: string,
): Promise<OwnerReportData> {
  const { periodFrom, periodTo } = config

  // ── Imóvel + capa ──────────────────────────────────────────────────
  const { data: prop } = await admin
    .from('dev_properties')
    .select(
      `id, title, external_ref, address_street, address_parish, postal_code, city, zone,
       listing_price, energy_certificate, created_at,
       dev_property_media(url, is_cover, order_index, media_type)`,
    )
    .eq('id', propertyId)
    .maybeSingle()

  const media: any[] = prop?.dev_property_media ?? []
  const images = media
    .filter((m) => (m.media_type ?? 'image') === 'image')
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  const coverUrl =
    images.find((m) => m.is_cover)?.url ?? images[0]?.url ?? null

  const listingPrice = prop?.listing_price != null ? Number(prop.listing_price) : null
  const createdAt: string | null = prop?.created_at ?? null
  const daysOnMarket = createdAt
    ? Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(createdAt)) / 86_400_000))
    : null

  const addressLine = [prop?.address_street, prop?.address_parish]
    .filter(Boolean)
    .join(', ') || null

  // ── Visitas ────────────────────────────────────────────────────────
  const visitsRes = await applyPeriod(
    admin.from('visits').select('status, feedback_interest, created_at').eq('property_id', propertyId),
    'created_at',
    periodFrom,
    periodTo,
  )
  const visitRows: any[] = visitsRes.data ?? []
  const vc = (s: string) => visitRows.filter((v) => v.status === s).length
  const visits = {
    total: visitRows.length,
    scheduled: vc('scheduled'),
    completed: vc('completed'),
    noShow: vc('no_show'),
    cancelled: vc('cancelled'),
    rejected: vc('rejected'),
    proposal: vc('proposal'),
  }
  const interest = {
    very_interested: visitRows.filter((v) => v.feedback_interest === 'very_interested').length,
    interested: visitRows.filter((v) => v.feedback_interest === 'interested').length,
    neutral: visitRows.filter((v) => v.feedback_interest === 'neutral').length,
    not_interested: visitRows.filter((v) => v.feedback_interest === 'not_interested').length,
  }

  // ── Fichas de visita (consentidas, k-anonimato) ────────────────────
  const fichasRes = await applyPeriod(
    admin
      .from('visit_fichas')
      .select(
        `consent_share_with_owner, would_buy, perceived_value, discovery_source,
         rating_floorplan, rating_construction, rating_finishes, rating_sun_exposition,
         rating_location, rating_value, rating_overall, rating_agent_service, created_at`,
      )
      .eq('property_id', propertyId),
    'created_at',
    periodFrom,
    periodTo,
  )
  const consented: any[] = (fichasRes.data ?? []).filter(
    (f: any) => f.consent_share_with_owner === true,
  )
  const threshold = Math.max(1, config.minFichas || 1)
  const meetsThreshold = consented.length >= threshold

  const avgRatings = RATING_FIELDS.map((rf) => {
    const vals = consented
      .map((f) => f[rf.key])
      .filter((n): n is number => typeof n === 'number')
    return { key: rf.key, label: rf.label, avg: round1(avg(vals)) ?? 0, count: vals.length }
  }).filter((r) => r.count > 0)

  const dims = avgRatings.filter((r) => r.key !== 'rating_overall')
  const sortedDims = [...dims].sort((a, b) => a.avg - b.avg)
  const lowestDimension = sortedDims[0]
    ? { label: sortedDims[0].label, avg: sortedDims[0].avg }
    : null
  const highestDimension = sortedDims[sortedDims.length - 1]
    ? {
        label: sortedDims[sortedDims.length - 1].label,
        avg: sortedDims[sortedDims.length - 1].avg,
      }
    : null

  const wouldBuyYes = consented.filter((f) => f.would_buy === true).length
  const wouldBuyNo = consented.filter((f) => f.would_buy === false).length
  const wouldBuyTotal = wouldBuyYes + wouldBuyNo
  const avgPerceivedValue = round1(
    avg(
      consented
        .map((f) => (f.perceived_value != null ? Number(f.perceived_value) : null))
        .filter((n): n is number => typeof n === 'number'),
    ),
  )

  const discoveryCounts: Record<string, number> = {}
  for (const f of consented) {
    if (f.discovery_source) {
      discoveryCounts[f.discovery_source] = (discoveryCounts[f.discovery_source] ?? 0) + 1
    }
  }
  const discoveryBreakdown = Object.entries(discoveryCounts)
    .map(([k, count]) => ({ label: DISCOVERY_LABELS[k] ?? k, count }))
    .sort((a, b) => b.count - a.count)

  const fichas: OwnerReportData['fichas'] = {
    consideredCount: consented.length,
    meetsThreshold,
    threshold,
    avgRatings: meetsThreshold
      ? avgRatings.map(({ key, label, avg }) => ({ key, label, avg }))
      : [],
    avgOverall: meetsThreshold
      ? round1(avgRatings.find((r) => r.key === 'rating_overall')?.avg ?? null)
      : null,
    avgPerceivedValue: meetsThreshold ? avgPerceivedValue : null,
    wouldBuyYes: meetsThreshold ? wouldBuyYes : 0,
    wouldBuyNo: meetsThreshold ? wouldBuyNo : 0,
    wouldBuyPct:
      meetsThreshold && wouldBuyTotal > 0
        ? Math.round((wouldBuyYes / wouldBuyTotal) * 100)
        : null,
    lowestDimension: meetsThreshold ? lowestDimension : null,
    highestDimension: meetsThreshold ? highestDimension : null,
    discoveryBreakdown: meetsThreshold ? discoveryBreakdown : [],
  }

  // ── Leads (entries) atribuídas ao imóvel ───────────────────────────
  const entriesRes = await applyPeriod(
    admin.from('leads_entries').select('source, campaign_id, created_at').eq('property_id', propertyId),
    'created_at',
    periodFrom,
    periodTo,
  )
  const entries: any[] = entriesRes.data ?? []
  const sourceCounts: Record<string, number> = {}
  for (const e of entries) {
    const s = e.source || 'other'
    sourceCounts[s] = (sourceCounts[s] ?? 0) + 1
  }
  const leads = {
    total: entries.length,
    bySource: Object.entries(sourceCounts)
      .map(([source, count]) => ({ source: SOURCE_LABELS[source] ?? source, count }))
      .sort((a, b) => b.count - a.count),
  }

  // ── Campanhas Meta ─────────────────────────────────────────────────
  // Fonte canónica do vínculo campanha↔imóvel: `leads_assignment_rules`
  // (a mesma usada na tab "Campanhas" do imóvel). As leads atribuídas vivem em
  // `leads_entries` (property_id + source='meta_ads') com o meta id em
  // `form_data`. As métricas (impressões/cliques/gasto) vêm de `leads_campaigns`
  // (external_campaign_id / external_ad_id) ↔ `leads_campaign_metrics`.
  let meta: OwnerReportData['meta'] = {
    hasData: false,
    mode: config.metaMode,
    showSpend: config.metaShowSpend,
    campaigns: [],
    totals: { impressions: 0, clicks: 0, leads: 0, estSpend: 0 },
  }

  const { data: rules } = await admin
    .from('leads_assignment_rules')
    .select('id, name, campaign_external_id_match, ad_id_match')
    .eq('property_id', propertyId)

  if (rules && rules.length) {
    const metaEntriesRes = await applyPeriod(
      admin
        .from('leads_entries')
        .select('form_data, created_at')
        .eq('property_id', propertyId)
        .eq('source', 'meta_ads'),
      'created_at',
      periodFrom,
      periodTo,
    )
    const metaEntries: any[] = metaEntriesRes.data ?? []

    const campExtIds = rules
      .filter((r: any) => !r.ad_id_match && r.campaign_external_id_match)
      .map((r: any) => r.campaign_external_id_match)
    const adExtIds = rules.filter((r: any) => r.ad_id_match).map((r: any) => r.ad_id_match)

    // leads_campaigns que correspondem aos meta ids → id interno + métricas
    const campaignRows: any[] = []
    if (campExtIds.length) {
      const r = await admin
        .from('leads_campaigns')
        .select('id, name, external_campaign_id, external_ad_id')
        .in('external_campaign_id', campExtIds)
      campaignRows.push(...(r.data ?? []))
    }
    if (adExtIds.length) {
      const r = await admin
        .from('leads_campaigns')
        .select('id, name, external_campaign_id, external_ad_id')
        .in('external_ad_id', adExtIds)
      campaignRows.push(...(r.data ?? []))
    }
    const byCampExt: Record<string, any> = {}
    const byAdExt: Record<string, any> = {}
    for (const c of campaignRows) {
      if (c.external_campaign_id) byCampExt[c.external_campaign_id] = c
      if (c.external_ad_id) byAdExt[c.external_ad_id] = c
    }

    const internalIds = Array.from(new Set(campaignRows.map((c) => c.id)))
    const metricsByCampaign: Record<
      string,
      { impressions: number; clicks: number; spend: number; platformLeads: number }
    > = {}
    if (internalIds.length) {
      const mRes = await applyPeriod(
        admin
          .from('leads_campaign_metrics')
          .select('campaign_id, impressions, clicks, spend, platform_leads, date')
          .in('campaign_id', internalIds),
        'date',
        periodFrom,
        periodTo,
      )
      for (const m of mRes.data ?? []) {
        const acc = (metricsByCampaign[m.campaign_id] ??= {
          impressions: 0,
          clicks: 0,
          spend: 0,
          platformLeads: 0,
        })
        acc.impressions += m.impressions ?? 0
        acc.clicks += m.clicks ?? 0
        acc.spend += m.spend != null ? Number(m.spend) : 0
        acc.platformLeads += m.platform_leads ?? 0
      }
    }

    const campaigns = rules.map((r: any) => {
      const scope = r.ad_id_match ? 'ad' : 'campaign'
      const metaId = scope === 'ad' ? r.ad_id_match : r.campaign_external_id_match
      const key = scope === 'ad' ? 'meta_ad_id' : 'meta_campaign_id'
      const leadsForProperty = metaEntries.filter((e) => e.form_data?.[key] === metaId).length
      const internal = scope === 'ad' ? byAdExt[metaId] : byCampExt[metaId]
      const m = internal ? metricsByCampaign[internal.id] : undefined
      // Valores reais da campanha (impressões/cliques/investimento) — sem rateio.
      return {
        name: ((r.name as string) || internal?.name || 'Campanha').replace(/^\[Meta\]\s*/, ''),
        platform: 'meta' as string | null,
        leadsForProperty,
        totalLeads: leadsForProperty,
        ratio: 1,
        impressions: m?.impressions ?? 0,
        clicks: m?.clicks ?? 0,
        estSpend: Math.round((m?.spend ?? 0) * 100) / 100,
      }
    })

    const totals = campaigns.reduce(
      (
        acc: { impressions: number; clicks: number; leads: number; estSpend: number },
        c: any,
      ) => ({
        impressions: acc.impressions + c.impressions,
        clicks: acc.clicks + c.clicks,
        leads: acc.leads + c.leadsForProperty,
        estSpend: Math.round((acc.estSpend + c.estSpend) * 100) / 100,
      }),
      { impressions: 0, clicks: 0, leads: 0, estSpend: 0 },
    )

    meta = {
      hasData: true,
      mode: config.metaMode,
      showSpend: config.metaShowSpend,
      campaigns,
      // Total de leads = todas as entradas Meta do imóvel (mais inclusivo do que
      // o match por meta id de cada regra).
      totals: { ...totals, leads: metaEntries.length },
    }
  }

  // ── Funil ──────────────────────────────────────────────────────────
  // "Interessados" = sinal de interesse das visitas concluídas (muito/interessado);
  // se não houver feedback de visita, recorre ao "compraria" das fichas. Limitado
  // a visitas realizadas para manter o funil monótono (cada etapa ⊆ anterior).
  const interestSignal = interest.very_interested + interest.interested
  const interestedTotal = Math.min(
    visits.completed,
    interestSignal > 0 ? interestSignal : wouldBuyYes,
  )
  const funnel = {
    impressions: meta.hasData ? meta.totals.impressions : null,
    clicks: meta.hasData ? meta.totals.clicks : null,
    leads: leads.total,
    visitRequests: visits.total,
    visitsDone: visits.completed,
    interested: interestedTotal,
  }

  // ── Portais (manual) ───────────────────────────────────────────────
  const pv = config.portalViews
  const portalNums = [pv.idealista, pv.imovirtual, pv.casaSapo, pv.website].filter(
    (n): n is number => typeof n === 'number',
  )
  const portalViews = {
    ...pv,
    total: portalNums.length ? portalNums.reduce((a, b) => a + b, 0) : null,
  }

  // ── Preço pedido vs. valor percebido ───────────────────────────────
  const priceComparison = {
    listingPrice,
    avgPerceivedValue: fichas.avgPerceivedValue,
    deltaPct:
      listingPrice && fichas.avgPerceivedValue
        ? Math.round(((fichas.avgPerceivedValue - listingPrice) / listingPrice) * 1000) / 10
        : null,
  }

  return {
    property: {
      id: propertyId,
      title: prop?.title ?? null,
      externalRef: prop?.external_ref ?? null,
      addressLine,
      city: prop?.city ?? null,
      zone: prop?.zone ?? null,
      listingPrice,
      energyCertificate: prop?.energy_certificate ?? null,
      coverUrl,
      createdAt,
    },
    generatedAt: nowIso,
    generatedByName,
    daysOnMarket,
    period: { from: periodFrom, to: periodTo },
    visits,
    funnel,
    fichas,
    interest,
    leads,
    meta,
    portalViews,
    priceComparison,
    agentNote: config.agentNote,
  }
}
