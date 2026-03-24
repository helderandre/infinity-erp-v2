'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EntitySearchInput } from './entity-search-input'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/kibo-ui/spinner'
import { useTemplateVariables } from '@/hooks/use-template-variables'
import type { TemplateVariable } from '@/hooks/use-template-variables'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Save,
  Eye,
  Pencil,
  ZoomIn,
  ZoomOut,
  Maximize2,
  TestTube2,
  Variable,
  ChevronLeft,
  Settings2,
} from 'lucide-react'
import type { PdfFieldWithMapping, BulkMappingUpdate } from '@/types/pdf-template'

// ─── Types ───────────────────────────────────────────────────────

interface PdfFieldMapperProps {
  templateId: string
  templateName: string
  fileUrl: string
}

interface PageRenderInfo {
  pdfWidth: number
  pdfHeight: number
  canvasWidth: number
  canvasHeight: number
}

const TRANSFORMS = [
  { value: '__none__', label: 'Nenhum' },
  { value: 'uppercase', label: 'MAIÚSCULAS' },
  { value: 'lowercase', label: 'minúsculas' },
  { value: 'date_pt', label: 'Data PT (DD/MM/AAAA)' },
  { value: 'currency_eur', label: 'Moeda EUR' },
]

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const DEFAULT_ZOOM_INDEX = 2

// ─── AutoScaleInput ──────────────────────────────────────────────

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
      style={{ ...style, fontSize, lineHeight: `${fieldHeight}px` }}
    />
  )
}

// ─── Transform helper ────────────────────────────────────────────

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

// ─── Main Component ──────────────────────────────────────────────

export function PdfFieldMapper({ templateId, templateName, fileUrl }: PdfFieldMapperProps) {
  const router = useRouter()
  const { variables, isLoading: varsLoading } = useTemplateVariables()

  const [fields, setFields] = useState<PdfFieldWithMapping[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')

  // Test dialog
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testPropertyId, setTestPropertyId] = useState('')
  const [testOwnerId, setTestOwnerId] = useState('')
  const [testConsultantId, setTestConsultantId] = useState('')
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({})

  // PDF state
  const [totalPages, setTotalPages] = useState(0)
  const [pageInfos, setPageInfos] = useState<PageRenderInfo[]>([])
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const [isPdfReady, setIsPdfReady] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'mapping' | 'variables'>('mapping')

  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null)
  const baseWidthRef = useRef(700)

  const zoom = ZOOM_LEVELS[zoomIndex]
  const isPreview = activeTab === 'preview'

  // ─── Fetch fields with mappings ──────────────────────────────────
  const fetchFields = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/libraries/docs/${templateId}/fields`)
      if (!res.ok) throw new Error()
      const data: PdfFieldWithMapping[] = await res.json()
      setFields(data)
    } catch {
      toast.error('Erro ao carregar campos do PDF')
    } finally {
      setIsLoading(false)
    }
  }, [templateId])

  useEffect(() => { fetchFields() }, [fetchFields])

  // ─── Group variables by category ──────────────────────────────────
  const variablesByCategory = useMemo(() => {
    const groups = new Map<string, typeof variables>()
    for (const v of variables) {
      const cat = v.category || 'Outros'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(v)
    }
    return groups
  }, [variables])

  // ─── Mapped count ────────────────────────────────────────────────
  const mappedCount = fields.filter(
    (f) => f.mapping?.variable_key || f.mapping?.default_value
  ).length

  // ─── Get display value for a field (preview mode) ────────────────
  const getFieldDisplayValue = useCallback((field: PdfFieldWithMapping): string => {
    const mapping = field.mapping
    if (!mapping) return ''
    // In preview with test data, use resolved values
    if (mapping.variable_key && previewValues[mapping.variable_key]) {
      return applyTransform(previewValues[mapping.variable_key], mapping.transform)
    }
    if (mapping.default_value) return mapping.default_value
    return ''
  }, [previewValues])

  // ─── Update mapping ──────────────────────────────────────────────
  const updateFieldMapping = (
    fieldName: string,
    key: keyof NonNullable<PdfFieldWithMapping['mapping']>,
    value: unknown
  ) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.name !== fieldName) return f
        const current = f.mapping || {
          variable_key: null,
          default_value: null,
          transform: null,
          font_size: null,
          is_required: false,
          display_label: null,
          display_order: 0,
        }
        return { ...f, mapping: { ...current, [key]: value } }
      })
    )
    setIsDirty(true)
  }

  // ─── Save mappings ───────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const mappings: BulkMappingUpdate[] = fields.map((f, idx) => ({
        pdf_field_name: f.name,
        variable_key: f.mapping?.variable_key || null,
        default_value: f.mapping?.default_value || null,
        transform: f.mapping?.transform || null,
        font_size: f.mapping?.font_size ?? null,
        is_required: f.mapping?.is_required ?? false,
        display_label: f.mapping?.display_label || null,
        display_order: f.mapping?.display_order ?? idx,
      }))

      const res = await fetch(`/api/libraries/docs/${templateId}/mappings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings }),
      })

      if (!res.ok) throw new Error()
      toast.success('Mapeamento guardado com sucesso')
      setIsDirty(false)
    } catch {
      toast.error('Erro ao guardar mapeamento')
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Test fill ───────────────────────────────────────────────────
  const handleTestFill = async () => {
    setIsTesting(true)
    try {
      if (isDirty) await handleSave()

      let resolvedVariables: Record<string, string> = {}
      if (testPropertyId || testOwnerId || testConsultantId) {
        const res = await fetch('/api/libraries/emails/preview-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: testPropertyId || undefined,
            owner_id: testOwnerId || undefined,
            consultant_id: testConsultantId || undefined,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          resolvedVariables = data.variables || {}
        }
      }

      setPreviewValues(resolvedVariables)
      setTestDialogOpen(false)
      setActiveTab('preview')
      toast.success('Dados de teste carregados')
    } catch {
      toast.error('Erro ao resolver variáveis de teste')
    } finally {
      setIsTesting(false)
    }
  }

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
    if (isLoading || varsLoading || !fileUrl) return
    let cancelled = false

    async function load() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
        const doc = await pdfjsLib.getDocument({ url: fileUrl, withCredentials: false }).promise
        if (cancelled) return
        pdfDocRef.current = doc
        setTotalPages(doc.numPages)
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
  }, [fileUrl, isLoading, varsLoading])

  // Re-render all pages when PDF is ready or zoom changes
  useEffect(() => {
    if (isPdfReady && totalPages > 0) {
      const timer = setTimeout(() => renderAllPages(), 50)
      return () => clearTimeout(timer)
    }
  }, [isPdfReady, totalPages, renderAllPages])

  // ─── Zoom controls ──────────────────────────────────────────────
  const handleZoomIn = () => setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1))
  const handleZoomOut = () => setZoomIndex((i) => Math.max(i - 1, 0))
  const handleZoomFit = () => setZoomIndex(DEFAULT_ZOOM_INDEX)

  // ─── Variable click → fill selected field ────────────────────────
  const handleVariableClick = (key: string) => {
    if (!selectedField) {
      toast.info('Seleccione um campo no PDF primeiro')
      return
    }
    updateFieldMapping(selectedField, 'variable_key', key)
  }

  // Page numbers array
  const pageNums = useMemo(() => Array.from({ length: totalPages }, (_, i) => i + 1), [totalPages])

  // Selected field data
  const selectedFieldData = useMemo(
    () => fields.find((f) => f.name === selectedField) || null,
    [fields, selectedField]
  )

  // ─── Loading state ──────────────────────────────────────────────
  if (isLoading || varsLoading) {
    return (
      <div className="flex h-full">
        <div className="flex-1 p-4">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="w-80 border-l p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b px-4 py-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.push('/dashboard/templates-documentos')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold truncate">{templateName}</h1>
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          PDF
        </Badge>
        <Badge variant="secondary">
          {mappedCount} de {fields.length} campos mapeados
        </Badge>

        {/* Edit / Preview toggle */}
        <div className="flex items-center gap-1 ml-auto">
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

        <Button
          variant="outline"
          size="sm"
          onClick={() => setTestDialogOpen(true)}
        >
          <TestTube2 className="mr-2 h-4 w-4" />
          Testar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving || !isDirty}>
          {isSaving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar
        </Button>
      </div>

      {/* ─── Body ────────────────────────────────────────── */}
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
                onClick={handleZoomOut} disabled={zoomIndex <= 0}
                title="Diminuir zoom"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-medium w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={handleZoomIn} disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
                title="Aumentar zoom"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={handleZoomFit} title="Ajustar à largura"
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
                    <div className="absolute -top-5 left-0 text-[10px] text-muted-foreground">
                      Página {pageNum}
                    </div>
                    <div className="relative" style={{ width: info?.canvasWidth || 'auto' }}>
                      <canvas
                        ref={(el) => {
                          if (el) canvasRefs.current.set(pageNum, el)
                          else canvasRefs.current.delete(pageNum)
                        }}
                        className="block shadow-md rounded"
                      />

                      {/* Field overlays */}
                      {info && pageFields.map((field) => {
                        const scaleX = info.canvasWidth / info.pdfWidth
                        const scaleY = info.canvasHeight / info.pdfHeight
                        const pos = field.position!
                        const left = pos.x * scaleX
                        const top = (info.pdfHeight - pos.y - pos.height) * scaleY
                        const width = pos.width * scaleX
                        const height = pos.height * scaleY
                        const isSelected = selectedField === field.name
                        const baseFontSize = Math.max(8, Math.round(height * 0.7))

                        const mapping = field.mapping
                        const isMapped = !!(mapping?.variable_key || mapping?.default_value)

                        // In preview mode, show resolved values
                        if (isPreview) {
                          const displayValue = getFieldDisplayValue(field)

                          if (field.type === 'checkbox') {
                            const checked = ['true', '1', 'sim', 'yes', 'x', 'on'].includes((displayValue || '').toLowerCase())
                            return (
                              <div
                                key={field.name}
                                className="absolute flex items-center justify-center"
                                style={{ left, top, width, height }}
                                title={field.name}
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled
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
                              value={displayValue}
                              readOnly
                              className="absolute bg-transparent text-black outline-none border border-transparent cursor-default"
                              style={{ left, top, width, height, padding: '0 2px' }}
                              fieldWidth={width}
                              fieldHeight={height}
                              baseFontSize={baseFontSize}
                              title={field.name}
                            />
                          )
                        }

                        // Edit mode — show mapping indicator overlays
                        if (field.type === 'checkbox') {
                          const defaultChecked = ['true', '1', 'sim', 'yes', 'x', 'on'].includes(
                            (mapping?.default_value || '').toLowerCase()
                          )
                          return (
                            <div
                              key={field.name}
                              className={cn(
                                'absolute flex items-center justify-center transition-all cursor-pointer',
                                isSelected
                                  ? 'ring-2 ring-blue-500 rounded-sm'
                                  : 'hover:ring-1 hover:ring-blue-300 rounded-sm'
                              )}
                              style={{ left, top, width, height }}
                              onClick={() => setSelectedField(field.name)}
                              title={field.name}
                            >
                              <Checkbox
                                checked={defaultChecked}
                                disabled
                                className="pointer-events-none"
                                style={{
                                  width: Math.min(width, height) * 0.7,
                                  height: Math.min(width, height) * 0.7,
                                }}
                              />
                            </div>
                          )
                        }

                        // Text field — show variable label or default value
                        const displayText = mapping?.variable_key
                          ? `{{${mapping.variable_key}}}`
                          : mapping?.default_value || ''

                        return (
                          <AutoScaleInput
                            key={field.name}
                            value={displayText || field.name}
                            readOnly
                            className={cn(
                              'absolute transition-all cursor-pointer outline-none',
                              'border',
                              isSelected
                                ? 'border-blue-500 bg-blue-50/40'
                                : isMapped
                                  ? 'border-emerald-300/50 bg-emerald-50/20 hover:border-blue-300'
                                  : 'border-amber-300/50 bg-amber-50/20 hover:border-blue-300',
                              mapping?.variable_key
                                ? 'text-blue-600/70 font-mono'
                                : mapping?.default_value
                                  ? 'text-black/70'
                                  : 'text-muted-foreground/40 italic'
                            )}
                            style={{ left, top, width, height, padding: '0 2px' }}
                            fieldWidth={width}
                            fieldHeight={height}
                            baseFontSize={baseFontSize}
                            onClick={() => setSelectedField(field.name)}
                            title={`${field.name}${mapping?.variable_key ? ` → {{${mapping.variable_key}}}` : ''}`}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {fields.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum campo AcroForm encontrado neste PDF.
              </div>
            )}
          </div>
        </div>

        {/* ─── Right Sidebar ──────────────────────────────── */}
        <RightSidebar
          sidebarTab={sidebarTab}
          onTabChange={setSidebarTab}
          selectedField={selectedField}
          selectedFieldData={selectedFieldData}
          fields={fields}
          variablesByCategory={variablesByCategory}
          variables={variables}
          previewValues={previewValues}
          onFieldSelect={setSelectedField}
          onUpdateMapping={updateFieldMapping}
          onVariableClick={handleVariableClick}
          transforms={TRANSFORMS}
        />
      </div>

      {/* ─── Test dialog ─────────────────────────────────── */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Testar Preenchimento</DialogTitle>
            <DialogDescription>
              Pesquise as entidades para testar o preenchimento do PDF com dados reais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Imóvel</Label>
              <EntitySearchInput
                value={testPropertyId}
                onChange={setTestPropertyId}
                entityType="property"
                placeholder="Pesquisar imóvel por título, ref ou cidade..."
              />
            </div>
            <div>
              <Label className="text-xs">Proprietário</Label>
              <EntitySearchInput
                value={testOwnerId}
                onChange={setTestOwnerId}
                entityType="owner"
                placeholder="Pesquisar proprietário por nome, NIF ou email..."
              />
            </div>
            <div>
              <Label className="text-xs">Consultor</Label>
              <EntitySearchInput
                value={testConsultantId}
                onChange={setTestConsultantId}
                entityType="consultant"
                placeholder="Pesquisar consultor por nome ou email..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleTestFill} disabled={isTesting}>
              {isTesting && <Spinner className="mr-2 h-4 w-4" />}
              Pré-visualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Right Sidebar ───────────────────────────────────────────────

interface RightSidebarProps {
  sidebarTab: 'mapping' | 'variables'
  onTabChange: (tab: 'mapping' | 'variables') => void
  selectedField: string | null
  selectedFieldData: PdfFieldWithMapping | null
  fields: PdfFieldWithMapping[]
  variablesByCategory: Map<string, { key: string; label: string; category: string }[]>
  variables: TemplateVariable[]
  previewValues: Record<string, string>
  onFieldSelect: (name: string) => void
  onUpdateMapping: (fieldName: string, key: keyof NonNullable<PdfFieldWithMapping['mapping']>, value: unknown) => void
  onVariableClick: (key: string) => void
  transforms: { value: string; label: string }[]
}

function RightSidebar({
  sidebarTab,
  onTabChange,
  selectedField,
  selectedFieldData,
  fields,
  variablesByCategory,
  variables,
  previewValues,
  onFieldSelect,
  onUpdateMapping,
  onVariableClick,
  transforms,
}: RightSidebarProps) {
  return (
    <div className="flex flex-col border-l border-border bg-card w-80 h-full max-h-full overflow-hidden">
      {/* Tab switcher */}
      <div className="flex border-b border-border shrink-0">
        <button
          type="button"
          onClick={() => onTabChange('mapping')}
          className={cn(
            'flex-1 px-3 py-2.5 text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5',
            sidebarTab === 'mapping'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Mapeamento
        </button>
        <button
          type="button"
          onClick={() => onTabChange('variables')}
          className={cn(
            'flex-1 px-3 py-2.5 text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5',
            sidebarTab === 'variables'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Variable className="h-3.5 w-3.5" />
          Variáveis
        </button>
      </div>

      {sidebarTab === 'mapping' ? (
        <MappingSidebar
          selectedField={selectedField}
          selectedFieldData={selectedFieldData}
          fields={fields}
          variablesByCategory={variablesByCategory}
          onFieldSelect={onFieldSelect}
          onUpdateMapping={onUpdateMapping}
          transforms={transforms}
        />
      ) : (
        <VariablesSidebar
          variables={variables}
          previewValues={previewValues}
          selectedFieldName={selectedField}
          onVariableClick={onVariableClick}
        />
      )}
    </div>
  )
}

// ─── Mapping Sidebar ─────────────────────────────────────────────

interface MappingSidebarProps {
  selectedField: string | null
  selectedFieldData: PdfFieldWithMapping | null
  fields: PdfFieldWithMapping[]
  variablesByCategory: Map<string, { key: string; label: string; category: string }[]>
  onFieldSelect: (name: string) => void
  onUpdateMapping: (fieldName: string, key: keyof NonNullable<PdfFieldWithMapping['mapping']>, value: unknown) => void
  transforms: { value: string; label: string }[]
}

function MappingSidebar({
  selectedField,
  selectedFieldData,
  fields,
  variablesByCategory,
  onFieldSelect,
  onUpdateMapping,
  transforms,
}: MappingSidebarProps) {
  const field = selectedFieldData

  return (
    <>
      {/* Selected field config */}
      {field ? (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="px-4 py-3 bg-blue-50 border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{field.name}</span>
              <Badge variant="outline" className="text-[10px] shrink-0">{field.type}</Badge>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Variable select */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Variável</Label>
              <Select
                value={field.mapping?.variable_key || '__none__'}
                onValueChange={(v) =>
                  onUpdateMapping(
                    field.name,
                    'variable_key',
                    v === '__none__' ? null : v === '__fixed__' ? null : v
                  )
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Seleccionar variável..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhuma —</SelectItem>
                  <SelectItem value="__fixed__">Valor fixo</SelectItem>
                  {Array.from(variablesByCategory.entries()).map(([cat, vars]) => (
                    <SelectGroup key={cat}>
                      <SelectLabel>{cat}</SelectLabel>
                      {vars.map((v) => (
                        <SelectItem key={v.key} value={v.key}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Default value (always visible — for fixed values or fallback) */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                {field.mapping?.variable_key ? 'Valor por defeito (fallback)' : 'Valor fixo'}
              </Label>
              <Input
                className="h-8 text-xs"
                placeholder={field.type === 'checkbox' ? 'true / false' : 'Valor...'}
                value={field.mapping?.default_value || ''}
                onChange={(e) => onUpdateMapping(field.name, 'default_value', e.target.value || null)}
              />
            </div>

            {/* Transform */}
            {field.mapping?.variable_key && field.mapping.variable_key !== '__fixed__' && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Transformação</Label>
                <Select
                  value={field.mapping?.transform || '__none__'}
                  onValueChange={(v) => onUpdateMapping(field.name, 'transform', v === '__none__' ? null : v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {transforms.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Display label */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Label de exibição</Label>
              <Input
                className="h-8 text-xs"
                placeholder={field.name}
                value={field.mapping?.display_label || ''}
                onChange={(e) => onUpdateMapping(field.name, 'display_label', e.target.value || null)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b">
            <p className="text-xs text-muted-foreground">
              Seleccione um campo no PDF para configurar o mapeamento
            </p>
          </div>

          {/* Field list */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-0.5">
              {fields.map((f) => {
                const isMapped = !!(f.mapping?.variable_key || f.mapping?.default_value)
                return (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => onFieldSelect(f.name)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center gap-2',
                      'hover:bg-accent'
                    )}
                  >
                    <div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        isMapped ? 'bg-emerald-500' : 'bg-amber-400'
                      )}
                    />
                    <span className="truncate">{f.name}</span>
                    <Badge variant="outline" className="text-[9px] shrink-0 ml-auto">{f.type}</Badge>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Bottom: back to list when field selected */}
      {field && (
        <div className="border-t border-border px-4 py-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => onFieldSelect('')}
          >
            <ChevronLeft className="mr-1 h-3 w-3" />
            Ver todos os campos
          </Button>
        </div>
      )}
    </>
  )
}

// ─── Variables Sidebar ───────────────────────────────────────────

interface VariablesSidebarProps {
  variables: TemplateVariable[]
  previewValues: Record<string, string>
  selectedFieldName: string | null
  onVariableClick: (key: string) => void
}

function VariablesSidebar({
  variables,
  previewValues,
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

  return (
    <>
      {selectedFieldName && (
        <div className="px-4 py-2 bg-blue-50 border-b text-xs text-blue-700 shrink-0">
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
                    const resolved = previewValues[v.key]
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

      <div className="border-t border-border px-4 py-2 shrink-0">
        <p className="text-xs text-muted-foreground">
          {selectedFieldName ? 'Clique numa variável para mapear o campo' : 'Seleccione um campo no PDF'}
        </p>
      </div>
    </>
  )
}
