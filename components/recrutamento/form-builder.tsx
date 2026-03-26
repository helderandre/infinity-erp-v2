'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import {
  Eye, EyeOff, GripVertical, Loader2, Save, Sparkles, X, Pencil,
  Type, Mail, Phone, Calendar, ListChecks, ToggleLeft, Upload, FileText,
  Plus, Trash2, Settings2, Smartphone, Monitor, ChevronDown, ChevronRight, Copy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getFormFields, updateFormField, reorderFormFields, updateSectionLabel,
  type FormFieldConfig,
} from '@/app/dashboard/recrutamento/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const LOGO_URL = 'https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/43f87d7c-92b5-4403-b7bb-618c8d4a2b9e.png'

const SECTION_LABELS_FALLBACK: Record<string, string> = {
  documento: 'Documento de Identificação',
  dados_pessoais: 'Dados Pessoais',
  contactos: 'Contactos',
  email_profissional: 'Email Profissional',
  email_remax: 'Email Profissional',
  experiencia: 'Experiência',
  redes_sociais: 'Redes Sociais',
}

const FIELD_TYPE_ICONS: Record<string, typeof Type> = {
  text: Type, email: Mail, tel: Phone, date: Calendar,
  select: ListChecks, toggle: ToggleLeft, file: Upload, textarea: FileText,
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Texto', email: 'Email', tel: 'Telefone', date: 'Data',
  select: 'Selecção', toggle: 'Toggle', file: 'Ficheiro', textarea: 'Texto longo',
}

type ViewMode = 'builder' | 'preview'
type DeviceMode = 'desktop' | 'mobile'

export function FormBuilder() {
  const [fields, setFields] = useState<FormFieldConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('builder')
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below'>('below')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [draggedSection, setDraggedSection] = useState<string | null>(null)
  const [dragOverSection, setDragOverSection] = useState<string | null>(null)
  const [dragOverSectionPos, setDragOverSectionPos] = useState<'above' | 'below'>('below')

  const fetchFields = useCallback(async () => {
    setLoading(true)
    const { fields: data, error } = await getFormFields()
    if (error) toast.error('Erro ao carregar campos')
    else setFields(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchFields() }, [fetchFields])

  const selectedField = fields.find(f => f.id === selectedFieldId) || null

  // Group fields by section
  const sections = fields.reduce<Record<string, FormFieldConfig[]>>((acc, field) => {
    if (!acc[field.section]) acc[field.section] = []
    acc[field.section].push(field)
    return acc
  }, {})

  const visibleSections = Object.entries(sections).map(([section, sectionFields]) => ({
    section,
    label: sectionFields[0]?.section_label || SECTION_LABELS_FALLBACK[section] || section,
    fields: sectionFields.sort((a, b) => a.order_index - b.order_index),
  }))

  // Update section label
  const handleUpdateSectionLabel = useCallback(async (section: string, newLabel: string) => {
    if (!newLabel.trim()) return
    // Optimistic update
    setFields(prev => prev.map(f => f.section === section ? { ...f, section_label: newLabel } : f))
    const { error } = await updateSectionLabel(section, newLabel.trim())
    if (error) { toast.error('Erro ao actualizar secção'); fetchFields() }
  }, [fetchFields])

  // Toggle field visibility
  const handleToggleVisible = useCallback(async (field: FormFieldConfig) => {
    const newVal = !field.is_visible
    setFields(prev => prev.map(f => f.id === field.id ? { ...f, is_visible: newVal } : f))
    const { error } = await updateFormField(field.id, { is_visible: newVal })
    if (error) {
      toast.error('Erro ao actualizar campo')
      setFields(prev => prev.map(f => f.id === field.id ? { ...f, is_visible: !newVal } : f))
    }
  }, [])

  // Toggle required
  const handleToggleRequired = useCallback(async (field: FormFieldConfig) => {
    const newVal = !field.is_required
    setFields(prev => prev.map(f => f.id === field.id ? { ...f, is_required: newVal } : f))
    const { error } = await updateFormField(field.id, { is_required: newVal })
    if (error) {
      toast.error('Erro ao actualizar campo')
      setFields(prev => prev.map(f => f.id === field.id ? { ...f, is_required: !newVal } : f))
    }
  }, [])

  // Update field label/placeholder
  const handleUpdateField = useCallback(async (fieldId: string, updates: Partial<FormFieldConfig>) => {
    setSaving(true)
    const { error } = await updateFormField(fieldId, updates)
    setSaving(false)
    if (error) {
      toast.error('Erro ao guardar')
    } else {
      setFields(prev => prev.map(f => f.id === fieldId ? { ...f, ...updates } : f))
      toast.success('Campo actualizado')
    }
  }, [])

  // Drag reorder
  const handleDragStart = useCallback((id: string) => { setDraggedId(id) }, [])
  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (id === draggedId) return
    setDragOverId(id)
    // Detect if cursor is in top or bottom half of the target
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDragOverPosition(e.clientY < midY ? 'above' : 'below')
  }, [draggedId])
  const handleDrop = useCallback(async (targetId: string) => {
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return }
    const draggedField = fields.find(f => f.id === draggedId)
    const targetField = fields.find(f => f.id === targetId)
    if (!draggedField || !targetField) return

    const isCrossSection = draggedField.section !== targetField.section
    const targetSection = targetField.section
    const targetSectionLabel = targetField.section_label

    // Get fields in the target section (excluding the dragged one if same section)
    const targetSectionFields = fields
      .filter(f => f.section === targetSection && f.id !== draggedId)
      .sort((a, b) => a.order_index - b.order_index)

    // Find insert position
    let insertIdx = targetSectionFields.findIndex(f => f.id === targetId)
    if (dragOverPosition === 'below') insertIdx += 1

    // Insert the dragged field
    const reordered = [...targetSectionFields]
    reordered.splice(insertIdx, 0, draggedField)

    // Build updates for the target section
    const updates = reordered.map((f, i) => ({ id: f.id, order_index: i }))

    // If cross-section, also reindex the source section
    const sourceUpdates: { id: string; order_index: number }[] = []
    if (isCrossSection) {
      const sourceFields = fields
        .filter(f => f.section === draggedField.section && f.id !== draggedId)
        .sort((a, b) => a.order_index - b.order_index)
      sourceFields.forEach((f, i) => sourceUpdates.push({ id: f.id, order_index: i }))
    }

    // Optimistic update
    setFields(prev => {
      let updated = [...prev]
      // Move dragged field to target section
      if (isCrossSection) {
        updated = updated.map(f => f.id === draggedId ? { ...f, section: targetSection, section_label: targetSectionLabel } : f)
      }
      // Apply order updates
      const allUpdates = [...updates, ...sourceUpdates]
      allUpdates.forEach(u => {
        const idx = updated.findIndex(f => f.id === u.id)
        if (idx >= 0) updated[idx] = { ...updated[idx], order_index: u.order_index }
      })
      return updated
    })

    setDraggedId(null); setDragOverId(null)

    // Persist: update section if cross-section move
    if (isCrossSection) {
      await updateFormField(draggedId, { section: targetSection, section_label: targetSectionLabel })
    }

    // Persist: reorder both sections
    const allReorderUpdates = [...updates, ...sourceUpdates]
    const { error } = await reorderFormFields(allReorderUpdates)
    if (error) { toast.error('Erro ao reordenar'); fetchFields() }
  }, [draggedId, dragOverPosition, fields, fetchFields])

  // Section drag handlers
  const handleSectionDragStart = useCallback((section: string) => {
    setDraggedSection(section)
  }, [])

  const handleSectionDragOver = useCallback((e: React.DragEvent, section: string) => {
    e.preventDefault()
    if (section === draggedSection) return
    setDragOverSection(section)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragOverSectionPos(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below')
  }, [draggedSection])

  const handleSectionDrop = useCallback(async (targetSection: string) => {
    if (!draggedSection || draggedSection === targetSection) {
      setDraggedSection(null); setDragOverSection(null); return
    }

    // Get current section order
    const sectionOrder = visibleSections.map(s => s.section)
    const fromIdx = sectionOrder.indexOf(draggedSection)
    let toIdx = sectionOrder.indexOf(targetSection)
    if (fromIdx === -1 || toIdx === -1) return

    // Remove and reinsert
    const reordered = [...sectionOrder]
    reordered.splice(fromIdx, 1)
    if (dragOverSectionPos === 'below') toIdx = Math.min(toIdx + (fromIdx < toIdx ? 0 : 1), reordered.length)
    else toIdx = Math.max(0, toIdx - (fromIdx < toIdx ? 1 : 0))
    reordered.splice(toIdx, 0, draggedSection)

    // Assign global order_index: section 0 fields get 0-99, section 1 gets 100-199, etc.
    const allUpdates: { id: string; order_index: number }[] = []
    reordered.forEach((sec, secIdx) => {
      const secFields = fields
        .filter(f => f.section === sec)
        .sort((a, b) => a.order_index - b.order_index)
      secFields.forEach((f, fieldIdx) => {
        allUpdates.push({ id: f.id, order_index: secIdx * 100 + fieldIdx })
      })
    })

    // Optimistic update
    setFields(prev => {
      const updated = [...prev]
      allUpdates.forEach(u => {
        const idx = updated.findIndex(f => f.id === u.id)
        if (idx >= 0) updated[idx] = { ...updated[idx], order_index: u.order_index }
      })
      return updated
    })

    setDraggedSection(null); setDragOverSection(null)

    const { error } = await reorderFormFields(allUpdates)
    if (error) { toast.error('Erro ao reordenar secções'); fetchFields() }
  }, [draggedSection, dragOverSectionPos, visibleSections, fields, fetchFields])

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section); else next.add(section)
      return next
    })
  }

  if (loading) {
    return <div className="flex gap-4 h-[calc(100vh-12rem)]">
      <Skeleton className="w-56 h-full rounded-xl" />
      <Skeleton className="flex-1 h-full rounded-xl" />
      <Skeleton className="w-64 h-full rounded-xl" />
    </div>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Topbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-1 p-0.5 rounded-full bg-muted/40 border border-border/30">
          {([['builder', 'Editor', Settings2] as const, ['preview', 'Pré-visualizar', Eye] as const]).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setViewMode(key)}
              className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all',
                viewMode === key ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
              <Icon className="h-3 w-3" />{label}
            </button>
          ))}
        </div>

        {viewMode === 'preview' && (
          <div className="flex items-center gap-1 p-0.5 rounded-full bg-muted/40 border border-border/30 ml-2">
            <button onClick={() => setDeviceMode('desktop')} className={cn('p-1.5 rounded-full transition-all', deviceMode === 'desktop' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-muted-foreground')}>
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setDeviceMode('mobile')} className={cn('p-1.5 rounded-full transition-all', deviceMode === 'mobile' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-muted-foreground')}>
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs gap-1"
            onClick={() => {
              const url = `${window.location.origin}/entryform`
              navigator.clipboard.writeText(url)
              toast.success('Link copiado!')
            }}
          >
            <Copy className="h-3 w-3" />Copiar link
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs gap-1"
            onClick={() => window.open('/entryform', '_blank')}
          >
            <Eye className="h-3 w-3" />Abrir formulário
          </Button>
        </div>
      </div>

      {/* Builder mode */}
      {viewMode === 'builder' && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left — Field types toolbox */}
          <div className="w-52 border-r bg-muted/10 overflow-y-auto p-3 shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Tipos de Campo</p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(FIELD_TYPE_LABELS).map(([type, label]) => {
                const Icon = FIELD_TYPE_ICONS[type] || Type
                return (
                  <div key={type} className="flex flex-col items-center gap-1 rounded-lg border bg-background p-2 text-center cursor-default opacity-70 hover:opacity-100 transition-opacity">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] font-medium">{label}</span>
                  </div>
                )
              })}
            </div>
            <Separator className="my-3" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Secções</p>
            <div className="space-y-1">
              {visibleSections.map(s => (
                <div
                  key={s.section}
                  draggable
                  onDragStart={() => handleSectionDragStart(s.section)}
                  onDragOver={(e) => handleSectionDragOver(e, s.section)}
                  onDrop={() => handleSectionDrop(s.section)}
                  onDragEnd={() => { setDraggedSection(null); setDragOverSection(null) }}
                  onClick={() => {
                    const el = document.getElementById(`form-section-${s.section}`)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={cn(
                    'flex items-center gap-1.5 w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing',
                    draggedSection === s.section && 'opacity-30',
                  )}
                  style={dragOverSection === s.section && draggedSection !== s.section ? {
                    [dragOverSectionPos === 'above' ? 'borderTop' : 'borderBottom']: '2px solid hsl(var(--primary))',
                  } : undefined}
                >
                  <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  <span className="flex-1 truncate">{s.label}</span>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0">({s.fields.filter(f => f.is_visible).length})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Center — Canvas */}
          <div className="flex-1 overflow-y-auto bg-muted/20 p-6">
            <div className="mx-auto" style={{ maxWidth: 620 }}>
              {/* Form header */}
              <div className="rounded-t-2xl bg-neutral-900 px-6 py-6 text-center">
                <img src={LOGO_URL} alt="Infinity Group" className="h-12 mx-auto" />
              </div>

              {/* Form body */}
              <div className="bg-white border border-t-0 rounded-b-2xl shadow-sm">
                {visibleSections.map(s => (
                  <div
                    key={s.section}
                    id={`form-section-${s.section}`}
                    className="border-b last:border-b-0"
                  >
                    {/* Section header — editable title */}
                    <div className="flex items-center gap-2 px-5 py-3 hover:bg-muted/30 transition-colors group">
                      <button onClick={(e) => { e.stopPropagation(); toggleSection(s.section) }} className="shrink-0">
                        {collapsedSections.has(s.section)
                          ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                      </button>
                      <input
                        type="text"
                        defaultValue={s.label}
                        onBlur={(e) => handleUpdateSectionLabel(s.section, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        className="text-sm font-semibold bg-transparent border-none outline-none focus:ring-1 focus:ring-primary/30 rounded px-1 -mx-1 flex-1 min-w-0"
                      />
                      <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors shrink-0" />
                      <span className="text-[10px] text-muted-foreground shrink-0">{s.fields.filter(f => f.is_visible).length} campos</span>
                    </div>

                    {/* Fields */}
                    {!collapsedSections.has(s.section) && (
                      <div className="px-5 pb-4 space-y-2">
                        {s.fields.map(field => {
                          const Icon = FIELD_TYPE_ICONS[field.field_type] || Type
                          const isSelected = selectedFieldId === field.id
                          return (
                            <div
                              key={field.id}
                              draggable
                              onDragStart={() => handleDragStart(field.id)}
                              onDragOver={(e) => handleDragOver(e, field.id)}
                              onDrop={() => handleDrop(field.id)}
                              onDragEnd={() => { setDraggedId(null); setDragOverId(null) }}
                              onClick={() => setSelectedFieldId(field.id)}
                              className={cn(
                                'group relative rounded-xl border-2 px-3 py-2.5 cursor-pointer transition-all',
                                isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent hover:border-border/50',
                                draggedId === field.id && 'opacity-30 scale-[0.98]',
                                !field.is_visible && 'opacity-40'
                              )}
                              style={dragOverId === field.id && draggedId !== field.id ? {
                                [dragOverPosition === 'above' ? 'borderTopColor' : 'borderBottomColor']: 'hsl(var(--primary))',
                                [dragOverPosition === 'above' ? 'borderTopWidth' : 'borderBottomWidth']: '3px',
                                [dragOverPosition === 'above' ? 'marginTop' : 'marginBottom']: '-1px',
                              } : undefined}
                            >
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 cursor-grab shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium">{field.label}</span>
                                    {field.is_required && <span className="text-red-500 text-xs">*</span>}
                                    {!field.is_visible && <Badge variant="outline" className="text-[9px] h-4">Oculto</Badge>}
                                  </div>
                                  {/* Render a fake input preview */}
                                  <div className="mt-1.5">
                                    {field.field_type === 'select' ? (
                                      <div className="h-8 rounded-md border bg-muted/30 px-3 flex items-center text-xs text-muted-foreground">
                                        {field.placeholder || 'Seleccionar...'}
                                      </div>
                                    ) : field.field_type === 'toggle' ? (
                                      <div className="flex items-center gap-2">
                                        <div className="h-5 w-9 rounded-full bg-muted border" />
                                        <span className="text-xs text-muted-foreground">{field.placeholder || 'Sim / Não'}</span>
                                      </div>
                                    ) : field.field_type === 'file' ? (
                                      <div className="h-8 rounded-md border border-dashed bg-muted/20 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                                        <Upload className="h-3 w-3" />{field.placeholder || 'Carregar ficheiro'}
                                      </div>
                                    ) : field.field_type === 'textarea' ? (
                                      <div className="h-16 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                        {field.placeholder || ''}
                                      </div>
                                    ) : (
                                      <div className="h-8 rounded-md border bg-muted/30 px-3 flex items-center text-xs text-muted-foreground">
                                        <Icon className="h-3 w-3 mr-1.5 shrink-0" />
                                        {field.placeholder || ''}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Settings panel */}
          <div className="w-64 border-l bg-background overflow-y-auto shrink-0">
            {selectedField ? (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Propriedades</h3>
                  <button onClick={() => setSelectedFieldId(null)} className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center">
                    <X className="h-3 w-3" />
                  </button>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Chave</Label>
                  <Input value={selectedField.field_key} disabled className="text-xs h-8 bg-muted/50" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {(() => { const I = FIELD_TYPE_ICONS[selectedField.field_type] || Type; return <I className="h-3.5 w-3.5" /> })()}
                    {FIELD_TYPE_LABELS[selectedField.field_type] || selectedField.field_type}
                  </div>
                </div>

                <Separator />

                <div className="space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={selectedField.label}
                    onChange={(e) => setFields(prev => prev.map(f => f.id === selectedField.id ? { ...f, label: e.target.value } : f))}
                    onBlur={(e) => handleUpdateField(selectedField.id, { label: e.target.value })}
                    className="text-xs h-8"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Placeholder</Label>
                  <Input
                    value={selectedField.placeholder || ''}
                    onChange={(e) => setFields(prev => prev.map(f => f.id === selectedField.id ? { ...f, placeholder: e.target.value } : f))}
                    onBlur={(e) => handleUpdateField(selectedField.id, { placeholder: e.target.value || null })}
                    className="text-xs h-8"
                    placeholder="Texto de placeholder..."
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Visível</Label>
                  <Switch checked={selectedField.is_visible} onCheckedChange={() => handleToggleVisible(selectedField)} />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Obrigatório</Label>
                  <Switch checked={selectedField.is_required} onCheckedChange={() => handleToggleRequired(selectedField)} />
                </div>

                {/* Options editor for select fields */}
                {selectedField.field_type === 'select' && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Opções</Label>
                      <div className="space-y-1">
                        {(selectedField.options || []).map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <GripVertical className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                            <Input
                              value={opt}
                              onChange={(e) => {
                                const newOptions = [...(selectedField.options || [])]
                                newOptions[idx] = e.target.value
                                setFields(prev => prev.map(f => f.id === selectedField.id ? { ...f, options: newOptions } : f))
                              }}
                              onBlur={() => {
                                handleUpdateField(selectedField.id, { options: selectedField.options })
                              }}
                              className="text-xs h-7 flex-1"
                            />
                            <button
                              onClick={() => {
                                const newOptions = (selectedField.options || []).filter((_, i) => i !== idx)
                                setFields(prev => prev.map(f => f.id === selectedField.id ? { ...f, options: newOptions } : f))
                                handleUpdateField(selectedField.id, { options: newOptions })
                              }}
                              className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-xs rounded-lg gap-1"
                        onClick={() => {
                          const newOptions = [...(selectedField.options || []), 'Nova opção']
                          setFields(prev => prev.map(f => f.id === selectedField.id ? { ...f, options: newOptions } : f))
                          handleUpdateField(selectedField.id, { options: newOptions })
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Adicionar opção
                      </Button>
                    </div>
                  </>
                )}

                {selectedField.is_ai_extractable && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600">
                    <Sparkles className="h-3 w-3" />
                    Extraível por IA
                  </div>
                )}

                <Separator />

                <div className="text-[10px] text-muted-foreground space-y-1">
                  <p>Secção: {selectedField.section_label || SECTION_LABELS_FALLBACK[selectedField.section] || selectedField.section}</p>
                  <p>Ordem: {selectedField.order_index}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <Settings2 className="h-8 w-8 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Seleccione um campo para editar as suas propriedades</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview mode */}
      {viewMode === 'preview' && (
        <div className="flex-1 overflow-y-auto bg-muted/30 p-6">
          <div className="mx-auto transition-all duration-300" style={{ maxWidth: deviceMode === 'mobile' ? 375 : 620 }}>
            {/* Form header */}
            <div className="rounded-t-2xl bg-neutral-900 px-6 py-8 text-center">
              <img src={LOGO_URL} alt="Infinity Group" className="h-14 mx-auto mb-3" />
              <h1 className="text-white text-lg font-bold">Formulário de Entrada</h1>
              <p className="text-neutral-400 text-xs mt-1">Preencha os dados para iniciar o processo de onboarding</p>
            </div>

            {/* Form body */}
            <div className="bg-white border border-t-0 rounded-b-2xl shadow-sm px-6 py-6 space-y-6">
              {visibleSections.map(s => {
                const visibleFields = s.fields.filter(f => f.is_visible)
                if (visibleFields.length === 0) return null
                return (
                  <div key={s.section}>
                    <h2 className="text-sm font-bold mb-3 text-neutral-800">{s.label}</h2>
                    <div className="space-y-3">
                      {visibleFields.map(field => (
                        <div key={field.id} className="space-y-1">
                          <label className="text-xs font-medium text-neutral-700">
                            {field.label}
                            {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
                          </label>
                          {field.field_type === 'select' ? (
                            <select className="w-full h-9 rounded-lg border bg-white px-3 text-sm text-muted-foreground" disabled>
                              <option>{field.placeholder || 'Seleccionar...'}</option>
                            </select>
                          ) : field.field_type === 'toggle' ? (
                            <div className="flex items-center gap-3">
                              <button className="h-5 w-9 rounded-full bg-muted border transition-colors" disabled />
                              <span className="text-xs text-muted-foreground">{field.placeholder || 'Sim / Não'}</span>
                            </div>
                          ) : field.field_type === 'file' ? (
                            <div className="h-20 rounded-lg border-2 border-dashed bg-muted/20 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                              <Upload className="h-5 w-5" />
                              <span className="text-xs">{field.placeholder || 'Carregar ficheiro'}</span>
                            </div>
                          ) : field.field_type === 'textarea' ? (
                            <textarea className="w-full h-20 rounded-lg border bg-white px-3 py-2 text-sm" placeholder={field.placeholder || ''} disabled />
                          ) : field.field_type === 'date' ? (
                            <input type="date" className="w-full h-9 rounded-lg border bg-white px-3 text-sm text-muted-foreground" disabled />
                          ) : (
                            <input type={field.field_type} className="w-full h-9 rounded-lg border bg-white px-3 text-sm" placeholder={field.placeholder || ''} disabled />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Submit button preview */}
              <div className="pt-2">
                <button className="w-full h-10 rounded-xl bg-neutral-900 text-white font-medium text-sm" disabled>
                  Submeter Formulário
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
