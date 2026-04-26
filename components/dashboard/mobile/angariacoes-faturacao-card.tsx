'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Building2, Receipt, ArrowRight, Trophy } from 'lucide-react'
import type { AgentDashboard } from '@/types/financial'
import { cn } from '@/lib/utils'

const fmt = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})
const fmtCompact = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

interface AngariacoesFaturacaoCardProps {
  data: AgentDashboard | null
  loading: boolean
  fillViewport?: boolean
}

export function AngariacoesFaturacaoCard({
  data,
  loading,
  fillViewport,
}: AngariacoesFaturacaoCardProps) {
  const cardClass = cn(
    'rounded-2xl border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.18),0_4px_10px_-6px_rgba(0,0,0,0.12)] p-4 gap-4',
    fillViewport &&
      'h-[calc(100dvh-env(safe-area-inset-top,0px)-var(--mobile-nav-height,5rem)-6rem)] min-h-[24rem] justify-between',
  )

  if (loading || !data) {
    return (
      <Card className={cardClass}>
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-5 w-32 mt-2" />
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </Card>
    )
  }

  const p = data.my_properties ?? {
    active: 0,
    reserved: 0,
    sold_year: 0,
    volume: 0,
  }

  return (
    <Card className={cardClass}>
      {/* Angariações */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-neutral-100 dark:bg-white/10 flex items-center justify-center shrink-0">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-sm font-semibold truncate">Angariações</h3>
          </div>
          <Link
            href="/dashboard/imoveis"
            className="text-[11px] font-medium text-primary inline-flex items-center gap-0.5 shrink-0"
          >
            Ver
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniTile label="Activas" value={p.active} />
          <MiniTile label="Reservadas" value={p.reserved} />
          <MiniTile label="Vendidas (ano)" value={p.sold_year} />
          <MiniTile label="Volume" value={fmtCompact.format(p.volume)} />
        </div>
      </section>

      <div className="h-px bg-border" />

      {/* Faturação */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-neutral-100 dark:bg-white/10 flex items-center justify-center shrink-0">
              <Receipt className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-sm font-semibold truncate">Faturação</h3>
          </div>
          {data.ranking_position > 0 && (
            <Badge
              variant="outline"
              className="gap-1 text-[10px] h-5 px-2 rounded-full shrink-0"
            >
              <Trophy className="h-3 w-3 text-amber-500" />
              #{data.ranking_position}
              {data.total_agents > 0 && (
                <span className="text-muted-foreground">
                  /{data.total_agents}
                </span>
              )}
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniTile
            label="YTD"
            value={fmt.format(data.revenue_ytd)}
            emphasis
          />
          <MiniTile
            label="Este mês"
            value={fmt.format(data.revenue_this_month)}
            emphasis
          />
        </div>
      </section>
    </Card>
  )
}

function MiniTile({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string | number
  emphasis?: boolean
}) {
  return (
    <div className="rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 p-3 text-center">
      <p
        className={
          emphasis
            ? 'text-lg font-bold tabular-nums'
            : 'text-2xl font-bold tabular-nums'
        }
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
        {label}
      </p>
    </div>
  )
}
