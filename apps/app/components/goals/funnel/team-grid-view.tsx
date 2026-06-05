'use client'

import { useState, useMemo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Users, LayoutGrid, List, ArrowDownUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConsultantMiniCard } from './consultant-mini-card'
import { ConsultantListRow } from './consultant-list-row'
import { TeamKpiStrip } from './team-kpi-strip'
import { useTeamOverview } from '@/hooks/use-team-overview'
import type {
  FunnelPeriod,
  TeamOverviewConsultantCard,
  FunnelStageStatus,
} from '@/types/funnel'

interface Props {
  period: FunnelPeriod
  onSelectConsultant: (id: string) => void
}

type ViewMode = 'grid' | 'list'
type StatusFilter = 'all' | 'late' | 'attention' | 'on_track'
type SortKey = 'status' | 'name' | 'achievement' | 'realized_eur'

const STATUS_RANK: Record<FunnelStageStatus, number> = {
  late: 0,
  attention: 1,
  on_track: 2,
  completed: 3,
  pending: 4,
}

export function TeamGridView({ period, onSelectConsultant }: Props) {
  const { data, isLoading, error } = useTeamOverview({ period })

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('status')

  const visibleCards = useMemo<TeamOverviewConsultantCard[]>(() => {
    if (!data) return []
    let list = [...data.consultants]

    if (statusFilter !== 'all') {
      list = list.filter((c) => {
        if (statusFilter === 'on_track')
          return c.status === 'on_track' || c.status === 'completed'
        return c.status === statusFilter
      })
    }

    list.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.commercial_name.localeCompare(b.commercial_name, 'pt')
        case 'achievement':
          return b.composite_pct - a.composite_pct
        case 'realized_eur':
          return b.realized_eur - a.realized_eur
        case 'status':
        default: {
          const r = STATUS_RANK[a.status] - STATUS_RANK[b.status]
          if (r !== 0) return r
          return a.commercial_name.localeCompare(b.commercial_name, 'pt')
        }
      }
    })

    return list
  }, [data, statusFilter, sortKey])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[112px] rounded-2xl" />
        <Skeleton className="h-[40px] rounded-full w-1/2" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[280px] rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200/60 bg-red-50/70 p-8 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!data || data.consultants.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl p-12 text-center">
        <div className="h-14 w-14 rounded-2xl bg-muted/60 ring-1 ring-border/40 flex items-center justify-center mx-auto mb-4">
          <Users className="h-6 w-6 text-muted-foreground/60" />
        </div>
        <h3 className="text-sm font-semibold tracking-tight">Nenhum consultor com objectivos</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Configure objectivos anuais para ver o resumo da equipa neste período.
        </p>
      </div>
    )
  }

  const totalConsultants = data.consultants.length

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <TeamKpiStrip kpis={data.kpis} totalConsultants={totalConsultants} />

      {/* Controls bar — filter chips + sort + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center rounded-full border border-border/40 bg-background/60 backdrop-blur-sm p-0.5 text-xs font-medium">
          <FilterChip
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          >
            Todos
            <Badge>{totalConsultants}</Badge>
          </FilterChip>
          <FilterChip
            active={statusFilter === 'late'}
            onClick={() => setStatusFilter('late')}
            tone="red"
          >
            Atrasados
            <Badge tone="red">{data.kpis.count_late}</Badge>
          </FilterChip>
          <FilterChip
            active={statusFilter === 'attention'}
            onClick={() => setStatusFilter('attention')}
            tone="amber"
          >
            Atenção
            <Badge tone="amber">{data.kpis.count_attention}</Badge>
          </FilterChip>
          <FilterChip
            active={statusFilter === 'on_track'}
            onClick={() => setStatusFilter('on_track')}
            tone="emerald"
          >
            Em linha
            <Badge tone="emerald">{data.kpis.count_on_track}</Badge>
          </FilterChip>
        </div>

        <div className="flex items-center gap-2">
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-8 rounded-full text-xs gap-1.5 px-3 w-auto border-border/40 bg-background/60 backdrop-blur-sm">
              <ArrowDownUp className="h-3 w-3 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="status" className="text-xs">Status (atrasados primeiro)</SelectItem>
              <SelectItem value="achievement" className="text-xs">% atingido</SelectItem>
              <SelectItem value="realized_eur" className="text-xs">Realizado €</SelectItem>
              <SelectItem value="name" className="text-xs">Nome (A-Z)</SelectItem>
            </SelectContent>
          </Select>

          <div className="inline-flex items-center rounded-full border border-border/40 bg-background/60 backdrop-blur-sm p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-full h-7 w-7 flex items-center justify-center transition-all',
                viewMode === 'grid'
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              title="Vista em grelha"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-full h-7 w-7 flex items-center justify-center transition-all',
                viewMode === 'list'
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              title="Vista em lista"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Cards / List */}
      {visibleCards.length === 0 ? (
        <div className="rounded-2xl border border-border/40 bg-background/60 backdrop-blur-sm p-8 text-center text-xs text-muted-foreground">
          Nenhum consultor neste filtro.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleCards.map((c) => (
            <ConsultantMiniCard
              key={c.consultant_id}
              card={c}
              onClick={() => onSelectConsultant(c.consultant_id)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5 overflow-x-auto">
          {visibleCards.map((c) => (
            <ConsultantListRow
              key={c.consultant_id}
              card={c}
              onClick={() => onSelectConsultant(c.consultant_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
  tone,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  tone?: 'red' | 'amber' | 'emerald'
}) {
  const activeColor =
    tone === 'red'
      ? 'bg-red-50 text-red-700 ring-1 ring-red-200/60'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60'
        : tone === 'emerald'
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60'
          : 'bg-foreground text-background shadow-sm'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 inline-flex items-center gap-1.5 transition-all',
        active ? activeColor : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: 'red' | 'amber' | 'emerald' }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums leading-none',
        tone === 'red' && 'bg-red-500/15',
        tone === 'amber' && 'bg-amber-500/15',
        tone === 'emerald' && 'bg-emerald-500/15',
        !tone && 'bg-foreground/10',
      )}
    >
      {children}
    </span>
  )
}
