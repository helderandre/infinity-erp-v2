'use client'

import { Suspense, useState, use } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/hooks/use-permissions'
import { useFunnel } from '@/hooks/use-funnel'
import { ConsultantHero } from '@/components/goals/funnel/consultant-hero'
import { FunnelCard } from '@/components/goals/funnel/funnel-card'
import { FunnelLegend } from '@/components/goals/funnel/funnel-legend'
import { FunnelManualEventDialog } from '@/components/goals/funnel/funnel-manual-event-dialog'
import { FunnelCoachSheet } from '@/components/goals/funnel/funnel-coach-sheet'
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import type {
  FunnelType,
  FunnelPeriod,
  FunnelStageKey,
} from '@/types/funnel'

interface PageProps {
  params: Promise<{ id: string }>
}

function ConsultorDetailInner({ id }: { id: string }) {
  const { hasPermission, loading: permLoading } = usePermissions()
  const [period, setPeriod] = useState<FunnelPeriod>('weekly')
  const [coachOpen, setCoachOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualFunnel, setManualFunnel] = useState<FunnelType>('buyer')
  const [manualStage, setManualStage] = useState<FunnelStageKey | null>(null)

  const { data, isLoading, error, refetch } = useFunnel({
    consultantId: id,
    period,
    scope: 'consultant',
    enabled: hasPermission('goals'),
  })

  function handleRegisterManual(funnel: FunnelType, stage: FunnelStageKey) {
    setManualFunnel(funnel)
    setManualStage(stage)
    setManualOpen(true)
  }

  if (permLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[160px] rounded-3xl" />
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>
    )
  }

  if (!hasPermission('goals')) {
    return (
      <div className="rounded-2xl border border-border/40 bg-background/85 p-12 text-center text-sm text-muted-foreground">
        Sem permissão para ver objectivos.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <>
          <Skeleton className="h-[160px] rounded-3xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </>
      ) : error ? (
        <div className="rounded-2xl border border-red-200/60 bg-red-50/60 backdrop-blur-sm p-8 text-sm text-red-700">
          {error}
        </div>
      ) : data ? (
        <>
          <ConsultantHero
            data={data}
            period={period}
            onPeriodChange={setPeriod}
            onCoachOpen={() => setCoachOpen(true)}
          />

          <div className="hidden lg:grid grid-cols-2 gap-4 items-start">
            <FunnelCard
              data={data.buyer}
              onRegisterManual={(stage) => handleRegisterManual('buyer', stage)}
            />
            <FunnelCard
              data={data.seller}
              onRegisterManual={(stage) => handleRegisterManual('seller', stage)}
            />
          </div>
          <div className="lg:hidden">
            <Carousel opts={{ align: 'start', loop: false }}>
              <CarouselContent>
                <CarouselItem className="basis-[92%]">
                  <FunnelCard
                    data={data.buyer}
                    onRegisterManual={(stage) => handleRegisterManual('buyer', stage)}
                  />
                </CarouselItem>
                <CarouselItem className="basis-[92%]">
                  <FunnelCard
                    data={data.seller}
                    onRegisterManual={(stage) => handleRegisterManual('seller', stage)}
                  />
                </CarouselItem>
              </CarouselContent>
            </Carousel>
            <div className="flex items-center justify-center gap-1 mt-3">
              <span className="h-1.5 w-6 rounded-full bg-foreground/60" />
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
            </div>
          </div>
          <FunnelLegend />

          <FunnelManualEventDialog
            open={manualOpen}
            onOpenChange={setManualOpen}
            consultantId={id}
            funnel={manualFunnel}
            stageKey={manualStage}
            onSuccess={refetch}
          />

          <FunnelCoachSheet
            open={coachOpen}
            onOpenChange={setCoachOpen}
            funnelSnapshot={data}
            consultantName={data.consultant.commercial_name}
          />
        </>
      ) : null}
    </div>
  )
}

export default function ConsultorDetailPage({ params }: PageProps) {
  const { id } = use(params)
  return (
    <Suspense fallback={null}>
      <ConsultorDetailInner id={id} />
    </Suspense>
  )
}
