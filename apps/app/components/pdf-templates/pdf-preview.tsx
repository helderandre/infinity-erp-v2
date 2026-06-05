'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PdfFieldOverlay } from '@/types/pdf-template'

interface PdfPreviewProps {
  pdfUrl: string
  fields: PdfFieldOverlay[]
  selectedField: string | null
  onFieldClick: (fieldName: string) => void
  currentPage: number
  onPageChange: (page: number) => void
}

export function PdfPreview({
  pdfUrl,
  fields,
  selectedField,
  onFieldClick,
  currentPage,
  onPageChange,
}: PdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null)
  // Unscaled PDF page dimensions (in PDF points)
  const [pdfPageSize, setPdfPageSize] = useState<{ width: number; height: number } | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null)

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return

    const page = await pdfDocRef.current.getPage(pageNum)
    const containerWidth = containerRef.current?.clientWidth || 600
    const unscaledViewport = page.getViewport({ scale: 1 })
    const scale = (containerWidth - 32) / unscaledViewport.width
    const scaledViewport = page.getViewport({ scale })

    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    if (!context) return

    canvas.width = scaledViewport.width
    canvas.height = scaledViewport.height

    setCanvasSize({ width: scaledViewport.width, height: scaledViewport.height })
    setPdfPageSize({ width: unscaledViewport.width, height: unscaledViewport.height })

    await page.render({ canvasContext: context, viewport: scaledViewport }).promise
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

        const pdf = await pdfjsLib.getDocument({ url: pdfUrl, withCredentials: false }).promise
        if (cancelled) return

        pdfDocRef.current = pdf
        setTotalPages(pdf.numPages)
        await renderPage(1)
      } catch (err) {
        console.error('Erro ao carregar PDF para preview:', err)
      }
    }

    loadPdf()
    return () => { cancelled = true }
  }, [pdfUrl, renderPage])

  useEffect(() => {
    if (pdfDocRef.current && currentPage > 0) {
      renderPage(currentPage)
    }
  }, [currentPage, renderPage])

  // Overlays for current page fields
  const currentPageFields = fields.filter((f) => f.page === currentPage - 1)

  return (
    <div ref={containerRef} className="relative flex flex-col h-full">
      {/* Navigation */}
      <div className="flex items-center justify-center gap-2 py-2 border-b bg-muted/30 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
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
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Canvas + overlays */}
      <div className="flex-1 overflow-auto p-4">
        <div className="relative mx-auto" style={{ width: canvasSize?.width || 'auto' }}>
          <canvas ref={canvasRef} className="block shadow-md rounded" />

          {/* Field overlays */}
          {canvasSize && pdfPageSize && currentPageFields.map((field) => {
            // Scale from PDF points → rendered canvas pixels
            const scaleX = canvasSize.width / pdfPageSize.width
            const scaleY = canvasSize.height / pdfPageSize.height

            // PDF coordinates are bottom-left origin → convert to top-left for CSS
            const left = field.x * scaleX
            const top = (pdfPageSize.height - field.y - field.height) * scaleY
            const width = field.width * scaleX
            const height = field.height * scaleY

            const isSelected = selectedField === field.name

            return (
              <div
                key={field.name}
                className={`absolute cursor-pointer border transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/20 z-10'
                    : 'border-transparent hover:border-amber-400 hover:bg-amber-400/10'
                }`}
                style={{ left, top, width, height }}
                onClick={() => onFieldClick(field.name)}
                title={field.name}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
