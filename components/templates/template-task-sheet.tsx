'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ClipboardList,
  Layers,
  Bell,
} from 'lucide-react'
import { TASK_PRIORITY_LABELS } from '@/lib/constants'
import { SubtaskEditor } from './subtask-editor'
import { AlertConfigEditor } from './alert-config-editor'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { TaskData, StageData } from './template-builder'
import type { SubtaskData } from '@/types/subtask'
import type { AlertsConfig } from '@/types/alert'

interface RoleOption {
  value: string
  label: string
}

interface DependencyContext {
  allTasks?: Record<string, TaskData>
  allStages?: Record<string, StageData>
  stageTaskMap?: Record<string, string[]>
  containers?: string[]
  currentTaskId?: string
}

interface TemplateTaskSheetProps extends DependencyContext {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: TaskData | null
  onSubmit: (data: TaskData) => void
}

type NavSection = 'detalhes' | 'subtarefas' | 'alertas'

const NAV_ITEMS: { key: NavSection; label: string; icon: React.ElementType }[] = [
  { key: 'detalhes', label: 'Detalhes', icon: ClipboardList },
  { key: 'subtarefas', label: 'Subtarefas', icon: Layers },
  { key: 'alertas', label: 'Alertas', icon: Bell },
]

export function TemplateTaskSheet({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  allTasks,
  allStages,
  stageTaskMap,
  containers,
  currentTaskId,
}: TemplateTaskSheetProps) {
  const [activeSection, setActiveSection] = useState<NavSection>('detalhes')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isMandatory, setIsMandatory] = useState(true)
  const [priority, setPriority] = useState<'urgent' | 'normal' | 'low'>('normal')
  const [assignedRole, setAssignedRole] = useState('')
  const [slaDays, setSlaDays] = useState<string>('')
  const [subtasks, setSubtasks] = useState<SubtaskData[]>([])
  const [dependencyTaskId, setDependencyTaskId] = useState<string | null>(null)
  const [taskAlerts, setTaskAlerts] = useState<AlertsConfig | undefined>(undefined)
  const [roles, setRoles] = useState<RoleOption[]>([])

  // Fetch roles
  useEffect(() => {
    let cancelled = false
    fetch('/api/libraries/roles')
      .then((res) => res.json())
      .then((data: { id: string; name: string }[]) => {
        if (cancelled) return
        const mapped = data
          .filter((r) => r.name.toLowerCase() !== 'admin')
          .map((r) => ({ value: r.name, label: r.name }))
        setRoles(mapped)
      })
      .catch(() => {/* silently ignore */})
    return () => { cancelled = true }
  }, [])

  // Reset/populate on open — runs once per open
  useEffect(() => {
    if (!open) return
    setActiveSection('detalhes')
    if (initialData) {
      setTitle(initialData.title)
      setDescription(initialData.description || '')
      setIsMandatory(initialData.is_mandatory)
      setPriority(initialData.priority || 'normal')
      setAssignedRole(initialData.assigned_role || '')
      setSlaDays(initialData.sla_days ? String(initialData.sla_days) : '')
      setSubtasks(initialData.subtasks || [])
      setDependencyTaskId(initialData.dependency_task_id || null)
      setTaskAlerts(initialData._task_alerts)
    } else {
      setTitle('')
      setDescription('')
      setIsMandatory(true)
      setPriority('normal')
      setAssignedRole('')
      setSlaDays('')
      setSubtasks([])
      setDependencyTaskId(null)
      setTaskAlerts(undefined)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Build task dependency options
  const taskDependencyOptions = (() => {
    if (!allTasks || !allStages || !stageTaskMap || !containers) return []

    const options: { stageLabel: string; taskId: string; taskTitle: string }[] = []
    for (const stageId of containers) {
      const stageName = allStages[stageId]?.name || 'Fase'
      const taskIds = stageTaskMap[stageId] || []
      for (const taskId of taskIds) {
        if (taskId === currentTaskId) continue
        const task = allTasks[taskId]
        if (task) {
          options.push({
            stageLabel: stageName,
            taskId,
            taskTitle: task.title || '(Sem título)',
          })
        }
      }
    }
    return options
  })()

  // Build all subtasks context for cross-task dependencies
  const allSubtasksContext = (() => {
    if (!allTasks || !allStages || !stageTaskMap || !containers) return []

    const result: { stageLabel: string; taskTitle: string; taskId: string; subtask: SubtaskData }[] = []
    for (const stageId of containers) {
      const stageName = allStages[stageId]?.name || 'Fase'
      const taskIds = stageTaskMap[stageId] || []
      for (const taskId of taskIds) {
        const task = allTasks[taskId]
        if (task) {
          for (const st of task.subtasks || []) {
            result.push({
              stageLabel: stageName,
              taskTitle: task.title || '(Sem título)',
              taskId,
              subtask: st,
            })
          }
        }
      }
    }
    return result
  })()

  // Count active alerts
  const alertCount = taskAlerts
    ? Object.values(taskAlerts).filter((e) => e?.enabled).length
    : 0

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('O título da tarefa é obrigatório')
      return
    }

    for (const st of subtasks) {
      if (!st.title.trim()) {
        toast.error('Todas as subtasks devem ter título')
        return
      }
      if (st.type === 'upload' && !st.config.doc_type_id && !st.config.has_person_type_variants) {
        toast.error(`Subtask "${st.title || 'Upload'}": seleccione o tipo de documento`)
        return
      }
      if (st.type === 'email' && !st.config.email_library_id && !st.config.has_person_type_variants) {
        toast.error(`Subtask "${st.title || 'Email'}": seleccione o template de email`)
        return
      }
      if (st.type === 'generate_doc' && !st.config.doc_library_id && !st.config.has_person_type_variants) {
        toast.error(`Subtask "${st.title || 'Gerar Documento'}": seleccione o template de documento`)
        return
      }
    }

    onSubmit({
      id: initialData?.id || '',
      title: title.trim(),
      description: description.trim() || undefined,
      is_mandatory: isMandatory,
      priority,
      sla_days: slaDays ? parseInt(slaDays, 10) : undefined,
      assigned_role: assignedRole || undefined,
      dependency_task_id: dependencyTaskId || null,
      subtasks,
      _task_alerts: taskAlerts,
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="data-[side=right]:w-full data-[side=right]:max-w-[800px] data-[side=right]:sm:max-w-[800px] gap-0 p-0 flex flex-col h-full">
        {/* HEADER */}
        <SheetHeader className="border-b px-6 py-4 space-y-3 shrink-0">
          <SheetTitle className="text-lg">
            {initialData ? 'Editar Tarefa' : 'Nova Tarefa'}
          </SheetTitle>
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da tarefa"
              className="text-base font-medium"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={2}
              className="resize-none text-sm"
            />
            <div className="flex items-center gap-2">
              <Switch checked={isMandatory} onCheckedChange={setIsMandatory} />
              <Label className="text-sm">Obrigatória</Label>
            </div>
          </div>
        </SheetHeader>

        {/* BODY: SPLIT LAYOUT */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Nav */}
          <nav className="w-44 border-r bg-muted/20 p-3 space-y-1 shrink-0">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
                  activeSection === item.key
                    ? 'bg-background text-foreground shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.key === 'subtarefas' && subtasks.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
                    {subtasks.length}
                  </Badge>
                )}
                {item.key === 'alertas' && alertCount > 0 && (
                  <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
                    {alertCount}
                  </Badge>
                )}
              </button>
            ))}
          </nav>

          {/* Right Content */}
          <ScrollArea className="flex-1">
            <div className="p-6">
              {/* Detalhes Section */}
              {activeSection === 'detalhes' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-medium mb-3">Configuração da Tarefa</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Prioridade</Label>
                        <Select value={priority} onValueChange={(v) => setPriority(v as 'urgent' | 'normal' | 'low')}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Role atribuído</Label>
                        <Select value={assignedRole} onValueChange={setAssignedRole}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">SLA (dias)</Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Ex: 5"
                          value={slaDays}
                          onChange={(e) => setSlaDays(e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Task dependency */}
                  {taskDependencyOptions.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Bloqueada até (dependência de tarefa)</Label>
                      <Select
                        value={dependencyTaskId || '_none'}
                        onValueChange={(v) => setDependencyTaskId(v === '_none' ? null : v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sem bloqueio" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">(Sem bloqueio)</SelectItem>
                          {(() => {
                            const grouped = new Map<string, typeof taskDependencyOptions>()
                            for (const opt of taskDependencyOptions) {
                              const list = grouped.get(opt.stageLabel) || []
                              list.push(opt)
                              grouped.set(opt.stageLabel, list)
                            }
                            return Array.from(grouped.entries()).map(([stage, tasks]) => (
                              <SelectGroup key={stage}>
                                <SelectLabel>{stage}</SelectLabel>
                                {tasks.map((t) => (
                                  <SelectItem key={t.taskId} value={t.taskId}>
                                    {t.taskTitle}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Subtarefas Section */}
              {activeSection === 'subtarefas' && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium mb-1">Subtarefas</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Adicione os passos que compõem esta tarefa. Clique em{' '}
                      <Settings2Icon /> para configurar cada subtarefa.
                    </p>
                  </div>
                  <SubtaskEditor
                    subtasks={subtasks}
                    onChange={setSubtasks}
                    taskDependencyOptions={taskDependencyOptions}
                    allSubtasksContext={allSubtasksContext}
                    currentTaskId={currentTaskId}
                    roles={roles}
                  />
                </div>
              )}

              {/* Alertas Section */}
              {activeSection === 'alertas' && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium mb-1">Alertas da Tarefa</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Configure notificações automáticas para eventos desta tarefa.
                    </p>
                  </div>
                  <AlertConfigEditor
                    alerts={taskAlerts}
                    onChange={setTaskAlerts}
                    defaultOpen
                  />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* FOOTER */}
        <div className="border-t px-6 py-3 shrink-0">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {initialData ? 'Guardar' : 'Criar Tarefa'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Small inline icon for the description text
function Settings2Icon() {
  return (
    <span className="inline-flex items-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="inline-block align-text-bottom text-muted-foreground"
      >
        <path d="M20 7h-9" />
        <path d="M14 17H5" />
        <circle cx="17" cy="17" r="3" />
        <circle cx="7" cy="7" r="3" />
      </svg>
    </span>
  )
}
