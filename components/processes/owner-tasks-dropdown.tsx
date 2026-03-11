'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ClipboardList, Loader2, Check, ChevronRight, ListPlus, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface TemplateSubtask {
  id: string
  title: string
  config: Record<string, unknown>
  order_index: number
}

interface TemplateTask {
  id: string
  title: string
  config: Record<string, unknown>
  stage_name: string
  tpl_subtasks: TemplateSubtask[]
}

interface OwnerTasksDropdownProps {
  processId: string
  ownerId: string
  ownerName: string
  /** Set of tpl_subtask_ids already created for this owner */
  existingSubtaskIds: Set<string>
  /** Whether all tasks are already populated */
  allPopulated: boolean
  onTasksPopulated?: () => void
}

export function OwnerTasksDropdown({
  processId,
  ownerId,
  ownerName,
  existingSubtaskIds,
  allPopulated,
  onTasksPopulated,
}: OwnerTasksDropdownProps) {
  const [open, setOpen] = useState(false)
  const [templateTasks, setTemplateTasks] = useState<TemplateTask[]>([])
  const [loading, setLoading] = useState(false)
  const [populating, setPopulating] = useState(false)
  const [populatingItem, setPopulatingItem] = useState<string | null>(null) // track which item is being added

  // Fetch template tasks when dropdown opens
  const fetchTemplateTasks = useCallback(async () => {
    if (templateTasks.length > 0) return // Already loaded
    setLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}/owners/template-tasks?owner_id=${ownerId}`)
      if (!res.ok) throw new Error('Erro ao carregar tarefas')
      const data = await res.json()
      setTemplateTasks(data.tasks || [])
    } catch {
      toast.error('Erro ao carregar tarefas do template')
    } finally {
      setLoading(false)
    }
  }, [processId, ownerId, templateTasks.length])

  useEffect(() => {
    if (open) fetchTemplateTasks()
  }, [open, fetchTemplateTasks])

  // Add all tasks for owner
  const handleAddAll = async () => {
    setPopulating(true)
    try {
      const res = await fetch(`/api/processes/${processId}/owners/populate-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_id: ownerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar tarefas')

      const total = (data.tasks_created || 0) + (data.subtasks_created || 0)
      if (total > 0) {
        toast.success(`${total} item(ns) criado(s) no fluxo para ${ownerName}`)
      } else {
        toast.info('Nenhuma tarefa do template corresponde a este tipo de proprietário')
      }
      setOpen(false)
      onTasksPopulated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar tarefas')
    } finally {
      setPopulating(false)
    }
  }

  // Add specific subtask(s) for owner within a specific task
  const handleAddSubtask = async (tplTaskId: string, tplSubtaskId: string) => {
    setPopulatingItem(tplSubtaskId)
    try {
      const res = await fetch(`/api/processes/${processId}/owners/populate-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: ownerId,
          tpl_task_id: tplTaskId,
          tpl_subtask_ids: [tplSubtaskId],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar subtarefa')

      const total = (data.tasks_created || 0) + (data.subtasks_created || 0)
      if (total > 0) {
        toast.success(`Subtarefa adicionada para ${ownerName}`)
      }
      onTasksPopulated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar subtarefa')
    } finally {
      setPopulatingItem(null)
    }
  }

  // Add all subtasks of a specific task for owner
  const handleAddTask = async (tplTaskId: string) => {
    setPopulatingItem(`task-${tplTaskId}`)
    try {
      const res = await fetch(`/api/processes/${processId}/owners/populate-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: ownerId,
          tpl_task_id: tplTaskId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar tarefas')

      const total = (data.tasks_created || 0) + (data.subtasks_created || 0)
      if (total > 0) {
        toast.success(`${total} item(ns) adicionado(s) para ${ownerName}`)
      }
      setOpen(false)
      onTasksPopulated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar tarefas')
    } finally {
      setPopulatingItem(null)
    }
  }

  // Filter tasks that have subtasks with owner_scope
  const relevantTasks = templateTasks.filter(
    (t) => t.tpl_subtasks.length > 0
  )

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Gerir tarefas do proprietário"
        >
          <ClipboardList className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Tarefas para {ownerName}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Add all */}
            <DropdownMenuItem
              disabled={allPopulated || populating}
              onClick={(e) => { e.preventDefault(); handleAddAll() }}
            >
              {populating ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : allPopulated ? (
                <Check className="h-3.5 w-3.5 mr-2 text-emerald-600" />
              ) : (
                <ListPlus className="h-3.5 w-3.5 mr-2" />
              )}
              <span className="font-medium">Adicionar todas ao fluxo</span>
            </DropdownMenuItem>

            {relevantTasks.length > 0 && <DropdownMenuSeparator />}

            {/* Per-task submenu */}
            {relevantTasks.map((task) => {
              const ownerSubtasks = task.tpl_subtasks
              const allSubtasksExist = ownerSubtasks.every((st) => existingSubtaskIds.has(st.id))

              return (
                <DropdownMenuSub key={task.id}>
                  <DropdownMenuSubTrigger
                    className={cn('text-xs', allSubtasksExist && 'text-muted-foreground')}
                  >
                    {allSubtasksExist ? (
                      <Check className="h-3 w-3 mr-2 text-emerald-600 shrink-0" />
                    ) : (
                      <FileText className="h-3 w-3 mr-2 shrink-0" />
                    )}
                    <span className="truncate">{task.title}</span>
                  </DropdownMenuSubTrigger>

                  <DropdownMenuSubContent className="w-64">
                    {/* Add all subtasks of this task */}
                    <DropdownMenuItem
                      disabled={allSubtasksExist || populatingItem === `task-${task.id}`}
                      onClick={(e) => { e.preventDefault(); handleAddTask(task.id) }}
                      className="text-xs"
                    >
                      {populatingItem === `task-${task.id}` ? (
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      ) : (
                        <ListPlus className="h-3 w-3 mr-2" />
                      )}
                      <span className="font-medium">Adicionar todas</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Individual subtasks */}
                    {ownerSubtasks.map((st) => {
                      const exists = existingSubtaskIds.has(st.id)
                      return (
                        <DropdownMenuItem
                          key={st.id}
                          disabled={exists || populatingItem === st.id}
                          onClick={(e) => { e.preventDefault(); handleAddSubtask(task.id, st.id) }}
                          className="text-xs"
                        >
                          {populatingItem === st.id ? (
                            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                          ) : exists ? (
                            <Check className="h-3 w-3 mr-2 text-emerald-600" />
                          ) : (
                            <ChevronRight className="h-3 w-3 mr-2 opacity-40" />
                          )}
                          <span className="truncate">{st.title}</span>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
