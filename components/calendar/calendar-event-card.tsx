'use client'

import type { CalendarEvent, CalendarCategory } from '@/types/calendar'
import { format, parseISO } from 'date-fns'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Colors that work in both light and dark mode
const EVENT_COLORS: Record<CalendarCategory, { bg: string; text: string; dot: string }> = {
  contract_expiry:   { bg: 'bg-amber-500/15 dark:bg-amber-500/25',     text: 'text-amber-700 dark:text-amber-300',     dot: 'bg-amber-500' },
  lead_expiry:       { bg: 'bg-red-500/15 dark:bg-red-500/25',         text: 'text-red-700 dark:text-red-300',         dot: 'bg-red-500' },
  lead_followup:     { bg: 'bg-yellow-500/15 dark:bg-yellow-500/25',   text: 'text-yellow-700 dark:text-yellow-300',   dot: 'bg-yellow-500' },
  process_task:      { bg: 'bg-violet-500/15 dark:bg-violet-500/25',   text: 'text-violet-700 dark:text-violet-300',   dot: 'bg-violet-500' },
  process_subtask:   { bg: 'bg-teal-500/15 dark:bg-teal-500/25',       text: 'text-teal-700 dark:text-teal-300',       dot: 'bg-teal-500' },
  birthday:          { bg: 'bg-pink-500/15 dark:bg-pink-500/25',       text: 'text-pink-700 dark:text-pink-300',       dot: 'bg-pink-500' },
  vacation:          { bg: 'bg-slate-500/15 dark:bg-slate-500/25',     text: 'text-slate-700 dark:text-slate-300',     dot: 'bg-slate-400' },
  company_event:     { bg: 'bg-emerald-500/15 dark:bg-emerald-500/25', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  marketing_event:   { bg: 'bg-orange-500/15 dark:bg-orange-500/25',   text: 'text-orange-700 dark:text-orange-300',   dot: 'bg-orange-500' },
  process_event:     { bg: 'bg-cyan-500/15 dark:bg-cyan-500/25',       text: 'text-cyan-700 dark:text-cyan-300',       dot: 'bg-cyan-500' },
  meeting:           { bg: 'bg-indigo-500/15 dark:bg-indigo-500/25',   text: 'text-indigo-700 dark:text-indigo-300',   dot: 'bg-indigo-500' },
  visit:             { bg: 'bg-rose-500/15 dark:bg-rose-500/25',       text: 'text-rose-700 dark:text-rose-300',       dot: 'bg-rose-500' },
  reminder:          { bg: 'bg-sky-500/15 dark:bg-sky-500/25',         text: 'text-sky-700 dark:text-sky-300',         dot: 'bg-sky-500' },
  custom:            { bg: 'bg-stone-500/15 dark:bg-stone-500/25',     text: 'text-stone-700 dark:text-stone-300',     dot: 'bg-stone-500' },
}

interface CalendarEventCardProps {
  event: CalendarEvent
  compact?: boolean
}

export function CalendarEventCard({ event, compact = false }: CalendarEventCardProps) {
  const colors = EVENT_COLORS[event.category] ?? EVENT_COLORS.custom
  // Visitas em estado `proposal` ainda estão à espera de confirmação do
  // seller agent. No calendário, mostramo-las com opacidade reduzida e
  // contorno tracejado para sinalizar visualmente que ainda não estão fixas.
  const isPendingVisit = event.category === 'visit' && event.status === 'proposal'

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-tight cursor-pointer transition-colors truncate',
        colors.bg,
        colors.text,
        'hover:opacity-80',
        isPendingVisit && 'opacity-60 border border-dashed border-current/40',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', colors.dot)} />
      {event.priority === 'urgent' && (
        <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-red-500" />
      )}
      {!compact && !event.all_day && event.start_date && (
        <span className="shrink-0 font-medium">
          {format(parseISO(event.start_date), 'HH:mm')}
        </span>
      )}
      <span className="truncate">{event.title}</span>
      {event.is_overdue && (
        <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
      )}
    </div>
  )
}
