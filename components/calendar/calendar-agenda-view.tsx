'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CalendarEvent, CalendarCategory } from '@/types/calendar'
import type { TaskWithRelations } from '@/types/task'
import { CALENDAR_CATEGORY_COLORS, CALENDAR_CATEGORY_LABELS } from '@/types/calendar'
import { CalendarTaskRow } from './calendar-task-row'
import {
  format,
  parseISO,
  isToday,
  isTomorrow,
  isSameDay,
  isBefore,
  startOfMonth,
  endOfMonth,
  startOfDay,
  addHours,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { CalendarX, CheckCircle2, Infinity as InfinityIcon } from 'lucide-react'

interface CalendarAgendaViewProps {
  currentDate: Date
  events: CalendarEvent[]
  tasks?: TaskWithRelations[]
  onEventClick: (event: CalendarEvent) => void
  onTaskSelect?: (task: TaskWithRelations) => void
  onTaskToggleComplete?: (id: string, isCompleted: boolean) => void
}

const TASK_CATEGORIES: CalendarCategory[] = [
  'process_task', 'process_subtask', 'reminder',
  'lead_followup', 'contract_expiry', 'lead_expiry',
]

export function isTaskEvent(event: CalendarEvent): boolean {
  if (event.item_type === 'task') return true
  return TASK_CATEGORIES.includes(event.category)
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function CalendarAgendaView({
  currentDate,
  events,
  tasks,
  onEventClick,
  onTaskSelect,
  onTaskToggleComplete,
}: CalendarAgendaViewProps) {
  const groupedByDay = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const map = new Map<string, { date: Date; events: CalendarEvent[] }>()

    for (const event of events) {
      try {
        const d = parseISO(event.start_date)
        if (d < monthStart || d > monthEnd) continue
        const key = format(d, 'yyyy-MM-dd')
        const existing = map.get(key)
        if (existing) existing.events.push(event)
        else map.set(key, { date: d, events: [event] })
      } catch {
        // skip bad dates
      }
    }

    // Include days that only have tasks — otherwise a day with 1 tarefa
    // and 0 events never gets a carousel card.
    for (const t of tasks ?? []) {
      if (!t.due_date) continue
      try {
        const d = parseISO(t.due_date)
        if (d < monthStart || d > monthEnd) continue
        const key = format(d, 'yyyy-MM-dd')
        if (!map.has(key)) {
          const anchor = new Date(d.getFullYear(), d.getMonth(), d.getDate())
          map.set(key, { date: anchor, events: [] })
        }
      } catch {
        // skip bad dates
      }
    }

    for (const group of map.values()) {
      group.events.sort(
        (a, b) =>
          parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime(),
      )
    }

    return Array.from(map.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    )
  }, [events, tasks, currentDate])

  // Mobile: show every day with events (past included, rendered dim) so
  // the user can slide left to see history; selection starts at today.
  const mobileGroups = groupedByDay
  const todayIdx = useMemo(() => {
    const today = startOfDay(new Date())
    const idx = mobileGroups.findIndex((g) => startOfDay(g.date) >= today)
    return idx === -1 ? Math.max(0, mobileGroups.length - 1) : idx
  }, [mobileGroups])

  // Tasks bucketed by day — rendered under the events on each day card.
  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>()
    if (!tasks?.length) return map
    for (const t of tasks) {
      if (!t.due_date) continue
      try {
        const key = format(parseISO(t.due_date), 'yyyy-MM-dd')
        const existing = map.get(key) ?? []
        existing.push(t)
        map.set(key, existing)
      } catch {
        // skip invalid dates
      }
    }
    return map
  }, [tasks])

  const getTasksForDay = (date: Date) =>
    tasksByDay.get(format(date, 'yyyy-MM-dd')) ?? []

  if (groupedByDay.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <CalendarX className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Sem eventos neste mês.</p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop: kanban-by-day */}
      <div className="hidden md:flex gap-3 overflow-x-auto px-1 pb-3 snap-x">
        {groupedByDay.map(({ date, events: dayEvents }) => {
          const today = isToday(date)
          const tomorrow = isTomorrow(date)
          const dayLabel = format(date, "EEEE, d 'de' MMMM", { locale: ptBR })

          return (
            <div
              key={date.toISOString()}
              className="w-[300px] shrink-0 snap-start rounded-2xl border bg-card/80 shadow-sm flex flex-col max-h-full overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/60">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold shrink-0',
                    today ? 'bg-foreground text-background' : 'bg-muted text-foreground',
                  )}
                >
                  {format(date, 'd')}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {today ? 'Hoje' : tomorrow ? 'Amanhã' : capitalize(dayLabel)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {(() => {
                      const t = getTasksForDay(date).length
                      const parts: string[] = []
                      if (dayEvents.length > 0)
                        parts.push(`${dayEvents.length} ${dayEvents.length === 1 ? 'evento' : 'eventos'}`)
                      if (t > 0) parts.push(`${t} ${t === 1 ? 'tarefa' : 'tarefas'}`)
                      return parts.join(' · ') || '—'
                    })()}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {dayEvents.map((event) => (
                  <AgendaEventCard
                    key={event.id}
                    event={event}
                    onClick={() => onEventClick(event)}
                  />
                ))}
                {(() => {
                  const dayTasks = getTasksForDay(date)
                  if (dayTasks.length === 0) return null
                  return (
                    <>
                      <p className="pt-2 px-1.5 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                        Tarefas
                      </p>
                      {dayTasks.map((task) => (
                        <CalendarTaskRow
                          key={task.id}
                          task={task}
                          onSelect={(t) => onTaskSelect?.(t)}
                          onToggleComplete={(id, c) =>
                            onTaskToggleComplete?.(id, c)
                          }
                        />
                      ))}
                    </>
                  )
                })()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile: day strip + horizontal swipe carousel */}
      <MobileAgendaCarousel
        groups={mobileGroups}
        tasksByDay={tasksByDay}
        initialIdx={todayIdx}
        onEventClick={onEventClick}
        onTaskSelect={onTaskSelect}
        onTaskToggleComplete={onTaskToggleComplete}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Mobile carousel
// ─────────────────────────────────────────────────────────────────────────

function MobileAgendaCarousel({
  groups,
  tasksByDay,
  initialIdx,
  onEventClick,
  onTaskSelect,
  onTaskToggleComplete,
}: {
  groups: { date: Date; events: CalendarEvent[] }[]
  tasksByDay: Map<string, TaskWithRelations[]>
  initialIdx: number
  onEventClick: (event: CalendarEvent) => void
  onTaskSelect?: (task: TaskWithRelations) => void
  onTaskToggleComplete?: (id: string, isCompleted: boolean) => void
}) {
  const [selectedIdx, setSelectedIdx] = useState(initialIdx)
  const carouselRef = useRef<HTMLDivElement>(null)
  const dayRefs = useRef<(HTMLDivElement | null)[]>([])
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([])
  const hasInitialScrolled = useRef(false)

  useEffect(() => {
    dayRefs.current = dayRefs.current.slice(0, groups.length)
    pillRefs.current = pillRefs.current.slice(0, groups.length)
    setSelectedIdx((idx) => Math.min(idx, Math.max(0, groups.length - 1)))
  }, [groups.length])

  // Scroll the carousel to today on first paint so past days are to the left.
  useEffect(() => {
    if (hasInitialScrolled.current) return
    if (groups.length === 0) return
    const card = dayRefs.current[initialIdx]
    if (card) {
      card.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'start' })
      setSelectedIdx(initialIdx)
      hasInitialScrolled.current = true
    }
  }, [initialIdx, groups.length])

  // Keep selectedIdx in sync with whichever card is in view.
  useEffect(() => {
    const root = carouselRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      (entries) => {
        let bestIdx = -1
        let bestRatio = 0
        for (const entry of entries) {
          if (entry.intersectionRatio > bestRatio) {
            const idx = dayRefs.current.indexOf(entry.target as HTMLDivElement)
            if (idx !== -1) {
              bestIdx = idx
              bestRatio = entry.intersectionRatio
            }
          }
        }
        if (bestIdx !== -1 && bestRatio > 0.55) setSelectedIdx(bestIdx)
      },
      { root, threshold: [0.25, 0.5, 0.75, 1] },
    )
    dayRefs.current.forEach((ref) => ref && observer.observe(ref))
    return () => observer.disconnect()
  }, [groups.length])

  // Scroll the selected pill into view when day changes.
  useEffect(() => {
    const pill = pillRefs.current[selectedIdx]
    pill?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [selectedIdx])

  const jumpToDay = (idx: number) => {
    const card = dayRefs.current[idx]
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }

  if (groups.length === 0) {
    return (
      <div className="md:hidden flex flex-col items-center justify-center py-16 text-muted-foreground">
        <CalendarX className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Sem eventos.</p>
      </div>
    )
  }

  return (
    <div className="md:hidden flex flex-col h-full min-h-0">
      {/* Day selector strip */}
      <div className="shrink-0 border-b border-border/40 bg-background/60 supports-[backdrop-filter]:bg-background/40 backdrop-blur-md">
        <div
          className="overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style>{`.agenda-strip::-webkit-scrollbar{display:none}`}</style>
          <div className="agenda-strip flex gap-1.5 px-3 py-2.5 w-max">
            {groups.map((g, idx) => {
              const selected = idx === selectedIdx
              const today = isToday(g.date)
              const past = isBefore(startOfDay(g.date), startOfDay(new Date()))
              return (
                <button
                  key={g.date.toISOString()}
                  ref={(el) => {
                    pillRefs.current[idx] = el
                  }}
                  type="button"
                  onClick={() => jumpToDay(idx)}
                  className={cn(
                    'shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold transition-all tabular-nums',
                    selected
                      ? 'bg-foreground text-background shadow-sm scale-105'
                      : today
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : past
                      ? 'bg-background/30 border border-border/30 text-muted-foreground/50 hover:text-muted-foreground'
                      : 'bg-background/60 border border-border/40 text-foreground/80 hover:border-border/70',
                  )}
                >
                  {format(g.date, 'd')}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={carouselRef}
        className="agenda-carousel flex-1 min-h-0 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth flex"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`.agenda-carousel::-webkit-scrollbar{display:none}`}</style>
        {groups.map((g, idx) => {
          const past = isBefore(startOfDay(g.date), startOfDay(new Date()))
          return (
            <div
              key={g.date.toISOString()}
              ref={(el) => {
                dayRefs.current[idx] = el
              }}
              className={cn(
                'w-full shrink-0 snap-start snap-always flex flex-col overflow-hidden',
                past && 'opacity-60',
              )}
            >
              <DayCard
                date={g.date}
                events={g.events}
                tasks={tasksByDay.get(format(g.date, 'yyyy-MM-dd')) ?? []}
                onEventClick={onEventClick}
                onTaskSelect={onTaskSelect}
                onTaskToggleComplete={onTaskToggleComplete}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DayCard({
  date,
  events,
  tasks,
  onEventClick,
  onTaskSelect,
  onTaskToggleComplete,
}: {
  date: Date
  events: CalendarEvent[]
  tasks: TaskWithRelations[]
  onEventClick: (event: CalendarEvent) => void
  onTaskSelect?: (task: TaskWithRelations) => void
  onTaskToggleComplete?: (id: string, isCompleted: boolean) => void
}) {
  const today = isToday(date)
  const tomorrow = isTomorrow(date)
  const weekday = format(date, 'EEEE', { locale: ptBR })
  const fullDate = format(date, "d 'de' MMMM", { locale: ptBR })

  const legacyTaskEvents = events.filter(isTaskEvent)
  const timed = events.filter((e) => !isTaskEvent(e))

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with date info (as user requested: the card itself carries date+weekday) */}
      <div className="shrink-0 px-5 pt-5 pb-3">
        <div className="flex items-baseline gap-2">
          <p className="text-[22px] font-semibold leading-tight tracking-tight">
            {today ? 'Hoje' : tomorrow ? 'Amanhã' : capitalize(weekday)}
          </p>
          {today && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Agora
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {fullDate}
          {events.length > 0 && (
            <> · {events.length} {events.length === 1 ? 'evento' : 'eventos'}</>
          )}
          {tasks.length > 0 && (
            <> · {tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}</>
          )}
        </p>
      </div>

      {/* Events scroll area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 space-y-1.5">
        {timed.map((event) => (
          <AgendaEventCard
            key={event.id}
            event={event}
            onClick={() => onEventClick(event)}
          />
        ))}
        {/* Legacy calendar-events with item_type='task' or task categories */}
        {legacyTaskEvents.map((event) => (
          <AgendaEventCard
            key={event.id}
            event={event}
            onClick={() => onEventClick(event)}
          />
        ))}
        {/* Tasks from the tasks module — rendered at the bottom in to-do style */}
        {tasks.length > 0 && (
          <>
            <p className="pt-2 px-1.5 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
              Tarefas
            </p>
            {tasks.map((task) => (
              <CalendarTaskRow
                key={task.id}
                task={task}
                onSelect={(t) => onTaskSelect?.(t)}
                onToggleComplete={(id, c) => onTaskToggleComplete?.(id, c)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Compact event card (shared between desktop kanban columns and mobile cards)
// ─────────────────────────────────────────────────────────────────────────

export function AgendaEventCard({
  event,
  onClick,
}: {
  event: CalendarEvent
  onClick: () => void
}) {
  const colors = CALENDAR_CATEGORY_COLORS[event.category]
  const categoryLabel = CALENDAR_CATEGORY_LABELS[event.category] ?? event.category
  const eventDate = parseISO(event.start_date)
  const isTask = event.item_type === 'task' || TASK_CATEGORIES.includes(event.category)
  const isCompleted = event.status === 'completed'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl overflow-hidden flex items-stretch hover:opacity-90 transition-opacity',
        colors?.bg || 'bg-muted',
      )}
    >
      <span className={cn('w-1 shrink-0', colors?.dot || 'bg-primary')} />
      <div className="flex-1 min-w-0 p-2.5">
        <div className={cn('flex items-start justify-between gap-2', colors?.text)}>
          <div className="flex items-center gap-1.5 min-w-0">
            {event.category === 'company_event' && (
              <InfinityIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            )}
            <p
              className={cn(
                'text-[13px] font-semibold truncate',
                isCompleted && 'line-through opacity-70',
              )}
            >
              {event.title}
            </p>
          </div>
          {event.all_day ? (
            <span className="shrink-0 text-[10px] opacity-70">Todo dia</span>
          ) : (
            <span className="shrink-0 text-[11px] font-medium tabular-nums opacity-80">
              {format(eventDate, 'HH:mm')}
              {event.end_date && (
                <>
                  {' '}
                  –{' '}
                  {format(parseISO(event.end_date), 'HH:mm')}
                </>
              )}
              {!event.end_date && !event.all_day && !isTask && (
                <>
                  {' '}
                  –{' '}
                  {format(addHours(eventDate, 1), 'HH:mm')}
                </>
              )}
            </span>
          )}
        </div>
        {event.description && (
          <p className={cn('text-[11px] truncate mt-0.5 opacity-70', colors?.text)}>
            {event.description.replace(/<[^>]+>/g, '')}
          </p>
        )}
        <div
          className={cn(
            'mt-1.5 flex items-center gap-1.5 text-[10px]',
            colors?.text,
            'opacity-70',
          )}
        >
          {isTask && (
            <CheckCircle2
              className={cn(
                'h-3 w-3 shrink-0',
                isCompleted ? 'text-emerald-500 opacity-100' : 'opacity-60',
              )}
            />
          )}
          <span className="truncate">{categoryLabel}</span>
          {event.user_name && (
            <>
              <span className="opacity-50">·</span>
              <span className="truncate">{event.user_name}</span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}
