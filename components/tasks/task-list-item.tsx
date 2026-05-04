'use client'

import {
  RotateCcw, MoreHorizontal, MapPin, ArrowUpRight,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  PriorityCheck, PriorityFlag, DueDateText, buildDueShort,
} from '@/components/tasks/task-primitives'
import { useUser } from '@/hooks/use-user'
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
  const { user } = useUser()

  if (task.source === 'visit_proposal' && !task.is_completed) {
    return <VisitProposalRow task={task} onSelect={onSelect} onRefresh={onRefresh} isSelected={isSelected} />
  }

  const dueDate = task.due_date ? new Date(task.due_date) : null
  const isProcessTask = task.source === 'proc_task' || task.source === 'proc_subtask'
  const isVisitProposalRecord = task.source === 'visit_proposal'
  // Pessoal task vista por leadership a entrar noutro consultor: a API
  // devolve título "Tarefa pessoal" e o flag `is_redacted`. Renderizamos
  // muito esbatida e cinzenta — o utilizador não pode interagir nem
  // navegar para o detalhe (clique é no-op).
  const isRedacted = (task as any).is_redacted === true
  const isReadOnly = isProcessTask || isVisitProposalRecord || isRedacted

  // Mostra um chip "→ {primeiro nome}" quando a tarefa pertence a outro
  // utilizador (delegada). Para tarefas que ficam atribuídas ao próprio,
  // não polui a linha — é o caso default.
  const showAssigneeChip =
    !!task.assignee &&
    !!task.assigned_to &&
    !!user?.id &&
    task.assigned_to !== user.id
  const assigneeFirstName = task.assignee?.commercial_name?.split(' ')[0]
  const assigneeInitials = task.assignee?.commercial_name
    ?.split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 px-2.5 py-2 cursor-pointer transition-colors',
        'border-b border-border/50 last:border-b-0',
        'hover:bg-muted/40',
        isSelected && 'bg-primary/5 hover:bg-primary/5',
        task.is_completed && 'opacity-55',
        isRedacted && 'opacity-40 pointer-events-none italic text-muted-foreground',
      )}
      onClick={() => isRedacted ? undefined : onSelect(task)}
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

          {/* Chip de assignee — visível só quando a tarefa está atribuída a
              outro utilizador (delegada). Avatar 22px com ring + nome. */}
          {showAssigneeChip && (
            <span
              className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/80 shrink-0"
              title={`Atribuída a ${task.assignee!.commercial_name}`}
            >
              <Avatar className="size-[22px] ring-2 ring-background shadow-sm">
                <AvatarImage
                  src={(task.assignee as { profile_photo_url?: string | null }).profile_photo_url ?? undefined}
                />
                <AvatarFallback className="text-[9px] font-semibold bg-primary/15 text-primary">
                  {assigneeInitials || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[80px]">{assigneeFirstName}</span>
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
  isSelected = false,
}: {
  task: TaskWithRelations
  onSelect: (task: TaskWithRelations) => void
  /** Refresh é chamado pelo detalhe da proposta após Confirmar/Rejeitar.
   *  A linha em si não tem mais botões de acção, então não precisa do
   *  callback aqui — mantemos a prop opcional para evitar churn no caller. */
  onRefresh?: () => void
  isSelected?: boolean
}) {
  const propertyTitle = task.property_title || 'Imóvel'
  const clientName = task.visit_client_name || 'Cliente'
  const buyerAgent = task.visit_buyer_agent_name
  const dueDate = task.due_date ? new Date(task.due_date) : null
  // Quando há colega a propôr (visita inter-agência), só mostramos o nome
  // do colega — o contacto do comprador é dele, não nosso. Mantemos o
  // nome do cliente apenas em visitas próprias (raras nesta fila, já que
  // visit_proposal só aparece quando há buyer agent diferente do seller).
  const subtitle = buyerAgent ? `Pedido por ${buyerAgent}` : clientName

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

        {/* Indicador de "ver mais" — toda a linha é clicável e abre o
            detalhe da proposta com toda a informação (consultor que pediu,
            cliente, imóvel, horário) e os botões Confirmar/Rejeitar. As
            antigas acções inline foram removidas para forçar o consultor
            a ler o pedido antes de decidir. */}
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 mt-1 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
      </div>
    </>
  )
}
