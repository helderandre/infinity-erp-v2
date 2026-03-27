'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Wand2, Plus, Trash2, Save, Loader2, ChevronLeft, ChevronRight,
  GripVertical, Eye, Move, MousePointer,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { KNOWN_VARIABLES } from '@/types/pdf-overlay'
import type { PdfTemplateField, AiDetectedField } from '@/types/pdf-overlay'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface Props {
  templateId: string
  fileUrl: string
  templateName: string
  initialFields?: PdfTemplateField[]
  onSave?: (fields: PdfTemplateField[]) => void
}

type EditorField = Omit<PdfTemplateField, 'id' | 'template_id' | 'created_at' | 'updated_at'> & {
  _id: string // local ID for tracking
}

export function PdfFieldEditor({ templateId, fileUrl, templateName, initialFields, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.5)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })

  const [fields, setFields] = useState<EditorField[]>([])
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<EditorField | null>(null)

  const [detecting, setDetecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'select' | 'add'>('select')

  // Dragging state
  const [dragging, setDragging] = useState<{ fieldId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  // Load initial fields
  useEffect(() => {
    if (initialFields) {
      setFields(initialFields.map((f) => ({
        ...f,
        _id: f.id || crypto.randomUUID(),
      })))
    }
  }, [initialFields])

  // Load PDF
  useEffect(() => {
    async function loadPdf() {
      try {
        const doc = await pdfjsLib.getDocument(fileUrl).promise
        setPdfDoc(doc)
        setTotalPages(doc.numPages)
      } catch (err) {
        console.error('Failed to load PDF:', err)
        toast.error('Erro ao carregar PDF')
      }
    }
    loadPdf()
  }, [fileUrl])

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return
    async function renderPage() {
      const page = await pdfDoc!.getPage(currentPage)
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current!
      canvas.width = viewport.width
      canvas.height = viewport.height
      setPageSize({ width: viewport.width, height: viewport.height })
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport }).promise
    }
    renderPage()
  }, [pdfDoc, currentPage, scale])

  const currentPageFields = fields.filter((f) => f.page_number === currentPage)

  // Add field on click
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (mode !== 'add') return
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const newField: EditorField = {
      _id: crypto.randomUUID(),
      page_number: currentPage,
      x_percent: Math.round(x * 10) / 10,
      y_percent: Math.round(y * 10) / 10,
      width_percent: 20,
      height_percent: 2.5,
      variable_key: 'campo_novo',
      display_label: 'Campo Novo',
      font_size: 11,
      font_color: '#000000',
      text_align: 'left' as const,
      transform: null,
      is_required: false,
      ai_detected: false,
      ai_confidence: null,
      sort_order: fields.length,
    }

    setFields((prev) => [...prev, newField])
    setSelectedFieldId(newField._id)
    setEditingField(newField)
    setMode('select')
  }

  // Start dragging a field
  const handleFieldMouseDown = (e: React.MouseEvent, field: EditorField) => {
    e.stopPropagation()
    if (mode !== 'select') return
    setSelectedFieldId(field._id)
    setEditingField(field)
    setDragging({
      fieldId: field._id,
      startX: e.clientX,
      startY: e.clientY,
      origX: field.x_percent,
      origY: field.y_percent,
    })
  }

  // Drag move
  useEffect(() => {
    if (!dragging) return
    const handleMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const dx = ((e.clientX - dragging.startX) / rect.width) * 100
      const dy = ((e.clientY - dragging.startY) / rect.height) * 100
      setFields((prev) =>
        prev.map((f) =>
          f._id === dragging.fieldId
            ? { ...f, x_percent: Math.max(0, Math.min(100, dragging.origX + dx)), y_percent: Math.max(0, Math.min(100, dragging.origY + dy)) }
            : f
        )
      )
    }
    const handleUp = () => {
      // Sync editing field
      setFields((prev) => {
        const updated = prev.find((f) => f._id === dragging.fieldId)
        if (updated) setEditingField({ ...updated })
        return prev
      })
      setDragging(null)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp) }
  }, [dragging])

  // Delete field
  const handleDelete = (id: string) => {
    setFields((prev) => prev.filter((f) => f._id !== id))
    if (selectedFieldId === id) {
      setSelectedFieldId(null)
      setEditingField(null)
    }
  }

  // Update field from sheet
  const updateEditingField = (key: string, value: any) => {
    if (!editingField) return
    const updated = { ...editingField, [key]: value }
    setEditingField(updated)
    setFields((prev) => prev.map((f) => f._id === updated._id ? updated : f))
  }

  // AI detect
  const handleAiDetect = async () => {
    if (!pdfDoc) return
    setDetecting(true)
    try {
      // Render all pages as images
      const pageImages: { page: number; data_url: string }[] = []
      for (let i = 1; i <= totalPages; i++) {
        const page = await pdfDoc.getPage(i)
        const viewport = page.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport }).promise
        pageImages.push({ page: i, data_url: canvas.toDataURL('image/jpeg', 0.8) })
      }

      const res = await fetch(`/api/pdf-templates/${templateId}/detect-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_images: pageImages }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro na deteccao')
      }

      const { fields: detected } = await res.json() as { fields: AiDetectedField[] }

      const newFields: EditorField[] = detected.map((f, idx) => ({
        _id: crypto.randomUUID(),
        page_number: f.page_number,
        x_percent: f.x_percent,
        y_percent: f.y_percent,
        width_percent: f.width_percent,
        height_percent: f.height_percent,
        variable_key: f.variable_key,
        display_label: f.display_label || KNOWN_VARIABLES[f.variable_key] || f.variable_key,
        font_size: 11,
        font_color: '#000000',
        text_align: 'left' as const,
        transform: null,
        is_required: false,
        ai_detected: true,
        ai_confidence: f.confidence,
        sort_order: idx,
      }))

      setFields(newFields)
      toast.success(`${newFields.length} campos detectados pela IA`)
    } catch (err: any) {
      toast.error(err?.message || 'Erro na deteccao de campos')
    } finally {
      setDetecting(false)
    }
  }

  // Save
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/pdf-templates/${templateId}/fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao guardar')
      }
      toast.success('Campos guardados com sucesso')
      onSave?.(fields as any)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao guardar campos')
    } finally {
      setSaving(false)
    }
  }

  if (!pdfDoc) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold truncate max-w-[200px]">{templateName}</h3>
          <Badge variant="secondary" className="text-[10px] rounded-full">
            {fields.length} campo{fields.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/50 border border-border/30">
            <button
              onClick={() => setMode('select')}
              className={cn('px-3 py-1 rounded-full text-xs font-medium transition-all', mode === 'select' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground')}
            >
              <MousePointer className="h-3 w-3 mr-1 inline" />Seleccionar
            </button>
            <button
              onClick={() => setMode('add')}
              className={cn('px-3 py-1 rounded-full text-xs font-medium transition-all', mode === 'add' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground')}
            >
              <Plus className="h-3 w-3 mr-1 inline" />Adicionar
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5"
            onClick={handleAiDetect}
            disabled={detecting}
          >
            {detecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {detecting ? 'A detectar...' : 'Detectar com IA'}
          </Button>

          <Button
            size="sm"
            className="rounded-full gap-1.5"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar
          </Button>
        </div>
      </div>

      {/* Page navigation */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          Pagina {currentPage} de {totalPages}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Select value={String(scale)} onValueChange={(v) => setScale(Number(v))}>
          <SelectTrigger className="w-[90px] h-8 rounded-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">100%</SelectItem>
            <SelectItem value="1.25">125%</SelectItem>
            <SelectItem value="1.5">150%</SelectItem>
            <SelectItem value="2">200%</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-4">
        {/* PDF Canvas + Overlays */}
        <div
          ref={containerRef}
          className={cn(
            'relative border rounded-xl overflow-auto bg-muted/20 flex-1',
            mode === 'add' && 'cursor-crosshair'
          )}
          style={{ maxHeight: '75vh' }}
        >
          <div className="relative inline-block">
            <canvas ref={canvasRef} onClick={handleCanvasClick} />

            {/* Field overlays */}
            {currentPageFields.map((field) => {
              const isSelected = selectedFieldId === field._id
              const confidenceColor = field.ai_detected
                ? (field.ai_confidence ?? 0) >= 0.7 ? 'border-emerald-500 bg-emerald-500/10'
                  : (field.ai_confidence ?? 0) >= 0.4 ? 'border-amber-500 bg-amber-500/10'
                  : 'border-red-500 bg-red-500/10'
                : 'border-blue-500 bg-blue-500/10'

              return (
                <div
                  key={field._id}
                  onMouseDown={(e) => handleFieldMouseDown(e, field)}
                  onClick={(e) => { e.stopPropagation(); setSelectedFieldId(field._id); setEditingField(field) }}
                  className={cn(
                    'absolute border-2 rounded-sm transition-all cursor-move group',
                    isSelected ? 'border-blue-600 bg-blue-600/15 ring-2 ring-blue-600/30 z-20' : confidenceColor,
                    'hover:ring-2 hover:ring-blue-400/30'
                  )}
                  style={{
                    left: `${field.x_percent}%`,
                    top: `${field.y_percent}%`,
                    width: `${field.width_percent}%`,
                    height: `${field.height_percent}%`,
                    minHeight: 16,
                    minWidth: 30,
                  }}
                >
                  {/* Label */}
                  <div className="absolute -top-5 left-0 flex items-center gap-1 whitespace-nowrap">
                    <span className={cn(
                      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold shadow-sm',
                      isSelected ? 'bg-blue-600 text-white' : field.ai_detected ? 'bg-neutral-800 text-white' : 'bg-blue-500 text-white'
                    )}>
                      {field.display_label || field.variable_key}
                    </span>
                    {field.ai_detected && field.ai_confidence != null && (
                      <span className={cn(
                        'text-[7px] font-bold rounded-full px-1 py-0.5',
                        (field.ai_confidence) >= 0.7 ? 'bg-emerald-100 text-emerald-700' : (field.ai_confidence) >= 0.4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      )}>
                        {Math.round((field.ai_confidence) * 100)}%
                      </span>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(field._id) }}
                    className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Field list sidebar */}
        <div className="w-64 shrink-0 space-y-2 max-h-[75vh] overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Campos ({currentPageFields.length})
          </p>
          {currentPageFields.length === 0 ? (
            <div className="rounded-xl border border-dashed py-8 text-center">
              <p className="text-xs text-muted-foreground">Nenhum campo nesta pagina</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Use "Detectar com IA" ou "Adicionar"</p>
            </div>
          ) : (
            currentPageFields.map((field) => (
              <div
                key={field._id}
                onClick={() => { setSelectedFieldId(field._id); setEditingField(field) }}
                className={cn(
                  'rounded-xl border p-3 cursor-pointer transition-all text-xs',
                  selectedFieldId === field._id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'hover:bg-muted/50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{field.display_label || field.variable_key}</span>
                  <div className="flex items-center gap-1">
                    {field.ai_detected && (
                      <Badge variant="secondary" className="text-[8px] rounded-full px-1">IA</Badge>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(field._id) }} className="h-5 w-5 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{`{{${field.variable_key}}}`}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Field properties sheet */}
      <Sheet open={!!editingField} onOpenChange={(o) => { if (!o) { setEditingField(null); setSelectedFieldId(null) } }}>
        <SheetContent side="right" className="w-[340px] sm:w-[380px]">
          <SheetHeader>
            <SheetTitle className="text-sm">Propriedades do Campo</SheetTitle>
          </SheetHeader>
          {editingField && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-xs">Variavel</Label>
                <Select value={editingField.variable_key} onValueChange={(v) => {
                  updateEditingField('variable_key', v)
                  if (KNOWN_VARIABLES[v]) updateEditingField('display_label', KNOWN_VARIABLES[v])
                }}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(KNOWN_VARIABLES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label} <span className="text-muted-foreground ml-1">({key})</span></SelectItem>
                    ))}
                    <SelectItem value={editingField.variable_key}>
                      {editingField.variable_key} (personalizado)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Variavel personalizada</Label>
                <Input
                  className="rounded-xl mt-1"
                  value={editingField.variable_key}
                  onChange={(e) => updateEditingField('variable_key', e.target.value.replace(/\s+/g, '_').toLowerCase())}
                />
              </div>

              <div>
                <Label className="text-xs">Label</Label>
                <Input
                  className="rounded-xl mt-1"
                  value={editingField.display_label || ''}
                  onChange={(e) => updateEditingField('display_label', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tamanho fonte</Label>
                  <Input type="number" className="rounded-xl mt-1" value={editingField.font_size} onChange={(e) => updateEditingField('font_size', Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Cor</Label>
                  <Input type="color" className="rounded-xl mt-1 h-9" value={editingField.font_color} onChange={(e) => updateEditingField('font_color', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Alinhamento</Label>
                  <Select value={editingField.text_align} onValueChange={(v) => updateEditingField('text_align', v)}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Esquerda</SelectItem>
                      <SelectItem value="center">Centro</SelectItem>
                      <SelectItem value="right">Direita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Transformacao</Label>
                  <Select value={editingField.transform || 'none'} onValueChange={(v) => updateEditingField('transform', v === 'none' ? null : v)}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="uppercase">MAIUSCULAS</SelectItem>
                      <SelectItem value="lowercase">minusculas</SelectItem>
                      <SelectItem value="date_pt">Data PT (dd/mm/yyyy)</SelectItem>
                      <SelectItem value="currency_eur">Moeda EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">X (%)</Label>
                  <Input type="number" step="0.1" className="rounded-xl mt-1" value={editingField.x_percent} onChange={(e) => updateEditingField('x_percent', Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Y (%)</Label>
                  <Input type="number" step="0.1" className="rounded-xl mt-1" value={editingField.y_percent} onChange={(e) => updateEditingField('y_percent', Number(e.target.value))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Largura (%)</Label>
                  <Input type="number" step="0.1" className="rounded-xl mt-1" value={editingField.width_percent} onChange={(e) => updateEditingField('width_percent', Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Altura (%)</Label>
                  <Input type="number" step="0.1" className="rounded-xl mt-1" value={editingField.height_percent} onChange={(e) => updateEditingField('height_percent', Number(e.target.value))} />
                </div>
              </div>

              {editingField.ai_detected && (
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    Detectado por IA · Confianca: {Math.round((editingField.ai_confidence || 0) * 100)}%
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
