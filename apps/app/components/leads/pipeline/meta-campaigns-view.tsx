'use client'

/**
 * CRM → Análise → Meta tab (management view).
 *
 * Mirrors the Meta Ads page (/dashboard/meta-ads → tab Campanhas): summary
 * metric cards on top, then an accordion table of campaigns. Each campaign row
 * expands (dropdown) to reveal its ads with per-object insights; the eye button
 * opens the detail (inline campaign drill-in, or the ad detail page for ads).
 *
 * Adsets aren't synced as their own entity (no names in the mirror), so ads are
 * nested directly under the campaign instead of campaign → adset → ad.
 *
 * Management-only data (all campaigns) comes from /api/analise-meta/campaigns.
 * Consultores (no management role) get a 403 there and fall back to the
 * "attributed to me" summary in <MetaTab>.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  Loader2,
  Target,
  ArrowLeft,
  Search,
  ChevronDown,
  Filter as FunnelIcon,
  Image as ImageIcon,
  Layers,
  Euro,
  Eye,
  MousePointerClick,
  Megaphone,
  Users,
  CheckCircle2,
  Wallet,
  Play,
  Pause,
  Percent,
  Gauge,
  Radar,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  formatCampaignObjective,
  formatEur,
  formatMetaBudgetCents,
  formatMetaInt,
  formatMetaPct,
  formatMetaStatus,
  metaStatusVariant,
} from '@/lib/meta/labels'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { AttributionPanel } from '@/components/analise-meta/attribution-panel'
import { AdDetailSheet } from '@/components/analise-meta/ad-detail-sheet'
import { CreateCampaignSheet } from '@/components/analise-meta/create-campaign-sheet'
import { toggleMetaEntityStatus } from '@/lib/meta/graph-actions'
import type {
  MetaCampaignListItem,
  MetaCampaignDetail,
  MetaCampaignAdItem,
  MetaCampaignAdsetGroup,
} from '@/lib/meta/campaign-queries'

import { MetaTab } from './meta-tab'

const PAGE_SIZE = 30
const GLASS = 'rounded-2xl border border-border/40 bg-card/60 shadow-sm backdrop-blur-xl'

// Mirror of the sentinel in campaign-queries (kept local to avoid bundling the
// server query module into this client component).
const NO_ADSET = '__none__'

// Lets a deeply-nested ad row open the shared <AdDetailSheet> without threading
// a callback through CampaignRow → AdsetRow → AdRow. Both the list grid and the
// inline campaign detail provide their own opener + render the sheet.
const OpenAdContext = createContext<(adId: string) => void>(() => {})

interface GlobalTotals {
  spend: number
  impressions: number
  clicks: number
  leads: number
  currency: string | null
}

function ctrOf(impressions: number | null, clicks: number | null): number | null {
  if (!impressions || impressions <= 0) return null
  return ((clicks ?? 0) / impressions) * 100
}

function cplOf(spend: number | null, leads: number | null): number | null {
  if (spend === null || !leads || leads <= 0) return null
  return spend / leads
}

export function MetaCampaignsView({
  from,
  to,
  consultantId,
}: {
  from?: string
  to?: string
  consultantId?: string | null
} = {}) {
  // Account-wide totals for the metric cards (independent of pagination).
  const [totals, setTotals] = useState<GlobalTotals>({
    spend: 0,
    impressions: 0,
    clicks: 0,
    leads: 0,
    currency: null,
  })

  // Grid access: management sees all campaigns; consultores fall back.
  const [access, setAccess] = useState<'loading' | 'grid' | 'fallback'>('loading')

  // Campaign list.
  const [campaigns, setCampaigns] = useState<MetaCampaignListItem[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const [page, setPage] = useState(1)
  const [listLoading, setListLoading] = useState(true)

  // Accordion expansion + lazily-loaded adset groups per campaign.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [groupsByCampaign, setGroupsByCampaign] = useState<
    Record<string, MetaCampaignAdsetGroup[] | 'loading'>
  >({})

  // Inline drill-in (campaign detail via the eye button).
  const [selected, setSelected] = useState<{ id: string; name: string | null } | null>(null)
  // Ad detail opens in a sheet (consistent with the leads flow), not a page.
  const [openAdId, setOpenAdId] = useState<string | null>(null)
  // Create-campaign sheet (management). reloadKey forces a list refetch after.
  const [createOpen, setCreateOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Campaign list + global totals — refetch on search / page change.
  // (Filter changes remount the component via a `key` in the parent, so page /
  // expansion / cache reset to their initial state automatically.)
  useEffect(() => {
    let active = true
    setListLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim())
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (consultantId) params.set('consultant_id', consultantId)
    fetch(`/api/analise-meta/campaigns?${params}`)
      .then(async (r) => {
        if (r.status === 403) {
          if (active) setAccess('fallback')
          return null
        }
        return r.json()
      })
      .then((j) => {
        if (!active || !j) return
        setAccess('grid')
        setCampaigns(j.campaigns ?? [])
        setTotal(j.total ?? 0)
        if (j.totals) setTotals(j.totals)
        // Collapse any open rows when the page/search changes.
        setExpanded(new Set())
      })
      .catch(() => {})
      .finally(() => {
        if (active) setListLoading(false)
      })
    return () => {
      active = false
    }
  }, [debouncedQuery, page, from, to, consultantId, reloadKey])

  // Reset to page 1 whenever the search term changes.
  const onSearch = useCallback((v: string) => {
    setQuery(v)
    setPage(1)
  }, [])

  const toggleCampaign = useCallback(
    (campaignId: string) => {
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(campaignId)) {
          next.delete(campaignId)
          return next
        }
        next.add(campaignId)
        return next
      })
      // Lazy-load the adset groups the first time the row opens.
      setGroupsByCampaign((prev) => {
        if (prev[campaignId]) return prev
        const adsParams = new URLSearchParams()
        if (from) adsParams.set('from', from)
        if (to) adsParams.set('to', to)
        const adsQs = adsParams.toString()
        fetch(`/api/analise-meta/campaigns/${encodeURIComponent(campaignId)}/ads${adsQs ? `?${adsQs}` : ''}`)
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((j) => {
            setGroupsByCampaign((cur) => ({ ...cur, [campaignId]: j.adsetGroups ?? [] }))
          })
          .catch(() => {
            setGroupsByCampaign((cur) => ({ ...cur, [campaignId]: [] }))
          })
        return { ...prev, [campaignId]: 'loading' }
      })
    },
    [from, to],
  )

  if (access === 'loading') {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
      </div>
    )
  }

  // Consultor — no access to the all-campaigns grid; show their attributed list.
  if (access === 'fallback') {
    return <MetaTab from={from} to={to} />
  }

  // Inline campaign detail.
  if (selected) {
    return (
      <CampaignDetailInline
        campaignId={selected.id}
        campaignName={selected.name}
        from={from}
        to={to}
        onBack={() => setSelected(null)}
      />
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const avgCpl = cplOf(totals.spend, totals.leads)
  const avgCtr = ctrOf(totals.impressions, totals.clicks)

  return (
    <OpenAdContext.Provider value={setOpenAdId}>
    <div className="space-y-5">
      {/* Summary metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={Euro} label="Gasto total" value={formatEur(totals.spend, totals.currency)} color="text-red-500" />
        <MetricCard icon={Target} label="Custo por lead" value={avgCpl !== null ? formatEur(avgCpl, totals.currency) : '—'} color="text-[#1877F2]" />
        <MetricCard icon={Eye} label="Impressões" value={formatMetaInt(totals.impressions)} />
        <MetricCard
          icon={MousePointerClick}
          label="Cliques"
          value={formatMetaInt(totals.clicks)}
          sub={avgCtr !== null ? `CTR: ${formatMetaPct(avgCtr)}` : undefined}
        />
      </div>

      {/* Search + count */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Pesquisar campanha…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-muted-foreground text-xs tabular-nums">
            {total} campanha{total === 1 ? '' : 's'}
          </p>
          <Button
            size="sm"
            className="gap-1.5 rounded-full bg-[#1877F2] text-white hover:bg-[#1877F2]/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Criar campanha
          </Button>
        </div>
      </div>

      {/* Accordion table */}
      {listLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar campanhas…
        </div>
      ) : campaigns.length === 0 ? (
        <div className={`${GLASS} text-muted-foreground p-10 text-center text-sm`}>
          {debouncedQuery.trim()
            ? 'Nenhuma campanha corresponde à pesquisa.'
            : 'Ainda não há campanhas Meta sincronizadas.'}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
                  <th className={TH}>Gasto</th>
                  <th className={TH}>Impressões</th>
                  <th className={TH}>Cliques</th>
                  <th className={TH}>CTR</th>
                  <th className={TH}>Leads</th>
                  <th className={TH}>CPL</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <CampaignRow
                    key={c.id}
                    campaign={c}
                    expanded={expanded.has(c.campaign_id)}
                    groups={groupsByCampaign[c.campaign_id]}
                    onToggle={() => toggleCampaign(c.campaign_id)}
                    onOpenDetail={() => setSelected({ id: c.campaign_id, name: c.name })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || listLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || listLoading}
            onClick={() => setPage((p) => p + 1)}
          >
            Seguinte
          </Button>
        </div>
      )}

      <AdDetailSheet adId={openAdId} open={!!openAdId} onOpenChange={(o) => !o && setOpenAdId(null)} />
      <CreateCampaignSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => setReloadKey((k) => k + 1)}
      />
    </div>
    </OpenAdContext.Provider>
  )
}

const TH = 'text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Target
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Icon className={cn('h-3.5 w-3.5', color ?? 'text-muted-foreground')} />
          <p className="text-muted-foreground text-xs">{label}</p>
        </div>
        <p className={cn('text-xl font-bold', color ?? 'text-foreground')}>{value}</p>
        {sub && <p className="text-muted-foreground mt-0.5 text-[10px]">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function CampaignRow({
  campaign: c,
  expanded,
  groups,
  onToggle,
  onOpenDetail,
}: {
  campaign: MetaCampaignListItem
  expanded: boolean
  groups: MetaCampaignAdsetGroup[] | 'loading' | undefined
  onToggle: () => void
  onOpenDetail: () => void
}) {
  // Which adset groups are open (keyed by adset_id). Local to this campaign.
  const [openAdsets, setOpenAdsets] = useState<Set<string>>(new Set())
  const toggleAdset = (adsetId: string) =>
    setOpenAdsets((prev) => {
      const next = new Set(prev)
      if (next.has(adsetId)) next.delete(adsetId)
      else next.add(adsetId)
      return next
    })

  const budget = formatMetaBudgetCents(c.daily_budget) !== '—'
    ? formatMetaBudgetCents(c.daily_budget)
    : formatMetaBudgetCents(c.lifetime_budget) !== '—'
      ? formatMetaBudgetCents(c.lifetime_budget)
      : null
  const ctr = ctrOf(c.impressions, c.clicks)
  const cpl = cplOf(c.spend, c.leads_count)

  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          'border-b cursor-pointer transition-colors',
          expanded ? 'bg-[#1877F2]/[0.03] dark:bg-[#1877F2]/[0.06]' : 'bg-card hover:bg-muted/50',
        )}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <ChevronDown
              className={cn(
                'h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200',
                !expanded && '-rotate-90',
              )}
            />
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1877F2]/10">
              <FunnelIcon className="h-3.5 w-3.5 text-[#1877F2]" />
            </div>
            <div className="min-w-0">
              <p className="max-w-[260px] truncate text-sm font-medium text-foreground">
                {c.name ?? c.campaign_id}
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <Badge variant={metaStatusVariant(c.status)} className="text-[10px]">
                  {formatMetaStatus(c.status)}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {formatCampaignObjective(c.objective)}
                </span>
                {budget && (
                  <>
                    <span className="text-border">·</span>
                    <span className="text-[10px] text-muted-foreground">
                      {c.daily_budget ? `${budget}/dia` : budget}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </td>
        <Num value={c.spend !== null ? formatEur(c.spend, c.currency) : '—'} />
        <Num value={formatMetaInt(c.impressions)} />
        <Num value={formatMetaInt(c.clicks)} />
        <Num value={ctr !== null ? formatMetaPct(ctr) : '—'} />
        <td className="px-4 py-3 text-right">
          <span className={cn('text-xs font-bold', c.leads_count > 0 ? 'text-[#1877F2]' : 'text-muted-foreground')}>
            {c.leads_count}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className={cn('text-xs font-semibold', cpl !== null ? 'text-[#1877F2]' : 'text-muted-foreground')}>
            {cpl !== null ? formatEur(cpl, c.currency) : '—'}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1.5">
            <StatusToggleButton level="campaign" entityId={c.campaign_id} status={c.status} />
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0"
              title="Ver detalhes"
              onClick={(e) => {
                e.stopPropagation()
                onOpenDetail()
              }}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>

      {/* Expanded: adset groups */}
      {expanded && groups === 'loading' && (
        <tr className="bg-muted/20">
          <td colSpan={8} className="px-12 py-4">
            <span className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> A carregar conjuntos e anúncios…
            </span>
          </td>
        </tr>
      )}

      {expanded && Array.isArray(groups) && groups.length === 0 && (
        <tr className="bg-muted/20">
          <td colSpan={8} className="px-12 py-3 text-xs italic text-muted-foreground">
            Sem anúncios nesta campanha.
          </td>
        </tr>
      )}

      {expanded &&
        Array.isArray(groups) &&
        groups.map((g) => (
          <AdsetRow
            key={g.adset_id}
            group={g}
            expanded={openAdsets.has(g.adset_id)}
            onToggle={() => toggleAdset(g.adset_id)}
          />
        ))}
    </>
  )
}

function AdsetRow({
  group: g,
  expanded,
  onToggle,
}: {
  group: MetaCampaignAdsetGroup
  expanded: boolean
  onToggle: () => void
}) {
  const isNone = g.adset_id === NO_ADSET
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          'border-b cursor-pointer transition-colors',
          expanded ? 'bg-muted/50' : 'bg-muted/30 hover:bg-muted/50',
        )}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2 pl-8">
            <ChevronDown
              className={cn(
                'h-2.75 w-2.75 shrink-0 text-muted-foreground transition-transform duration-200',
                !expanded && '-rotate-90',
              )}
            />
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
              <Layers className="h-2.75 w-2.75 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="max-w-[220px] truncate text-xs font-medium text-foreground">
                  {isNone ? 'Sem conjunto de anúncios' : (g.name ?? 'Conjunto de anúncios')}
                </p>
                {g.status && !isNone && (
                  <Badge variant={metaStatusVariant(g.status)} className="text-[9px]">
                    {formatMetaStatus(g.status)}
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                {!isNone && (
                  <span className="font-mono text-[9px] text-muted-foreground">{g.adset_id}</span>
                )}
                <span className="text-[9px] text-muted-foreground">
                  {g.ads.length} {g.ads.length === 1 ? 'anúncio' : 'anúncios'}
                </span>
              </div>
            </div>
          </div>
        </td>
        <Num value={g.spend !== null ? formatEur(g.spend, g.currency) : '—'} size="sm" />
        <Num value={formatMetaInt(g.impressions)} size="sm" />
        <Num value={formatMetaInt(g.clicks)} size="sm" />
        <Num value={g.ctr !== null ? formatMetaPct(g.ctr) : '—'} size="sm" />
        <td className="px-4 py-2.5 text-right">
          <span className={cn('text-[11px] font-bold', g.leads_count > 0 ? 'text-[#1877F2]' : 'text-muted-foreground')}>
            {g.leads_count}
          </span>
        </td>
        <td className="px-4 py-2.5 text-right">
          <span className={cn('text-[11px] font-semibold', g.cost_per_lead !== null ? 'text-[#1877F2]' : 'text-muted-foreground')}>
            {g.cost_per_lead !== null ? formatEur(g.cost_per_lead, g.currency) : '—'}
          </span>
        </td>
        <td className="px-4 py-2.5">
          {!isNone && <StatusToggleButton level="adset" entityId={g.adset_id} status={g.status} />}
        </td>
      </tr>

      {expanded && g.ads.map((ad) => <AdRow key={ad.id} ad={ad} />)}
    </>
  )
}

function AdRow({ ad }: { ad: MetaCampaignAdItem }) {
  const openAd = useContext(OpenAdContext)
  return (
    <tr className="border-b bg-muted/20 transition-colors hover:bg-muted/40">
      <td className="px-4 py-2">
        <div className="flex items-center gap-2 pl-16">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-purple-500/10">
            <ImageIcon className="h-2.5 w-2.5 text-purple-500" />
          </div>
          <div className="min-w-0">
            <p className="max-w-[200px] truncate text-[11px] font-medium text-foreground">
              {ad.name ?? ad.ad_id}
            </p>
            <Badge variant={metaStatusVariant(ad.status)} className="mt-0.5 text-[9px]">
              {formatMetaStatus(ad.status)}
            </Badge>
          </div>
        </div>
      </td>
      <Num value={ad.spend !== null ? formatEur(ad.spend, ad.currency) : '—'} size="sm" />
      <Num value={formatMetaInt(ad.impressions)} size="sm" />
      <Num value={formatMetaInt(ad.clicks)} size="sm" />
      <Num value={ad.ctr !== null ? formatMetaPct(ad.ctr) : '—'} size="sm" />
      <td className="px-4 py-2.5 text-right">
        <span className={cn('text-[11px] font-bold', ad.leads_count > 0 ? 'text-[#1877F2]' : 'text-muted-foreground')}>
          {ad.leads_count}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className={cn('text-[11px] font-semibold', ad.cost_per_lead !== null ? 'text-[#1877F2]' : 'text-muted-foreground')}>
          {ad.cost_per_lead !== null ? formatEur(ad.cost_per_lead, ad.currency) : '—'}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          <StatusToggleButton level="ad" entityId={ad.ad_id} status={ad.status} />
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            title="Ver detalhes"
            onClick={() => openAd(ad.ad_id)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

// PT-PT copy per level, with gender agreement for the result toast.
const TOGGLE_COPY: Record<'campaign' | 'adset' | 'ad', { noun: string; on: string; off: string }> = {
  campaign: { noun: 'Campanha', on: 'activada', off: 'pausada' },
  adset: { noun: 'Conjunto', on: 'activado', off: 'pausado' },
  ad: { noun: 'Anúncio', on: 'activado', off: 'pausado' },
}

/**
 * Icon-only pause/activate toggle for a campaign/adset/ad row (management). Holds
 * its own optimistic status so the row reflects the change immediately, and
 * confirms with a result toast ("Anúncio pausado", "Campanha activada", …).
 * Renders nothing when the current status isn't a togglable ACTIVE/PAUSED.
 */
function StatusToggleButton({
  level,
  entityId,
  status,
}: {
  level: 'campaign' | 'adset' | 'ad'
  entityId: string
  status: string | null
}) {
  const [override, setOverride] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const current = (override ?? status ?? '').toUpperCase()
  if (current !== 'ACTIVE' && current !== 'PAUSED') return null
  const isActive = current === 'ACTIVE'
  const copy = TOGGLE_COPY[level]

  async function onClick(e: React.MouseEvent) {
    e.stopPropagation()
    const next = isActive ? 'PAUSED' : 'ACTIVE'
    setBusy(true)
    const res = await toggleMetaEntityStatus(level, entityId, next)
    setBusy(false)
    if (res.success) {
      setOverride(next)
      toast.success(`${copy.noun} ${next === 'ACTIVE' ? copy.on : copy.off}`)
    } else {
      toast.error(res.error ?? 'Não foi possível alterar o estado.')
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="h-7 w-7 shrink-0"
      title={isActive ? `Pausar ${copy.noun.toLowerCase()}` : `Activar ${copy.noun.toLowerCase()}`}
      disabled={busy}
      onClick={onClick}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isActive ? (
        <Pause className="h-3.5 w-3.5" />
      ) : (
        <Play className="h-3.5 w-3.5" />
      )}
    </Button>
  )
}

function Num({ value, size = 'md' }: { value: string; size?: 'sm' | 'md' }) {
  return (
    <td
      className={cn(
        'px-4 text-right text-foreground tabular-nums',
        size === 'sm' ? 'py-2.5 text-[11px]' : 'py-3 text-xs',
      )}
    >
      {value}
    </td>
  )
}

function CampaignDetailInline({
  campaignId,
  campaignName,
  from,
  to,
  onBack,
}: {
  campaignId: string
  campaignName: string | null
  from?: string
  to?: string
  onBack: () => void
}) {
  const [detail, setDetail] = useState<MetaCampaignDetail | null>(null)
  const [groups, setGroups] = useState<MetaCampaignAdsetGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // Ad detail opens in a sheet (not a page), like the rest of the meta tab.
  const [openAdId, setOpenAdId] = useState<string | null>(null)
  // Which adset groups are open in the funnel table.
  const [openAdsets, setOpenAdsets] = useState<Set<string>>(new Set())
  const toggleAdset = (adsetId: string) =>
    setOpenAdsets((prev) => {
      const next = new Set(prev)
      if (next.has(adsetId)) next.delete(adsetId)
      else next.add(adsetId)
      return next
    })
  // Live status toggle (management). `statusOverride` reflects the change before
  // the next sync; the server action also patches the mirror row.
  const [statusOverride, setStatusOverride] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    const qs = new URLSearchParams()
    if (from) qs.set('from', from)
    if (to) qs.set('to', to)
    const suffix = qs.toString() ? `?${qs}` : ''
    const id = encodeURIComponent(campaignId)
    Promise.all([
      fetch(`/api/analise-meta/campaigns/${id}${suffix}`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(`/api/analise-meta/campaigns/${id}/ads${suffix}`).then((r) => (r.ok ? r.json() : { adsetGroups: [] })),
    ])
      .then(([d, a]) => {
        if (!active) return
        setDetail(d)
        setGroups(a.adsetGroups ?? [])
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [campaignId, from, to])

  const k = detail?.insightKpis
  const perfPeriod =
    k?.firstDay && k?.lastDay ? (k.firstDay === k.lastDay ? k.firstDay : `${k.firstDay} → ${k.lastDay}`) : null
  const currentStatus = statusOverride ?? detail?.campaign.status ?? null
  const statusUp = (currentStatus ?? '').toUpperCase()
  const canToggle = statusUp === 'ACTIVE' || statusUp === 'PAUSED'
  const isActive = statusUp === 'ACTIVE'

  async function onToggleStatus() {
    if (!detail) return
    const next = isActive ? 'PAUSED' : 'ACTIVE'
    setToggling(true)
    const res = await toggleMetaEntityStatus('campaign', detail.campaign.campaign_id, next)
    setToggling(false)
    if (res.success) {
      setStatusOverride(next)
      toast.success(next === 'PAUSED' ? 'Campanha pausada' : 'Campanha activada')
    } else {
      toast.error(res.error ?? 'Não foi possível alterar o estado.')
    }
  }

  return (
    <OpenAdContext.Provider value={setOpenAdId}>
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-3" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        Campanhas
      </Button>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar campanha…
        </div>
      ) : error || !detail || !k ? (
        <div className="text-destructive text-sm">Erro a carregar a campanha.</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Target className="text-muted-foreground h-5 w-5" />
            <h1 className="text-2xl font-semibold tracking-tight">
              {detail.campaign.name ?? campaignName ?? '(sem nome)'}
            </h1>
            <Badge variant={metaStatusVariant(currentStatus)} className="text-[10px]">
              {formatMetaStatus(currentStatus)}
            </Badge>
            {canToggle && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-8 gap-1.5 rounded-full"
                disabled={toggling}
                onClick={onToggleStatus}
              >
                {toggling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isActive ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {isActive ? 'Pausar' : 'Activar'}
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {formatCampaignObjective(detail.campaign.objective)}
          </p>

          {/* Performance — full metric grid (mirrors the old Meta Ads page) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Desempenho</p>
              {perfPeriod && <span className="text-muted-foreground/70 text-[11px] tabular-nums">{perfPeriod}</span>}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard icon={Euro} label="Gasto" value={formatEur(k.spend, k.currency)} color="text-red-500" />
              <MetricCard
                icon={Target}
                label="Custo / lead"
                value={k.costPerLead !== null ? formatEur(k.costPerLead, k.currency) : '—'}
                color="text-[#1877F2]"
              />
              <MetricCard icon={Eye} label="Impressões" value={formatMetaInt(k.impressions)} />
              <MetricCard icon={Radar} label="Alcance" value={formatMetaInt(k.reach)} />
              <MetricCard icon={MousePointerClick} label="Cliques" value={formatMetaInt(k.clicks)} />
              <MetricCard icon={Percent} label="CTR" value={k.ctr !== null ? formatMetaPct(k.ctr) : '—'} />
              <MetricCard icon={Euro} label="CPC" value={k.cpc !== null ? formatEur(k.cpc, k.currency) : '—'} />
              <MetricCard
                icon={Gauge}
                label="CPM"
                value={k.cpm !== null ? formatEur(k.cpm, k.currency) : '—'}
                sub={k.frequency !== null ? `Freq. ${k.frequency.toFixed(2)}` : undefined}
              />
            </div>
          </div>

          {/* Funnel — ads / leads / CRM / budget */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard icon={Megaphone} label="Anúncios" value={formatMetaInt(detail.kpis.ads)} />
            <MetricCard icon={Users} label="Leads" value={formatMetaInt(detail.kpis.leads)} color="text-[#1877F2]" />
            <MetricCard icon={CheckCircle2} label="No CRM" value={formatMetaInt(detail.kpis.inCrm)} color="text-emerald-600" />
            <MetricCard icon={Wallet} label="Orçamento/dia" value={detail.kpis.dailyBudget} />
          </div>

          {/* Attribution */}
          <div className={`${GLASS} p-4`}>
            <AttributionPanel
              scope="campaign"
              targetId={detail.campaign.campaign_id}
              targetName={detail.campaign.name}
              bare
            />
          </div>

          {/* Conjuntos e anúncios — same accordion table as the list expansion */}
          <section className="space-y-2.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="text-muted-foreground h-3.5 w-3.5" />
              Conjuntos e anúncios
            </h3>
            {groups.length === 0 ? (
              <div className={`${GLASS} text-muted-foreground p-8 text-center text-sm`}>
                Nenhum anúncio sincronizado para esta campanha.
              </div>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conjunto / Anúncio</th>
                        <th className={TH}>Gasto</th>
                        <th className={TH}>Impressões</th>
                        <th className={TH}>Cliques</th>
                        <th className={TH}>CTR</th>
                        <th className={TH}>Leads</th>
                        <th className={TH}>CPL</th>
                        <th className="w-10 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g) => (
                        <AdsetRow
                          key={g.adset_id}
                          group={g}
                          expanded={openAdsets.has(g.adset_id)}
                          onToggle={() => toggleAdset(g.adset_id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </section>
        </>
      )}

      <AdDetailSheet adId={openAdId} open={!!openAdId} onOpenChange={(o) => !o && setOpenAdId(null)} />
    </div>
    </OpenAdContext.Provider>
  )
}
