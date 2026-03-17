'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MarketingOrderItem } from '@/types/marketing'
import { MARKETING_CATEGORIES, formatCurrency } from '@/lib/constants'
import { UseItemDialog } from './use-item-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Camera, Video, Palette, Package, Megaphone, Share2, MoreHorizontal,
  Calendar, Building2, Clock, ShoppingBag, Play, CheckCircle2
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

export function MyProductsTab() {
  const [products, setProducts] = useState<MarketingOrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [useItem, setUseItem] = useState<MarketingOrderItem | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/marketing/my-products')
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const available = products.filter(p => p.status === 'available')
  const used = products.filter(p => p.status === 'used')

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Sem produtos comprados"
        description="Visite a Loja para adquirir serviços de marketing."
      />
    )
  }

  return (
    <div className="space-y-10">
      {/* Available products */}
      {available.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold tracking-tight">Disponíveis</h3>
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm text-muted-foreground">
              {available.length} {available.length === 1 ? 'serviço' : 'serviços'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {available.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                onUse={() => setUseItem(item)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Used products */}
      {used.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
          </div>
          <div className="flex items-center gap-3 opacity-60">
            <h3 className="text-base font-bold tracking-tight">Utilizados</h3>
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm text-muted-foreground">
              {used.length} {used.length === 1 ? 'serviço' : 'serviços'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 opacity-60">
            {used.map((item) => (
              <ProductCard key={item.id} item={item} used />
            ))}
          </div>
        </div>
      )}

      {/* Use Item Dialog */}
      <UseItemDialog
        open={!!useItem}
        onOpenChange={(open) => { if (!open) setUseItem(null) }}
        orderItem={useItem}
        onUsed={() => {
          setUseItem(null)
          fetchProducts()
        }}
      />
    </div>
  )
}

function ProductCard({ item, onUse, used }: { item: MarketingOrderItem; onUse?: () => void; used?: boolean }) {
  const catalogItem = item.catalog_item
  const pack = item.pack
  const category = catalogItem?.category
  const Icon = category ? (CATEGORY_ICONS[category] || Package) : Package
  const thumbnail = catalogItem?.thumbnail || pack?.thumbnail
  const requiresScheduling = catalogItem?.requires_scheduling
  const requiresProperty = catalogItem?.requires_property

  return (
    <div className="group relative flex flex-col rounded-xl border bg-card text-card-foreground overflow-hidden hover:shadow-lg transition-all duration-300">
      {/* Thumbnail / Placeholder */}
      {thumbnail ? (
        <div className="relative aspect-square overflow-hidden rounded-xl m-2">
          <img
            src={thumbnail}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {used && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />Utilizado
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="relative aspect-square overflow-hidden rounded-xl m-2 bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center">
          <Icon className="h-14 w-14 text-neutral-300" />
          {used && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />Utilizado
              </span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col flex-1 px-3 pt-2 pb-3 space-y-2">
        {/* Name + Price */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-snug line-clamp-2">{item.name}</span>
          <span className="font-bold text-base shrink-0">{formatCurrency(item.price)}</span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {category && (
            <span className="rounded-full bg-muted text-[11px] px-2 py-0.5 font-medium">
              {MARKETING_CATEGORIES[category as keyof typeof MARKETING_CATEGORIES]}
            </span>
          )}
          {item.pack_id && (
            <span className="rounded-full bg-emerald-50 text-emerald-700 text-[11px] px-2 py-0.5 font-medium">
              Pack
            </span>
          )}
          {requiresScheduling && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-[11px] px-2 py-0.5 text-muted-foreground">
              <Calendar className="h-3 w-3" />Agendamento
            </span>
          )}
          {requiresProperty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-[11px] px-2 py-0.5 text-muted-foreground">
              <Building2 className="h-3 w-3" />Imóvel
            </span>
          )}
          {catalogItem?.estimated_delivery_days && catalogItem.estimated_delivery_days > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-[11px] px-2 py-0.5 text-muted-foreground">
              <Clock className="h-3 w-3" />{catalogItem.estimated_delivery_days} dias
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Use button */}
        {!used && onUse && (
          <Button className="w-full rounded-full mt-1" onClick={onUse}>
            <Play className="mr-2 h-4 w-4" />
            Utilizar
          </Button>
        )}
      </div>
    </div>
  )
}
