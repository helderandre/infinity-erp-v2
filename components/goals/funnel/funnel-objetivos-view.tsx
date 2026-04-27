'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { usePermissions } from '@/hooks/use-permissions'
import { useFunnel } from '@/hooks/use-funnel'
import { Skeleton } from '@/components/ui/skeleton'
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { Button } from '@/components/ui/button'
import { Users, User, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FunnelCard } from './funnel-card'
import { FunnelLegend } from './funnel-legend'
import { FunnelManualEventDialog } from './funnel-manual-event-dialog'
import { FunnelCoachSheet } from './funnel-coach-sheet'
import { TeamGridView } from './team-grid-view'
import type {
  FunnelType,
  FunnelPeriod,
  FunnelScope,
  FunnelStageKey,
} from '@/types/funnel'

const PERIOD_OPTIONS: { value: FunnelPeriod; label: string }[] = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'annual', label: 'Anual' },
]

const eurFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatPeriodRange(start: string, end: string): string {
  return `${start} → ${end}`
}

function periodLabelEur(period: FunnelPeriod): string {
  return {
    daily: 'Objetivo diário',
    weekly: 'Objetivo semanal',
    monthly: 'Objetivo mensal',
    annual: 'Objetivo anual',
  }[period]
}

export function FunnelObjetivosView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { isBroker, isTeamLeader, hasPermission } = usePermissions()
  const isManager = isBroker() || isTeamLeader()

  const initialView = searchParams.get('view')
  const [period, setPeriod] = useState<FunnelPeriod>('weekly')
  const [scope, setScope] = useState<FunnelScope>(
    isManager && initialView !== 'individual' ? 'team' : isManager ? 'consultant' : 'consultant',
  )

  const [manualOpen, setManualOpen] = useState(false)
  const [manualFunnel, setManualFunnel] = useState<FunnelType>('buyer')
  const [manualStage, setManualStage] = useState<FunnelStageKey | null>(null)
  const [coachOpen, setCoachOpen] = useState(false)

  // Sync scope with role once permissions resolve, unless URL says otherwise
  useEffect(() => {
    if (initialView === 'individual') {
      setScope('consultant')
    } else if (isManager) {
      setScope('team')
    } else {
      setScope('consultant')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager, initialView])

  // Non-manager always sees themselves; manager in consultant scope shows the
  // team grid (no auto-self).
  const consultantId = !isManager ? user?.id ?? null : null

  const { data, isLoading, error, refetch } = useFunnel({
    consultantId,
    period,
    scope,
    enabled: hasPermission('goals') && (scope === 'team' || !!consultantId),
  })

  const consultantName = useMemo(() => {
    if (scope === 'team')
      return data?.team_member_count != null
        ? `Equipa (${data.team_member_count})`
        : 'Equipa'
    if (data?.consultant?.commercial_name) return data.consultant.commercial_name
    return user?.commercial_name ?? '—'
  }, [data, user, scope])

  function handleRegisterManual(funnel: FunnelType, stage: FunnelStageKey) {
    setManualFunnel(funnel)
    setManualStage(stage)
    setManualOpen(true)
  }

  function handleSelectConsultant(id: string) {
    router.push(`/dashboard/objetivos/consultor/${id}`)
  }

  if (!hasPermission('goals')) {
    return (
      <div className="rounded-2xl border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.18),0_4px_10px_-6px_rgba(0,0,0,0.12)] p-12 text-center text-sm text-muted-foreground">
        Sem permissão para ver objectivos.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="overflow-hidden rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
        <div className="px-5 py-5 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">
              Objetivos · Funil
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight mt-0.5">Funil Comercial</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Evolução face aos objetivos
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="inline-flex items-center rounded-full border border-border/40 bg-muted/40 p-0.5 text-xs font-medium backdrop-blur-sm">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPeriod(opt.value)}
                  className={cn(
                    'rounded-full px-3 py-1 transition-all',
                    period === opt.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCoachOpen(true)}
              disabled={!data}
              className="rounded-full h-8 text-xs gap-1.5 border-border/40 bg-background/60 backdrop-blur-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-orange-500" />
              Coach
            </Button>
          </div>
        </div>

        {/* Sub-header — scope toggle + period range + euro target */}
        <div className="px-5 py-3 sm:px-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs bg-background/30">
          {isManager && (
            <div className="inline-flex items-center rounded-full border border-border/40 bg-muted/40 p-0.5 font-medium backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setScope('team')}
                className={cn(
                  'rounded-full px-3 py-1 inline-flex items-center gap-1.5 transition-all',
                  scope === 'team'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Users className="h-3 w-3" />
                Equipa
              </button>
              <button
                type="button"
                onClick={() => setScope('consultant')}
                className={cn(
                  'rounded-full px-3 py-1 inline-flex items-center gap-1.5 transition-all',
                  scope === 'consultant'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <User className="h-3 w-3" />
                Individual
              </button>
            </div>
          )}
          {scope === 'team' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground tracking-wider uppercase font-medium">
                Vista
              </span>
              <span className="font-semibold">{consultantName}</span>
            </div>
          )}
          {scope === 'consultant' && !isManager && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground tracking-wider uppercase font-medium">
                Consultor
              </span>
              <span className="font-semibold">{consultantName}</span>
            </div>
          )}
          {scope === 'consultant' && isManager && (
            <span className="text-[11px] text-muted-foreground italic">
              Selecione um consultor abaixo para ver o detalhe
            </span>
          )}
          {data && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/40 backdrop-blur-sm px-3 py-1 text-muted-foreground">
                <span className="text-[10px] tracking-wider uppercase font-medium">Período</span>
                <span className="text-foreground tabular-nums">{formatPeriodRange(data.period_start, data.period_end)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/40 backdrop-blur-sm px-3 py-1 text-muted-foreground">
                <span className="text-[10px] tracking-wider uppercase font-medium">
                  {periodLabelEur(period)}{scope === 'team' ? ' (somado)' : ''}
                </span>
                <span className="text-foreground font-semibold tabular-nums">
                  {eurFormatter.format(data.period_target_eur)}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Body:
          - Manager + scope=consultant → team grid (clicking a card navigates to /consultor/[id])
          - scope=team → aggregate dual funnels
          - non-manager → own dual funnels
       */}
      {scope === 'consultant' && isManager ? (
        <TeamGridView period={period} onSelectConsultant={handleSelectConsultant} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[640px] rounded-2xl" />
          <Skeleton className="h-[640px] rounded-2xl hidden lg:block" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200/60 bg-red-50/60 backdrop-blur-sm p-8 text-sm text-red-700 shadow-[0_2px_12px_-6px_rgba(220,38,38,0.15)]">
          {error}
        </div>
      ) : data ? (
        <>
          <div className="hidden lg:grid grid-cols-2 gap-4 items-start">
            <FunnelCard
              data={data.buyer}
              onRegisterManual={
                scope === 'consultant' && !isManager
                  ? (stage) => handleRegisterManual('buyer', stage)
                  : undefined
              }
            />
            <FunnelCard
              data={data.seller}
              onRegisterManual={
                scope === 'consultant' && !isManager
                  ? (stage) => handleRegisterManual('seller', stage)
                  : undefined
              }
            />
          </div>
          <div className="lg:hidden">
            <Carousel opts={{ align: 'start', loop: false }}>
              <CarouselContent>
                <CarouselItem className="basis-[92%]">
                  <FunnelCard
                    data={data.buyer}
                    onRegisterManual={
                      scope === 'consultant' && !isManager
                        ? (stage) => handleRegisterManual('buyer', stage)
                        : undefined
                    }
                  />
                </CarouselItem>
                <CarouselItem className="basis-[92%]">
                  <FunnelCard
                    data={data.seller}
                    onRegisterManual={
                      scope === 'consultant' && !isManager
                        ? (stage) => handleRegisterManual('seller', stage)
                        : undefined
                    }
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
        </>
      ) : null}

      {/* Manual event dialog — only when consultor is viewing themselves */}
      {consultantId && !isManager && (
        <FunnelManualEventDialog
          open={manualOpen}
          onOpenChange={setManualOpen}
          consultantId={consultantId}
          funnel={manualFunnel}
          stageKey={manualStage}
          onSuccess={refetch}
        />
      )}

      {/* AI Coach sheet */}
      <FunnelCoachSheet
        open={coachOpen}
        onOpenChange={setCoachOpen}
        funnelSnapshot={data}
        consultantName={consultantName}
      />
    </div>
  )
}
