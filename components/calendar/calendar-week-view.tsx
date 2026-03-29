'use client'

import { useMemo } from 'react'
import type { CalendarEvent, CalendarCategory } from '@/types/calendar'
import { CALENDAR_CATEGORY_COLORS } from '@/types/calendar'
import {
  startOfWeek,
  addDays,
  format,
  parseISO,
  isSameDay,
  isToday,
  getHours,
  getMinutes,
  differenceInMinutes,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { CheckCircle2 } from 'lucide-react'

interface CalendarWeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onDayClick: (date: Date) => void
}

const HOUR_START = 0
const HOUR_END = 23
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i)
const HOUR_HEIGHT = 48 // px per hour slot

/** Categories that represent tasks (no duration, shown as a line) vs timed events (shown as blocks) */
const TASK_CATEGORIES: CalendarCategory[] = [
  'process_task', 'process_subtask', 'reminder',
  'lead_followup', 'contract_expiry', 'lead_expiry',
]

function isTaskEvent(event: CalendarEvent): boolean {
  if (event.item_type === 'task') return true
  return TASK_CATEGORIES.includes(event.category)
}

export function CalendarWeekView({
  currentDate,
  events,
  onEventClick,
  onDayClick,
}: CalendarWeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const { allDayEvents, taskEvents, timedEvents } = useMemo(() => {
    const allDay: CalendarEvent[] = []
    const tasks: CalendarEvent[] = []
    const timed: CalendarEvent[] = []
    for (const event of events) {
      const eventDate = parseISO(event.start_date)
      const isInWeek = weekDays.some((d) => isSameDay(d, eventDate))
      if (!isInWeek) continue

      // Multi-day events (end_date on a different day) go to all-day row
      const isMultiDay = event.end_date && !isSameDay(eventDate, parseISO(event.end_date))

      if (event.all_day || isMultiDay) {
        allDay.push(event)
      } else if (isTaskEvent(event)) {
        tasks.push(event)
      } else {
        timed.push(event)
      }
    }
    return { allDayEvents: allDay, taskEvents: tasks, timedEvents: timed }
  }, [events, weekDays])

  const getAllDayEventsForDay = (day: Date) =>
    allDayEvents.filter((event) => isSameDay(parseISO(event.start_date), day))

  const getTaskEventsForDay = (day: Date) =>
    taskEvents.filter((event) => isSameDay(parseISO(event.start_date), day))

  const getTimedEventsForDay = (day: Date) =>
    timedEvents.filter((event) => isSameDay(parseISO(event.start_date), day))

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden h-full">
      {/* Header with day names and dates */}
      <div className="grid grid-cols-[40px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30 shrink-0">
        <div className="px-1 py-2 sm:px-2" />
        {weekDays.map((day) => {
          const today = isToday(day)
          const dayLabel = format(day, 'EEE', { locale: ptBR })
          const capitalizedDay = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)
          const shortDay = capitalizedDay.charAt(0)

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'px-0.5 py-1.5 sm:px-2 sm:py-2 text-center border-l cursor-pointer hover:bg-muted/40 transition-colors',
                today && 'bg-primary/5'
              )}
              onClick={() => onDayClick(day)}
            >
              <div className="text-[10px] sm:text-xs text-muted-foreground">
                <span className="hidden sm:inline">{capitalizedDay}</span>
                <span className="sm:hidden">{shortDay}</span>
              </div>
              <div className={cn('text-xs sm:text-sm font-medium mt-0.5', today && 'text-primary')}>
                <span
                  className={cn(
                    'inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full',
                    today && 'bg-primary text-primary-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day + tasks row */}
      {(allDayEvents.length > 0 || taskEvents.length > 0) && (
        <div className="grid grid-cols-[40px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/10 shrink-0">
          <div className="px-0.5 py-1.5 text-[8px] sm:text-[10px] text-muted-foreground text-right pr-1 sm:pr-2 flex items-start justify-end pt-2">
            <span className="hidden sm:inline">Todo dia</span>
            <span className="sm:hidden">TD</span>
          </div>
          {weekDays.map((day) => {
            const dayAllDay = getAllDayEventsForDay(day)
            const dayTasks = getTaskEventsForDay(day)
            return (
              <div key={day.toISOString()} className="border-l px-0.5 py-1 space-y-0.5 min-h-[28px] overflow-hidden">
                {dayAllDay.map((event) => {
                  const colors = CALENDAR_CATEGORY_COLORS[event.category]
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        'flex items-center gap-1 rounded px-1 py-0.5 text-[10px] sm:text-[11px] leading-tight cursor-pointer overflow-hidden',
                        colors?.bg, colors?.text, 'hover:opacity-80'
                      )}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event) }}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', colors?.dot)} />
                      <span className="truncate">{event.title}</span>
                    </div>
                  )
                })}
                {dayTasks.map((event) => {
                  const isDone = event.status === 'completed'
                  const colors = CALENDAR_CATEGORY_COLORS[event.category]
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        'flex items-center gap-1 rounded px-1 py-0.5 text-[10px] sm:text-[11px] leading-tight cursor-pointer overflow-hidden border border-dashed hover:opacity-80',
                        isDone
                          ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/40'
                          : cn(colors?.bg, colors?.text),
                      )}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event) }}
                    >
                      <CheckCircle2 className={cn('h-2.5 w-2.5 shrink-0', isDone ? 'text-emerald-500' : 'opacity-40')} />
                      <span className={cn('truncate', isDone && 'line-through')}>{event.title}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Time grid — positioned events */}
      <div className="overflow-auto flex-1 min-h-0">
        <div className="relative [--time-col:40px] sm:[--time-col:60px]" style={{ height: HOURS.length * HOUR_HEIGHT }}>
          {/* Time labels */}
          {HOURS.map((hour, i) => (
            <div
              key={hour}
              className="absolute left-0 text-[9px] sm:text-[10px] text-muted-foreground text-right pr-1 sm:pr-2 border-r"
              style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT, width: 'var(--time-col)' }}
            >
              <span className="relative -top-[5px]">{String(hour).padStart(2, '0')}:00</span>
            </div>
          ))}

          {/* Grid lines */}
          {HOURS.map((hour, i) => (
            <div
              key={`line-${hour}`}
              className="absolute right-0 border-b border-border/40"
              style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT, left: 'var(--time-col)' }}
            />
          ))}

          {/* Day columns with positioned events */}
          {weekDays.map((day, dayIdx) => {
            const dayTimedEvents = getTimedEventsForDay(day)
            const today = isToday(day)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'absolute border-l cursor-pointer',
                  today && 'bg-primary/[0.02]'
                )}
                style={{
                  top: 0,
                  bottom: 0,
                  left: `calc(var(--time-col) + (100% - var(--time-col)) * ${dayIdx} / 7)`,
                  width: `calc((100% - var(--time-col)) / 7)`,
                }}
                onClick={() => onDayClick(day)}
              >
                {(() => {
                  // Compute layout: assign column index to overlapping events
                  type LayoutEvent = {
                    event: CalendarEvent
                    top: number
                    height: number
                    col: number
                    totalCols: number
                  }

                  // First pass: compute top/height for each event
                  const items = dayTimedEvents.map((event) => {
                    const eventDate = parseISO(event.start_date)
                    const startHour = getHours(eventDate)
                    const startMin = getMinutes(eventDate)
                    const top = ((startHour - HOUR_START) + startMin / 60) * HOUR_HEIGHT

                    let duration = 60
                    if (event.end_date) {
                      const diff = differenceInMinutes(parseISO(event.end_date), eventDate)
                      duration = diff > 0 ? diff : 60
                    }
                    const maxMinutesLeft = ((HOUR_END + 1) - startHour) * 60 - startMin
                    duration = Math.min(duration, maxMinutesLeft)
                    const height = Math.max((duration / 60) * HOUR_HEIGHT, 22)

                    return { event, top, height, col: 0, totalCols: 1 }
                  }).sort((a, b) => a.top - b.top || b.height - a.height)

                  // Second pass: find overlapping groups and assign columns
                  const placed: LayoutEvent[] = []
                  for (const item of items) {
                    const overlapping = placed.filter(
                      (p) => p.top < item.top + item.height && p.top + p.height > item.top
                    )
                    // Find first free column
                    const usedCols = new Set(overlapping.map((p) => p.col))
                    let col = 0
                    while (usedCols.has(col)) col++
                    item.col = col
                    placed.push(item)
                  }

                  // Third pass: compute totalCols for each overlap group
                  for (const item of placed) {
                    const overlapping = placed.filter(
                      (p) => p.top < item.top + item.height && p.top + p.height > item.top
                    )
                    const maxCol = Math.max(...overlapping.map((p) => p.col)) + 1
                    item.totalCols = maxCol
                  }
                  // Normalize: all items in the same group should have the same totalCols
                  for (const item of placed) {
                    const overlapping = placed.filter(
                      (p) => p.top < item.top + item.height && p.top + p.height > item.top
                    )
                    const maxTotalCols = Math.max(...overlapping.map((p) => p.totalCols))
                    for (const p of overlapping) p.totalCols = maxTotalCols
                  }

                  return placed.map(({ event, top, height, col, totalCols }) => {
                    const colors = CALENDAR_CATEGORY_COLORS[event.category]
                    const eventDate = parseISO(event.start_date)
                    const widthPct = 100 / totalCols
                    const leftPct = col * widthPct

                    return (
                      <div
                        key={event.id}
                        className={cn(
                          'absolute rounded overflow-hidden cursor-pointer transition-opacity hover:opacity-80 flex',
                          colors?.bg,
                          colors?.text,
                        )}
                        style={{
                          top,
                          height,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                        }}
                        onClick={(e) => { e.stopPropagation(); onEventClick(event) }}
                      >
                        <div className={cn('w-[3px] shrink-0 rounded-l', colors?.dot)} />
                        <div className="flex-1 min-w-0 px-1 py-0.5">
                          <p className="text-[9px] sm:text-[10px] font-medium truncate leading-tight">{event.title}</p>
                          {height >= 32 && (
                            <p className="text-[8px] sm:text-[9px] opacity-70 truncate leading-tight">
                              {format(eventDate, 'HH:mm')}
                              {event.end_date && ` – ${format(parseISO(event.end_date), 'HH:mm')}`}
                            </p>
                        )}
                      </div>
                    </div>
                  )
                })
                })()}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
