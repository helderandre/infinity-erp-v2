'use client'

/**
 * Slide 3 of the manager mobile carousel — top consultors ranked by
 * facturação or angariações (toggle pill). Tap a row to open the
 * MobileDrillDownSheet with that consultor's transactions/properties.
 */

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MobileDrillDownSheet, type MobileDrillDownConfig,
} from './mobile-drill-down-sheet'
import {
  getDrillDownProperties, getDrillDownTransactions,
} from '@/app/dashboard/drill-down-actions'
import type { AgentRanking } from '@/types/financial'

const fmt = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
})

interface ManagerRankingsCardProps {
  rankingsRevenue: AgentRanking[]
  rankingsAcquisitions: AgentRanking[]
  loading: boolean
  fillViewport?: boolean
}

export function ManagerRankingsCard({
  rankingsRevenue, rankingsAcquisitions, loading, fillViewport,
}: ManagerRankingsCardProps) {
  const [tab, setTab] = useState<'revenue' | 'acquisitions'>('revenue')
  const [config, setConfig] = useState<MobileDrillDownConfig | null>(null)
  const [open, setOpen] = useState(false)

  const cardClass = cn(
    'rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)] p-5 gap-4 overflow-y-auto',
    fillViewport && 'h-[calc(100dvh-env(safe-area-inset-top,0px)-var(--mobile-nav-height,5rem)-6rem)] min-h-[24rem]',
  )

  const drill = (cfg: MobileDrillDownConfig) => {
    setConfig(cfg)
    setOpen(true)
  }

  const dateFrom = `${new Date().getFullYear()}-01-01`

  if (loading) {
    return (
      <Card className={cardClass}>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-56 rounded-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </Card>
    )
  }

  const current = tab === 'revenue' ? rankingsRevenue : rankingsAcquisitions

  return (
    <>
      <Card className={cardClass}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Rankings</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Top consultores este ano
            </p>
          </div>
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/40">
            <button
              onClick={() => setTab('revenue')}
              className={cn(
                'px-3 py-1 rounded-full text-[10px] font-medium transition-colors',
                tab === 'revenue'
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Facturação
            </button>
            <button
              onClick={() => setTab('acquisitions')}
              className={cn(
                'px-3 py-1 rounded-full text-[10px] font-medium transition-colors',
                tab === 'acquisitions'
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Angariações
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 overflow-hidden">
          {current.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-sm">Sem dados disponíveis</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {current.map((r) => {
                const medals = ['', '🥇', '🥈', '🥉']
                const medal = medals[r.position] || ''
                const pct = r.pct_achieved ?? 0
                const isTop3 = r.position <= 3
                return (
                  <button
                    key={r.consultant_id}
                    onClick={() => drill({
                      title: r.consultant_name,
                      description: tab === 'revenue'
                        ? `Facturação: ${fmt.format(r.value)}`
                        : `${r.value} angariações`,
                      fetcher: tab === 'revenue'
                        ? () => getDrillDownTransactions({
                            consultant_id: r.consultant_id,
                            date_from: dateFrom,
                          })
                        : () => getDrillDownProperties({
                            consultant_id: r.consultant_id,
                            created_after: dateFrom,
                          }),
                    })}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors group text-left"
                  >
                    <span className={cn(
                      'w-7 text-center font-bold shrink-0 text-xs',
                      isTop3 ? 'text-base' : 'text-muted-foreground',
                    )}>
                      {medal || `#${r.position}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {r.consultant_name}
                        </span>
                        <span className="text-sm font-bold tabular-nums shrink-0">
                          {tab === 'revenue' ? fmt.format(r.value) : r.value}
                        </span>
                      </div>
                      {r.target && r.target > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-medium w-8 text-right tabular-nums text-muted-foreground">
                            {Math.round(pct)}%
                          </span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground shrink-0 transition-colors" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      <MobileDrillDownSheet config={config} open={open} onOpenChange={setOpen} />
    </>
  )
}
