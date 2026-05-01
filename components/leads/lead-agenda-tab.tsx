'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon, ListTodo } from 'lucide-react'
import { LeadCalendarTab } from './lead-calendar-tab'
import { LeadTasksSubtab } from './lead-tasks-subtab'
import { cn } from '@/lib/utils'

interface LeadAgendaTabProps {
  contactId: string
  negocioIds: string[]
  onCreateEvent: () => void
  onCreateTask: () => void
}

type Sub = 'calendario' | 'tarefas'

/**
 * Agenda tab — wraps the calendar (events linked to this contact) and the
 * tasks list (tasks linked to this contact OR to its opportunities) under
 * two pill sub-tabs in the same visual language used elsewhere on the page.
 */
export function LeadAgendaTab({
  contactId,
  negocioIds,
  onCreateEvent,
  onCreateTask,
}: LeadAgendaTabProps) {
  const [sub, setSub] = useState<Sub>('calendario')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-full bg-muted/50 p-1 w-fit border border-border/30">
        {([
          { key: 'calendario' as const, label: 'Calendário', Icon: CalendarIcon },
          { key: 'tarefas' as const, label: 'Tarefas', Icon: ListTodo },
        ]).map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSub(key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
              sub === key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {sub === 'calendario' ? (
        <LeadCalendarTab contactId={contactId} onCreateEvent={onCreateEvent} />
      ) : (
        <LeadTasksSubtab
          contactId={contactId}
          negocioIds={negocioIds}
          onCreateTask={onCreateTask}
        />
      )}
    </div>
  )
}
