'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GestaoHistoryItem } from '@/types/marketing'
import { formatCurrency, formatDate } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Camera, Package, Clock, Loader2 } from 'lucide-react'

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; bg: string; text: string }> = {
  service_used: {
    icon: Camera,
    label: 'Servico',
    bg: 'bg-blue-500/15',
    text: 'text-blue-600',
  },
  material_delivered: {
    icon: Package,
    label: 'Material',
    bg: 'bg-orange-500/15',
    text: 'text-orange-600',
  },
}

export function GestaoHistoryTab() {
  const [items, setItems] = useState<GestaoHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 20

  const fetchHistory = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset
    if (reset) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const res = await fetch(
        `/api/marketing/gestao/history?limit=${limit}&offset=${currentOffset}`
      )
      const data = await res.json()
      const newItems: GestaoHistoryItem[] = Array.isArray(data.items) ? data.items : []
      const more = data.has_more ?? false

      if (reset) {
        setItems(newItems)
        setOffset(newItems.length)
      } else {
        setItems((prev) => [...prev, ...newItems])
        setOffset((prev) => prev + newItems.length)
      }
      setHasMore(more)
    } catch {
      if (reset) setItems([])
      setHasMore(false)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [offset])

  useEffect(() => {
    fetchHistory(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="Sem historico"
        description="O historico de servicos concluidos e materiais entregues aparecera aqui."
      />
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.service_used
        const Icon = config.icon

        return (
          <div
            key={item.id}
            className="rounded-xl border bg-card p-4 transition-all duration-300 hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="shrink-0 rounded-full bg-muted/60 p-2.5">
                <Icon className="h-4.5 w-4.5 text-muted-foreground" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{item.name}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${config.bg} ${config.text}`}
                  >
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
              </div>

              {/* Amount */}
              {item.amount !== undefined && item.amount !== null && (
                <span className="text-sm font-semibold shrink-0">
                  {formatCurrency(item.amount)}
                </span>
              )}
            </div>
          </div>
        )
      })}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => fetchHistory(false)}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  )
}
