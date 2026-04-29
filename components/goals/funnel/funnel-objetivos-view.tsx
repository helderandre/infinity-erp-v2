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
import { FunnelCoachSheet } from './funnel-coach-sheet'
import { TeamGridView } from './team-grid-view'
import type {
  FunnelPeriod,
  FunnelScope,
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

  const { data, isLoading, error } = useFunnel({
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
      {/* Toolbar — single compact row aligned with the rest of the app */}
      <div className="rounded-2xl border bg-card/50 backdrop-blur-sm px-4 py-3 sm:px-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {/* Scope toggle (managers only) */}
        {isManager && (
          <div className="inline-flex items-center rounded-md border bg-muted p-[3px] font-medium">
            <button
              type="button"
              onClick={() => setScope('team')}
              className={cn(
                'rounded-sm px-2.5 py-1 inline-flex items-center gap-1.5 transition-all',
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
                'rounded-sm px-2.5 py-1 inline-flex items-center gap-1.5 transition-all',
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

        {/* Period picker — moved here from the (now removed) title row */}
        <div className="inline-flex items-center rounded-md border bg-muted p-[3px] font-medium">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={cn(
                'rounded-sm px-2.5 py-1 transition-all',
                period === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Vista name (when relevant) */}
        {scope === 'team' && (
          <span className="font-semibold truncate max-w-[160px]">{consultantName}</span>
        )}
        {scope === 'consultant' && !isManager && (
          <span className="font-semibold truncate max-w-[160px]">{consultantName}</span>
        )}
        {scope === 'consultant' && isManager && (
          <span className="text-muted-foreground italic">
            Selecione um consultor abaixo
          </span>
        )}

        {/* Spacer pushes period range + target + Coach to the right */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {data && (
            <>
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-muted-foreground">
                <span className="text-[11px] font-medium">Período</span>
                <span className="text-foreground tabular-nums">{formatPeriodRange(data.period_start, data.period_end)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-muted-foreground">
                <span className="text-[11px] font-medium">
                  Objectivo{scope === 'team' ? ' (somado)' : ''}
                </span>
                <span className="text-foreground font-semibold tabular-nums">
                  {eurFormatter.format(data.period_target_eur)}
                </span>
              </span>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCoachOpen(true)}
            disabled={!data}
            className="h-8 text-xs gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-orange-500" />
            Coach
          </Button>
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
            <FunnelCard data={data.buyer} />
            <FunnelCard data={data.seller} />
          </div>
          <div className="lg:hidden">
            <Carousel opts={{ align: 'start', loop: false }}>
              <CarouselContent>
                <CarouselItem className="basis-[92%]">
                  <FunnelCard data={data.buyer} />
                </CarouselItem>
                <CarouselItem className="basis-[92%]">
                  <FunnelCard data={data.seller} />
                </CarouselItem>
              </CarouselContent>
            </Carousel>
            <div className="flex items-center justify-center gap-1 mt-3">
              <span className="h-1.5 w-6 rounded-full bg-foreground/60" />
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
            </div>
          </div>
        </>
      ) : null}

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
