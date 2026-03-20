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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  GripVertical,
  Trash2,
  Plus,
  Upload,
  CheckSquare,
  Mail,
  FileText,
  Settings2,
  Users,
  Clock,
  Lock,
  Bell,
  ClipboardList,
  TextCursorInput,
  CalendarPlus,
} from 'lucide-react'
import { SUBTASK_TYPES, SUBTASK_TYPE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { SubtaskData } from '@/types/subtask'
import {
  SubtaskConfigDialog,
  type SubtaskDependencyOption,
  type SubtaskContextItem,
} from './subtask-config-dialog'

const ICON_MAP: Record<string, React.ElementType> = {
  Upload,
  CheckSquare,
  Mail,
  FileText,
  ClipboardList,
  TextCursorInput,
  CalendarPlus,
  ExternalLink: ClipboardList,
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  upload: Upload,
  checklist: CheckSquare,
  email: Mail,
  generate_doc: FileText,
  form: ClipboardList,
  field: TextCursorInput,
  external_form: ClipboardList,
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

// ─── Compact Sortable Row ────────────────────────────────

function SortableSubtaskRow({
  subtask,
  onUpdateTitle,
  onToggleMandatory,
  onRemove,
  onOpenConfig,
  hasConfig,
}: {
  subtask: SubtaskData
  onUpdateTitle: (id: string, title: string) => void
  onToggleMandatory: (id: string, mandatory: boolean) => void
  onRemove: (id: string) => void
  onOpenConfig: (subtask: SubtaskData) => void
  hasConfig: boolean
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

  const TypeIcon = TYPE_ICONS[subtask.type] || FileText

  // Indicators for configured features
  const indicators: { icon: React.ElementType; label: string; color: string }[] = []
  if (subtask.sla_days || subtask.assigned_role || (subtask.priority && subtask.priority !== 'normal')) {
    indicators.push({ icon: Clock, label: 'Prazos', color: 'text-blue-500' })
  }
  if (subtask.config.owner_scope && subtask.config.owner_scope !== 'none') {
    indicators.push({ icon: Users, label: 'Proprietários', color: 'text-violet-500' })
  }
  if (subtask.dependency_type && subtask.dependency_type !== 'none') {
    indicators.push({ icon: Lock, label: 'Dependência', color: 'text-orange-500' })
  }
  const alerts = subtask.config.alerts
  if (alerts && Object.values(alerts).some((e) => e?.enabled)) {
    indicators.push({ icon: Bell, label: 'Alertas', color: 'text-amber-500' })
  }
  // Form/field config indicators
  if (subtask.type === 'form' && subtask.config.sections?.length) {
    const fieldCount = subtask.config.sections.reduce((sum, s) => sum + (s.fields?.length ?? 0), 0)
    if (fieldCount > 0) {
      indicators.push({ icon: ClipboardList, label: `${fieldCount} campos`, color: 'text-teal-500' })
    }
  }
  if (subtask.type === 'field' && subtask.config.field) {
    indicators.push({ icon: TextCursorInput, label: subtask.config.field.label, color: 'text-cyan-500' })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-2 group"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Type icon + badge */}
      <div className="shrink-0">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 gap-1">
          <TypeIcon className="h-3 w-3" />
          {SUBTASK_TYPE_LABELS[subtask.type]}
        </Badge>
      </div>

      {/* Title input */}
      <Input
        value={subtask.title}
        onChange={(e) => onUpdateTitle(subtask.id, e.target.value)}
        placeholder={getPlaceholder(subtask.type)}
        className="h-8 text-sm flex-1 min-w-0"
      />

      {/* Feature indicators */}
      {indicators.length > 0 && (
        <div className="flex items-center gap-0.5 shrink-0">
          {indicators.map((ind) => (
            <ind.icon key={ind.label} className={cn('h-3.5 w-3.5', ind.color)} />
          ))}
        </div>
      )}

      {/* Mandatory toggle */}
      <div className="flex items-center gap-1 shrink-0">
        <Switch
          checked={subtask.is_mandatory}
          onCheckedChange={(v) => onToggleMandatory(subtask.id, v)}
          className="scale-[0.65]"
        />
        <span className="text-[10px] text-muted-foreground w-6">
          {subtask.is_mandatory ? 'Obr.' : 'Opc.'}
        </span>
      </div>

      {/* Config button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-7 w-7 shrink-0',
          hasConfig
            ? 'text-primary'
            : 'text-muted-foreground opacity-60 group-hover:opacity-100'
        )}
        onClick={() => onOpenConfig(subtask)}
        title="Configurações avançadas"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </Button>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive shrink-0 opacity-60 group-hover:opacity-100"
        onClick={() => onRemove(subtask.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ─── Main SubtaskEditor ──────────────────────────────────

export function SubtaskEditor({
  subtasks,
  onChange,
  taskDependencyOptions,
  allSubtasksContext,
  currentTaskId,
  roles,
}: SubtaskEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Config dialog state
  const [configSubtask, setConfigSubtask] = useState<SubtaskData | null>(null)
  const [configOpen, setConfigOpen] = useState(false)

  // Lazy-load data for subtask config
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

  const handleUpdateTitle = useCallback(
    (id: string, title: string) => {
      onChange(subtasks.map((s) => (s.id === id ? { ...s, title } : s)))
    },
    [subtasks, onChange]
  )

  const handleToggleMandatory = useCallback(
    (id: string, is_mandatory: boolean) => {
      onChange(subtasks.map((s) => (s.id === id ? { ...s, is_mandatory } : s)))
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
    const newSubtask: SubtaskData = {
      id: crypto.randomUUID(),
      type,
      title: '',
      is_mandatory: true,
      order_index: subtasks.length,
      config: {},
    }
    onChange([...subtasks, newSubtask])
    // Auto-open config for the new subtask
    setConfigSubtask(newSubtask)
    setConfigOpen(true)
  }

  const handleOpenConfig = (subtask: SubtaskData) => {
    setConfigSubtask(subtask)
    setConfigOpen(true)
  }

  const handleSaveConfig = (updatedSubtask: SubtaskData) => {
    onChange(subtasks.map((s) => (s.id === updatedSubtask.id ? updatedSubtask : s)))
    setConfigOpen(false)
    setConfigSubtask(null)
  }

  const hasAdvancedConfig = (s: SubtaskData) => {
    return !!(
      s.sla_days ||
      s.assigned_role ||
      (s.priority && s.priority !== 'normal') ||
      (s.config.owner_scope && s.config.owner_scope !== 'none') ||
      (s.dependency_type && s.dependency_type !== 'none') ||
      (s.config.alerts && Object.values(s.config.alerts).some((e) => e?.enabled)) ||
      (s.type === 'form' && s.config.sections?.length) ||
      (s.type === 'field' && s.config.field) ||
      (s.type === 'external_form' && (s.config.external_form_fields?.length || s.config.external_links?.length || s.config.document_shortcuts?.length))
    )
  }

  return (
    <div className="space-y-2">
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
                  onUpdateTitle={handleUpdateTitle}
                  onToggleMandatory={handleToggleMandatory}
                  onRemove={handleRemove}
                  onOpenConfig={handleOpenConfig}
                  hasConfig={hasAdvancedConfig(subtask)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {subtasks.length === 0 && (
        <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhuma subtarefa adicionada. Adicione subtarefas para definir os passos desta tarefa.
        </div>
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

      {/* Subtask Config Dialog */}
      <SubtaskConfigDialog
        open={configOpen}
        onOpenChange={(open) => {
          setConfigOpen(open)
          if (!open) setConfigSubtask(null)
        }}
        subtask={configSubtask}
        onSave={handleSaveConfig}
        docTypes={docTypes}
        docTypesByCategory={docTypesByCategory}
        emailTemplates={emailTemplates}
        docTemplates={docTemplates}
        roles={roles}
        sameTaskSubtasks={subtasks}
        taskDependencyOptions={taskDependencyOptions}
        allSubtasksContext={allSubtasksContext}
        currentTaskId={currentTaskId}
      />
    </div>
  )
}
