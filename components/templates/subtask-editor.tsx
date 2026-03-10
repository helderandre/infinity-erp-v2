'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  GripVertical,
  Trash2,
  Plus,
  Upload,
  CheckSquare,
  Mail,
  FileText,
  Users,
  Lock,
  ChevronRight,
  Settings2,
} from 'lucide-react'
import { SUBTASK_TYPES, SUBTASK_TYPE_LABELS, TASK_PRIORITY_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { SubtaskData } from '@/types/subtask'
import type { AlertsConfig } from '@/types/alert'
import { AlertConfigEditor } from './alert-config-editor'

const ICON_MAP: Record<string, React.ElementType> = {
  Upload,
  CheckSquare,
  Mail,
  FileText,
}

// Contexto de dependências passado pelo TemplateTaskSheet
export interface SubtaskDependencyOption {
  stageLabel: string
  taskId: string
  taskTitle: string
}
export interface SubtaskContextItem {
  stageLabel: string
  taskTitle: string
  taskId: string
  subtask: SubtaskData
}

interface RoleOption {
  value: string
  label: string
}

interface SubtaskEditorProps {
  subtasks: SubtaskData[]
  onChange: (subtasks: SubtaskData[]) => void
  taskDependencyOptions?: SubtaskDependencyOption[]
  allSubtasksContext?: SubtaskContextItem[]
  currentTaskId?: string
  roles?: RoleOption[]
}

function getPlaceholder(type: SubtaskData['type']): string {
  const map: Record<string, string> = {
    upload: 'Ex: Certidão Permanente',
    checklist: 'Ex: Validar NIF do proprietário',
    email: 'Ex: Pedido de documentação',
    generate_doc: 'Ex: Minuta CPCV',
  }
  return map[type] || 'Título da subtarefa'
}

// Helper para renderizar selects de variantes (singular/coletiva)
function renderVariantSelect(
  subtask: SubtaskData,
  variant: 'singular' | 'coletiva',
  docTypes: { id: string; name: string; category?: string }[],
  docTypesByCategory: Record<string, typeof docTypes>,
  emailTemplates: { id: string; name: string; subject: string }[],
  docTemplates: { id: string; name: string }[],
  onUpdate: (id: string, data: Partial<SubtaskData>) => void
) {
  const variantKey = variant === 'singular' ? 'singular_config' : 'coletiva_config'
  const currentConfig = subtask.config[variantKey] || {}

  const updateVariant = (field: string, value: string) => {
    onUpdate(subtask.id, {
      config: {
        ...subtask.config,
        [variantKey]: { ...currentConfig, [field]: value },
      },
    })
  }

  if (subtask.type === 'upload') {
    return (
      <Select
        value={currentConfig.doc_type_id || ''}
        onValueChange={(v) => updateVariant('doc_type_id', v)}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Tipo de documento..." />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(docTypesByCategory).map(([category, types]) => (
            <SelectGroup key={category}>
              <SelectLabel>{category}</SelectLabel>
              {types.map((dt) => (
                <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (subtask.type === 'email') {
    return (
      <Select
        value={currentConfig.email_library_id || ''}
        onValueChange={(v) => updateVariant('email_library_id', v)}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Template de email..." />
        </SelectTrigger>
        <SelectContent>
          {emailTemplates.map((et) => (
            <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (subtask.type === 'generate_doc') {
    return (
      <Select
        value={currentConfig.doc_library_id || ''}
        onValueChange={(v) => updateVariant('doc_library_id', v)}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Template de documento..." />
        </SelectTrigger>
        <SelectContent>
          {docTemplates.map((dt) => (
            <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return null
}

// Sortable row component
function SortableSubtaskRow({
  subtask,
  docTypes,
  docTypesByCategory,
  emailTemplates,
  docTemplates,
  onUpdate,
  onRemove,
  sameTaskSubtasks,
  taskDependencyOptions,
  allSubtasksContext,
  currentTaskId,
  roles,
}: {
  subtask: SubtaskData
  docTypes: { id: string; name: string; category?: string }[]
  docTypesByCategory: Record<string, typeof docTypes>
  emailTemplates: { id: string; name: string; subject: string }[]
  docTemplates: { id: string; name: string }[]
  onUpdate: (id: string, data: Partial<SubtaskData>) => void
  onRemove: (id: string) => void
  sameTaskSubtasks: SubtaskData[]
  taskDependencyOptions?: SubtaskDependencyOption[]
  allSubtasksContext?: SubtaskContextItem[]
  currentTaskId?: string
  roles?: RoleOption[]
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 rounded-md border bg-card p-3"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-2 cursor-grab active:cursor-grabbing touch-none shrink-0"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex-1 min-w-0 space-y-2">
        {/* Badge de tipo + Input de título */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="shrink-0 text-xs">
            {SUBTASK_TYPE_LABELS[subtask.type]}
          </Badge>
          <Input
            value={subtask.title}
            onChange={(e) => onUpdate(subtask.id, { title: e.target.value })}
            placeholder={getPlaceholder(subtask.type)}
            className="h-8 text-sm"
          />
        </div>

        {/* Config condicional por tipo (escondida quando has_person_type_variants activo) */}
        {subtask.type === 'upload' && !subtask.config.has_person_type_variants && (
          <Select
            value={subtask.config.doc_type_id || ''}
            onValueChange={(v) =>
              onUpdate(subtask.id, { config: { ...subtask.config, doc_type_id: v } })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Seleccionar tipo de documento..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(docTypesByCategory).map(([category, types]) => (
                <SelectGroup key={category}>
                  <SelectLabel>{category}</SelectLabel>
                  {types.map((dt) => (
                    <SelectItem key={dt.id} value={dt.id}>
                      {dt.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )}

        {subtask.type === 'email' && !subtask.config.has_person_type_variants && (
          <Select
            value={subtask.config.email_library_id || ''}
            onValueChange={(v) =>
              onUpdate(subtask.id, { config: { ...subtask.config, email_library_id: v } })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Seleccionar template de email..." />
            </SelectTrigger>
            <SelectContent>
              {emailTemplates.map((et) => (
                <SelectItem key={et.id} value={et.id}>
                  {et.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {subtask.type === 'generate_doc' && !subtask.config.has_person_type_variants && (
          <Select
            value={subtask.config.doc_library_id || ''}
            onValueChange={(v) =>
              onUpdate(subtask.id, { config: { ...subtask.config, doc_library_id: v } })
            }
          >
            <SelectTrigger className="h-8 w-full text-xs [&>span]:truncate">
              <SelectValue placeholder="Seleccionar template de documento..." />
            </SelectTrigger>
            <SelectContent>
              {docTemplates.map((dt) => (
                <SelectItem key={dt.id} value={dt.id}>
                  {dt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* checklist: não precisa de config extra — só o título */}

        {/* Opções avançadas (prazo, responsável, prioridade) */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group">
            <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
            <Settings2 className="h-3 w-3" />
            <span>Opções avançadas</span>
            {(subtask.sla_days || subtask.assigned_role || (subtask.priority && subtask.priority !== 'normal')) && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-1">
                {[
                  subtask.sla_days && `${subtask.sla_days}d`,
                  subtask.assigned_role,
                  subtask.priority && subtask.priority !== 'normal' && TASK_PRIORITY_LABELS[subtask.priority],
                ].filter(Boolean).join(' · ')}
              </Badge>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="grid grid-cols-3 gap-2">
              {/* Prazo (dias) */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Prazo (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Ex: 5"
                  value={subtask.sla_days || ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : undefined
                    onUpdate(subtask.id, { sla_days: val && val > 0 ? val : undefined })
                  }}
                  className="h-7 text-xs"
                />
              </div>

              {/* Responsável (role) */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Responsável</Label>
                <Select
                  value={subtask.assigned_role || '_none'}
                  onValueChange={(v) => onUpdate(subtask.id, { assigned_role: v === '_none' ? undefined : v })}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">(Sem atribuição)</SelectItem>
                    {(roles || []).map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Prioridade */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Prioridade</Label>
                <Select
                  value={subtask.priority || 'normal'}
                  onValueChange={(v) => onUpdate(subtask.id, { priority: v as SubtaskData['priority'] })}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Alertas */}
            <AlertConfigEditor
              alerts={(subtask.config as Record<string, unknown>).alerts as AlertsConfig | undefined}
              onChange={(alerts) => onUpdate(subtask.id, {
                config: { ...subtask.config, alerts },
              })}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Bloqueada até (dependência) */}
        {(sameTaskSubtasks.length > 1 || (taskDependencyOptions && taskDependencyOptions.length > 0)) && (() => {
          const hasDep = subtask.dependency_type && subtask.dependency_type !== 'none'
          // Subtarefas da mesma tarefa (excluindo a própria)
          const siblingSubtasks = sameTaskSubtasks.filter((s) => s.id !== subtask.id && s.title)
          // Subtarefas de outras tarefas
          const otherSubtasks = (allSubtasksContext || []).filter(
            (ctx) => ctx.taskId !== currentTaskId && ctx.subtask.title
          )
          const hasOptions = siblingSubtasks.length > 0 || otherSubtasks.length > 0 || (taskDependencyOptions && taskDependencyOptions.length > 0)

          if (!hasOptions) return null

          // Compute current value for the select
          const currentDepValue = (() => {
            if (!hasDep) return '_none'
            if (subtask.dependency_type === 'subtask' && subtask.dependency_subtask_id) {
              return `st:${subtask.dependency_subtask_id}`
            }
            if (subtask.dependency_type === 'task' && subtask.dependency_task_id) {
              return `tk:${subtask.dependency_task_id}`
            }
            return '_none'
          })()

          return (
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Lock className="h-3 w-3 text-muted-foreground" />
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Bloqueada até</Label>
              </div>
              <Select
                value={currentDepValue}
                onValueChange={(v) => {
                  if (v === '_none') {
                    onUpdate(subtask.id, {
                      dependency_type: 'none',
                      dependency_subtask_id: null,
                      dependency_task_id: null,
                    })
                  } else if (v.startsWith('st:')) {
                    onUpdate(subtask.id, {
                      dependency_type: 'subtask',
                      dependency_subtask_id: v.slice(3),
                      dependency_task_id: null,
                    })
                  } else if (v.startsWith('tk:')) {
                    onUpdate(subtask.id, {
                      dependency_type: 'task',
                      dependency_subtask_id: null,
                      dependency_task_id: v.slice(3),
                    })
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Sem bloqueio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">(Sem bloqueio)</SelectItem>
                  {siblingSubtasks.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Subtarefas desta tarefa</SelectLabel>
                      {siblingSubtasks.map((s) => (
                        <SelectItem key={`st:${s.id}`} value={`st:${s.id}`}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {otherSubtasks.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Subtarefas de outras tarefas</SelectLabel>
                      {otherSubtasks.map((ctx) => (
                        <SelectItem key={`st:${ctx.subtask.id}`} value={`st:${ctx.subtask.id}`}>
                          [{ctx.stageLabel}] {ctx.taskTitle} → {ctx.subtask.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {taskDependencyOptions && taskDependencyOptions.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Tarefas (tarefa inteira)</SelectLabel>
                      {taskDependencyOptions.map((t) => (
                        <SelectItem key={`tk:${t.taskId}`} value={`tk:${t.taskId}`}>
                          [{t.stageLabel}] {t.taskTitle}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              {hasDep && (
                <Badge variant="outline" className="text-[10px] h-5 bg-orange-50 text-orange-700 border-orange-200">
                  <Lock className="h-3 w-3 mr-1" />
                  Dependência
                </Badge>
              )}
            </div>
          )
        })()}

        {/* Secção de configuração por proprietário */}
        {(() => {
          const ownerScope = subtask.config.owner_scope
          const isMultiplied = ownerScope && ownerScope !== 'none'

          return (
            <div className="space-y-2 pt-1">
              {/* Badges visuais (quando multiplicação activa) */}
              {isMultiplied && (
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="outline" className="text-[10px] h-5 bg-blue-50 text-blue-700 border-blue-200">
                    <Users className="h-3 w-3 mr-1" />
                    {ownerScope === 'main_contact_only' ? 'Contacto Principal' : 'Por Proprietário'}
                  </Badge>
                  {subtask.config.person_type_filter && subtask.config.person_type_filter !== 'all' && (
                    <Badge variant="outline" className="text-[10px] h-5">
                      {subtask.config.person_type_filter === 'singular' ? 'Singular' : 'Colectiva'}
                    </Badge>
                  )}
                  {subtask.config.has_person_type_variants && (
                    <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-200">
                      S/C
                    </Badge>
                  )}
                </div>
              )}

              {/* Toggle: Repetir por proprietário (mutuamente exclusivo com "Apenas contacto principal") */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={ownerScope === 'all_owners'}
                  onCheckedChange={(checked) => {
                    onUpdate(subtask.id, {
                      config: {
                        ...subtask.config,
                        owner_scope: checked ? 'all_owners' : 'none',
                        person_type_filter: checked ? (subtask.config.person_type_filter || 'all') : undefined,
                        ...(!checked ? {
                          has_person_type_variants: undefined,
                          singular_config: undefined,
                          coletiva_config: undefined,
                        } : {}),
                      },
                    })
                  }}
                  className="scale-75"
                />
                <Label className="text-xs text-muted-foreground cursor-pointer">
                  Repetir por proprietário
                </Label>
              </div>

              {/* Toggle: Apenas contacto principal (mutuamente exclusivo com "Repetir por proprietário") */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={ownerScope === 'main_contact_only'}
                  onCheckedChange={(checked) => {
                    onUpdate(subtask.id, {
                      config: {
                        ...subtask.config,
                        owner_scope: checked ? 'main_contact_only' : 'none',
                        person_type_filter: checked ? (subtask.config.person_type_filter || 'all') : undefined,
                        ...(!checked ? {
                          has_person_type_variants: undefined,
                          singular_config: undefined,
                          coletiva_config: undefined,
                        } : {}),
                      },
                    })
                  }}
                  className="scale-75"
                />
                <Label className="text-xs text-muted-foreground cursor-pointer">
                  Apenas contacto principal
                </Label>
              </div>

              {/* Toggle: Config diferente por tipo de pessoa (mesmo nível, só para tipos com config) */}
              {subtask.type !== 'checklist' && isMultiplied && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!subtask.config.has_person_type_variants}
                    onCheckedChange={(checked) =>
                      onUpdate(subtask.id, {
                        config: {
                          ...subtask.config,
                          has_person_type_variants: checked || undefined,
                          singular_config: checked ? (subtask.config.singular_config || {}) : undefined,
                          coletiva_config: checked ? (subtask.config.coletiva_config || {}) : undefined,
                          ...(checked ? {
                            doc_type_id: undefined,
                            email_library_id: undefined,
                            doc_library_id: undefined,
                          } : {}),
                        },
                      })
                    }
                    className="scale-75"
                  />
                  <Label className="text-xs text-muted-foreground cursor-pointer">
                    Configuração diferente por tipo de pessoa
                  </Label>
                </div>
              )}

              {/* Campos condicionais (visíveis quando um dos modos de proprietário está activo) */}
              {isMultiplied && (
                <div className="pl-4 border-l-2 border-muted space-y-2">
                  {/* Select: Aplicar a que tipo de proprietário */}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Aplicar a</Label>
                    <Select
                      value={subtask.config.person_type_filter || 'all'}
                      onValueChange={(v) =>
                        onUpdate(subtask.id, {
                          config: { ...subtask.config, person_type_filter: v as any },
                        })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os proprietários</SelectItem>
                        <SelectItem value="singular">Apenas Pessoa Singular</SelectItem>
                        <SelectItem value="coletiva">Apenas Pessoa Colectiva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Variantes singular/colectiva */}
                  {subtask.type !== 'checklist' && subtask.config.has_person_type_variants && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          Pessoa Singular
                        </Label>
                        {renderVariantSelect(subtask, 'singular', docTypes, docTypesByCategory, emailTemplates, docTemplates, onUpdate)}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          Pessoa Colectiva
                        </Label>
                        {renderVariantSelect(subtask, 'coletiva', docTypes, docTypesByCategory, emailTemplates, docTemplates, onUpdate)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Toggle obrigatória + botão eliminar */}
      <div className="flex items-center gap-1 shrink-0">
        <Switch
          checked={subtask.is_mandatory}
          onCheckedChange={(v) => onUpdate(subtask.id, { is_mandatory: v })}
          className="scale-75"
        />
        <span className="text-[10px] text-muted-foreground w-8">
          {subtask.is_mandatory ? 'Obrig.' : 'Opc.'}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() => onRemove(subtask.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function SubtaskEditor({
  subtasks,
  onChange,
  taskDependencyOptions,
  allSubtasksContext,
  currentTaskId,
  roles,
}: SubtaskEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Lazy-load doc types and email templates
  const [docTypes, setDocTypes] = useState<{ id: string; name: string; category?: string }[]>([])
  const [emailTemplates, setEmailTemplates] = useState<{ id: string; name: string; subject: string }[]>([])
  const [docTemplates, setDocTemplates] = useState<{ id: string; name: string }[]>([])

  const hasUploadSubtask = subtasks.some((s) => s.type === 'upload')
  const hasEmailSubtask = subtasks.some((s) => s.type === 'email')
  const hasGenerateDocSubtask = subtasks.some((s) => s.type === 'generate_doc')

  useEffect(() => {
    if (hasUploadSubtask && docTypes.length === 0) {
      fetch('/api/libraries/doc-types')
        .then((res) => res.json())
        .then((data) => setDocTypes(Array.isArray(data) ? data : []))
        .catch(() => setDocTypes([]))
    }
  }, [hasUploadSubtask, docTypes.length])

  useEffect(() => {
    if (hasEmailSubtask && emailTemplates.length === 0) {
      fetch('/api/libraries/emails')
        .then((res) => res.json())
        .then((data) => setEmailTemplates(Array.isArray(data) ? data : []))
        .catch(() => setEmailTemplates([]))
    }
  }, [hasEmailSubtask, emailTemplates.length])

  useEffect(() => {
    if (hasGenerateDocSubtask && docTemplates.length === 0) {
      fetch('/api/libraries/docs')
        .then((res) => res.json())
        .then((data) => setDocTemplates(Array.isArray(data) ? data : []))
        .catch(() => setDocTemplates([]))
    }
  }, [hasGenerateDocSubtask, docTemplates.length])

  const docTypesByCategory = docTypes.reduce<Record<string, typeof docTypes>>((acc, dt) => {
    const cat = dt.category || 'Outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(dt)
    return acc
  }, {})

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = subtasks.findIndex((s) => s.id === active.id)
      const newIndex = subtasks.findIndex((s) => s.id === over.id)

      const reordered = arrayMove(subtasks, oldIndex, newIndex).map((s, idx) => ({
        ...s,
        order_index: idx,
      }))
      onChange(reordered)
    },
    [subtasks, onChange]
  )

  const handleUpdate = useCallback(
    (id: string, data: Partial<SubtaskData>) => {
      onChange(
        subtasks.map((s) => (s.id === id ? { ...s, ...data } : s))
      )
    },
    [subtasks, onChange]
  )

  const handleRemove = useCallback(
    (id: string) => {
      onChange(
        subtasks
          .filter((s) => s.id !== id)
          .map((s, idx) => ({ ...s, order_index: idx }))
      )
    },
    [subtasks, onChange]
  )

  const handleAddSubtask = (type: SubtaskData['type']) => {
    onChange([
      ...subtasks,
      {
        id: crypto.randomUUID(),
        type,
        title: '',
        is_mandatory: true,
        order_index: subtasks.length,
        config: {},
      },
    ])
  }

  return (
    <div className="space-y-3">
      {subtasks.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={subtasks.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {subtasks.map((subtask) => (
                <SortableSubtaskRow
                  key={subtask.id}
                  subtask={subtask}
                  docTypes={docTypes}
                  docTypesByCategory={docTypesByCategory}
                  emailTemplates={emailTemplates}
                  docTemplates={docTemplates}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                  sameTaskSubtasks={subtasks}
                  taskDependencyOptions={taskDependencyOptions}
                  allSubtasksContext={allSubtasksContext}
                  currentTaskId={currentTaskId}
                  roles={roles}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            <Plus className="mr-2 h-3.5 w-3.5" />
            Adicionar Subtask
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {SUBTASK_TYPES.map((st) => {
            const Icon = ICON_MAP[st.icon]
            return (
              <DropdownMenuItem key={st.type} onClick={() => handleAddSubtask(st.type)}>
                <Icon className={cn('mr-2 h-4 w-4', st.color)} />
                {st.label}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
