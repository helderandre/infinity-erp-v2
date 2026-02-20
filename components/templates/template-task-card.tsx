'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  Mail,
  FileText,
  Circle,
  GripVertical,
  Pencil,
  Trash2,
} from 'lucide-react'
import { ACTION_TYPES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { TaskData } from './template-builder'

interface TemplateTaskCardProps {
  id: string
  task: TaskData
  isOverlay?: boolean
  onEdit?: () => void
  onRemove?: () => void
}

const getTaskIcon = (actionType: string) => {
  switch (actionType) {
    case 'UPLOAD':
      return <Upload className="h-3.5 w-3.5" />
    case 'EMAIL':
      return <Mail className="h-3.5 w-3.5" />
    case 'GENERATE_DOC':
      return <FileText className="h-3.5 w-3.5" />
    default:
      return <Circle className="h-3.5 w-3.5" />
  }
}

const actionTypeColors: Record<string, string> = {
  UPLOAD: 'text-blue-600',
  EMAIL: 'text-amber-600',
  GENERATE_DOC: 'text-purple-600',
  MANUAL: 'text-slate-500',
}

export function TemplateTaskCard({
  id,
  task,
  isOverlay = false,
  onEdit,
  onRemove,
}: TemplateTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isOverlay })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  if (!task) return null

  return (
    <div
      ref={!isOverlay ? setNodeRef : undefined}
      style={!isOverlay ? style : undefined}
      className={cn(
        'group flex items-start gap-2 rounded-md border bg-card p-2.5 text-sm',
        isOverlay && 'shadow-lg',
        !isOverlay && 'hover:bg-accent/50 transition-colors'
      )}
    >
      {/* Drag handle */}
      {!isOverlay && (
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing touch-none shrink-0"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Ícone do tipo */}
      <div className={cn('mt-0.5 shrink-0', actionTypeColors[task.action_type])}>
        {getTaskIcon(task.action_type)}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-medium text-xs leading-tight truncate">{task.title}</p>
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {ACTION_TYPES[task.action_type as keyof typeof ACTION_TYPES]}
          </Badge>
          {task.is_mandatory && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              Obrig.
            </Badge>
          )}
          {task.sla_days && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {task.sla_days}d
            </Badge>
          )}
          {task.assigned_role && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {task.assigned_role}
            </Badge>
          )}
        </div>
      </div>

      {/* Acções (visíveis no hover) */}
      {!isOverlay && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.()
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onRemove?.()
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
