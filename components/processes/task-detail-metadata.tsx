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
  X,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { TASK_PRIORITY_LABELS } from '@/lib/constants'
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

  return (
    <div className="space-y-3">
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
            <span className="flex items-center gap-1.5">
              {PRIORITY_ICONS[(task.priority as TaskPriority) || 'normal']}
              {TASK_PRIORITY_LABELS[(task.priority as TaskPriority) || 'normal']}
            </span>
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
          <Loader2 className="h-3 w-3 animate-spin" />
          A actualizar...
        </div>
      )}
    </div>
  )
}
