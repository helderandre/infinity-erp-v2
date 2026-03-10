'use client'

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  CalendarIcon,
  AlertTriangle,
  ArrowRight,
  ArrowDown,
  Lock,
  X,
} from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { TASK_PRIORITY_LABELS, PRIORITY_BADGE_CONFIG } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { ProcessTask, TaskPriority } from '@/types/process'

interface TaskDetailMetadataProps {
  task: ProcessTask
  processId: string
  onTaskUpdate: () => void
}

interface User {
  id: string
  commercial_name: string
}

const PRIORITY_ICONS: Record<TaskPriority, React.ReactNode> = {
  urgent: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
  normal: <ArrowRight className="h-3.5 w-3.5 text-amber-500" />,
  low: <ArrowDown className="h-3.5 w-3.5 text-slate-400" />,
}

export function TaskDetailMetadata({
  task,
  processId,
  onTaskUpdate,
}: TaskDetailMetadataProps) {
  const [users, setUsers] = useState<User[]>([])
  const [isUpdating, setIsUpdating] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch('/api/users/consultants')
        if (!res.ok) throw new Error()
        const data = await res.json()
        setUsers(data)
      } catch {
        // silent
      }
    }
    loadUsers()
  }, [])

  const handleMetadataUpdate = async (action: string, payload: Record<string, unknown>) => {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/processes/${processId}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      })
      if (!res.ok) throw new Error()
      toast.success('Tarefa actualizada')
      onTaskUpdate()
    } catch {
      toast.error('Erro ao actualizar tarefa')
    } finally {
      setIsUpdating(false)
    }
  }

  const dueDate = task.due_date ? new Date(task.due_date) : undefined
  const isEditable = !['completed', 'skipped'].includes(task.status ?? '')

  const isBlocked = !!task.is_blocked

  return (
    <div className="space-y-3">
      {/* Blocked banner */}
      {isBlocked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <Lock className="h-4 w-4 shrink-0 text-amber-500" />
          <span>
            <strong>Bloqueada</strong> — esta tarefa aguarda a conclusão de uma dependência antes de poder ser executada.
          </span>
        </div>
      )}

      <h4 className="text-sm font-medium">Detalhes</h4>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {/* Estado */}
        <div className="text-muted-foreground">Estado</div>
        <div>
          <StatusBadge status={task.status ?? 'pending'} type="task" />
        </div>

        {/* Prioridade */}
        <div className="text-muted-foreground">Prioridade</div>
        <div>
          {isEditable ? (
            <Select
              value={task.priority || 'normal'}
              onValueChange={(v) =>
                handleMetadataUpdate('update_priority', { priority: v })
              }
              disabled={isUpdating}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(
                  ([key, label]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {PRIORITY_ICONS[key]}
                        {label}
                      </span>
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          ) : (
            (() => {
              const p = (task.priority as TaskPriority) || 'normal'
              const config = PRIORITY_BADGE_CONFIG[p]
              return (
                <Badge variant="outline" className={cn('text-xs gap-1.5', config?.className)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', config?.dotColor)} />
                  {TASK_PRIORITY_LABELS[p]}
                </Badge>
              )
            })()
          )}
        </div>

        {/* Atribuído a */}
        <div className="text-muted-foreground">Atribuído a</div>
        <div>
          {isEditable ? (
            <Select
              value={task.assigned_to || 'unassigned'}
              onValueChange={(v) =>
                handleMetadataUpdate('assign', {
                  assigned_to: v === 'unassigned' ? null : v,
                })
              }
              disabled={isUpdating}
            >
              <SelectTrigger className="h-8 w-[180px]">
                <SelectValue placeholder="Sem atribuição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Sem atribuição</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.commercial_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span>{task.assigned_to_user?.commercial_name || 'Não atribuído'}</span>
          )}
        </div>

        {/* Data Limite */}
        <div className="text-muted-foreground">Data Limite</div>
        <div className="flex items-center gap-1">
          {isEditable ? (
            <>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-8 justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                    disabled={isUpdating}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {dueDate ? format(dueDate, 'dd/MM/yyyy', { locale: pt }) : 'Definir data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => {
                      setCalendarOpen(false)
                      handleMetadataUpdate('update_due_date', {
                        due_date: date ? date.toISOString() : null,
                      })
                    }}
                    locale={pt}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {dueDate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    handleMetadataUpdate('update_due_date', { due_date: null })
                  }
                  disabled={isUpdating}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          ) : (
            <span>{formatDate(task.due_date)}</span>
          )}
        </div>

        {/* Fase */}
        <div className="text-muted-foreground">Fase</div>
        <div>{task.stage_name || '—'}</div>

        {/* Proprietário */}
        {task.owner && (
          <>
            <div className="text-muted-foreground">Proprietário</div>
            <div>{task.owner.name}</div>
          </>
        )}

        {/* Criada */}
        {task.created_at && (
          <>
            <div className="text-muted-foreground">Criada</div>
            <div>{formatDate(task.created_at)}</div>
          </>
        )}
      </div>

      {isUpdating && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner variant="infinite" size={12} />
          A actualizar...
        </div>
      )}
    </div>
  )
}
