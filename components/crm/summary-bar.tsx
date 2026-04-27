'use client'

/**
 * Summary KPIs that sit inside the dark hero on /dashboard/crm and
 * /dashboard/crm/referencias. Three figures: count of active négocios,
 * possible commission, forecasted commission.
 *
 * Same data source as the kanban (`/api/crm/kanban/[pipelineType]`) — the
 * API already returns these in `data.totals`. When `referrerConsultantId`
 * is supplied, the API multiplies the commission figures by each card's
 * referral_pct (or the agency default), so the numbers shown are the
 * referrer's actual slice rather than the headline gross.
 */

import { useEffect, useState } from 'react'
import { Briefcase, Euro, TrendingUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { PipelineType } from '@/types/leads-crm'

interface SummaryData {
  negocios: number
  possible_commission: number
  forecast_commission: number
}

interface SummaryBarProps {
  pipelineType: PipelineType
  inHero?: boolean
  /** Bumped by the parent to force re-fetch (qualify, create, edit). */
  refreshKey?: number
  /**
   * When set, the totals are computed from the referrer's perspective —
   * filter by this referrer + commission lines multiplied by referral_pct.
   * Used by the Referências page.
   */
  referrerConsultantId?: string
}

const formatEUR = (value: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(value)

export function SummaryBar({
  pipelineType,
  inHero = false,
  refreshKey = 0,
  referrerConsultantId,
}: SummaryBarProps) {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setData(null)
    const params = new URLSearchParams()
    if (referrerConsultantId) params.set('referrer_consultant_id', referrerConsultantId)
    const url = `/api/crm/kanban/${pipelineType}${params.size ? `?${params}` : ''}`
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (json?.totals) setData(json.totals)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [pipelineType, refreshKey, referrerConsultantId])

  const stats = [
    {
      icon: Briefcase,
      label: 'Negócios activos',
      mobileLabel: 'Negócios',
      value: loading ? null : String(data?.negocios ?? 0),
    },
    {
      icon: Euro,
      label: 'Comissão possível',
      mobileLabel: 'Possível',
      value: loading ? null : formatEUR(data?.possible_commission ?? 0),
    },
    {
      icon: TrendingUp,
      label: 'Comissão prevista',
      mobileLabel: 'Previsão',
      value: loading ? null : formatEUR(data?.forecast_commission ?? 0),
    },
  ]

  if (inHero) {
    return (
      <div className="inline-flex items-stretch rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden">
        {stats.map(({ icon: Icon, label, mobileLabel, value }, idx) => (
          <div
            key={label}
            className={cn(
              'flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 px-4 py-2 min-w-[78px] md:min-w-0',
              idx > 0 && 'border-l border-white/10',
            )}
          >
            <div className="flex items-center gap-1.5">
              <Icon className="hidden md:block h-3 w-3 text-white/50" />
              <span className="text-[8px] md:text-[10px] uppercase tracking-wider font-medium text-white/50 whitespace-nowrap leading-none">
                <span className="md:hidden">{mobileLabel}</span>
                <span className="hidden md:inline">{label}</span>
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-3.5 w-10 bg-white/10" />
            ) : (
              <span className="text-sm font-bold text-white tabular-nums whitespace-nowrap leading-tight">{value}</span>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {stats.map(({ icon: Icon, label, mobileLabel, value }) => (
        <div
          key={label}
          className="flex items-center gap-1 md:gap-2 rounded-full bg-card/70 backdrop-blur-sm border border-border/30 shadow-sm px-2.5 md:px-3.5 py-1.5"
        >
          <div className="hidden md:flex p-1 rounded-full bg-muted/60">
            <Icon className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            <span className="md:hidden">{mobileLabel}</span>
            <span className="hidden md:inline">{label}</span>
          </span>
          {loading ? (
            <Skeleton className="h-4 w-12" />
          ) : (
            <span className="text-xs font-bold whitespace-nowrap">{value}</span>
          )}
        </div>
      ))}
    </div>
  )
}
