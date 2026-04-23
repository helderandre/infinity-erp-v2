'use client'

import type { CalendarEvent, CalendarCategory } from '@/types/calendar'
import { CALENDAR_CATEGORY_COLORS } from '@/types/calendar'
import { format, parseISO } from 'date-fns'
import { AlertCircle, Infinity as InfinityIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Kept exported for consumers that only want the coloured-bar strip class
// without importing the whole colour map (agenda kanban cards, mobile bars).
export const CALENDAR_EVENT_BORDER_L: Record<CalendarCategory, string> = {
  contract_expiry: 'border-l-stone-500',
  lead_expiry: 'border-l-red-700',
  lead_followup: 'border-l-yellow-600',
  process_task: 'border-l-violet-600',
  process_subtask: 'border-l-teal-600',
  birthday: 'border-l-rose-500',
  vacation: 'border-l-slate-500',
  company_event: 'border-l-yellow-500',
  marketing_event: 'border-l-orange-600',
  process_event: 'border-l-sky-700',
  meeting: 'border-l-indigo-700',
  visit: 'border-l-fuchsia-600',
  reminder: 'border-l-blue-600',
  custom: 'border-l-neutral-500',
}

interface CalendarEventCardProps {
  event: CalendarEvent
  compact?: boolean
}

export function CalendarEventCard({ event, compact = false }: CalendarEventCardProps) {
  const colors = CALENDAR_CATEGORY_COLORS[event.category]
  const isPendingVisit = event.category === 'visit' && event.status === 'proposal'

  return (
    <div
      className={cn(
        'flex items-stretch rounded-md overflow-hidden cursor-pointer hover:opacity-85 transition-opacity',
        colors?.bg,
        colors?.text,
        isPendingVisit && 'opacity-60 ring-1 ring-dashed ring-current/40',
      )}
    >
      {/* Solid colored left strip — matches the week view style */}
      <div className={cn('w-[3px] shrink-0', colors?.dot)} />
      <div className="flex-1 min-w-0 flex items-center gap-1 px-1.5 py-0.5 text-[11px] leading-tight">
        {event.category === 'company_event' && (
          <InfinityIcon className="h-3 w-3 shrink-0" strokeWidth={2.25} />
        )}
        {event.priority === 'urgent' && (
          <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-red-500" />
        )}
        {!compact && !event.all_day && event.start_date && (
          <span className="shrink-0 font-medium tabular-nums">
            {format(parseISO(event.start_date), 'HH:mm')}
          </span>
        )}
        <span className="truncate font-medium">{event.title}</span>
        {event.is_overdue && (
          <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
        )}
      </div>
    </div>
  )
}
