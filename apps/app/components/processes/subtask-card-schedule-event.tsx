'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SubtaskCardBase } from './subtask-card-base'
import { ScheduleEventDialog } from './schedule-event-dialog'
import {
  CalendarPlus,
  CalendarCheck,
  Clock,
  Users,
  Pencil,
  Undo2,
  Trash2,
  Loader2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ProcSubtask } from '@/types/subtask'

interface Owner {
  id: string
  name: string
  person_type?: string
}

interface Consultant {
  id: string
  commercial_name: string
}

interface EventDetails {
  id: string
  title: string
  description?: string
  start_date: string
  end_date?: string
  all_day: boolean
  owner_ids?: string[]
  attendee_user_ids?: string[]
}

interface SubtaskCardScheduleEventProps {
  subtask: ProcSubtask
  processId: string
  taskId: string
  owners: Owner[]
  consultants: Consultant[]
  onRefresh?: () => void
}

export function SubtaskCardScheduleEvent({
  subtask,
  processId,
  taskId,
  owners,
  consultants,
  onRefresh,
}: SubtaskCardScheduleEventProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null)
  const [loadingEvent, setLoadingEvent] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const calendarEventId = subtask.config?.calendar_event_id as string | undefined
  const isScheduled = subtask.is_completed && !!calendarEventId
  const isBlocked = !!subtask.is_blocked

  // Carregar detalhes do evento se já agendado
  const loadEventDetails = useCallback(async () => {
    if (!calendarEventId) return
    setLoadingEvent(true)
    try {
      const res = await fetch(`/api/calendar/events/${calendarEventId}`)
      if (res.ok) {
        const { data } = await res.json()
        setEventDetails({
          id: data.id,
          title: data.title,
          description: data.description,
          start_date: data.start_date,
          end_date: data.end_date,
          all_day: data.all_day,
          owner_ids: data.owner_ids || [],
          attendee_user_ids: [],
        })
      }
    } catch {
      // silenciar
    } finally {
      setLoadingEvent(false)
    }
  }, [calendarEventId])

  useEffect(() => {
    loadEventDetails()
  }, [loadEventDetails])

  const handleSuccess = () => {
    loadEventDetails()
    onRefresh?.()
  }

  // Cancelar agendamento — reverte subtarefa e elimina evento (server-side com activity log)
  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtask.id}/schedule-event`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('Erro ao cancelar agendamento')

      setEventDetails(null)
      toast.success('Agendamento cancelado')
      onRefresh?.()
    } catch {
      toast.error('Erro ao cancelar agendamento')
    } finally {
      setIsCancelling(false)
      setCancelDialogOpen(false)
    }
  }

  // Formatar data para exibição
  const formatDate = (dateStr: string, allDay: boolean) => {
    const date = parseISO(dateStr)
    if (allDay) {
      return format(date, "d 'de' MMMM 'de' yyyy", { locale: pt })
    }
    return format(date, "d 'de' MMMM 'às' HH:mm", { locale: pt })
  }

  // Encontrar nomes dos owners selecionados
  const selectedOwnerNames = eventDetails?.owner_ids
    ?.map((id) => owners.find((o) => o.id === id)?.name)
    .filter(Boolean) || []

  return (
    <>
      <SubtaskCardBase
        subtask={subtask}
        state={isScheduled ? 'completed' : 'pending'}
        icon={
          isScheduled ? (
            <CalendarCheck className="h-4 w-4 text-emerald-500" />
          ) : (
            <CalendarPlus className="h-4 w-4 text-indigo-500" />
          )
        }
        typeLabel="Evento"
      >
        {isScheduled && eventDetails ? (
          // Evento já agendado — mostrar resumo + acções
          <div className="space-y-2">
            <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/15 p-3 space-y-2">
              {/* Data e hora */}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <span className="font-medium">
                  {formatDate(eventDetails.start_date, eventDetails.all_day)}
                </span>
                {eventDetails.all_day && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    Dia todo
                  </Badge>
                )}
              </div>

              {/* End date se diferente */}
              {eventDetails.end_date && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-5.5">
                  até {formatDate(eventDetails.end_date, eventDetails.all_day)}
                </div>
              )}

              {/* Proprietários */}
              {selectedOwnerNames.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span>{selectedOwnerNames.join(', ')}</span>
                </div>
              )}

              {/* Descrição */}
              {eventDetails.description && (
                <p className="text-xs text-muted-foreground pl-5.5 line-clamp-2">
                  {eventDetails.description}
                </p>
              )}
            </div>

            {/* Acções: Editar | Cancelar */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-full"
                onClick={() => setDialogOpen(true)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                onClick={() => setCancelDialogOpen(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          // Não agendado — botão para agendar
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'w-full border-dashed rounded-full',
              !isBlocked && 'border-indigo-300 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-500/10'
            )}
            disabled={isBlocked}
            onClick={() => setDialogOpen(true)}
          >
            <CalendarPlus className="mr-2 h-3.5 w-3.5" />
            Agendar Evento
          </Button>
        )}
      </SubtaskCardBase>

      {/* Dialog de agendamento/edição */}
      <ScheduleEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        processId={processId}
        taskId={taskId}
        subtaskId={subtask.id}
        subtaskTitle={subtask.title}
        existingEvent={eventDetails}
        owners={owners}
        consultants={consultants}
        onSuccess={handleSuccess}
      />

      {/* Confirmação de cancelamento */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende cancelar este agendamento? O evento será eliminado do calendário e a subtarefa voltará a pendente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancelar Agendamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
