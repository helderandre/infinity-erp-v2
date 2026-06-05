'use client'

/**
 * Tabs inside a campaign's detail page:
 *   1. Resumo               — KPI strip + attribution, in one card
 *   2. Conjuntos e anúncios — funnel: adset → ad cards (pipeline-card design) → forms
 *
 * Tab picker mirrors the loja (store) design — solid dark/light active pill in a
 * glass container. Clicking an ad card opens the glassmorphic AdDetailSheet
 * (no navigation away from the campaign).
 */

import { useState } from 'react'
import {
  Megaphone,
  Users,
  CheckCircle2,
  Layers,
  Info,
  Filter,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { formatMetaStatus, metaStatusVariant } from '@/lib/meta/labels'
import { AttributionPanel } from '@/components/analise-meta/attribution-panel'
import { AdDetailSheet } from '@/components/analise-meta/ad-detail-sheet'

const GLASS = 'rounded-2xl border border-border/40 bg-card/60 shadow-sm backdrop-blur-xl'

// Loja tab pill — solid dark/light active state.
const TAB_TRIGGER = cn(
  'inline-flex items-center justify-center shrink-0 gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300',
  'data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm',
  'dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900',
  'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/50',
)

export interface FunnelForm {
  form_id: string
  name: string | null
  count: number
}
export interface FunnelAd {
  id: string
  ad_id: string
  name: string | null
  status: string | null
  creative_name: string | null
  leads: number
  forms: FunnelForm[]
}
export interface FunnelAdset {
  adset_id: string
  ads: FunnelAd[]
}

function statusColor(status: string | null): string {
  const s = (status ?? '').toUpperCase()
  if (s === 'ACTIVE') return '#10b981'
  if (s === 'PAUSED') return '#f59e0b'
  if (s === 'ARCHIVED' || s === 'DELETED') return '#94a3b8'
  return '#6366f1'
}

export function CampaignDetailTabs({
  campaignId,
  campaignName,
  kpis,
  adsetGroups,
  noAdLeads,
}: {
  campaignId: string
  campaignName: string | null
  kpis: { ads: number; leads: number; inCrm: number; dailyBudget: string }
  adsetGroups: FunnelAdset[]
  noAdLeads: number
}) {
  const [openAdId, setOpenAdId] = useState<string | null>(null)

  return (
    <>
      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="inline-flex h-auto w-fit items-center gap-1 self-start rounded-full border border-border/30 bg-muted/40 p-1 shadow-sm backdrop-blur-sm">
          <TabsTrigger value="resumo" className={TAB_TRIGGER}>
            <Info className="h-3.5 w-3.5" />
            Resumo
          </TabsTrigger>
          <TabsTrigger value="estrutura" className={TAB_TRIGGER}>
            <Layers className="h-3.5 w-3.5" />
            Conjuntos e anúncios
          </TabsTrigger>
        </TabsList>

        {/* Tab 1 — one card: KPI strip + attribution */}
        <TabsContent value="resumo">
          <div className={`${GLASS} divide-y divide-border/40 overflow-hidden`}>
            <div className="grid grid-cols-2 divide-x divide-y divide-border/40 sm:grid-cols-4 sm:divide-y-0">
              <Kpi label="Anúncios" value={kpis.ads} icon={<Megaphone className="h-4 w-4" />} accent="#6366f1" />
              <Kpi label="Leads" value={kpis.leads} icon={<Users className="h-4 w-4" />} accent="#0ea5e9" />
              <Kpi label="No CRM" value={kpis.inCrm} icon={<CheckCircle2 className="h-4 w-4" />} accent="#10b981" />
              <Kpi label="Orçamento/dia" value={kpis.dailyBudget} accent="#f59e0b" />
            </div>
            <div className="p-4">
              <AttributionPanel scope="campaign" targetId={campaignId} targetName={campaignName} bare />
            </div>
          </div>
        </TabsContent>

        {/* Tab 2 — funnel: adset sections with pipeline-style ad cards */}
        <TabsContent value="estrutura">
          {adsetGroups.length === 0 ? (
            <div className={`${GLASS} text-muted-foreground p-8 text-center text-sm`}>
              Nenhum anúncio sincronizado para esta campanha.
            </div>
          ) : (
            <div className={`${GLASS} space-y-5 p-4`}>
              {adsetGroups.map((group) => (
                <section key={group.adset_id} className="space-y-2.5">
                <div className="flex items-center gap-2 px-0.5">
                  <Layers className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">
                    {group.adset_id === '__none__' ? 'Sem conjunto de anúncios' : 'Conjunto de anúncios'}
                  </span>
                  {group.adset_id !== '__none__' && (
                    <span className="text-muted-foreground font-mono text-[10px]">{group.adset_id}</span>
                  )}
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {group.ads.length} {group.ads.length === 1 ? 'anúncio' : 'anúncios'}
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {group.ads.map((ad) => (
                    <AdCard key={ad.id} ad={ad} onOpen={() => setOpenAdId(ad.ad_id)} />
                  ))}
                </div>
                </section>
              ))}
              {noAdLeads > 0 && (
                <p className="text-muted-foreground pl-1 text-[11px]">
                  + {noAdLeads} lead{noAdLeads === 1 ? '' : 's'} sem anúncio associado.
                </p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AdDetailSheet adId={openAdId} open={!!openAdId} onOpenChange={(o) => !o && setOpenAdId(null)} />
    </>
  )
}

function AdCard({ ad, onOpen }: { ad: FunnelAd; onOpen: () => void }) {
  const color = statusColor(ad.status)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="group bg-card relative cursor-pointer overflow-hidden rounded-xl border border-border/50 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span aria-hidden className="absolute bottom-0 left-0 top-0 w-[3px]" style={{ backgroundColor: color }} />
      <div className="pl-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Filter className="text-muted-foreground h-4 w-4 shrink-0" />
            <h4 className="line-clamp-1 text-sm font-medium group-hover:underline">{ad.name ?? ad.ad_id}</h4>
          </div>
          <Badge variant={metaStatusVariant(ad.status)} className="shrink-0 text-[10px]">
            {formatMetaStatus(ad.status)}
          </Badge>
        </div>

        <div className="text-muted-foreground mt-2 flex items-center gap-1 pl-6 text-xs">
          <Users className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium tabular-nums">{ad.leads}</span> leads
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string | number
  icon?: React.ReactNode
  accent: string
}) {
  return (
    <div className="p-4">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
        {icon && <span style={{ color: accent }}>{icon}</span>}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
