'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { MultiSelectFilter } from '@/components/shared/multi-select-filter'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { Activity, Bot, CalendarDays, Clock, Eye, History, X } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { TASK_ACTIVITY_TYPE_CONFIG } from '@/lib/constants'
import { ACTIVITY_ICON_MAP } from '../activity-icon-map'
import type { TaskActivity } from '@/types/process'

const SYSTEM_PERSON = '__system__'

/** Actividade enriquecida pelo endpoint /activities (task_title + stage_name). */
interface HistoryActivity extends TaskActivity {
  task_title?: string
  stage_name?: string
}

interface ProcessHistorySheetProps {
  processId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Histórico completo do processo, acessível a partir do botão no topo da
 * sheet de detalhe do passo. Dados reais de `proc_task_activities` (via
 * /api/processes/[id]/activities). Duas tabs — Ações e Visualizações — ambas
 * filtráveis por pessoa e por intervalo de datas (inclusive).
 */
export function ProcessHistorySheet({
  processId,
  open,
  onOpenChange,
}: ProcessHistorySheetProps) {
  const isMobile = useIsMobile()
  const [activities, setActivities] = useState<HistoryActivity[] | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [tab, setTab] = useState<'acoes' | 'visualizacoes'>('acoes')

  // Filtros partilhados pelas duas tabs.
  const [people, setPeople] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (!open || !processId) return
    let active = true
    fetch(`/api/processes/${processId}/activities`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (!active) return
        setActivities((Array.isArray(d) ? d : []) as HistoryActivity[])
        setFetchedFor(processId)
      })
      .catch(() => {
        if (!active) return
        setActivities([])
        setFetchedFor(processId)
      })
    return () => {
      active = false
    }
  }, [open, processId])

  // Carregamento derivado — evita setState síncrono no effect. Mantém os dados
  // anteriores visíveis enquanto re-busca (sem flash de skeleton), e só mostra
  // skeleton na 1ª carga ou quando o processo muda.
  const loading = open && (activities === null || fetchedFor !== processId)

  // Opções de pessoa — a partir de todos os actores que surgem no histórico.
  const peopleOptions = useMemo(() => {
    const map = new Map<string, string>()
    let hasSystem = false
    for (const a of activities ?? []) {
      if (a.user_id) {
        map.set(a.user_id, a.user?.commercial_name || 'Utilizador')
      } else {
        hasSystem = true
      }
    }
    const opts = [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((x, y) => x.label.localeCompare(y.label, 'pt'))
    if (hasSystem) opts.push({ value: SYSTEM_PERSON, label: 'Sistema' })
    return opts
  }, [activities])

  // Aplica filtros de pessoa + datas (inclusive em ambos os extremos).
  const filtered = useMemo(() => {
    return (activities ?? []).filter((a) => {
      if (people.length > 0) {
        const pid = a.user_id ?? SYSTEM_PERSON
        if (!people.includes(pid)) return false
      }
      if (dateFrom || dateTo) {
        const day = format(new Date(a.created_at), 'yyyy-MM-dd')
        if (dateFrom && day < dateFrom) return false
        if (dateTo && day > dateTo) return false
      }
      return true
    })
  }, [activities, people, dateFrom, dateTo])

  const actions = useMemo(
    () => filtered.filter((a) => a.activity_type !== 'viewed'),
    [filtered]
  )
  const views = useMemo(
    () => filtered.filter((a) => a.activity_type === 'viewed'),
    [filtered]
  )

  const hasFilters = people.length > 0 || !!dateFrom || !!dateTo
  const clearFilters = () => {
    setPeople([])
    setDateFrom('')
    setDateTo('')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col gap-0 overflow-hidden border-border/40 p-0 shadow-2xl',
          'bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[92dvh] rounded-t-3xl'
            : 'h-full w-full data-[side=right]:sm:max-w-[640px] sm:rounded-l-3xl'
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 z-20 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/25" />
        )}
        <SheetHeader className="shrink-0 space-y-0 border-b border-border/40 px-6 pb-4 pt-6">
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <History className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                Processo
              </p>
              <SheetTitle className="text-base leading-snug">
                Histórico
              </SheetTitle>
            </div>
          </div>
          <SheetDescription className="sr-only">
            Histórico de acções e visualizações do processo
          </SheetDescription>
        </SheetHeader>

        {/* Barra de filtros — aplica-se a ambas as tabs */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/40 px-6 py-3">
          <MultiSelectFilter
            title="Pessoa"
            options={peopleOptions}
            selected={people}
            onSelectedChange={setPeople}
            searchable={peopleOptions.length > 8}
          />
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            onChange={(f, t) => {
              setDateFrom(f)
              setDateTo(t)
            }}
          />
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-xs text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="shrink-0 px-6 pt-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="acoes" className="gap-1.5">
                Ações
                <span className="text-xs text-muted-foreground">
                  {loading ? '' : actions.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="visualizacoes" className="gap-1.5">
                Visualizações
                <span className="text-xs text-muted-foreground">
                  {loading ? '' : views.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="acoes"
            className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-4"
          >
            <ActivityList
              activities={actions}
              loading={loading}
              emptyIcon={Activity}
              emptyText="Sem acções registadas."
            />
          </TabsContent>
          <TabsContent
            value="visualizacoes"
            className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-4"
          >
            <ActivityList
              activities={views}
              loading={loading}
              emptyIcon={Eye}
              emptyText="Sem visualizações registadas."
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

/** Filtro de intervalo de datas (inclusive nos dois extremos). */
function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  const active = !!(from || to)
  const label =
    from && to
      ? `${from} → ${to}`
      : from
        ? `Desde ${from}`
        : to
          ? `Até ${to}`
          : null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          <CalendarDays className="mr-2 h-4 w-4" />
          Datas
          {active && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal text-[11px]"
              >
                {label}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Intervalo de datas
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-8 text-[10px] text-muted-foreground">De</span>
            <Input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => onChange(e.target.value, to)}
              className="h-9 rounded-lg text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 text-[10px] text-muted-foreground">Até</span>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => onChange(from, e.target.value)}
              className="h-9 rounded-lg text-xs"
            />
          </div>
        </div>
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-full text-[11px]"
            onClick={() => onChange('', '')}
          >
            Limpar datas
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}

function ActivityList({
  activities,
  loading,
  emptyIcon: EmptyIcon,
  emptyText,
}: {
  activities: HistoryActivity[]
  loading: boolean
  emptyIcon: typeof Activity
  emptyText: string
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <EmptyIcon className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{emptyText}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Ajuste os filtros para ver mais resultados.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-4">
      {activities.map((a) => (
        <ActivityRow key={a.id} activity={a} />
      ))}
    </ul>
  )
}

function ActivityRow({ activity }: { activity: HistoryActivity }) {
  const config = TASK_ACTIVITY_TYPE_CONFIG[activity.activity_type] || {
    icon: 'Activity',
    label: activity.activity_type,
    color: 'text-muted-foreground',
  }
  const Icon = ACTIVITY_ICON_MAP[config.icon] || Activity
  const name = activity.user?.commercial_name || 'Sistema'

  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted',
          config.color
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {activity.user_id ? (
            <Avatar className="h-5 w-5">
              {activity.user?.profile?.profile_photo_url && (
                <AvatarImage src={activity.user.profile.profile_photo_url} />
              )}
              <AvatarFallback className="text-[9px]">
                {name[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
              <Bot className="h-3 w-3 text-muted-foreground" />
            </span>
          )}
          <span className="text-sm font-medium">{name}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {config.label}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-foreground">{activity.description}</p>
        {activity.task_title && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
            {activity.task_title}
          </p>
        )}
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(activity.created_at), {
            addSuffix: true,
            locale: pt,
          })}
          <span className="text-muted-foreground/50">·</span>
          {format(new Date(activity.created_at), "d MMM yyyy, HH:mm", {
            locale: pt,
          })}
        </p>
      </div>
    </li>
  )
}
