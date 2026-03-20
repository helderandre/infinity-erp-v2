'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Save } from 'lucide-react'
import { PROCESS_TYPES } from '@/lib/constants'
import { Spinner } from '@/components/kibo-ui/spinner'
import { TemplateStageColumn } from './template-stage-column'
import { TemplateTaskCard } from './template-task-card'
import { TemplateTaskSheet } from './template-task-sheet'
import { TemplateStageDialog } from './template-stage-dialog'
import type { TemplateDetail } from '@/types/template'
import type { SubtaskData, SubtaskType } from '@/types/subtask'
import type { AlertsConfig } from '@/types/alert'

function deriveTypeFromLegacy(config: Record<string, unknown>): SubtaskType {
  if (config?.check_type === 'document' || config?.doc_type_id) return 'upload'
  if (config?.email_library_id) return 'email'
  if (config?.doc_library_id) return 'generate_doc'
  return 'checklist'
}

// -------------------------------------------------------
// Tipos internos do builder
// -------------------------------------------------------
export interface StageData {
  id: string // UUID temporário (crypto.randomUUID())
  name: string
  description?: string
  depends_on_stages: string[] // IDs locais de estágios dos quais depende
}

export interface TaskData {
  id: string // UUID temporário
  title: string
  description?: string
  is_mandatory: boolean
  priority?: 'urgent' | 'normal' | 'low'
  sla_days?: number
  assigned_role?: string
  subtasks: SubtaskData[] // SEMPRE presente, array (pode ser vazio)
  // Dependência entre tarefas (bloqueio)
  dependency_task_id?: string | null // referência ao ID local de outra tarefa
  // Alertas configurados na tarefa (propagados para tpl_tasks.config.alerts)
  _task_alerts?: AlertsConfig
}

interface TemplateBuilderProps {
  mode: 'create' | 'edit'
  templateId?: string
  initialData?: TemplateDetail
}

// -------------------------------------------------------
// Componente Principal
// -------------------------------------------------------
export function TemplateBuilder({ mode, templateId, initialData }: TemplateBuilderProps) {
  const router = useRouter()

  // Campos do template
  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [processType, setProcessType] = useState<string>(initialData?.process_type || '')

  // Estado DnD: items = { stageId: [taskId1, taskId2, ...] }
  const [items, setItems] = useState<Record<string, string[]>>({})
  const [containers, setContainers] = useState<string[]>([])

  // Metadados separados do DnD
  const [stagesData, setStagesData] = useState<Record<string, StageData>>({})
  const [tasksData, setTasksData] = useState<Record<string, TaskData>>({})

  // DnD state
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [clonedItems, setClonedItems] = useState<Record<string, string[]> | null>(null)
  const lastOverId = useRef<UniqueIdentifier | null>(null)
  const recentlyMovedToNewContainer = useRef(false)

  // Dialogs
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskDialogStageId, setTaskDialogStageId] = useState<string | null>(null)
  const [taskDialogData, setTaskDialogData] = useState<TaskData | null>(null)
  const [stageDialogOpen, setStageDialogOpen] = useState(false)
  const [stageDialogData, setStageDialogData] = useState<StageData | null>(null)

  // Loading
  const [isSaving, setIsSaving] = useState(false)

  // -------------------------------------------------------
  // Inicializar com dados existentes (modo edição)
  // -------------------------------------------------------
  useEffect(() => {
    if (!initialData?.tpl_stages) return

    const newItems: Record<string, string[]> = {}
    const newStagesData: Record<string, StageData> = {}
    const newTasksData: Record<string, TaskData> = {}
    const newContainers: string[] = []

    for (const stage of initialData.tpl_stages) {
      newContainers.push(stage.id)
      newStagesData[stage.id] = {
        id: stage.id,
        name: stage.name,
        description: stage.description || undefined,
        depends_on_stages: (stage as any).depends_on_stages || [],
      }

      const taskIds: string[] = []
      for (const task of stage.tpl_tasks || []) {
        taskIds.push(task.id)
        const tplSubtasks = task.tpl_subtasks || []
        newTasksData[task.id] = {
          id: task.id,
          title: task.title,
          description: task.description || undefined,
          is_mandatory: task.is_mandatory ?? true,
          priority: ((task as unknown as { priority?: string }).priority as TaskData['priority']) || 'normal',
          sla_days: task.sla_days || undefined,
          assigned_role: task.assigned_role || undefined,
          dependency_task_id: task.dependency_task_id || null,
          _task_alerts: (task.config as Record<string, unknown>)?.alerts as AlertsConfig | undefined,
          subtasks: tplSubtasks.map((st) => ({
            id: st.id,
            title: st.title,
            description: st.description || undefined,
            is_mandatory: st.is_mandatory ?? true,
            order_index: st.order_index ?? 0,
            type: st.config?.type || deriveTypeFromLegacy((st.config || {}) as Record<string, unknown>),
            sla_days: st.sla_days || undefined,
            assigned_role: st.assigned_role || undefined,
            priority: (st.priority as SubtaskData['priority']) || 'normal',
            dependency_type: st.dependency_type || 'none',
            dependency_subtask_id: st.dependency_subtask_id || null,
            dependency_task_id: st.dependency_task_id || null,
            config: (() => {
              // Copiar todas as propriedades do config excepto 'type' (já extraído acima)
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { type: _type, ...rest } = (st.config || {}) as Record<string, unknown>
              return rest
            })(),
          })),
        }
      }
      newItems[stage.id] = taskIds
    }

    setItems(newItems)
    setContainers(newContainers)
    setStagesData(newStagesData)
    setTasksData(newTasksData)
  }, [initialData])

  // -------------------------------------------------------
  // Sensores DnD
  // -------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // -------------------------------------------------------
  // Helper: encontrar container de um ID
  // -------------------------------------------------------
  const findContainer = useCallback(
    (id: UniqueIdentifier) => {
      if (id in items) return id as string
      return Object.keys(items).find((key) =>
        items[key].includes(id as string)
      )
    },
    [items]
  )

  // -------------------------------------------------------
  // Collision Detection (multi-container)
  // -------------------------------------------------------
  const collisionDetectionStrategy: CollisionDetection = useCallback(
    (args) => {
      // Ao arrastar container, só verificar containers
      if (activeId && activeId in items) {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (container) => container.id in items
          ),
        })
      }

      const pointerIntersections = pointerWithin(args)
      const intersections =
        pointerIntersections.length > 0
          ? pointerIntersections
          : rectIntersection(args)

      let overId = getFirstCollision(intersections, 'id')

      if (overId != null) {
        if (overId in items) {
          const containerItems = items[overId as string]
          if (containerItems.length > 0) {
            overId = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (c) =>
                  c.id !== overId &&
                  containerItems.includes(c.id as string)
              ),
            })[0]?.id
          }
        }
        lastOverId.current = overId
        return [{ id: overId }]
      }

      if (recentlyMovedToNewContainer.current) {
        lastOverId.current = activeId
      }

      return lastOverId.current ? [{ id: lastOverId.current }] : []
    },
    [activeId, items]
  )

  // -------------------------------------------------------
  // DnD Event Handlers
  // -------------------------------------------------------
  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id)
    setClonedItems({ ...items })
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    const overId = over?.id
    if (overId == null || active.id in items) return

    const overContainer = findContainer(overId)
    const activeContainer = findContainer(active.id)
    if (!overContainer || !activeContainer || activeContainer === overContainer) return

    setItems((prev) => {
      const activeItems = prev[activeContainer]
      const overItems = prev[overContainer]
      const overIndex = overItems.indexOf(overId as string)
      const activeIndex = activeItems.indexOf(active.id as string)

      const isBelowOverItem =
        over &&
        active.rect.current.translated &&
        active.rect.current.translated.top > over.rect.top + over.rect.height
      const modifier = isBelowOverItem ? 1 : 0
      const newIndex =
        overId in prev
          ? overItems.length + 1
          : overIndex >= 0
            ? overIndex + modifier
            : overItems.length + 1

      recentlyMovedToNewContainer.current = true

      return {
        ...prev,
        [activeContainer]: prev[activeContainer].filter((item) => item !== active.id),
        [overContainer]: [
          ...prev[overContainer].slice(0, newIndex),
          active.id as string,
          ...prev[overContainer].slice(newIndex),
        ],
      }
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    // Arrastar containers (fases)
    if (active.id in items && over?.id) {
      setContainers((c) =>
        arrayMove(c, c.indexOf(active.id as string), c.indexOf(over.id as string))
      )
    }

    // Arrastar items (tarefas) dentro do mesmo container
    const activeContainer = findContainer(active.id)
    if (!activeContainer || !over?.id) {
      setActiveId(null)
      return
    }

    const overContainer = findContainer(over.id)
    if (overContainer) {
      const activeIndex = items[activeContainer].indexOf(active.id as string)
      const overIndex = items[overContainer].indexOf(over.id as string)
      if (activeIndex !== overIndex) {
        setItems((prev) => ({
          ...prev,
          [overContainer]: arrayMove(prev[overContainer], activeIndex, overIndex),
        }))
      }
    }
    setActiveId(null)
  }

  function handleDragCancel() {
    if (clonedItems) setItems(clonedItems)
    setActiveId(null)
    setClonedItems(null)
  }

  // -------------------------------------------------------
  // Acções: Adicionar/Editar/Remover Fases
  // -------------------------------------------------------
  const handleAddStage = (data: { name: string; description?: string; depends_on_stages?: string[] }) => {
    const id = crypto.randomUUID()
    setStagesData((prev) => ({ ...prev, [id]: { id, name: data.name, description: data.description, depends_on_stages: data.depends_on_stages || [] } }))
    setItems((prev) => ({ ...prev, [id]: [] }))
    setContainers((prev) => [...prev, id])
    setStageDialogOpen(false)
  }

  const handleEditStage = (data: { name: string; description?: string; depends_on_stages?: string[] }) => {
    if (!stageDialogData) return
    setStagesData((prev) => ({
      ...prev,
      [stageDialogData.id]: { ...prev[stageDialogData.id], name: data.name, description: data.description, depends_on_stages: data.depends_on_stages || prev[stageDialogData.id].depends_on_stages || [] },
    }))
    setStageDialogOpen(false)
    setStageDialogData(null)
  }

  const handleRemoveStage = (stageId: string) => {
    // Remover tasks associadas
    const taskIds = items[stageId] || []
    setTasksData((prev) => {
      const next = { ...prev }
      taskIds.forEach((id) => delete next[id])
      return next
    })
    setStagesData((prev) => {
      const next = { ...prev }
      delete next[stageId]
      return next
    })
    setItems((prev) => {
      const next = { ...prev }
      delete next[stageId]
      return next
    })
    setContainers((prev) => prev.filter((id) => id !== stageId))
  }

  // -------------------------------------------------------
  // Acções: Adicionar/Editar/Remover Tarefas
  // -------------------------------------------------------
  const handleAddTask = (data: TaskData) => {
    if (!taskDialogStageId) return
    const id = crypto.randomUUID()
    const taskWithId = { ...data, id }
    setTasksData((prev) => ({ ...prev, [id]: taskWithId }))
    setItems((prev) => ({
      ...prev,
      [taskDialogStageId]: [...(prev[taskDialogStageId] || []), id],
    }))
    setTaskDialogOpen(false)
    setTaskDialogStageId(null)
  }

  const handleEditTask = (data: TaskData) => {
    if (!taskDialogData) return
    setTasksData((prev) => ({
      ...prev,
      [taskDialogData.id]: { ...data, id: taskDialogData.id },
    }))
    setTaskDialogOpen(false)
    setTaskDialogData(null)
  }

  const handleRemoveTask = (taskId: string) => {
    const container = findContainer(taskId)
    if (!container) return
    setItems((prev) => ({
      ...prev,
      [container]: prev[container].filter((id) => id !== taskId),
    }))
    setTasksData((prev) => {
      const next = { ...prev }
      delete next[taskId]
      return next
    })
  }

  // -------------------------------------------------------
  // Guardar Template
  // -------------------------------------------------------
  const handleSave = async () => {
    // Validação básica no frontend
    if (!name.trim()) {
      toast.error('O nome do template é obrigatório')
      return
    }
    if (!processType) {
      toast.error('Seleccione o tipo de processo')
      return
    }
    if (containers.length === 0) {
      toast.error('O template deve ter pelo menos uma fase')
      return
    }
    for (const stageId of containers) {
      if (!items[stageId] || items[stageId].length === 0) {
        toast.error(`A fase "${stagesData[stageId]?.name}" deve ter pelo menos uma tarefa`)
        return
      }
    }

    // Montar payload
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      process_type: processType,
      stages: containers.map((stageId, stageIndex) => ({
        _local_id: stageId,
        name: stagesData[stageId].name,
        description: stagesData[stageId].description,
        order_index: stageIndex,
        depends_on_stages: stagesData[stageId].depends_on_stages || [],
        tasks: (items[stageId] || []).map((taskId, taskIndex) => ({
          _local_id: taskId,
          title: tasksData[taskId].title,
          description: tasksData[taskId].description,
          is_mandatory: tasksData[taskId].is_mandatory,
          priority: tasksData[taskId].priority || 'normal',
          sla_days: tasksData[taskId].sla_days,
          assigned_role: tasksData[taskId].assigned_role,
          dependency_task_id: tasksData[taskId].dependency_task_id || null,
          config: tasksData[taskId]._task_alerts
            ? { alerts: tasksData[taskId]._task_alerts }
            : undefined,
          order_index: taskIndex,
          subtasks: (tasksData[taskId].subtasks || []).map((st, sidx) => ({
            _local_id: st.id,
            title: st.title,
            description: st.description,
            is_mandatory: st.is_mandatory,
            type: st.type,
            sla_days: st.sla_days,
            assigned_role: st.assigned_role,
            priority: st.priority || 'normal',
            config: st.config,
            dependency_type: st.dependency_type || 'none',
            dependency_subtask_id: st.dependency_subtask_id || null,
            dependency_task_id: st.dependency_task_id || null,
            order_index: sidx,
          })),
        })),
      })),
    }

    setIsSaving(true)
    try {
      const url = mode === 'create' ? '/api/templates' : `/api/templates/${templateId}`
      const method = mode === 'create' ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Erro ao guardar template')

      if (result.warning) {
        toast.warning(result.warning)
      } else {
        toast.success(mode === 'create' ? 'Template criado com sucesso!' : 'Template actualizado com sucesso!')
      }

      // On create, redirect to edit page of the new template; on edit, stay on the same page
      if (mode === 'create' && result.id) {
        router.replace(`/dashboard/processos/templates/${result.id}/editar`)
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 p-4 md:p-6">
      {/* Campos do template */}
      <Card className="shrink-0">
        <CardContent className=" space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Nome do Template *</Label>
              <Input
                id="tpl-name"
                placeholder="Ex: Captação da Angariação"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">Descrição</Label>
              <Input
                id="tpl-desc"
                placeholder="Breve descrição do template..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Processo *</Label>
              <Select value={processType} onValueChange={setProcessType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROCESS_TYPES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barra de acções */}
      <div className="flex items-center justify-between shrink-0">
        <Button
          variant="outline"
          onClick={() => {
            setStageDialogData(null)
            setStageDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Fase
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/processos/templates')}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Spinner variant="infinite" size={16} className="mr-2" />
                A guardar...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Template
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Builder DnD — colunas horizontais */}
      {containers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Comece por adicionar a primeira fase do template
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setStageDialogData(null)
                setStageDialogOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Fase
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto flex-1 min-h-0">
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={containers} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-4 min-w-min h-full">
                {containers.map((stageId) => (
                  <TemplateStageColumn
                    key={stageId}
                    id={stageId}
                    stage={stagesData[stageId]}
                    taskIds={items[stageId] || []}
                    tasksData={tasksData}
                    onEditStage={() => {
                      setStageDialogData(stagesData[stageId])
                      setStageDialogOpen(true)
                    }}
                    onRemoveStage={() => handleRemoveStage(stageId)}
                    onAddTask={() => {
                      setTaskDialogStageId(stageId)
                      setTaskDialogData(null)
                      setTaskDialogOpen(true)
                    }}
                    onEditTask={(taskId) => {
                      setTaskDialogStageId(stageId)
                      setTaskDialogData(tasksData[taskId])
                      setTaskDialogOpen(true)
                    }}
                    onRemoveTask={handleRemoveTask}
                  />
                ))}
              </div>
            </SortableContext>

            {/* DragOverlay — ghost durante drag */}
            <DragOverlay>
              {activeId ? (
                activeId in items ? (
                  // A arrastar uma fase
                  <div className="w-72 rounded-lg border bg-card shadow-lg opacity-80 p-4">
                    <p className="font-medium text-sm">{stagesData[activeId as string]?.name}</p>
                  </div>
                ) : (
                  // A arrastar uma tarefa
                  <TemplateTaskCard
                    id={activeId as string}
                    task={tasksData[activeId as string]}
                    isOverlay
                  />
                )
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {/* Dialogs */}
      <TemplateStageDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        initialData={stageDialogData}
        onSubmit={stageDialogData ? handleEditStage : handleAddStage}
        allStages={containers.map((id) => ({ id, name: stagesData[id]?.name || '' }))}
        currentStageId={stageDialogData?.id}
      />

      <TemplateTaskSheet
        open={taskDialogOpen}
        onOpenChange={(open: boolean) => {
          setTaskDialogOpen(open)
          if (!open) {
            setTaskDialogData(null)
            setTaskDialogStageId(null)
          }
        }}
        initialData={taskDialogData}
        onSubmit={taskDialogData ? handleEditTask : handleAddTask}
        allTasks={tasksData}
        allStages={stagesData}
        stageTaskMap={items}
        containers={containers}
        currentTaskId={taskDialogData?.id}
      />
    </div>
  )
}
