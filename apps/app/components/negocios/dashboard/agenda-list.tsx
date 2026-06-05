'use client'

import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Building2, Calendar, CalendarDays, Clock, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { VISIT_STATUS_COLORS } from '@/lib/constants'
import type { AgendaItem } from '@/hooks/use-negocio-agenda'

interface AgendaListProps {
  upcoming: AgendaItem[]
  past: AgendaItem[]
  isLoading: boolean
  /** Botão "Agendar visita" no topo. */
  onScheduleVisit: () => void
}

export function AgendaList({ upcoming, past, isLoading, onScheduleVisit }: AgendaListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    )
  }

  const total = upcoming.length + past.length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total === 0
            ? 'Sem agenda'
            : `${total} ${total === 1 ? 'item' : 'itens'} · ${upcoming.length} ${upcoming.length === 1 ? 'agendado' : 'agendados'}`}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full text-xs h-8"
          onClick={onScheduleVisit}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Agendar visita
        </Button>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">Nada na agenda</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-[280px]">
            Agende uma visita ou crie um evento no calendário ligado ao lead/imóvel.
          </p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <Section label="Próximos" items={upcoming} />
          )}
          {past.length > 0 && (
            <Section
              label="Histórico"
              items={past.slice(0, 30)}
              isPast
            />
          )}
        </>
      )}
    </div>
  )
}

function Section({
  label,
  items,
  isPast,
}: {
  label: string
  items: AgendaItem[]
  isPast?: boolean
}) {
  return (
    <section className="space-y-2">
      <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <AgendaRow key={item.id} item={item} isPast={isPast} />
        ))}
      </ul>
    </section>
  )
}

function AgendaRow({ item, isPast }: { item: AgendaItem; isPast?: boolean }) {
  const router = useRouter()
  const dt = new Date(item.start_at)
  const isVisit = item.source === 'visit'

  const statusStyle = isVisit && item.status
    ? VISIT_STATUS_COLORS[item.status as keyof typeof VISIT_STATUS_COLORS]
    : null
  const statusLabel = statusStyle?.label || categoryLabel(item.category)

  return (
    <li
      onClick={() => router.push(item.href)}
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-3 py-2.5 cursor-pointer transition-colors',
        'hover:bg-card hover:border-border',
        isPast && 'opacity-80',
      )}
    >
      {/* Source badge */}
      <div
        className={cn(
          'h-9 w-9 rounded-full flex items-center justify-center shrink-0 border',
          isVisit
            ? 'bg-rose-50 border-rose-200/60 text-rose-600 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-300'
            : 'bg-indigo-50 border-indigo-200/60 text-indigo-600 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-300',
        )}
      >
        {isVisit ? <Building2 className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{item.title}</p>
          {statusLabel && (
            <span
              className={cn(
                'inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full',
                statusStyle ? statusStyle.bg : 'bg-muted/60',
                statusStyle ? statusStyle.text : 'text-muted-foreground',
              )}
            >
              {statusLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {format(dt, "EEE, d 'de' MMM", { locale: pt })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(dt, 'HH:mm', { locale: pt })}
          </span>
          {!isVisit && item.property?.title && (
            <span className="truncate inline-flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {item.property.title}
            </span>
          )}
        </div>
      </div>
    </li>
  )
}

function categoryLabel(category: string | null): string | null {
  if (!category) return null
  switch (category) {
    case 'meeting':
      return 'Reunião'
    case 'company_event':
      return 'Empresa'
    case 'marketing_event':
      return 'Marketing'
    case 'birthday':
      return 'Aniversário'
    case 'vacation':
      return 'Férias'
    case 'reminder':
      return 'Lembrete'
    case 'custom':
      return 'Outro'
    default:
      return category
  }
}
