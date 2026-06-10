'use client'

import type { CalendarEvent, CalendarCategory } from '@/types/calendar'
import { getEventColors } from '@/types/calendar'
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
}

export function CalendarEventCard({ event }: CalendarEventCardProps) {
  const colors = getEventColors(event)
  const isPendingVisit = event.category === 'visit' && event.status === 'proposal'
  // Eventos de dia inteiro rendem como chip sólido (estilo mube-crm); eventos
  // com hora rendem como chip neutro com dot colorido + hora inline. Eventos
  // pessoais/privados mantêm sempre o pastel amarelo para legibilidade.
  const solid = !!event.all_day && !event.is_private

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1.5 py-[3px] rounded-md cursor-pointer transition-all hover:opacity-80',
        solid
          ? cn(colors?.dot || 'bg-primary', 'text-white')
          : event.is_private
            ? cn(colors?.bg, colors?.text)
            : cn('bg-muted/60', colors?.text),
        isPendingVisit && 'opacity-60 ring-1 ring-dashed ring-current/40',
      )}
    >
      {!solid && (
        <span className={cn('h-2 w-2 rounded-full shrink-0', colors?.dot || 'bg-primary')} />
      )}
      {event.category === 'company_event' && (
        <InfinityIcon className="h-3 w-3 shrink-0" strokeWidth={2.25} />
      )}
      {event.priority === 'urgent' && (
        <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-red-500" />
      )}
      <span className="flex-1 min-w-0 truncate text-[11px] font-medium leading-tight">
        {!event.all_day && event.start_date && (
          <span className="mr-1 opacity-70 tabular-nums">
            {format(parseISO(event.start_date), 'HH:mm')}
          </span>
        )}
        {event.title}
      </span>
      {event.is_overdue && (
        <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
      )}
    </div>
  )
}
