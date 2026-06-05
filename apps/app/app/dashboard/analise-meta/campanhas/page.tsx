import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Target, Megaphone, Users, ChevronRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  formatCampaignObjective,
  formatEur,
  formatMetaStatus,
  metaStatusVariant,
} from '@/lib/meta/labels'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { listMetaCampaigns } from '@/lib/meta/campaign-queries'

import { MetaRefreshControls } from '@/components/analise-meta/meta-refresh-controls'

import { MetaEmptyState } from '../_components/meta-empty-state'
import { MetaSearchInput } from '../_components/search-input'
import { MetaPaginationNav } from '../_components/pagination-nav'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Campanhas — Análise Meta' }

const PAGE_SIZE = 30
const BASE_PATH = '/dashboard/analise-meta/campanhas'

type SearchParams = Promise<{ q?: string; page?: string }>

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
}

// Accent colour by Meta status, for the card's left bar + dot.
function statusColor(status: string | null): string {
  const s = (status ?? '').toUpperCase()
  if (s === 'ACTIVE') return '#10b981'
  if (s === 'PAUSED') return '#f59e0b'
  if (s === 'ARCHIVED' || s === 'DELETED') return '#94a3b8'
  return '#6366f1'
}

export default async function CampanhasMetaPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const q = sp.q?.trim() ?? ''
  const page = Math.max(1, Number(sp.page) || 1)

  const supabase = createCrmAdminClient()
  let campaigns: Awaited<ReturnType<typeof listMetaCampaigns>>['campaigns']
  let total: number
  try {
    const res = await listMetaCampaigns(supabase, { q, page, pageSize: PAGE_SIZE })
    campaigns = res.campaigns
    total = res.total
  } catch (e) {
    return (
      <div className="text-destructive text-sm">
        Erro a carregar campanhas: {e instanceof Error ? e.message : 'erro desconhecido'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetaSearchInput
          action={BASE_PATH}
          defaultValue={q}
          placeholder="Pesquisar campanha…"
        />
        <div className="flex flex-wrap items-center gap-3">
          <MetaRefreshControls />
          <p className="text-muted-foreground text-xs tabular-nums">
            {total} campanha{total === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <MetaEmptyState entityLabel="campanhas" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => {
            const color = statusColor(c.status)
            return (
              <Link
                key={c.id}
                href={`${BASE_PATH}/${c.campaign_id}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-4 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-lg"
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
              </Link>
            )
          })}
        </div>
      )}

      {campaigns.length > 0 && (
        <MetaPaginationNav
          basePath={BASE_PATH}
          searchParams={{ q }}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
        />
      )}
    </div>
  )
}
