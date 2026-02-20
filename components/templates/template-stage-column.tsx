'use client'

import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GripVertical, MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react'
import { TemplateTaskCard } from './template-task-card'
import type { StageData, TaskData } from './template-builder'

interface TemplateStageColumnProps {
  id: string
  stage: StageData
  taskIds: string[]
  tasksData: Record<string, TaskData>
  onEditStage: () => void
  onRemoveStage: () => void
  onAddTask: () => void
  onEditTask: (taskId: string) => void
  onRemoveTask: (taskId: string) => void
}

export function TemplateStageColumn({
  id,
  stage,
  taskIds,
  tasksData,
  onEditStage,
  onRemoveStage,
  onAddTask,
  onEditTask,
  onRemoveTask,
}: TemplateStageColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: { type: 'container', children: taskIds },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-90 shrink-0 flex flex-col rounded-lg border bg-muted/30"
    >
      {/* Header da fase */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/50 rounded-t-lg">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{stage.name}</h3>
          {stage.description && (
            <p className="text-xs text-muted-foreground truncate">{stage.description}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {taskIds.length}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEditStage}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar Fase
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onRemoveStage}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remover Fase
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Lista de tarefas (sortable) */}
      <ScrollArea className="flex-1 max-h-[400px]">
        <div className="p-2 space-y-2">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {taskIds.map((taskId) => (
              <TemplateTaskCard
                key={taskId}
                id={taskId}
                task={tasksData[taskId]}
                onEdit={() => onEditTask(taskId)}
                onRemove={() => onRemoveTask(taskId)}
              />
            ))}
          </SortableContext>

          {taskIds.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Arraste tarefas para aqui ou clique em adicionar
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer — Adicionar tarefa */}
      <div className="p-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={onAddTask}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Tarefa
        </Button>
      </div>
    </div>
  )
}
