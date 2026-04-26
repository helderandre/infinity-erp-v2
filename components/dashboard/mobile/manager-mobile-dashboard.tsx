'use client'

/**
 * Manager (gestor / broker) variant of the mobile dashboard. Same Embla
 * carousel + dot pagination as the consultor MobileDashboard, but with
 * 5 management-specific slides:
 *
 *   1. WelcomeCard           (re-used — photo + name + buttons)
 *   2. ManagerOverviewCard   (KPIs YTD + valores em curso + previsões)
 *   3. ManagerPipelineCard   (pipeline ponderado + angariações)
 *   4. ManagerRankingsCard   (top consultores por facturação/angariações)
 *   5. ManagerAlertasCard    (consultores com red/amber alerts)
 *
 * Data is fetched once at this level and passed down so the four data
 * cards share a single round-trip to the management endpoints.
 */

import { useEffect, useState } from 'react'
import {
  Carousel, CarouselApi, CarouselContent, CarouselItem,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'
import type { UserWithRole } from '@/hooks/use-user'
import {
  getManagementDashboard, getRevenuePipeline, getBuyerPipeline, getAgentRankings,
  type BuyerPipelineSummary,
} from '@/app/dashboard/financeiro/actions'
import type {
  ManagementDashboard as MgmtData, RevenuePipelineItem, AgentRanking,
} from '@/types/financial'
import { WelcomeCard } from './welcome-card'
import { ManagerAlertasCard } from './manager-alertas-card'
import { ManagerRankingsCard } from './manager-rankings-card'
import { ManagerOverviewCard } from './manager-overview-card'
import { ManagerPipelineCard } from './manager-pipeline-card'

interface ManagerMobileDashboardProps {
  user: UserWithRole
}

export function ManagerMobileDashboard({ user }: ManagerMobileDashboardProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)

  const [mgmtData, setMgmtData] = useState<MgmtData | null>(null)
  const [pipeline, setPipeline] = useState<RevenuePipelineItem[]>([])
  const [buyerPipeline, setBuyerPipeline] = useState<RevenuePipelineItem[]>([])
  const [buyerSummary, setBuyerSummary] = useState<BuyerPipelineSummary | null>(null)
  const [rankingsRevenue, setRankingsRevenue] = useState<AgentRanking[]>([])
  const [rankingsAcq, setRankingsAcq] = useState<AgentRanking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!api) return
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap())
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    api.on('select', onSelect)
    return () => { api.off('select', onSelect) }
  }, [api])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getManagementDashboard(),
      getRevenuePipeline(),
      getBuyerPipeline(),
      getAgentRankings('revenue'),
      getAgentRankings('acquisitions'),
    ])
      .then(([mgmt, pipe, buyerPipe, rankRev, rankAcq]) => {
        if (cancelled) return
        if (!mgmt.error) {
          const { error: _err, ...rest } = mgmt
          setMgmtData(rest as MgmtData)
        }
        if (!pipe.error) setPipeline(pipe.pipeline)
        if (!buyerPipe.error) {
          setBuyerPipeline(buyerPipe.pipeline)
          setBuyerSummary(buyerPipe.summary)
        }
        if (!rankRev.error) setRankingsRevenue(rankRev.rankings)
        if (!rankAcq.error) setRankingsAcq(rankAcq.rankings)
      })
      .catch((err) => {
        console.error('ManagerMobileDashboard load failed:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <Carousel
        setApi={setApi}
        opts={{ align: 'start', loop: false, containScroll: 'trimSnaps' }}
        className="w-full"
      >
        <CarouselContent>
          <CarouselItem className="basis-full">
            <WelcomeCard user={user} />
          </CarouselItem>
          <CarouselItem className="basis-full">
            <ManagerOverviewCard
              data={mgmtData}
              pipeline={pipeline}
              loading={loading}
              fillViewport
            />
          </CarouselItem>
          <CarouselItem className="basis-full">
            <ManagerPipelineCard
              data={mgmtData}
              pipeline={pipeline}
              buyerPipeline={buyerPipeline}
              buyerSummary={buyerSummary}
              loading={loading}
              fillViewport
            />
          </CarouselItem>
          <CarouselItem className="basis-full">
            <ManagerRankingsCard
              rankingsRevenue={rankingsRevenue}
              rankingsAcquisitions={rankingsAcq}
              loading={loading}
              fillViewport
            />
          </CarouselItem>
          <CarouselItem className="basis-full">
            <ManagerAlertasCard fillViewport />
          </CarouselItem>
        </CarouselContent>
      </Carousel>

      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir para cartão ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === current ? 'w-5 bg-foreground' : 'w-1.5 bg-muted-foreground/30',
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
