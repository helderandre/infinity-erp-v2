'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import type { DrillDownItem } from '@/app/dashboard/drill-down-actions'

export interface DrillDownConfig {
  title: string
  description?: string
  fetcher: () => Promise<{ items: DrillDownItem[]; error: string | null }>
}

export function DrillDownSheet({
  config,
  open,
  onOpenChange,
}: {
  config: DrillDownConfig | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [items, setItems] = useState<DrillDownItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && config) {
      setLoading(true)
      setItems([])
      config.fetcher().then((res) => {
        if (!res.error) setItems(res.items)
        setLoading(false)
      })
    }
  }, [open, config])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto px-6 py-0">
        <div className="-mx-6 mb-5 bg-neutral-900 px-6 py-6">
          <SheetHeader>
            <SheetTitle className="text-white text-lg">{config?.title || ''}</SheetTitle>
            {config?.description && (
              <SheetDescription className="text-neutral-400">
                {config.description}
              </SheetDescription>
            )}
          </SheetHeader>
          {!loading && items.length > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
              <span className="text-white text-sm font-bold tabular-nums">{items.length}</span>
              <span className="text-neutral-400 text-xs">
                {items.length === 1 ? 'resultado' : 'resultados'}
              </span>
            </div>
          )}
        </div>
        <div className="pb-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Building2 className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm">Nenhum resultado encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onOpenChange(false)
                    router.push(item.href)
                  }}
                  className="w-full flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-4 text-left hover:shadow-md hover:border-neutral-300 dark:hover:border-white/20 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      {item.badge && (
                        <Badge
                          variant={item.badge.variant}
                          className="text-[10px] shrink-0 rounded-full"
                        >
                          {item.badge.label}
                        </Badge>
                      )}
                    </div>
                    {item.subtitle && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{item.subtitle}</p>
                    )}
                    {item.date && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">{item.date}</p>
                    )}
                  </div>
                  {item.extra && (
                    <span className="text-sm font-bold text-right shrink-0">{item.extra}</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
