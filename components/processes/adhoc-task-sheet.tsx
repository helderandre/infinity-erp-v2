'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ClipboardList,
  ListChecks,
  Bell,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { TASK_PRIORITY_LABELS, ROLES } from '@/lib/constants'
import { SubtaskEditor } from '@/components/templates/subtask-editor'
import { AlertConfigEditor } from '@/components/templates/alert-config-editor'
import { OwnerSelector } from './owner-selector'
import type { ProcessStageWithTasks, ProcessOwner, ProcessTask } from '@/types/process'
import type { SubtaskData } from '@/types/subtask'
import type { AlertsConfig } from '@/types/alert'

type NavTab = 'dados' | 'subtarefas' | 'alertas'

interface AdHocTaskSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  processId: string
  stages: ProcessStageWithTasks[]
  owners: ProcessOwner[]
  existingTasks: ProcessTask[]
  preselectedStage?: { name: string; order_index: number }
  onTaskCreated: () => void
}

const NAV_TABS: { key: NavTab; label: string; icon: React.ElementType }[] = [
  { key: 'dados', label: 'Dados', icon: ClipboardList },
  { key: 'subtarefas', label: 'Subtarefas', icon: ListChecks },
  { key: 'alertas', label: 'Alertas', icon: Bell },
]

const ROLE_OPTIONS = Object.entries(ROLES).map(([, label]) => ({
  value: label,
  label,
}))

export function AdHocTaskSheet({
  open,
  onOpenChange,
  processId,
  stages,
  owners,
  existingTasks,
  preselectedStage,
  onTaskCreated,
}: AdHocTaskSheetProps) {
  const [activeTab, setActiveTab] = useState<NavTab>('dados')
  const [saving, setSaving] = useState(false)

  // Task fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stageName, setStageName] = useState('')
  const [stageOrderIndex, setStageOrderIndex] = useState(0)
  const [priority, setPriority] = useState<'urgent' | 'normal' | 'low'>('normal')
  const [assignedRole, setAssignedRole] = useState('')
  const [slaDays, setSlaDays] = useState<number | undefined>()
  const [isMandatory, setIsMandatory] = useState(true)
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([])
  const [dependencyTaskId, setDependencyTaskId] = useState('')

  // Subtasks
  const [subtasks, setSubtasks] = useState<SubtaskData[]>([])

  // Alerts
  const [alertsConfig, setAlertsConfig] = useState<AlertsConfig | undefined>()

  // Reset on open
  useEffect(() => {
    if (!open) return
    setActiveTab('dados')
    setTitle('')
    setDescription('')
    setPriority('normal')
    setAssignedRole('')
    setSlaDays(undefined)
    setIsMandatory(true)
    setSelectedOwnerIds([])
    setDependencyTaskId('')
    setSubtasks([])
    setAlertsConfig(undefined)

    if (preselectedStage) {
      setStageName(preselectedStage.name)
      setStageOrderIndex(preselectedStage.order_index)
    } else if (stages.length > 0) {
      setStageName(stages[0].name)
      setStageOrderIndex(stages[0].order_index)
    }
  }, [open, preselectedStage, stages])

  // Build dependency options from existing tasks
  const taskDependencyOptions = stages.map(stage => ({
    label: stage.name,
    tasks: stage.tasks.map(t => ({ id: t.id, title: t.title })),
  }))

  const handleStageChange = useCallback((name: string) => {
    setStageName(name)
    const stage = stages.find(s => s.name === name)
    if (stage) setStageOrderIndex(stage.order_index)
  }, [stages])

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Título é obrigatório')
      return
    }
    if (!stageName) {
      toast.error('Seleccione uma fase')
      return
    }

    setSaving(true)
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || undefined,
        stage_name: stageName,
        stage_order_index: stageOrderIndex,
        is_mandatory: isMandatory,
        priority,
        assigned_role: assignedRole || undefined,
        sla_days: slaDays || undefined,
        owner_id: selectedOwnerIds[0] || undefined,
        dependency_proc_task_id: dependencyTaskId || undefined,
        alerts_config: alertsConfig || undefined,
        subtasks: subtasks.map((st, idx) => ({
          title: st.title || `Subtarefa ${idx + 1}`,
          description: st.description || undefined,
          is_mandatory: st.is_mandatory,
          order_index: idx,
          priority: st.priority || 'normal',
          assigned_role: st.assigned_role || undefined,
          sla_days: st.sla_days || undefined,
          owner_id: (st as any).owner_id || undefined,
          dependency_type: st.dependency_type || 'none',
          dependency_proc_subtask_id: st.dependency_subtask_id || null,
          dependency_proc_task_id: st.dependency_task_id || null,
          config: {
            type: st.type,
            doc_type_id: st.config.doc_type_id || undefined,
            email_library_id: st.config.email_library_id || undefined,
            doc_library_id: st.config.doc_library_id || undefined,
            sections: st.config.sections || undefined,
            field: st.config.field || undefined,
          },
        })),
      }

      const res = await fetch(`/api/processes/${processId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar tarefa')
      }

      toast.success('Tarefa manual criada com sucesso')
      onOpenChange(false)
      onTaskCreated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar tarefa')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full flex flex-col gap-0 p-0" style={{ maxWidth: 600 }}>
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <SheetTitle>Nova Tarefa Manual</SheetTitle>
          </div>
        </SheetHeader>

        {/* Navigation Tabs */}
        <div className="flex border-b shrink-0">
          {NAV_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-b-2',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.key === 'subtarefas' && subtasks.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-xs">
                  {subtasks.length}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0 overflow-auto">
          <div className="p-6 space-y-5">
            {activeTab === 'dados' && (
              <>
                {/* Title */}
                <div className="space-y-1.5">
                  <Label>Título *</Label>
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ex: Verificação CPCV adicional"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Descrição opcional..."
                    rows={2}
                  />
                </div>

                <Separator />

                {/* Stage */}
                <div className="space-y-1.5">
                  <Label>Fase *</Label>
                  <Select value={stageName} onValueChange={handleStageChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar fase" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map(s => (
                        <SelectItem key={s.name} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <Label>Prioridade</Label>
                  <Select value={priority} onValueChange={v => setPriority(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Assigned role */}
                <div className="space-y-1.5">
                  <Label>Responsável (role)</Label>
                  <Select value={assignedRole || '__none__'} onValueChange={(v) => setAssignedRole(v === '__none__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem role específico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {ROLE_OPTIONS.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* SLA */}
                <div className="space-y-1.5">
                  <Label>SLA (dias)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={slaDays ?? ''}
                    onChange={e => setSlaDays(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Sem prazo"
                  />
                </div>

                {/* Mandatory */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Obrigatória</p>
                    <p className="text-xs text-muted-foreground">Conta para o progresso do processo</p>
                  </div>
                  <Switch checked={isMandatory} onCheckedChange={setIsMandatory} />
                </div>

                <Separator />

                {/* Owner */}
                {owners.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Proprietário (opcional)</Label>
                    <OwnerSelector
                      owners={owners}
                      selectedOwnerIds={selectedOwnerIds}
                      onChange={setSelectedOwnerIds}
                      placeholder="Sem proprietário associado"
                    />
                  </div>
                )}

                {/* Dependency */}
                <div className="space-y-1.5">
                  <Label>Dependência (opcional)</Label>
                  <Select value={dependencyTaskId || '__none__'} onValueChange={(v) => setDependencyTaskId(v === '__none__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem dependência" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma</SelectItem>
                      {taskDependencyOptions.map(group => (
                        group.tasks.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            [{group.label}] {t.title}
                          </SelectItem>
                        ))
                      ))}
                    </SelectContent>
                  </Select>
                  {dependencyTaskId && (
                    <p className="text-xs text-muted-foreground">
                      A tarefa ficará bloqueada até a dependência ser concluída.
                    </p>
                  )}
                </div>
              </>
            )}

            {activeTab === 'subtarefas' && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium mb-1">Subtarefas</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Adicione subtarefas para detalhar o trabalho necessário.
                  </p>
                </div>
                <SubtaskEditor
                  subtasks={subtasks}
                  onChange={setSubtasks}
                  roles={ROLE_OPTIONS}
                />
              </div>
            )}

            {activeTab === 'alertas' && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium mb-1">Alertas & Notificações</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Configure notificações automáticas para esta tarefa.
                  </p>
                </div>
                <AlertConfigEditor
                  alerts={alertsConfig}
                  onChange={setAlertsConfig}
                  defaultOpen
                />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim() || !stageName}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Tarefa
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
