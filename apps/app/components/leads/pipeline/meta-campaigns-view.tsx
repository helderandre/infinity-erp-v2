'use client'

/**
 * CRM → Análise → Meta tab (management view).
 *
 * Mirrors the standalone "Análise Meta" page inside the CRM shell: summary KPIs
 * on top, the searchable/paginated campaign-cards grid below, and an inline
 * drill-in to the campaign detail (performance KPIs + Resumo/attribution +
 * adset funnel) — no navigation away from the tab.
 *
 * Management-only data (all campaigns) comes from /api/analise-meta/campaigns.
 * Consultores (no management role) get a 403 there and fall back to the
 * "attributed to me" summary in <MetaTab>.
 */

import { useCallback, useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Loader2,
  Target,
  Megaphone,
  Users,
  ChevronRight,
  ArrowLeft,
  Search,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  formatCampaignObjective,
  formatEur,
  formatMetaStatus,
  metaStatusVariant,
} from '@/lib/meta/labels'
import { useDebounce } from '@/hooks/use-debounce'
import { CampaignDetailTabs } from '@/components/analise-meta/campaign-detail-tabs'
import { PerformanceKpis } from '@/components/analise-meta/performance-kpis'
import type { MetaCampaignListItem, MetaCampaignDetail } from '@/lib/meta/campaign-queries'

import { MetaTab } from './meta-tab'

const PAGE_SIZE = 30
const GLASS = 'rounded-2xl border border-border/40 bg-card/60 shadow-sm backdrop-blur-xl'

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
}

function statusColor(status: string | null): string {
  const s = (status ?? '').toUpperCase()
  if (s === 'ACTIVE') return '#10b981'
  if (s === 'PAUSED') return '#f59e0b'
  if (s === 'ARCHIVED' || s === 'DELETED') return '#94a3b8'
  return '#6366f1'
}

export function MetaCampaignsView() {
  // Top KPIs (from /api/leads/meta-performance — works for both modes).
  const [totals, setTotals] = useState({ total_leads: 0, in_crm: 0, spend: 0 })

  // Grid access: management sees all campaigns; consultores fall back.
  const [access, setAccess] = useState<'loading' | 'grid' | 'fallback'>('loading')

  // Campaign list.
  const [campaigns, setCampaigns] = useState<MetaCampaignListItem[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const [page, setPage] = useState(1)
  const [listLoading, setListLoading] = useState(true)

  // Inline drill-in.
  const [selected, setSelected] = useState<{ id: string; name: string | null } | null>(null)

  // Summary KPIs — independent of grid access.
  useEffect(() => {
    let active = true
    fetch('/api/leads/meta-performance')
      .then((r) => r.json())
      .then((j) => {
        if (active) setTotals(j.totals ?? { total_leads: 0, in_crm: 0, spend: 0 })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Campaign list — refetch on search / page change.
  useEffect(() => {
    let active = true
    setListLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim())
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
      })
      .catch(() => {})
      .finally(() => {
        if (active) setListLoading(false)
      })
    return () => {
      active = false
    }
  }, [debouncedQuery, page])

  // Reset to page 1 whenever the search term changes.
  const onSearch = useCallback((v: string) => {
    setQuery(v)
    setPage(1)
  }, [])

  if (access === 'loading') {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
      </div>
    )
  }

  // Consultor — no access to the all-campaigns grid; show their attributed list.
  if (access === 'fallback') {
    return <MetaTab />
  }

  // Inline campaign detail.
  if (selected) {
    return (
      <CampaignDetailInline
        campaignId={selected.id}
        campaignName={selected.name}
        onBack={() => setSelected(null)}
      />
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Campanhas" value={total} />
        <Kpi label="Leads recebidos" value={totals.total_leads} />
        <Kpi label="No CRM" value={totals.in_crm} />
        <Kpi label="Gasto total" value={formatEur(totals.spend)} />
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
        <p className="text-muted-foreground text-xs tabular-nums">
          {total} campanha{total === 1 ? '' : 's'}
        </p>
      </div>

      {/* Grid */}
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => {
            const color = statusColor(c.status)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected({ id: c.campaign_id, name: c.name })}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-4 text-left shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1 opacity-80"
                  style={{ background: `linear-gradient(to right, ${color}, transparent)` }}
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${color}1f`, color }}
                    >
                      <Target className="h-4 w-4" />
                    </span>
                    <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
                      {c.name ?? c.campaign_id}
                    </h3>
                  </div>
                  <Badge variant={metaStatusVariant(c.status)} className="shrink-0 text-[10px]">
                    {formatMetaStatus(c.status)}
                  </Badge>
                </div>

                <p className="text-muted-foreground mt-2 text-xs">
                  {formatCampaignObjective(c.objective)}
                </p>

                <div className="text-muted-foreground mt-3 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <Megaphone className="h-3.5 w-3.5" />
                    <span className="text-foreground font-medium tabular-nums">{c.ads_count}</span> anúncios
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-foreground font-medium tabular-nums">{c.leads_count}</span> leads
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-2">
                  <span className="text-muted-foreground text-[11px]">
                    {fmtRelative(c.fb_created_time ?? c.received_at)}
                  </span>
                  <span className="text-muted-foreground/60 text-[11px] tabular-nums">
                    {c.spend
                      ? `${formatEur(c.spend, c.currency, { maximumFractionDigits: 0 })} gasto`
                      : '—'}
                  </span>
                  <ChevronRight className="text-muted-foreground/40 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            )
          })}
        </div>
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
    </div>
  )
}

function CampaignDetailInline({
  campaignId,
  campaignName,
  onBack,
}: {
  campaignId: string
  campaignName: string | null
  onBack: () => void
}) {
  const [detail, setDetail] = useState<MetaCampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    fetch(`/api/analise-meta/campaigns/${encodeURIComponent(campaignId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        if (active) setDetail(j)
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
  }, [campaignId])

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-3" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        Campanhas
      </Button>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar campanha…
        </div>
      ) : error || !detail ? (
        <div className="text-destructive text-sm">Erro a carregar a campanha.</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Target className="text-muted-foreground h-5 w-5" />
            <h1 className="text-2xl font-semibold tracking-tight">
              {detail.campaign.name ?? campaignName ?? '(sem nome)'}
            </h1>
            <Badge variant={metaStatusVariant(detail.campaign.status)} className="text-[10px]">
              {formatMetaStatus(detail.campaign.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {formatCampaignObjective(detail.campaign.objective)}
          </p>

          <PerformanceKpis kpis={detail.insightKpis} />

          <CampaignDetailTabs
            campaignId={detail.campaign.campaign_id}
            campaignName={detail.campaign.name}
            kpis={detail.kpis}
            adsetGroups={detail.adsetGroups}
            noAdLeads={detail.noAdLeads}
          />
        </>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
