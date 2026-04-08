'use client'

import Link from 'next/link'
import { useState } from 'react'
import { format, isPast, isToday } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  CalendarDays, ChevronRight, MessageSquare, Paperclip, RotateCcw, User, Workflow,
  Check, X, Loader2, MapPin,
} from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { TASK_PRIORITY_MAP, TASK_ENTITY_LABELS } from '@/types/task'
import type { TaskWithRelations, TaskEntityType } from '@/types/task'

interface TaskListItemProps {
  task: TaskWithRelations
  onToggleComplete: (id: string, isCompleted: boolean) => void
  onSelect: (task: TaskWithRelations) => void
  onRefresh?: () => void
}

export function TaskListItem({ task, onToggleComplete, onSelect, onRefresh }: TaskListItemProps) {
  // Render especial para propostas de visita PENDENTES — card âmbar com botões.
  // Quando já foram respondidas (is_completed=true), caem no render normal de
  // task concluída para servirem de histórico.
  if (task.source === 'visit_proposal' && !task.is_completed) {
    return <VisitProposalItem task={task} onRefresh={onRefresh} />
  }

  const priority = TASK_PRIORITY_MAP[task.priority as keyof typeof TASK_PRIORITY_MAP]
  const isOverdue = task.due_date && !task.is_completed && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))
  const isDueToday = task.due_date && isToday(new Date(task.due_date))
  const subTaskCount = (task.sub_tasks || []).length
  const subTasksDone = (task.sub_tasks || []).filter((st) => st.is_completed).length
  const commentCount = (task as any).task_comments?.[0]?.count || 0
  const attachmentCount = (task as any).task_attachments?.[0]?.count || 0
  const isProcessTask = task.source === 'proc_task' || task.source === 'proc_subtask'
  // Visit proposals respondidas são read-only — o checkbox não é toggleable
  // (a visita já avançou para outro estado, isto é apenas histórico)
  const isVisitProposalRecord = task.source === 'visit_proposal'
  const isReadOnly = isProcessTask || isVisitProposalRecord

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50 cursor-pointer',
        task.is_completed && 'opacity-60',
      )}
      onClick={() => onSelect(task)}
    >
      {/* Checkbox — disabled para tasks vindas de outras fontes (proc_task, proc_subtask, visit_proposal) */}
      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={task.is_completed}
          onCheckedChange={() => !isReadOnly && onToggleComplete(task.id, task.is_completed)}
          disabled={isReadOnly}
          className={cn('mt-0.5', priority.color, isReadOnly && 'cursor-not-allowed opacity-60')}
          title={
            isProcessTask
              ? 'Concluir no detalhe do processo'
              : isVisitProposalRecord
                ? 'Acção registada — gerida no detalhe da visita'
                : undefined
          }
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Priority dot */}
          <span className={cn('h-2 w-2 shrink-0 rounded-full', priority.dot)} />

          {/* Title */}
          <span className={cn(
            'text-sm font-medium truncate',
            task.is_completed && 'line-through text-muted-foreground',
          )}>
            {task.title}
          </span>

          {/* Recurring icon */}
          {task.is_recurring && (
            <RotateCcw className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {/* Due date */}
          {task.due_date && (
            <span className={cn(
              'flex items-center gap-1',
              isOverdue && 'text-red-600 font-medium',
              isDueToday && 'text-orange-600 font-medium',
            )}>
              <CalendarDays className="h-3 w-3" />
              {format(new Date(task.due_date), 'd MMM', { locale: pt })}
            </span>
          )}

          {/* Assignee */}
          {task.assignee && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.assignee.commercial_name}
            </span>
          )}

          {/* Entity link — clickable when we have a target */}
          {isVisitProposalRecord ? (
            <Badge
              variant="outline"
              className={cn(
                'text-[0.65rem] h-4 px-1.5',
                // Verde se foi confirmada (a visita ficou em scheduled ou já avançou),
                // vermelho se foi rejeitada
                task.title.startsWith('Proposta rejeitada')
                  ? 'border-red-500/30 text-red-700 dark:text-red-300 bg-red-500/5'
                  : 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5',
              )}
            >
              {task.title.startsWith('Proposta rejeitada') ? 'Rejeitada' : 'Confirmada'}
            </Badge>
          ) : isProcessTask && task.process_id ? (
            <Link
              href={`/dashboard/processos/${task.process_id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex"
            >
              <Badge
                variant="outline"
                className="text-[0.65rem] h-4 px-1.5 gap-1 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 transition-colors"
              >
                <Workflow className="h-2.5 w-2.5" />
                {task.process_ref || 'Processo'}
                {task.stage_name && <span className="opacity-70">· {task.stage_name}</span>}
              </Badge>
            </Link>
          ) : task.entity_type ? (
            <Badge variant="outline" className="text-[0.65rem] h-4 px-1.5">
              {TASK_ENTITY_LABELS[task.entity_type as TaskEntityType]}
            </Badge>
          ) : null}

          {/* Sub-tasks */}
          {subTaskCount > 0 && (
            <span className="flex items-center gap-1">
              {subTasksDone}/{subTaskCount}
            </span>
          )}

          {/* Comments */}
          {commentCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {commentCount}
            </span>
          )}

          {/* Attachments */}
          {attachmentCount > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              {attachmentCount}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
    </div>
  )
}

// ─── Visit Proposal Item ────────────────────────────────────────────────────
// Render especial para visit proposals: card âmbar com info da visita e dois
// botões inline (Confirmar / Rejeitar). Rejeitar abre dialog de motivo.

function VisitProposalItem({
  task,
  onRefresh,
}: {
  task: TaskWithRelations
  onRefresh?: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const visitId = task.visit_id
  const propertyTitle = task.property_title || 'Imóvel'
  const clientName = task.visit_client_name || 'Cliente'
  const buyerAgent = task.visit_buyer_agent_name
  const visitWhen = task.due_date
    ? format(new Date(task.due_date), "EEE, d 'de' MMM 'às' HH:mm", { locale: pt })
    : null

  const respond = async (decision: 'confirm' | 'reject', reason?: string) => {
    if (!visitId) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/visits/${visitId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision === 'confirm' ? { decision } : { decision, reason }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao responder à proposta')
      }
      toast.success(decision === 'confirm' ? 'Visita confirmada' : 'Proposta rejeitada')
      setRejectOpen(false)
      setRejectReason('')
      onRefresh?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-medium text-amber-700 dark:text-amber-300 border-amber-500/40 bg-amber-500/10">
                Proposta de visita
              </Badge>
            </div>
            <div className="mt-1.5 flex items-center gap-2 min-w-0">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{propertyTitle}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {clientName}
              </span>
              {buyerAgent && (
                <span>· por {buyerAgent}</span>
              )}
              {visitWhen && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {visitWhen}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => respond('confirm')}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 border-red-500/30 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
              onClick={() => setRejectOpen(true)}
              disabled={isSubmitting}
            >
              <X className="h-3.5 w-3.5" />
              Rejeitar
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar proposta de visita</AlertDialogTitle>
            <AlertDialogDescription>
              Indica o motivo pelo qual estás a rejeitar esta proposta. O consultor do
              comprador vai receber esta mensagem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Ex: Imóvel com visita já marcada nesse horário"
            rows={3}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!rejectReason.trim() || isSubmitting}
              onClick={(e) => {
                e.preventDefault()
                respond('reject', rejectReason.trim())
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Rejeitar proposta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
