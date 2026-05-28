import { Coins, Eye, MousePointerClick, Users, TrendingDown } from 'lucide-react'

import {
  formatEur,
  formatMetaInt,
  formatMetaPct,
} from '@/lib/meta/labels'
import type { InsightKpis } from '@/lib/meta/insights-kpis'

/**
 * Cartão de KPIs de desempenho (insights) para o detalhe de campanha/anúncio.
 * Lê do mirror local meta.meta_insights_raw (agregado via getInsightKpis).
 *
 * NOTA: spend/clicks/leads são somas no período coberto; CPL = spend ÷ leads
 * (aproximação). reach/frequency omitidos (não somáveis entre dias).
 */
export function PerformanceKpis({
  kpis,
  title = 'Desempenho',
}: {
  kpis: InsightKpis
  title?: string
}) {
  if (!kpis.hasData) {
    return (
      <div className="bg-card rounded-lg border p-4">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
          <Coins className="h-4 w-4" />
          {title}
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          Ainda não há dados de desempenho. Usa{' '}
          <strong>Atualizar desempenho agora</strong> ou aguarda o sync diário.
        </p>
      </div>
    )
  }

  const period =
    kpis.firstDay && kpis.lastDay
      ? kpis.firstDay === kpis.lastDay
        ? kpis.firstDay
        : `${kpis.firstDay} → ${kpis.lastDay}`
      : `${kpis.days} dia(s)`

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
          <Coins className="h-4 w-4" />
          {title}
        </p>
        <span className="text-muted-foreground/70 text-[11px] tabular-nums">
          {period}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Tile
          label="Gasto"
          value={formatEur(kpis.spend, kpis.currency)}
          icon={<Coins className="h-4 w-4" />}
          accent
        />
        <Tile
          label="Custo / lead"
          value={
            kpis.costPerLead === null
              ? '—'
              : formatEur(kpis.costPerLead, kpis.currency)
          }
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <Tile
          label="Leads"
          value={formatMetaInt(kpis.leads)}
          icon={<Users className="h-4 w-4" />}
        />
        <Tile
          label="Impressões"
          value={formatMetaInt(kpis.impressions)}
          icon={<Eye className="h-4 w-4" />}
        />
        <Tile
          label="Cliques"
          value={formatMetaInt(kpis.clicks)}
          sub={kpis.ctr !== null ? `CTR ${formatMetaPct(kpis.ctr)}` : undefined}
          icon={<MousePointerClick className="h-4 w-4" />}
        />
      </div>
    </div>
  )
}

function Tile({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
  accent?: boolean
}) {
  return (
    <div
      className={
        accent
          ? 'rounded-lg border border-primary/30 bg-primary/5 p-4'
          : 'bg-card rounded-lg border p-4'
      }
    >
      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-muted-foreground mt-0.5 text-[11px]">{sub}</p>}
    </div>
  )
}
