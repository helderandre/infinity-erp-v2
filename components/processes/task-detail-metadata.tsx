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
        <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          <Lock className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div>
            <strong>Bloqueada</strong> — esta tarefa aguarda a conclusão de uma dependência antes de poder ser executada.
            {task.blocking_task_title && (
              <p className="mt-1 text-xs text-primary/70">
                Depende de: <strong>{task.blocking_task_title}</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Proprietário */}
      {task.owner && (
        <div className="text-sm">
          <span className="text-muted-foreground">Proprietário: </span>
          <span className="font-medium">{task.owner.name}</span>
        </div>
      )}
    </div>
  )
}
