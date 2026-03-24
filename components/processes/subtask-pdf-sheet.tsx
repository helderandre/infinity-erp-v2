'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import {
  FileType,
  CheckCircle2,
  Eye,
  Pencil,
  Save,
  Download,
  User,
  Building2,
  Variable,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTemplateVariables } from '@/hooks/use-template-variables'
import type { ProcSubtask } from '@/types/subtask'
import type { TemplateVariable } from '@/hooks/use-template-variables'

// ─── Types ───────────────────────────────────────────────────────

interface SubtaskPdfSheetProps {
  subtask: ProcSubtask
  propertyId: string
  processId: string
  taskId: string
  consultantId?: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onComplete: () => void
  onSaveDraft?: () => void
}

interface PdfFieldData {
  name: string
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'textarea' | 'unknown'
  options?: string[]
  page: number
  position: { x: number; y: number; width: number; height: number } | null
  suggestedFontSize: number | null
  mapping: {
    variable_key: string | null
    default_value: string | null
    transform: string | null
    font_size: number | null
    is_required: boolean
    display_label: string | null
    display_order: number
  } | null
}

interface PageRenderInfo {
  pdfWidth: number
  pdfHeight: number
  canvasWidth: number
  canvasHeight: number
}

// ─── Helpers ─────────────────────────────────────────────────────

function getDocLibraryId(subtask: ProcSubtask): string | undefined {
  const c = subtask.config as Record<string, unknown>
  if (c.has_person_type_variants) {
    const personType = (subtask as unknown as { owner?: { person_type?: string } }).owner?.person_type
    if (personType === 'singular') return (c.singular_config as Record<string, string> | undefined)?.doc_library_id
    if (personType === 'coletiva') return (c.coletiva_config as Record<string, string> | undefined)?.doc_library_id
  }
  return c.doc_library_id as string | undefined
}

function applyTransform(value: string, transform: string | null): string {
  if (!transform || !value) return value
  switch (transform) {
    case 'uppercase': return value.toUpperCase()
    case 'lowercase': return value.toLowerCase()
    case 'date_pt': {
      const d = new Date(value)
      if (isNaN(d.getTime())) return value
      return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
    case 'currency_eur': {
      const num = parseFloat(value)
      if (isNaN(num)) return value
      return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(num)
    }
    default: return value
  }
}

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const DEFAULT_ZOOM_INDEX = 2 // 100%

// ─── AutoScaleInput: reduces font size (both dimensions) when text overflows ──

const _measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null

function measureTextWidth(text: string, fontSize: number, fontFamily: string): number {
  if (!_measureCanvas || !text) return 0
  const ctx = _measureCanvas.getContext('2d')
  if (!ctx) return 0
  ctx.font = `${fontSize}px ${fontFamily}`
  return ctx.measureText(text).width
}

function AutoScaleInput({
  fieldWidth,
  fieldHeight,
  baseFontSize,
  style,
  value,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  fieldWidth: number
  fieldHeight: number
  baseFontSize: number
}) {
  const [fontSize, setFontSize] = useState(baseFontSize)

  useEffect(() => {
    const text = (value as string) || ''
    if (!text) { setFontSize(baseFontSize); return }

    const padding = 4
    const available = fieldWidth - padding
    if (available <= 0) { setFontSize(baseFontSize); return }

    const textWidth = measureTextWidth(text, baseFontSize, 'sans-serif')
    if (textWidth > available) {
      // Shrink font proportionally (both width + height shrink together)
      const ratio = available / textWidth
      setFontSize(Math.max(6, Math.round(baseFontSize * ratio)))
    } else {
      setFontSize(baseFontSize)
    }
  }, [value, fieldWidth, baseFontSize])

  return (
    <input
      type="text"
      value={value}
      {...props}
      style={{
        ...style,
        fontSize,
        lineHeight: `${fieldHeight}px`,
      }}
    />
  )
}

// ─── Main Component ──────────────────────────────────────────────

export function SubtaskPdfSheet({
  subtask,
  propertyId,
  processId,
  taskId,
  consultantId,
  open,
  onOpenChange,
  onComplete,
  onSaveDraft: onSaveDraftProp,
}: SubtaskPdfSheetProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [fields, setFields] = useState<PdfFieldData[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [resolvedVariables, setResolvedVariables] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [isSaving, setIsSaving] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [selectedFieldName, setSelectedFieldName] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [pageInfos, setPageInfos] = useState<PageRenderInfo[]>([])
  const [variablesSidebarOpen, setVariablesSidebarOpen] = useState(true)
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const [isPdfReady, setIsPdfReady] = useState(false)

  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null)
  const baseWidthRef = useRef(700)

  const { variables: templateVariables } = useTemplateVariables()

  const docLibraryId = getDocLibraryId(subtask)
  const ownerId = (subtask as unknown as { owner_id?: string }).owner_id
  const isCompleted = subtask.is_completed
  const pdfProxyUrl = docLibraryId ? `/api/libraries/docs/${docLibraryId}/pdf` : null
  const zoom = ZOOM_LEVELS[zoomIndex]

  // ─── Load template data + resolve variables ──────────────────────
  const loadData = useCallback(async () => {
    if (!docLibraryId || !open) return
    setIsLoading(true)
    setError(null)

    try {
      const [fieldsRes, varsRes, tplRes] = await Promise.all([
        fetch(`/api/libraries/docs/${docLibraryId}/fields`),
        fetch('/api/libraries/emails/preview-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId || undefined,
            owner_id: ownerId || undefined,
            consultant_id: consultantId || undefined,
            process_id: processId || undefined,
          }),
        }),
        fetch(`/api/libraries/docs/${docLibraryId}`),
      ])

      if (tplRes.ok) {
        const tpl = await tplRes.json()
        setTemplateName(tpl.name || 'Template PDF')
      }

      if (!fieldsRes.ok) throw new Error('Erro ao carregar campos do PDF')
      const fieldsData: PdfFieldData[] = await fieldsRes.json()
      setFields(fieldsData)

      let vars: Record<string, string> = {}
      if (varsRes.ok) {
        const varsData = await varsRes.json()
        vars = varsData.variables || {}
      }
      setResolvedVariables(vars)

      // Restore draft or pre-populate
      const rendered = (subtask.config as Record<string, unknown>).rendered as
        | { pdf_field_values?: Record<string, string> }
        | undefined

      if (rendered?.pdf_field_values) {
        setFieldValues(rendered.pdf_field_values)
      } else {
        const initial: Record<string, string> = {}
        for (const f of fieldsData) {
          const m = f.mapping
          if (!m) continue
          if (m.variable_key && vars[m.variable_key]) {
            initial[f.name] = applyTransform(vars[m.variable_key], m.transform)
          } else if (m.default_value) {
            initial[f.name] = m.default_value
          }
        }
        setFieldValues(initial)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar template')
    } finally {
      setIsLoading(false)
    }
  }, [docLibraryId, open, propertyId, ownerId, consultantId, processId, subtask.config])

  useEffect(() => {
    if (open) {
      setIsPdfReady(false)
      loadData()
    }
  }, [open, loadData])

  // ─── Render ALL pages ────────────────────────────────────────────
  const renderAllPages = useCallback(async () => {
    if (!pdfDocRef.current) return
    const doc = pdfDocRef.current
    const numPages = doc.numPages
    const infos: PageRenderInfo[] = []

    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i)
      const unscaledVp = page.getViewport({ scale: 1 })
      const scale = ((baseWidthRef.current - 48) / unscaledVp.width) * zoom
      const vp = page.getViewport({ scale })

      const canvas = canvasRefs.current.get(i)
      if (!canvas) continue

      const ctx = canvas.getContext('2d')
      if (!ctx) continue

      canvas.width = vp.width
      canvas.height = vp.height

      await page.render({ canvasContext: ctx, viewport: vp }).promise

      infos.push({
        pdfWidth: unscaledVp.width,
        pdfHeight: unscaledVp.height,
        canvasWidth: vp.width,
        canvasHeight: vp.height,
      })
    }

    setPageInfos(infos)
  }, [zoom])

  // Load PDF document
  useEffect(() => {
    if (!open || !pdfProxyUrl || isLoading) return
    let cancelled = false

    async function load() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
        const doc = await pdfjsLib.getDocument({ url: pdfProxyUrl, withCredentials: false }).promise
        if (cancelled) return
        pdfDocRef.current = doc
        setTotalPages(doc.numPages)
        // Measure container width
        if (scrollContainerRef.current) {
          baseWidthRef.current = scrollContainerRef.current.clientWidth
        }
        setIsPdfReady(true)
      } catch (err) {
        console.error('Erro ao carregar PDF:', err)
      }
    }

    const timer = setTimeout(load, 100)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [open, pdfProxyUrl, isLoading])

  // Re-render all pages when PDF is ready or zoom changes
  useEffect(() => {
    if (isPdfReady && totalPages > 0) {
      // Small delay to ensure canvas refs are mounted
      const timer = setTimeout(() => renderAllPages(), 50)
      return () => clearTimeout(timer)
    }
  }, [isPdfReady, totalPages, renderAllPages])

  // ─── Zoom controls ──────────────────────────────────────────────
  const handleZoomIn = () => setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1))
  const handleZoomOut = () => setZoomIndex((i) => Math.max(i - 1, 0))
  const handleZoomFit = () => setZoomIndex(DEFAULT_ZOOM_INDEX)

  // Stats
  const filledCount = fields.filter((f) => fieldValues[f.name]).length

  // ─── Field value update ──────────────────────────────────────────
  const updateFieldValue = (name: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }))
  }

  // ─── Variable click → fill selected field ────────────────────────
  const handleVariableClick = (key: string) => {
    if (!selectedFieldName) {
      toast.info('Seleccione um campo no PDF primeiro')
      return
    }
    const resolved = resolvedVariables[key]
    if (resolved) {
      const field = fields.find((f) => f.name === selectedFieldName)
      const transformed = field?.mapping?.transform
        ? applyTransform(resolved, field.mapping.transform)
        : resolved
      updateFieldValue(selectedFieldName, transformed)
    }
  }

  // ─── Save draft ──────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtask.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rendered_content: { pdf_field_values: fieldValues },
          }),
        }
      )
      if (!res.ok) throw new Error('Erro ao guardar rascunho')
      toast.success('Rascunho guardado!')
      onSaveDraftProp?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar rascunho')
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Download filled PDF (client-side generation) ────────────────
  const handleDownload = async () => {
    if (!pdfDocRef.current) return
    setIsDownloading(true)
    try {
      const { PDFDocument: PdfDoc } = await import('pdf-lib')
      const newPdf = await PdfDoc.create()
      const offscreen = document.createElement('canvas')
      const offCtx = offscreen.getContext('2d')!

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdfDocRef.current.getPage(i)
        const renderScale = 2
        const vp = page.getViewport({ scale: renderScale })
        const unscaledVp = page.getViewport({ scale: 1 })

        offscreen.width = vp.width
        offscreen.height = vp.height
        offCtx.clearRect(0, 0, vp.width, vp.height)
        await page.render({ canvasContext: offCtx, viewport: vp }).promise

        const pageFields = fields.filter((f) => f.page === i - 1 && f.position)
        const scaleX = vp.width / unscaledVp.width
        const scaleY = vp.height / unscaledVp.height

        for (const field of pageFields) {
          const value = fieldValues[field.name]
          if (!value) continue
          const pos = field.position!
          const x = pos.x * scaleX
          const y = vp.height - (pos.y + pos.height) * scaleY
          const w = pos.width * scaleX
          const h = pos.height * scaleY
          let fontSize = Math.max(6, Math.round(h * 0.7))

          offCtx.save()
          offCtx.fillStyle = 'rgba(0, 0, 0, 1)'
          offCtx.textBaseline = 'middle'
          offCtx.beginPath()
          offCtx.rect(x, y, w, h)
          offCtx.clip()

          if (field.type === 'checkbox') {
            if (['true', '1', 'sim', 'yes', 'x', 'on'].includes(value.toLowerCase())) {
              const sz = Math.min(w, h) * 0.7
              offCtx.font = `${Math.round(sz)}px sans-serif`
              offCtx.fillText('X', x + w / 2 - sz / 3, y + h / 2)
            }
          } else {
            // Auto-scale: shrink font size proportionally if text overflows
            offCtx.font = `${fontSize}px sans-serif`
            const textWidth = offCtx.measureText(value).width
            const available = w - 4
            if (textWidth > available && available > 0) {
              fontSize = Math.max(4, Math.round(fontSize * (available / textWidth)))
              offCtx.font = `${fontSize}px sans-serif`
            }
            offCtx.fillText(value, x + 2, y + h / 2)
          }
          offCtx.restore()
        }

        const pngDataUrl = offscreen.toDataURL('image/png')
        const pngBase64 = pngDataUrl.split(',')[1]
        const pngBytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0))
        const pngImage = await newPdf.embedPng(pngBytes)
        const newPage = newPdf.addPage([unscaledVp.width, unscaledVp.height])
        newPage.drawImage(pngImage, { x: 0, y: 0, width: unscaledVp.width, height: unscaledVp.height })
      }

      const pdfBytes = await newPdf.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${templateName || 'documento'}_preenchido.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      toast.success('PDF descarregado')
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      toast.error('Erro ao gerar PDF')
    } finally {
      setIsDownloading(false)
    }
  }

  // ─── Complete subtask ────────────────────────────────────────────
  const handleComplete = async () => {
    setIsCompleting(true)
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtask.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rendered_content: { pdf_field_values: fieldValues },
            is_completed: true,
            task_result: {
              generated_pdf: true,
              template_id: docLibraryId,
              template_name: templateName,
              generated_at: new Date().toISOString(),
              field_values: fieldValues,
            },
          }),
        }
      )
      if (!res.ok) throw new Error('Erro ao concluir subtarefa')
      toast.success('Documento PDF concluído!')
      onComplete()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao concluir')
    } finally {
      setIsCompleting(false)
    }
  }

  // ─── Render helpers ──────────────────────────────────────────────
  const ownerInfo = (subtask as unknown as { owner?: { person_type?: string; name?: string } }).owner
  const isPreview = activeTab === 'preview' || isCompleted

  // Page numbers array
  const pageNums = useMemo(() => Array.from({ length: totalPages }, (_, i) => i + 1), [totalPages])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex flex-col p-0 gap-0"
        style={{ position: 'fixed', inset: 0, width: '100vw', maxWidth: '100vw', height: '100dvh' }}
        side="right"
      >
        {/* ─── Header ──────────────────────────────────────── */}
        <SheetHeader className="px-6 py-3 border-b shrink-0">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-red-100 p-1.5 shrink-0">
              <FileType className="h-4 w-4 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base leading-snug">
                {templateName || 'Documento PDF'}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                  PDF
                </Badge>
                {ownerInfo && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs shrink-0',
                      ownerInfo.person_type === 'singular'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-purple-50 text-purple-700 border-purple-200'
                    )}
                  >
                    {ownerInfo.person_type === 'singular' ? (
                      <User className="mr-1 h-3 w-3" />
                    ) : (
                      <Building2 className="mr-1 h-3 w-3" />
                    )}
                    {ownerInfo.name}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {filledCount} de {fields.length} preenchidos
                </Badge>
                {isCompleted && (
                  <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Concluído
                  </Badge>
                )}
              </div>
            </div>
            {/* Edit / Preview toggle */}
            {!isLoading && !error && !isCompleted && (
              <div className="flex items-center gap-1 shrink-0 self-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5',
                    activeTab === 'edit'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5',
                    activeTab === 'preview'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Eye className="h-3 w-3" />
                  Pré-visualizar
                </button>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* ─── Body ────────────────────────────────────────── */}
        {isLoading ? (
          <div className="p-6 space-y-3 flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : error ? (
          <div className="p-6 flex-1 text-sm text-destructive">{error}</div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-row min-h-0">
            {/* PDF area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Toolbar: zoom + page count */}
              <div className="flex items-center justify-center gap-3 py-2 border-b bg-muted/30 shrink-0 px-4">
                <span className="text-xs text-muted-foreground">
                  {totalPages} página{totalPages !== 1 ? 's' : ''}
                </span>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={handleZoomOut}
                    disabled={zoomIndex <= 0}
                    title="Diminuir zoom"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs font-medium w-12 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={handleZoomIn}
                    disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
                    title="Aumentar zoom"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={handleZoomFit}
                    title="Ajustar à largura"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* All pages stacked vertically */}
              <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4 bg-muted/20">
                <div className="flex flex-col items-center gap-6">
                  {pageNums.map((pageNum) => {
                    const info = pageInfos[pageNum - 1]
                    const pageFields = fields.filter((f) => f.page === pageNum - 1 && f.position)

                    return (
                      <div key={pageNum} className="relative">
                        {/* Page number label */}
                        <div className="absolute -top-5 left-0 text-[10px] text-muted-foreground">
                          Página {pageNum}
                        </div>
                        <div
                          className="relative"
                          style={{ width: info?.canvasWidth || 'auto' }}
                        >
                          <canvas
                            ref={(el) => {
                              if (el) canvasRefs.current.set(pageNum, el)
                              else canvasRefs.current.delete(pageNum)
                            }}
                            className="block shadow-md rounded"
                          />

                          {/* Field overlays for this page */}
                          {info && pageFields.map((field) => {
                            const scaleX = info.canvasWidth / info.pdfWidth
                            const scaleY = info.canvasHeight / info.pdfHeight
                            const pos = field.position!
                            const left = pos.x * scaleX
                            const top = (info.pdfHeight - pos.y - pos.height) * scaleY
                            const width = pos.width * scaleX
                            const height = pos.height * scaleY
                            const isSelected = selectedFieldName === field.name
                            const value = fieldValues[field.name] || ''
                            // Font fills the field height (with small padding)
                            const fontSize = Math.max(8, Math.round(height * 0.7))

                            if (field.type === 'checkbox') {
                              const checked = ['true', '1', 'sim', 'yes', 'x', 'on'].includes(value.toLowerCase())
                              return (
                                <div
                                  key={field.name}
                                  className={cn(
                                    'absolute flex items-center justify-center transition-all',
                                    isPreview
                                      ? ''
                                      : isSelected
                                        ? 'ring-2 ring-blue-500 rounded-sm'
                                        : 'hover:ring-1 hover:ring-blue-300 rounded-sm'
                                  )}
                                  style={{ left, top, width, height }}
                                  onClick={() => {
                                    if (isPreview) return
                                    setSelectedFieldName(field.name)
                                    updateFieldValue(field.name, checked ? '' : 'true')
                                  }}
                                  title={field.mapping?.display_label || field.name}
                                >
                                  <Checkbox
                                    checked={checked}
                                    disabled={isPreview}
                                    className="pointer-events-none"
                                    style={{
                                      width: Math.min(width, height) * 0.7,
                                      height: Math.min(width, height) * 0.7,
                                    }}
                                  />
                                </div>
                              )
                            }

                            return (
                              <AutoScaleInput
                                key={field.name}
                                value={value}
                                readOnly={isPreview}
                                placeholder={isPreview ? '' : (field.mapping?.display_label || field.name)}
                                className={cn(
                                  'absolute bg-transparent text-black outline-none transition-all',
                                  'border border-transparent',
                                  isPreview
                                    ? 'cursor-default placeholder:text-transparent'
                                    : cn(
                                        'placeholder:text-muted-foreground/40 placeholder:text-[10px]',
                                        isSelected
                                          ? 'border-blue-500 bg-blue-50/30'
                                          : 'hover:border-blue-300 focus:border-blue-500 focus:bg-blue-50/20'
                                      )
                                )}
                                style={{
                                  left,
                                  top,
                                  width,
                                  height,
                                  padding: '0 2px',
                                }}
                                fieldWidth={width}
                                fieldHeight={height}
                                baseFontSize={fontSize}
                                onFocus={() => setSelectedFieldName(field.name)}
                                onChange={(e) => updateFieldValue(field.name, e.target.value)}
                                title={field.mapping?.display_label || field.name}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Variables sidebar */}
            {!isCompleted && activeTab === 'edit' && (
              <VariablesSidebar
                isOpen={variablesSidebarOpen}
                onToggle={() => setVariablesSidebarOpen((v) => !v)}
                variables={templateVariables}
                resolvedVariables={resolvedVariables}
                selectedFieldName={selectedFieldName}
                onVariableClick={handleVariableClick}
              />
            )}
          </div>
        )}

        {/* ─── Footer ──────────────────────────────────────── */}
        {!isLoading && !error && !isCompleted && (
          <div className="px-4 py-3 border-t shrink-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving || isCompleting}
              >
                {isSaving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Rascunho
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={handleDownload}
                disabled={isDownloading || isCompleting || !pdfDocRef.current}
              >
                {isDownloading ? <Spinner className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
                Descarregar PDF
              </Button>
            </div>
            <Button
              size="sm"
              onClick={handleComplete}
              disabled={isSaving || isCompleting}
            >
              {isCompleting ? <Spinner className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Gerar e Concluir
            </Button>
          </div>
        )}

        {isCompleted && !isLoading && (
          <div className="px-4 py-3 border-t shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Documento concluído.
            </div>
            <Button
              variant="outline" size="sm"
              onClick={handleDownload}
              disabled={isDownloading || !pdfDocRef.current}
            >
              {isDownloading ? <Spinner className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
              Descarregar PDF
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── Variables Sidebar ───────────────────────────────────────────

interface VariablesSidebarProps {
  isOpen: boolean
  onToggle: () => void
  variables: TemplateVariable[]
  resolvedVariables: Record<string, string>
  selectedFieldName: string | null
  onVariableClick: (key: string) => void
}

function VariablesSidebar({
  isOpen,
  onToggle,
  variables,
  resolvedVariables,
  selectedFieldName,
  onVariableClick,
}: VariablesSidebarProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, TemplateVariable[]>()
    variables.forEach((v) => {
      const cat = v.category || 'Sem categoria'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(v)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [variables])

  if (!isOpen) {
    return (
      <div className="flex flex-col items-center border-l border-border bg-card w-12 py-2 gap-2">
        <Button variant="ghost" size="sm" onClick={onToggle} className="h-8 w-8 p-0 rounded">
          <Variable className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col border-l border-border bg-card w-72 h-full max-h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Variáveis</h3>
        <Button variant="ghost" size="sm" onClick={onToggle} className="h-6 w-6 p-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {selectedFieldName && (
        <div className="px-4 py-2 bg-blue-50 border-b text-xs text-blue-700">
          Campo: <strong>{selectedFieldName}</strong>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {grouped.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma variável.</p>
          ) : (
            grouped.map(([category, vars]) => (
              <div key={category}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {category}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {vars.map((v) => {
                    const resolved = resolvedVariables[v.key]
                    const hasResolved = resolved !== undefined && resolved !== ''
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => onVariableClick(v.key)}
                        disabled={!selectedFieldName}
                        className={cn(
                          'rounded-md border border-border bg-background px-2 py-1 text-xs transition-colors text-left',
                          selectedFieldName
                            ? 'hover:bg-accent hover:border-blue-300 cursor-pointer'
                            : 'opacity-50 cursor-not-allowed'
                        )}
                        title={hasResolved ? `${v.label}: ${resolved}` : `{{${v.key}}}`}
                      >
                        {hasResolved ? (
                          <span className="font-medium">{resolved}</span>
                        ) : (
                          v.label
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border px-4 py-2">
        <p className="text-xs text-muted-foreground">
          {selectedFieldName ? 'Clique numa variável para preencher' : 'Seleccione um campo no PDF'}
        </p>
      </div>
    </div>
  )
}
