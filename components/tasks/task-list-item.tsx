'use client'

import Link from 'next/link'
import { useState } from 'react'
import { format, isPast, isToday, isTomorrow, isYesterday } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Check, X, Loader2, RotateCcw, Workflow,
  Building2, User, Handshake, UserSquare, ListTodo, CalendarCheck,
  MapPin, CalendarDays,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/types/task'

interface TaskListItemProps {
  task: TaskWithRelations
  onToggleComplete: (id: string, isCompleted: boolean) => void
  onSelect: (task: TaskWithRelations) => void
  onRefresh?: () => void
  isSelected?: boolean
}

function buildDueShort(date: Date): string {
  const time = format(date, 'HH:mm', { locale: pt })
  if (isToday(date)) return `Hoje ${time}`
  if (isTomorrow(date)) return `Amanhã ${time}`
  if (isYesterday(date)) return `Ontem ${time}`
  return format(date, "d MMM, HH:mm", { locale: pt })
}

function iconForTask(task: TaskWithRelations) {
  if (task.source === 'proc_task' || task.source === 'proc_subtask') return Workflow
  switch (task.entity_type) {
    case 'property': return Building2
    case 'lead': return User
    case 'negocio': return Handshake
    case 'owner': return UserSquare
    case 'process': return Workflow
    default: return ListTodo
  }
}

function subtitleFor(task: TaskWithRelations): string | null {
  if (task.description) return task.description
  if ((task.source === 'proc_task' || task.source === 'proc_subtask') && task.stage_name) {
    return task.property_title
      ? `${task.property_title} · ${task.stage_name}`
      : task.stage_name
  }
  if (task.property_title) return task.property_title
  return null
}

// ─── Small round check in top-right ────────────────────────────────────────

function CheckCircle({
  checked,
  disabled,
  onClick,
  title,
}: {
  checked: boolean
  disabled?: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={title}
      className={cn(
        'size-5 rounded-full flex items-center justify-center transition-all shrink-0',
        checked
          ? 'bg-foreground text-background shadow-[0_1px_3px_rgba(0,0,0,0.18)]'
          : 'bg-muted/40 hover:bg-muted border border-border/50 hover:border-border',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </button>
  )
}

// ─── Main item ──────────────────────────────────────────────────────────────

export function TaskListItem({ task, onToggleComplete, onSelect, onRefresh, isSelected = false }: TaskListItemProps) {
  if (task.source === 'visit_proposal' && !task.is_completed) {
    return <VisitProposalItem task={task} onSelect={onSelect} onRefresh={onRefresh} isSelected={isSelected} />
  }

  const Icon = iconForTask(task)
  const dueDate = task.due_date ? new Date(task.due_date) : null
  const isOverdue = dueDate && !task.is_completed && isPast(dueDate) && !isToday(dueDate)
  const isDueToday = dueDate && isToday(dueDate)
  const subtitle = subtitleFor(task)
  const isProcessTask = task.source === 'proc_task' || task.source === 'proc_subtask'
  const isVisitProposalRecord = task.source === 'visit_proposal'
  const isReadOnly = isProcessTask || isVisitProposalRecord

  // Tint do ícone para prioridades altas — subtil, não invasivo
  const iconTint = task.is_completed
    ? 'bg-muted/50 text-muted-foreground/60'
    : task.priority === 1 ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
    : task.priority === 2 ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400'
    : 'bg-muted/70 text-foreground/65 dark:bg-neutral-800/60'

  return (
    <div
      className={cn(
        'group relative rounded-2xl p-4 cursor-pointer transition-all duration-200',
        // Soft "pillow" shadow — very spread, low contrast (inspirado na referência)
        'bg-card shadow-[0_2px_10px_-2px_rgba(15,23,42,0.06),0_1px_3px_-1px_rgba(15,23,42,0.04)]',
        'hover:shadow-[0_6px_20px_-4px_rgba(15,23,42,0.1),0_2px_6px_-2px_rgba(15,23,42,0.05)]',
        'hover:-translate-y-[1px]',
        isSelected && 'ring-1 ring-primary/25 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.14)]',
        // Completed: bg muted + no shadow (card fica "rebaixado")
        task.is_completed && [
          'bg-muted/40 dark:bg-muted/20',
          'shadow-none hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
          'hover:translate-y-0',
        ],
      )}
      onClick={() => onSelect(task)}
    >
      <div className="flex items-start gap-3">
        {/* Ícone circular */}
        <div className={cn(
          'size-11 rounded-full flex items-center justify-center shrink-0 transition-colors',
          iconTint,
        )}>
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0 pt-1 pr-7">
          <div className="flex items-center gap-1.5 min-w-0">
            <h4 className={cn(
              'text-[0.9rem] font-semibold leading-snug truncate tracking-tight',
              task.is_completed && 'text-muted-foreground',
            )}>
              {task.title}
            </h4>
            {task.is_recurring && (
              <RotateCcw className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
          </div>

          {subtitle && (
            <p className={cn(
              'text-xs text-muted-foreground/80 mt-0.5 line-clamp-1',
              task.is_completed && 'text-muted-foreground/60',
            )}>
              {subtitle}
            </p>
          )}

          {/* Meta row — badges à esquerda, data à direita */}
          {(dueDate || (isProcessTask && task.process_ref) || isVisitProposalRecord) && (
            <div className="flex items-center justify-between gap-2 mt-2 text-[11px]">
              {/* Badges à esquerda (processo / estado) */}
              <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                {isProcessTask && task.process_id && task.process_ref && (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-4 px-1.5 rounded-full gap-0.5 bg-muted/50"
                  >
                    <Workflow className="h-2.5 w-2.5" />
                    {task.process_ref}
                  </Badge>
                )}
                {isVisitProposalRecord && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] h-4 px-1.5 rounded-full',
                      task.title.startsWith('Proposta rejeitada')
                        ? 'border-red-500/30 text-red-700 dark:text-red-300 bg-red-500/5'
                        : 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5',
                    )}
                  >
                    {task.title.startsWith('Proposta rejeitada') ? 'Rejeitada' : 'Confirmada'}
                  </Badge>
                )}
              </div>

              {/* Data à direita */}
              {dueDate && (
                <span className={cn(
                  'flex items-center gap-1 shrink-0 ml-auto',
                  isOverdue ? 'text-red-600 font-medium'
                    : isDueToday ? 'text-orange-600 font-medium'
                    : 'text-muted-foreground',
                )}>
                  <CalendarDays className="h-3 w-3" />
                  {buildDueShort(dueDate)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Check circle no topo-direito */}
        <div className="absolute top-4 right-4">
          <CheckCircle
            checked={task.is_completed}
            disabled={isReadOnly}
            onClick={() => !isReadOnly && onToggleComplete(task.id, task.is_completed)}
            title={
              isProcessTask ? 'Concluir no detalhe do processo'
              : isVisitProposalRecord ? 'Gerida no detalhe da visita'
              : undefined
            }
          />
        </div>
      </div>
    </div>
  )
}

// ─── Visit Proposal Item ────────────────────────────────────────────────────

function VisitProposalItem({
  task,
  onSelect,
  onRefresh,
  isSelected = false,
}: {
  task: TaskWithRelations
  onSelect: (task: TaskWithRelations) => void
  onRefresh?: () => void
  isSelected?: boolean
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const visitId = task.visit_id
  const propertyTitle = task.property_title || 'Imóvel'
  const clientName = task.visit_client_name || 'Cliente'
  const buyerAgent = task.visit_buyer_agent_name
  const dueDate = task.due_date ? new Date(task.due_date) : null

  const subtitle = buyerAgent ? `${clientName} · por ${buyerAgent}` : clientName

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
      <div
        className={cn(
          'group relative rounded-2xl p-4 cursor-pointer transition-all duration-200',
          'bg-amber-50/60 dark:bg-amber-950/15',
          'shadow-[0_2px_10px_-2px_rgba(217,119,6,0.12),0_1px_3px_-1px_rgba(217,119,6,0.08)]',
          'hover:shadow-[0_6px_20px_-4px_rgba(217,119,6,0.18),0_2px_6px_-2px_rgba(217,119,6,0.1)]',
          'hover:-translate-y-[1px]',
          isSelected && 'ring-1 ring-amber-500/40 shadow-[0_8px_24px_-4px_rgba(217,119,6,0.22)]',
        )}
        onClick={() => onSelect(task)}
      >
        <div className="flex items-start gap-3">
          {/* Ícone circular âmbar */}
          <div className="size-11 rounded-full flex items-center justify-center shrink-0 bg-amber-100/80 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            <MapPin className="size-[18px]" strokeWidth={1.75} />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 min-w-0">
              <h4 className="text-[0.9rem] font-semibold leading-snug truncate tracking-tight">
                {propertyTitle}
              </h4>
              <Badge
                variant="outline"
                className="text-[9px] font-medium text-amber-700 dark:text-amber-300 border-amber-500/40 bg-amber-500/10 rounded-full px-1.5 h-4 shrink-0"
              >
                Proposta
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-1">
              {subtitle}
            </p>

            <div className="flex items-center justify-between gap-2 mt-2.5">
              {dueDate && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarCheck className="h-3 w-3" />
                  {buildDueShort(dueDate)}
                </span>
              )}

              <div
                className="flex items-center gap-1.5 shrink-0 ml-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="sm"
                  className="h-6 px-2.5 gap-1 text-[11px] rounded-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => respond('confirm')}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                  Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2.5 gap-1 text-[11px] rounded-full border-red-500/30 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                  onClick={() => setRejectOpen(true)}
                  disabled={isSubmitting}
                >
                  <X className="h-2.5 w-2.5" />
                  Rejeitar
                </Button>
              </div>
            </div>
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
