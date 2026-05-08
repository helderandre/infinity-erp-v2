'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { ImageCompareSlider } from '@/components/shared/image-compare-slider'
import { ChevronLeft, ChevronRight, Sparkles, Sofa } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

export interface PreviewItem {
  id: string
  url: string
  /** Optional AI-staged version. When present, a "Comparar decorada" toggle
   *  is offered inside the preview. */
  ai_staged_url?: string | null
  ai_staged_style?: string | null
  /** Optional room label to surface in the header. */
  ai_room_label?: string | null
  /** Optional caption (e.g., "Planta 1", "Render 3D"). When provided, replaces
   *  the room label in the header. */
  caption?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: PreviewItem[]
  index: number
  onIndexChange: (next: number) => void
}

/**
 * Modern image preview surface — replaces the legacy Dialog popups for both
 * the gallery and the plantas section. Slides in as a Sheet (right on
 * desktop, bottom on mobile), shows the image with optional next/prev
 * navigation, and exposes a "Comparar decorada" toggle when an AI staged
 * version exists. No AI editing tools — those live in the gallery toolbar.
 */
export function PropertyImagePreviewSheet({ open, onOpenChange, items, index, onIndexChange }: Props) {
  const isMobile = useIsMobile()
  const [showCompare, setShowCompare] = useState(false)

  const safeIndex = Math.min(Math.max(0, index), Math.max(0, items.length - 1))
  const current = items[safeIndex]
  const hasMany = items.length > 1
  const canCompare = !!current?.ai_staged_url

  // Reset compare toggle whenever item changes.
  useEffect(() => { setShowCompare(false) }, [current?.id])

  // Keyboard nav while open.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && safeIndex > 0) {
        e.preventDefault()
        onIndexChange(safeIndex - 1)
      } else if (e.key === 'ArrowRight' && safeIndex < items.length - 1) {
        e.preventDefault()
        onIndexChange(safeIndex + 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, safeIndex, items.length, onIndexChange])

  if (!current) return null

  const headerLabel = current.caption || current.ai_room_label || `Imagem ${safeIndex + 1}`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[92dvh] rounded-t-3xl'
            : 'h-full w-full data-[side=right]:sm:max-w-[920px] sm:rounded-l-3xl',
        )}
      >
        <VisuallyHidden>
          <SheetTitle>{headerLabel}</SheetTitle>
          <SheetDescription>Pré-visualização de imagem.</SheetDescription>
        </VisuallyHidden>
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className="shrink-0 px-4 sm:px-6 pt-8 pb-3 sm:pt-10 gap-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-semibold leading-tight tracking-tight truncate capitalize">
                {headerLabel}
              </h2>
              {hasMany && (
                <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                  {safeIndex + 1} de {items.length}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 mr-10 shrink-0">
              {canCompare && (
                <Button
                  size="sm"
                  variant={showCompare ? 'default' : 'outline'}
                  className="rounded-full h-8 px-3 gap-1.5 text-xs"
                  onClick={() => setShowCompare((v) => !v)}
                  title={showCompare ? 'Ver original' : 'Comparar decorada'}
                >
                  {showCompare ? <Sparkles className="h-3.5 w-3.5" /> : <Sofa className="h-3.5 w-3.5" />}
                  {showCompare ? 'A comparar' : 'Comparar decorada'}
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 px-4 sm:px-6 pb-6 flex items-center justify-center">
          <div className="relative w-full h-full max-h-full flex items-center justify-center">
            {showCompare && current.ai_staged_url ? (
              <div className="w-full max-w-full">
                <ImageCompareSlider
                  originalUrl={current.url}
                  modifiedUrl={current.ai_staged_url}
                  originalLabel="Original"
                  modifiedLabel={current.ai_staged_style ? `Decoração ${current.ai_staged_style}` : 'Decorada'}
                />
              </div>
            ) : (
              <div className="relative w-full h-full min-h-[40vh] rounded-2xl overflow-hidden bg-muted/30">
                <Image
                  src={current.url}
                  alt={headerLabel}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 920px"
                  priority
                />
              </div>
            )}

            {/* Navigation arrows */}
            {hasMany && safeIndex > 0 && (
              <button
                type="button"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/85 backdrop-blur-md border border-border/50 text-foreground hover:bg-background shadow-lg transition-colors flex items-center justify-center"
                onClick={() => onIndexChange(safeIndex - 1)}
                title="Anterior"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {hasMany && safeIndex < items.length - 1 && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/85 backdrop-blur-md border border-border/50 text-foreground hover:bg-background shadow-lg transition-colors flex items-center justify-center"
                onClick={() => onIndexChange(safeIndex + 1)}
                title="Seguinte"
                aria-label="Seguinte"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
