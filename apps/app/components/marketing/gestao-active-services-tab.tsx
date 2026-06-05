'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MarketingSubscription, MarketingOrderItem } from '@/types/marketing'
import {
  MARKETING_CATEGORIES,
  formatCurrency,
  formatDate,
} from '@/lib/constants'
import { SubscriptionCard } from '@/components/marketing/subscription-card'
import { CancelSubscriptionDialog } from '@/components/marketing/cancel-subscription-dialog'
import { UseItemDialog } from '@/components/marketing/use-item-dialog'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { toast } from 'sonner'
import {
  Zap, Play, Package, Camera, Video, Palette, Megaphone, Share2, MoreHorizontal,
  Calendar, Building2, Clock,
} from 'lucide-react'

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  photography: Camera,
  video: Video,
  design: Palette,
  physical_materials: Package,
  ads: Megaphone,
  social_media: Share2,
  other: MoreHorizontal,
}

interface ActiveServicesData {
  subscriptions: MarketingSubscription[]
  available_items: MarketingOrderItem[]
}

export function GestaoActiveServicesTab() {
  const [data, setData] = useState<ActiveServicesData>({ subscriptions: [], available_items: [] })
  const [loading, setLoading] = useState(true)
  const [cancelSub, setCancelSub] = useState<MarketingSubscription | null>(null)
  const [useItem, setUseItem] = useState<MarketingOrderItem | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/marketing/gestao/active-services')
      const json = await res.json()
      setData({
        subscriptions: Array.isArray(json.subscriptions) ? json.subscriptions : [],
        available_items: Array.isArray(json.available_items) ? json.available_items : [],
      })
    } catch {
      setData({ subscriptions: [], available_items: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCancelSubscription = async (immediate: boolean) => {
    if (!cancelSub) return
    try {
      const res = await fetch(`/api/marketing/subscriptions/${cancelSub.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediate }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao cancelar')
      }
      toast.success(
        immediate
          ? 'Subscrição cancelada imediatamente.'
          : 'Subscrição será cancelada no final do período.'
      )
      setCancelSub(null)
      fetchData()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao cancelar subscrição')
    }
  }

  const handleReactivateSubscription = async (id: string) => {
    try {
      const res = await fetch(`/api/marketing/subscriptions/${id}/reactivate`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao reactivar')
      }
      toast.success('Subscrição reactivada com sucesso!')
      fetchData()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao reactivar subscrição')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        <Separator />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    )
  }

  const { subscriptions, available_items } = data
  const hasContent = subscriptions.length > 0 || available_items.length > 0

  if (!hasContent) {
    return (
      <EmptyState
        icon={Zap}
        title="Sem serviços activos"
        description="As suas subscrições e serviços disponíveis aparecerão aqui."
      />
    )
  }

  return (
    <div className="space-y-8">
      {/* ─── Subscriptions (cards) ─── */}
      {subscriptions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold tracking-tight">Subscrições</h3>
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm text-muted-foreground">
              {subscriptions.length} {subscriptions.length === 1 ? 'subscrição' : 'subscrições'}
            </span>
          </div>
          <div className="space-y-3">
            {subscriptions.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                onCancel={(id) => {
                  const found = subscriptions.find((s) => s.id === id)
                  if (found) setCancelSub(found)
                }}
                onReactivate={handleReactivateSubscription}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Available Services (list) ─── */}
      {available_items.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold tracking-tight">Serviços Disponíveis</h3>
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm text-muted-foreground">
              {available_items.length} {available_items.length === 1 ? 'serviço' : 'serviços'}
            </span>
          </div>
          <div className="space-y-2">
            {available_items.map((item) => {
              const catalogItem = item.catalog_item
              const category = catalogItem?.category
              const Icon = category ? (CATEGORY_ICONS[category] || Package) : Package
              const categoryLabel = category ? MARKETING_CATEGORIES[category as keyof typeof MARKETING_CATEGORIES] : null
              const remaining = item.quantity - (item.used_count || 0)

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3 transition-all duration-300 hover:shadow-md hover:bg-muted/30"
                >
                  {/* Icon */}
                  <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-muted/60">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{item.name}</span>
                      {item.pack_id && (
                        <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">Pack</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {categoryLabel && (
                        <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                          {categoryLabel}
                        </span>
                      )}
                      {catalogItem?.requires_scheduling && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                          <Calendar className="h-2.5 w-2.5" />Agendamento
                        </span>
                      )}
                      {catalogItem?.requires_property && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                          <Building2 className="h-2.5 w-2.5" />Imóvel
                        </span>
                      )}
                      {catalogItem?.estimated_delivery_days && catalogItem.estimated_delivery_days > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                          <Clock className="h-2.5 w-2.5" />{catalogItem.estimated_delivery_days}d
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Remaining count */}
                  {item.quantity > 1 && (
                    <div className="shrink-0 text-center">
                      <span className="text-lg font-bold">{remaining}</span>
                      <p className="text-[10px] text-muted-foreground leading-none">restante{remaining !== 1 ? 's' : ''}</p>
                    </div>
                  )}

                  {/* Price */}
                  <span className="shrink-0 text-sm font-semibold">
                    {formatCurrency(item.price)}
                  </span>

                  {/* Action */}
                  <Button
                    size="sm"
                    className="shrink-0 rounded-full"
                    onClick={() => setUseItem(item)}
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Utilizar
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CancelSubscriptionDialog
        open={!!cancelSub}
        onOpenChange={(open) => { if (!open) setCancelSub(null) }}
        subscription={cancelSub}
        onConfirm={handleCancelSubscription}
      />

      <UseItemDialog
        open={!!useItem}
        onOpenChange={(open) => { if (!open) setUseItem(null) }}
        orderItem={useItem}
        onUsed={() => {
          setUseItem(null)
          fetchData()
        }}
      />
    </div>
  )
}
