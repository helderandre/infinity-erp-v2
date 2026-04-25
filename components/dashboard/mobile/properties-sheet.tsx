'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ArrowRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { PropertyPreviewSheet } from './property-preview-sheet'
import { PropertyListItem, type PropertyListItemData } from '@/components/properties/property-list-item'

interface PropertiesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PropertyItem = PropertyListItemData & { status: string | null }

export function PropertiesSheet({ open, onOpenChange }: PropertiesSheetProps) {
  const isMobile = useIsMobile()
  const [items, setItems] = useState<PropertyItem[]>([])
  const [loading, setLoading] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetch('/api/properties?per_page=20&sort_by=created_at&sort_dir=desc')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        if (cancelled) return
        const data = Array.isArray(json) ? json : json.data ?? []
        setItems(data)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[75dvh] data-[side=bottom]:max-h-[75dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[520px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}
        <SheetHeader className="shrink-0 px-6 pt-8 pb-4 gap-0 flex-row items-center justify-between">
          <div>
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight">
              Imóveis recentes
            </SheetTitle>
            <SheetDescription className="sr-only">
              Lista dos imóveis mais recentes
            </SheetDescription>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5"
          >
            <Link href="/dashboard/imoveis" onClick={() => onOpenChange(false)}>
              Ver todos
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-muted-foreground">
              <Home className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Sem imóveis recentes</p>
            </div>
          ) : (
            items.map((p) => (
              <PropertyListItem
                key={p.id}
                property={p}
                onSelect={() => setPreviewId(p.id)}
              />
            ))
          )}
        </div>
      </SheetContent>
      <PropertyPreviewSheet
        propertyId={previewId}
        open={previewId !== null}
        onOpenChange={(o) => !o && setPreviewId(null)}
      />
    </Sheet>
  )
}
