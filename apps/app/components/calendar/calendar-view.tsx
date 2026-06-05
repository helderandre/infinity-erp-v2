'use client'

import type { CalendarEvent } from '@/types/calendar'
import type { TaskWithRelations } from '@/types/task'
import { CalendarMonthGrid } from './calendar-month-grid'
import { CalendarWeekView } from './calendar-week-view'
import { CalendarAgendaView } from './calendar-agenda-view'
import { CalendarDayView } from './calendar-day-view'
import { Skeleton } from '@/components/ui/skeleton'

export type CalendarViewMode = 'month' | 'week' | 'agenda' | 'day'

interface CalendarViewProps {
  events: CalendarEvent[]
  tasks?: TaskWithRelations[]
  isLoading: boolean
  currentDate: Date
  view: CalendarViewMode
  onDateChange: (date: Date) => void
  onViewChange: (view: CalendarViewMode) => void
  onEventClick: (event: CalendarEvent) => void
  onDayClick: (date: Date) => void
  onCreateAtTime?: (date: Date) => void
  onDayNumberClick?: (date: Date) => void
  onDayBack?: () => void
  dayBackLabel?: string
  onTaskSelect?: (task: TaskWithRelations) => void
  onTaskToggleComplete?: (id: string, isCompleted: boolean) => void
}

function CalendarSkeleton({ view }: { view: 'month' | 'week' }) {
  if (view === 'week') {
    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30 p-2">
          <div />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 border-l px-2">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
          ))}
        </div>
        {/* Time rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[60px_repeat(7,1fr)] border-b min-h-[48px]"
          >
            <div className="p-2 border-r">
              <Skeleton className="h-3 w-8" />
            </div>
            {Array.from({ length: 7 }).map((_, j) => (
              <div key={j} className="border-l p-1">
                {i % 3 === 0 && j % 2 === 0 && (
                  <Skeleton className="h-5 w-full rounded" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 border-b bg-muted/30 p-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex justify-center">
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[100px] border-b border-r p-2 space-y-1"
          >
            <div className="flex justify-end">
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
            {i % 4 === 0 && <Skeleton className="h-4 w-full rounded" />}
            {i % 5 === 1 && (
              <>
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-4 w-1/2 rounded" />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CalendarView({
  events,
  tasks,
  isLoading,
  currentDate,
  view,
  onDateChange,
  onViewChange,
  onEventClick,
  onDayClick,
  onCreateAtTime,
  onDayNumberClick,
  onDayBack,
  dayBackLabel,
  onTaskSelect,
  onTaskToggleComplete,
}: CalendarViewProps) {
  if (isLoading) {
    const skeletonView = view === 'week' ? 'week' : 'month'
    return <CalendarSkeleton view={skeletonView} />
  }

  if (view === 'day') {
    return (
      <CalendarDayView
        date={currentDate}
        events={events}
        tasks={tasks ?? []}
        onEventClick={onEventClick}
        onTaskSelect={onTaskSelect}
        onTaskToggleComplete={onTaskToggleComplete}
        onBack={onDayBack ?? (() => onViewChange('month'))}
        backLabel={dayBackLabel}
      />
    )
  }

  if (view === 'agenda') {
    return (
      <CalendarAgendaView
        currentDate={currentDate}
        events={events}
        tasks={tasks ?? []}
        onEventClick={onEventClick}
        onTaskSelect={onTaskSelect}
        onTaskToggleComplete={onTaskToggleComplete}
      />
    )
  }

  if (view === 'week') {
    return (
      <CalendarWeekView
        currentDate={currentDate}
        events={events}
        tasks={tasks ?? []}
        onEventClick={onEventClick}
        onDayClick={onDayClick}
        onCreateAtTime={onCreateAtTime}
      />
    )
  }

  return (
    <CalendarMonthGrid
      currentDate={currentDate}
      events={events}
      tasks={tasks ?? []}
      onEventClick={onEventClick}
      onDayClick={onDayClick}
      onDayNumberClick={onDayNumberClick}
    />
  )
}
