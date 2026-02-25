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
  GripVertical,
  Trash2,
  Plus,
  Upload,
  CheckSquare,
  Mail,
  FileText,
} from 'lucide-react'
import { SUBTASK_TYPES, SUBTASK_TYPE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { SubtaskData } from '@/types/subtask'

const ICON_MAP: Record<string, React.ElementType> = {
  Upload,
  CheckSquare,
  Mail,
  FileText,
}

interface SubtaskEditorProps {
  subtasks: SubtaskData[]
  onChange: (subtasks: SubtaskData[]) => void
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

// Sortable row component
function SortableSubtaskRow({
  subtask,
  docTypes,
  docTypesByCategory,
  emailTemplates,
  onUpdate,
  onRemove,
}: {
  subtask: SubtaskData
  docTypes: { id: string; name: string; category?: string }[]
  docTypesByCategory: Record<string, typeof docTypes>
  emailTemplates: { id: string; name: string; subject: string }[]
  onUpdate: (id: string, data: Partial<SubtaskData>) => void
  onRemove: (id: string) => void
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

      <div className="flex-1 space-y-2">
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

        {/* Config condicional por tipo */}
        {subtask.type === 'upload' && (
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

        {subtask.type === 'email' && (
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

        {subtask.type === 'generate_doc' && (
          <p className="text-xs text-muted-foreground italic">
            Selecção de template de documento ficará disponível em breve (M13).
          </p>
        )}

        {/* checklist: não precisa de config extra — só o título */}
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

export function SubtaskEditor({ subtasks, onChange }: SubtaskEditorProps) {
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

  const hasUploadSubtask = subtasks.some((s) => s.type === 'upload')
  const hasEmailSubtask = subtasks.some((s) => s.type === 'email')

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
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
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
