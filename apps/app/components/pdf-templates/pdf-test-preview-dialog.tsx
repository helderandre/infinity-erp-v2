'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import type { PdfFieldWithMapping } from '@/types/pdf-template'

interface PdfTestPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pdfUrl: string
  fields: PdfFieldWithMapping[]
  resolvedValues: Record<string, string>
  templateName: string
}

function applyTransform(value: string, transform: string | null): string {
  if (!transform || !value) return value
  switch (transform) {
    case 'uppercase':
      return value.toUpperCase()
    case 'lowercase':
      return value.toLowerCase()
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
    default:
      return value
  }
}

export function PdfTestPreviewDialog({
  open,
  onOpenChange,
  pdfUrl,
  fields,
  resolvedValues,
  templateName,
}: PdfTestPreviewDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null)

  const getFieldValue = useCallback(
    (field: PdfFieldWithMapping): string => {
      const mapping = field.mapping
      if (!mapping) return ''
      let value = ''
      if (mapping.variable_key && resolvedValues[mapping.variable_key]) {
        value = resolvedValues[mapping.variable_key]
      } else if (mapping.default_value) {
        value = mapping.default_value
      }
      return applyTransform(value, mapping.transform)
    },
    [resolvedValues]
  )

  const drawFilledText = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      pageNum: number,
      viewportWidth: number,
      viewportHeight: number,
      pdfWidth: number,
      pdfHeight: number
    ) => {
      const pageFields = fields.filter((f) => f.page === pageNum - 1 && f.position)
      const scaleX = viewportWidth / pdfWidth
      const scaleY = viewportHeight / pdfHeight

      for (const field of pageFields) {
        const value = getFieldValue(field)
        if (!value) continue

        const pos = field.position!
        const x = pos.x * scaleX
        const y = viewportHeight - (pos.y + pos.height) * scaleY
        const w = pos.width * scaleX
        const h = pos.height * scaleY
        let fontSize = Math.max(6, Math.round(h * 0.7))

        ctx.save()
        ctx.fillStyle = 'rgba(0, 0, 0, 1)'
        ctx.textBaseline = 'middle'

        // Clip to field bounds
        ctx.beginPath()
        ctx.rect(x, y, w, h)
        ctx.clip()

        if (field.type === 'checkbox') {
          const truthyValues = ['true', '1', 'sim', 'yes', 'x', 'on']
          if (truthyValues.includes(value.toLowerCase())) {
            const checkSize = Math.min(w, h) * 0.7
            ctx.font = `${Math.round(checkSize)}px sans-serif`
            ctx.fillText('X', x + w / 2 - checkSize / 3, y + h / 2)
          }
        } else {
          // Auto-scale: shrink font size proportionally if text overflows
          ctx.font = `${fontSize}px sans-serif`
          const textWidth = ctx.measureText(value).width
          const available = w - 4
          if (textWidth > available && available > 0) {
            fontSize = Math.max(4, Math.round(fontSize * (available / textWidth)))
            ctx.font = `${fontSize}px sans-serif`
          }
          ctx.fillText(value, x + 2, y + h / 2)
        }

        ctx.restore()
      }
    },
    [fields, getFieldValue]
  )

  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDocRef.current || !canvasRef.current) return

      const page = await pdfDocRef.current.getPage(pageNum)
      const containerWidth = containerRef.current?.clientWidth || 700
      const unscaledViewport = page.getViewport({ scale: 1 })
      const scale = (containerWidth - 48) / unscaledViewport.width
      const viewport = page.getViewport({ scale })

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = viewport.width
      canvas.height = viewport.height

      // Render PDF page
      await page.render({ canvasContext: ctx, viewport }).promise

      // Draw filled values on top
      drawFilledText(
        ctx,
        pageNum,
        viewport.width,
        viewport.height,
        unscaledViewport.width,
        unscaledViewport.height
      )
    },
    [drawFilledText]
  )

  // Load PDF when dialog opens
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

        const doc = await pdfjsLib.getDocument({ url: pdfUrl, withCredentials: false }).promise
        if (cancelled) return

        pdfDocRef.current = doc
        setTotalPages(doc.numPages)
        setCurrentPage(1)
      } catch (err) {
        console.error('Erro ao carregar PDF para preview:', err)
        toast.error('Erro ao carregar PDF')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pdfUrl])

  // Render current page
  useEffect(() => {
    if (pdfDocRef.current && currentPage > 0 && open && !isLoading) {
      renderPage(currentPage)
    }
  }, [currentPage, renderPage, open, isLoading])

  // Download: render all pages at 2x → create clean PDF from images
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
        const viewport = page.getViewport({ scale: renderScale })
        const unscaledViewport = page.getViewport({ scale: 1 })

        offscreen.width = viewport.width
        offscreen.height = viewport.height
        offCtx.clearRect(0, 0, viewport.width, viewport.height)

        // Render PDF page
        await page.render({ canvasContext: offCtx, viewport }).promise

        // Draw filled text
        drawFilledText(
          offCtx,
          i,
          viewport.width,
          viewport.height,
          unscaledViewport.width,
          unscaledViewport.height
        )

        // Convert canvas to PNG → embed in new PDF
        const pngDataUrl = offscreen.toDataURL('image/png')
        const pngBase64 = pngDataUrl.split(',')[1]
        const pngBytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0))
        const pngImage = await newPdf.embedPng(pngBytes)

        const newPage = newPdf.addPage([unscaledViewport.width, unscaledViewport.height])
        newPage.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: unscaledViewport.width,
          height: unscaledViewport.height,
        })
      }

      const pdfBytes = await newPdf.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${templateName}_preenchido.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      toast.success('PDF descarregado com sucesso')
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      toast.error('Erro ao gerar PDF para download')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle>Pré-visualização — {templateName}</DialogTitle>
        </DialogHeader>

        {/* Navigation + Download */}
        <div className="flex items-center justify-center gap-2 py-2 border-b bg-muted/30 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages || '...'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-auto mr-4">
            <Button size="sm" onClick={handleDownload} disabled={isDownloading || isLoading}>
              {isDownloading ? (
                <Spinner className="mr-2 h-4 w-4" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Descarregar PDF
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            <div className="mx-auto" style={{ width: 'fit-content' }}>
              <canvas ref={canvasRef} className="shadow-md rounded" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
