'use client'

import { useState } from 'react'
import {
  Check, X, Loader2, RotateCcw, MoreHorizontal, MapPin,
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
import {
  PriorityCheck, PriorityFlag, DueDateText, buildDueShort,
} from '@/components/tasks/task-primitives'
import type { TaskWithRelations } from '@/types/task'

interface TaskListItemProps {
  task: TaskWithRelations
  onToggleComplete: (id: string, isCompleted: boolean) => void
  onSelect: (task: TaskWithRelations) => void
  onRefresh?: () => void
  isSelected?: boolean
}

// ─── Main row ──────────────────────────────────────────────────────────────

export function TaskListItem({ task, onToggleComplete, onSelect, onRefresh, isSelected = false }: TaskListItemProps) {
  if (task.source === 'visit_proposal' && !task.is_completed) {
    return <VisitProposalRow task={task} onSelect={onSelect} onRefresh={onRefresh} isSelected={isSelected} />
  }

  const dueDate = task.due_date ? new Date(task.due_date) : null
  const isProcessTask = task.source === 'proc_task' || task.source === 'proc_subtask'
  const isVisitProposalRecord = task.source === 'visit_proposal'
  const isReadOnly = isProcessTask || isVisitProposalRecord

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 px-2.5 py-2 cursor-pointer transition-colors',
        'border-b border-border/50 last:border-b-0',
        'hover:bg-muted/40',
        isSelected && 'bg-primary/5 hover:bg-primary/5',
        task.is_completed && 'opacity-55',
      )}
      onClick={() => onSelect(task)}
    >
      <div className="mt-[3px]">
        <PriorityCheck
          priority={task.priority}
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

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        {/* Linha 1: título + chips inline */}
        <div className="flex items-center gap-1.5 min-w-0 leading-snug">
          <span className={cn(
            'text-[0.85rem] truncate tracking-tight',
            task.is_completed
              ? 'text-muted-foreground line-through decoration-muted-foreground/60'
              : 'text-foreground',
          )}>
            {task.title}
          </span>

          {task.is_recurring && (
            <RotateCcw className="h-3 w-3 text-muted-foreground shrink-0" />
          )}

          {/* Chip de processo inline (Todoist-style hashtag) */}
          {isProcessTask && task.process_ref && (
            <span className="text-[10.5px] text-muted-foreground/80 shrink-0 truncate max-w-[120px]">
              #{task.process_ref}
            </span>
          )}
        </div>

        {/* Linha 2: subtitle + due date + meta */}
        {(task.description || task.property_title || task.stage_name || dueDate) && (
          <div className="flex items-center gap-2 min-w-0 text-[11px]">
            {(task.description || task.property_title || task.stage_name) && (
              <span className="text-muted-foreground/80 truncate">
                {task.description
                  ? task.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                  : (task.property_title && task.stage_name
                      ? `${task.property_title} · ${task.stage_name}`
                      : task.property_title || task.stage_name)}
              </span>
            )}

            {dueDate && (
              <DueDateText
                date={dueDate}
                isCompleted={task.is_completed}
                className="shrink-0 ml-auto"
              />
            )}
          </div>
        )}
      </div>

      {/* Right side: flag + hover actions */}
      <div className="flex items-center gap-1 shrink-0 self-start mt-[3px]">
        {!task.is_completed && <PriorityFlag priority={task.priority} />}
        <button
          type="button"
          className="size-5 rounded hover:bg-muted text-muted-foreground/50 hover:text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onSelect(task) }}
          aria-label="Mais opções"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Visit Proposal Row (same shape, inline actions) ───────────────────────

function VisitProposalRow({
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
          'group relative flex items-start gap-3 px-2.5 py-2 cursor-pointer transition-colors',
          'border-b border-border/50 last:border-b-0',
          'hover:bg-amber-50/40 dark:hover:bg-amber-950/10',
          isSelected && 'bg-amber-50/60 dark:bg-amber-950/20',
        )}
        onClick={() => onSelect(task)}
      >
        {/* Amber pin marker (replaces checkbox for visit proposals) */}
        <div className="size-[18px] rounded-full flex items-center justify-center shrink-0 mt-[3px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
          <MapPin className="size-[11px]" strokeWidth={2.5} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 min-w-0 leading-snug">
            <span className="text-[0.85rem] truncate tracking-tight text-foreground">
              {propertyTitle}
            </span>
            <Badge
              variant="outline"
              className="text-[9px] font-medium text-amber-700 dark:text-amber-300 border-amber-500/40 bg-amber-500/10 rounded-full px-1.5 h-4 shrink-0"
            >
              Proposta
            </Badge>
          </div>

          <div className="flex items-center gap-2 min-w-0 text-[11px]">
            <span className="text-muted-foreground/80 truncate">{subtitle}</span>
            {dueDate && (
              <span className="shrink-0 ml-auto tabular-nums text-muted-foreground">
                {buildDueShort(dueDate)}
              </span>
            )}
          </div>
        </div>

        {/* Inline actions (right) */}
        <div
          className="flex items-center gap-1 shrink-0 self-start mt-[1px]"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            className="h-6 px-2 gap-1 text-[11px] rounded-full bg-emerald-600 hover:bg-emerald-700"
            onClick={() => respond('confirm')}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
            <span className="hidden sm:inline">Confirmar</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 gap-1 text-[11px] rounded-full border-red-500/30 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
            onClick={() => setRejectOpen(true)}
            disabled={isSubmitting}
          >
            <X className="h-2.5 w-2.5" />
            <span className="hidden sm:inline">Rejeitar</span>
          </Button>
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
