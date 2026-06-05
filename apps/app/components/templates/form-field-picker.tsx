'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { Plus, Trash2, GripVertical, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getFieldsByCategory } from '@/lib/form-field-registry'
import type { FieldRegistryEntry } from '@/lib/form-field-registry'
import type { FormFieldConfig, FormSectionConfig } from '@/types/subtask'

// ─── Props ───────────────────────────────────────────────

interface FormFieldPickerProps {
  mode: 'form' | 'field'
  // Modo form:
  sections?: FormSectionConfig[]
  onSectionsChange?: (sections: FormSectionConfig[]) => void
  // Modo field:
  field?: FormFieldConfig | null
  onFieldChange?: (field: FormFieldConfig | null) => void
  // Opções do field:
  showCurrentValue?: boolean
  onShowCurrentValueChange?: (v: boolean) => void
  autoCompleteOnSave?: boolean
  onAutoCompleteOnSaveChange?: (v: boolean) => void
}

// ─── Helpers ─────────────────────────────────────────────

function registryToFieldConfig(entry: FieldRegistryEntry, orderIndex: number): FormFieldConfig {
  return {
    field_name: entry.field_name,
    label: entry.label,
    field_type: entry.field_type,
    target_entity: entry.target_entity,
    placeholder: entry.default_placeholder,
    options: entry.options,
    options_from_constant: entry.options_from_constant,
    min: entry.suggested_min,
    max: entry.suggested_max,
    order_index: orderIndex,
  }
}

function fieldKey(f: { field_name: string; target_entity: string }): string {
  return `${f.target_entity}__${f.field_name}`
}

// ─── Sortable Field Item ─────────────────────────────────

function SortableFieldItem({
  field,
  sectionIdx,
  fieldIdx,
  onWidthChange,
  onToggleRequired,
  onRemove,
}: {
  field: FormFieldConfig
  sectionIdx: number
  fieldIdx: number
  onWidthChange: (si: number, fi: number, w: 'full' | 'half' | 'third') => void
  onToggleRequired: (si: number, fi: number) => void
  onRemove: (si: number, fi: number) => void
}) {
  const id = `field-${sectionIdx}-${fieldKey(field)}`
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50 text-xs"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>
      <span className="flex-1 truncate">{field.label}</span>
      <Select
        value={field.width || 'full'}
        onValueChange={(v) => onWidthChange(sectionIdx, fieldIdx, v as 'full' | 'half' | 'third')}
      >
        <SelectTrigger className="h-6 w-16 text-[10px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="full">Full</SelectItem>
          <SelectItem value="half">½</SelectItem>
          <SelectItem value="third">⅓</SelectItem>
        </SelectContent>
      </Select>
      <button
        type="button"
        className={cn(
          'text-[10px] px-1.5 py-0.5 rounded',
          field.required ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'
        )}
        onClick={() => onToggleRequired(sectionIdx, fieldIdx)}
      >
        {field.required ? 'Req' : 'Opt'}
      </button>
      <button
        type="button"
        className="text-destructive hover:text-destructive/80"
        onClick={() => onRemove(sectionIdx, fieldIdx)}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

// ─── Sortable Section Item ───────────────────────────────

function SortableSectionItem({
  section,
  sectionIdx,
  fieldIds,
  onTitleChange,
  onRemoveSection,
  onWidthChange,
  onToggleRequired,
  onRemoveField,
  onFieldDragEnd,
}: {
  section: FormSectionConfig
  sectionIdx: number
  fieldIds: string[]
  onTitleChange: (idx: number, title: string) => void
  onRemoveSection: (idx: number) => void
  onWidthChange: (si: number, fi: number, w: 'full' | 'half' | 'third') => void
  onToggleRequired: (si: number, fi: number) => void
  onRemoveField: (si: number, fi: number) => void
  onFieldDragEnd: (sectionIdx: number, event: DragEndEvent) => void
}) {
  const id = `section-${sectionIdx}`
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-md border p-2 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <Input
          value={section.title}
          onChange={(e) => onTitleChange(sectionIdx, e.target.value)}
          className="h-7 text-xs font-medium flex-1"
          placeholder="Título da secção"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={() => onRemoveSection(sectionIdx)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {section.fields.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-2">
          Sem campos. Adicione do catálogo acima.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => onFieldDragEnd(sectionIdx, e)}
        >
          <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {section.fields.map((field, fi) => (
                <SortableFieldItem
                  key={fieldIds[fi]}
                  field={field}
                  sectionIdx={sectionIdx}
                  fieldIdx={fi}
                  onWidthChange={onWidthChange}
                  onToggleRequired={onToggleRequired}
                  onRemove={onRemoveField}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

// ─── Form Mode Component ─────────────────────────────────

function FormModePicker({
  sections,
  onSectionsChange,
}: {
  sections: FormSectionConfig[]
  onSectionsChange: (sections: FormSectionConfig[]) => void
}) {
  const [search, setSearch] = useState('')
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const categories = getFieldsByCategory()

  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Get all currently selected field keys
  const selectedKeys = new Set(
    sections.flatMap(s => s.fields.map(f => fieldKey(f)))
  )

  const filteredCategories = Object.entries(categories).reduce((acc, [cat, fields]) => {
    const filtered = search
      ? fields.filter(f =>
          f.label.toLowerCase().includes(search.toLowerCase()) ||
          f.field_name.toLowerCase().includes(search.toLowerCase())
        )
      : fields
    if (filtered.length > 0) acc[cat] = filtered
    return acc
  }, {} as Record<string, FieldRegistryEntry[]>)

  const addField = (entry: FieldRegistryEntry) => {
    let updated = [...sections]
    if (updated.length === 0) {
      updated = [{ title: 'Dados', description: '', fields: [], order_index: 0 }]
    }
    const lastSection = updated[updated.length - 1]
    const newField = registryToFieldConfig(entry, lastSection.fields.length)
    updated[updated.length - 1] = {
      ...lastSection,
      fields: [...lastSection.fields, newField],
    }
    onSectionsChange(updated)
  }

  const removeField = (sectionIdx: number, fieldIdx: number) => {
    const updated = sections.map((s, si) => {
      if (si !== sectionIdx) return s
      const fields = s.fields.filter((_, fi) => fi !== fieldIdx)
        .map((f, i) => ({ ...f, order_index: i }))
      return { ...s, fields }
    })
    onSectionsChange(updated)
  }

  const addSection = () => {
    onSectionsChange([
      ...sections,
      {
        title: `Secção ${sections.length + 1}`,
        description: '',
        fields: [],
        order_index: sections.length,
      },
    ])
  }

  const removeSection = (idx: number) => {
    onSectionsChange(
      sections.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order_index: i }))
    )
  }

  const updateSectionTitle = (idx: number, title: string) => {
    const updated = [...sections]
    updated[idx] = { ...updated[idx], title }
    onSectionsChange(updated)
  }

  const updateFieldWidth = (sectionIdx: number, fieldIdx: number, width: 'full' | 'half' | 'third') => {
    const updated = sections.map((s, si) => {
      if (si !== sectionIdx) return s
      const fields = s.fields.map((f, fi) => fi === fieldIdx ? { ...f, width } : f)
      return { ...s, fields }
    })
    onSectionsChange(updated)
  }

  const toggleFieldRequired = (sectionIdx: number, fieldIdx: number) => {
    const updated = sections.map((s, si) => {
      if (si !== sectionIdx) return s
      const fields = s.fields.map((f, fi) => fi === fieldIdx ? { ...f, required: !f.required } : f)
      return { ...s, fields }
    })
    onSectionsChange(updated)
  }

  // Section drag-and-drop
  const sectionIds = sections.map((_, i) => `section-${i}`)

  const handleSectionDragStart = useCallback((event: DragStartEvent) => {
    setActiveSectionId(event.active.id as string)
  }, [])

  const handleSectionDragEnd = useCallback((event: DragEndEvent) => {
    setActiveSectionId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = parseInt((active.id as string).replace('section-', ''))
    const newIdx = parseInt((over.id as string).replace('section-', ''))

    const reordered = arrayMove(sections, oldIdx, newIdx)
      .map((s, i) => ({ ...s, order_index: i }))
    onSectionsChange(reordered)
  }, [sections, onSectionsChange])

  // Field drag-and-drop within a section
  const handleFieldDragEnd = useCallback((sectionIdx: number, event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const prefix = `field-${sectionIdx}-`
    const activeKey = (active.id as string).replace(prefix, '')
    const overKey = (over.id as string).replace(prefix, '')

    const section = sections[sectionIdx]
    const oldIdx = section.fields.findIndex(f => fieldKey(f) === activeKey)
    const newIdx = section.fields.findIndex(f => fieldKey(f) === overKey)
    if (oldIdx === -1 || newIdx === -1) return

    const reorderedFields = arrayMove(section.fields, oldIdx, newIdx)
      .map((f, i) => ({ ...f, order_index: i }))

    const updated = sections.map((s, si) =>
      si === sectionIdx ? { ...s, fields: reorderedFields } : s
    )
    onSectionsChange(updated)
  }, [sections, onSectionsChange])

  // Active section for overlay
  const activeSectionIdx = activeSectionId
    ? parseInt(activeSectionId.replace('section-', ''))
    : null

  return (
    <div className="space-y-4">
      {/* Field catalog */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Catálogo de Campos</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar campo..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <ScrollArea className="h-48 rounded-md border">
          <Accordion type="multiple" className="px-2">
            {Object.entries(filteredCategories).map(([cat, fields]) => (
              <AccordionItem key={cat} value={cat} className="border-b-0">
                <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                  {cat}
                  <Badge variant="outline" className="ml-auto mr-2 text-[10px]">
                    {fields.length}
                  </Badge>
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <div className="space-y-0.5">
                    {fields.map((f) => {
                      const key = fieldKey(f)
                      const isSelected = selectedKeys.has(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={isSelected}
                          className={cn(
                            'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left',
                            'hover:bg-muted transition-colors',
                            isSelected && 'opacity-40 cursor-not-allowed'
                          )}
                          onClick={() => addField(f)}
                        >
                          <Plus className="h-3 w-3 shrink-0" />
                          <span className="flex-1">{f.label}</span>
                          <Badge variant="outline" className="text-[9px] shrink-0">
                            {f.target_entity.replace('property_', 'p_')}
                          </Badge>
                        </button>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </div>

      <Separator />

      {/* Sections and selected fields */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Secções & Campos Seleccionados</Label>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addSection}>
            <Plus className="h-3 w-3 mr-1" />
            Nova Secção
          </Button>
        </div>

        {sections.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Adicione campos do catálogo acima. Uma secção será criada automaticamente.
          </p>
        ) : (
          <DndContext
            sensors={sectionSensors}
            collisionDetection={closestCenter}
            onDragStart={handleSectionDragStart}
            onDragEnd={handleSectionDragEnd}
          >
            <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {sections.map((section, si) => {
                  const fieldIds = section.fields.map((f) => `field-${si}-${fieldKey(f)}`)
                  return (
                    <SortableSectionItem
                      key={sectionIds[si]}
                      section={section}
                      sectionIdx={si}
                      fieldIds={fieldIds}
                      onTitleChange={updateSectionTitle}
                      onRemoveSection={removeSection}
                      onWidthChange={updateFieldWidth}
                      onToggleRequired={toggleFieldRequired}
                      onRemoveField={removeField}
                      onFieldDragEnd={handleFieldDragEnd}
                    />
                  )
                })}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeSectionIdx !== null && sections[activeSectionIdx] && (
                <div className="rounded-md border bg-background p-2 shadow-md opacity-90">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">{sections[activeSectionIdx].title}</span>
                    <Badge variant="outline" className="text-[9px] ml-auto">
                      {sections[activeSectionIdx].fields.length} campos
                    </Badge>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  )
}

// ─── Field Mode Component ────────────────────────────────

function FieldModePicker({
  field,
  onFieldChange,
  showCurrentValue,
  onShowCurrentValueChange,
  autoCompleteOnSave,
  onAutoCompleteOnSaveChange,
}: {
  field: FormFieldConfig | null
  onFieldChange: (field: FormFieldConfig | null) => void
  showCurrentValue?: boolean
  onShowCurrentValueChange?: (v: boolean) => void
  autoCompleteOnSave?: boolean
  onAutoCompleteOnSaveChange?: (v: boolean) => void
}) {
  const [search, setSearch] = useState('')
  const categories = getFieldsByCategory()

  const selectedKey = field ? fieldKey(field) : null

  const filteredCategories = Object.entries(categories).reduce((acc, [cat, fields]) => {
    const filtered = search
      ? fields.filter(f =>
          f.label.toLowerCase().includes(search.toLowerCase()) ||
          f.field_name.toLowerCase().includes(search.toLowerCase())
        )
      : fields
    if (filtered.length > 0) acc[cat] = filtered
    return acc
  }, {} as Record<string, FieldRegistryEntry[]>)

  const selectField = (entry: FieldRegistryEntry) => {
    onFieldChange(registryToFieldConfig(entry, 0))
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar campo..."
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* Field list */}
      <ScrollArea className="h-48 rounded-md border">
        <div className="p-2 space-y-2">
          {Object.entries(filteredCategories).map(([cat, fields]) => (
            <div key={cat}>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 pb-1">{cat}</p>
              <div className="space-y-0.5">
                {fields.map((f) => {
                  const key = fieldKey(f)
                  const isSelected = key === selectedKey
                  return (
                    <button
                      key={key}
                      type="button"
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors',
                        isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                      )}
                      onClick={() => isSelected ? onFieldChange(null) : selectField(f)}
                    >
                      <div className={cn(
                        'h-3 w-3 rounded-full border-2 shrink-0',
                        isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                      )} />
                      <span className="flex-1">{f.label}</span>
                      <Badge variant="outline" className="text-[9px] shrink-0">
                        {f.field_type}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Selected field options */}
      {field && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium">Seleccionado:</span>
              <Badge variant="secondary">{field.label}</Badge>
              <Badge variant="outline" className="text-[9px]">{field.target_entity}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Mostrar valor actual</Label>
              <Switch
                checked={showCurrentValue ?? true}
                onCheckedChange={onShowCurrentValueChange}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Auto-concluir ao guardar</Label>
              <Switch
                checked={autoCompleteOnSave ?? true}
                onCheckedChange={onAutoCompleteOnSaveChange}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Campo obrigatório</Label>
              <Switch
                checked={field.required ?? false}
                onCheckedChange={(v) => onFieldChange({ ...field, required: v })}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────

export function FormFieldPicker(props: FormFieldPickerProps) {
  if (props.mode === 'form') {
    return (
      <FormModePicker
        sections={props.sections || []}
        onSectionsChange={props.onSectionsChange || (() => {})}
      />
    )
  }

  return (
    <FieldModePicker
      field={props.field || null}
      onFieldChange={props.onFieldChange || (() => {})}
      showCurrentValue={props.showCurrentValue}
      onShowCurrentValueChange={props.onShowCurrentValueChange}
      autoCompleteOnSave={props.autoCompleteOnSave}
      onAutoCompleteOnSaveChange={props.onAutoCompleteOnSaveChange}
    />
  )
}
