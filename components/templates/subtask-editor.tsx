'use client'

import { useCallback } from 'react'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GripVertical, Trash2, Plus } from 'lucide-react'
import { CHECK_TYPE_LABELS, OWNER_FIELDS_SINGULAR, OWNER_FIELDS_COLETIVA } from '@/lib/constants'
import type { SubtaskData } from '@/types/subtask'

interface SubtaskEditorProps {
  subtasks: SubtaskData[]
  ownerType: 'singular' | 'coletiva'
  docTypes: { id: string; name: string; category?: string }[]
  onChange: (subtasks: SubtaskData[]) => void
}

// Sortable row component
function SortableSubtaskRow({
  subtask,
  ownerType,
  docTypes,
  docTypesByCategory,
  onUpdate,
  onRemove,
}: {
  subtask: SubtaskData
  ownerType: 'singular' | 'coletiva'
  docTypes: { id: string; name: string; category?: string }[]
  docTypesByCategory: Record<string, typeof docTypes>
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

  const ownerFields = ownerType === 'singular' ? OWNER_FIELDS_SINGULAR : OWNER_FIELDS_COLETIVA

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 rounded-md border bg-card p-2"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-2.5 cursor-grab active:cursor-grabbing touch-none shrink-0"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Fields */}
      <div className="flex-1 space-y-2">
        {/* Row 1: Title + check_type */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Título da subtarefa"
            value={subtask.title}
            onChange={(e) => onUpdate(subtask.id, { title: e.target.value })}
            className="flex-1 h-8 text-sm"
          />
          <Select
            value={subtask.config.check_type}
            onValueChange={(v) =>
              onUpdate(subtask.id, {
                config: { ...subtask.config, check_type: v as SubtaskData['config']['check_type'], field_name: undefined, doc_type_id: undefined },
              })
            }
          >
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CHECK_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: Conditional field */}
        {subtask.config.check_type === 'field' && (
          <Select
            value={subtask.config.field_name || ''}
            onValueChange={(v) =>
              onUpdate(subtask.id, { config: { ...subtask.config, field_name: v } })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Seleccionar campo..." />
            </SelectTrigger>
            <SelectContent>
              {ownerFields.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {subtask.config.check_type === 'document' && (
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
      </div>

      {/* Mandatory switch */}
      <div className="flex items-center gap-1 mt-2 shrink-0">
        <Switch
          checked={subtask.is_mandatory}
          onCheckedChange={(v) => onUpdate(subtask.id, { is_mandatory: v })}
          className="scale-75"
        />
        <span className="text-[10px] text-muted-foreground w-8">
          {subtask.is_mandatory ? 'Obrig.' : 'Opc.'}
        </span>
      </div>

      {/* Remove */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-destructive mt-0.5"
        onClick={() => onRemove(subtask.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function SubtaskEditor({
  subtasks,
  ownerType,
  docTypes,
  onChange,
}: SubtaskEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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

  const handleAdd = () => {
    onChange([
      ...subtasks,
      {
        id: crypto.randomUUID(),
        title: '',
        is_mandatory: true,
        order_index: subtasks.length,
        config: { check_type: 'manual' },
      },
    ])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Subtarefas ({subtasks.length})</p>
      </div>

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
                  ownerType={ownerType}
                  docTypes={docTypes}
                  docTypesByCategory={docTypesByCategory}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleAdd}
      >
        <Plus className="mr-2 h-3.5 w-3.5" />
        Adicionar subtarefa
      </Button>
    </div>
  )
}
