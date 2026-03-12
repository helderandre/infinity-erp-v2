'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MarketingOrderItem } from '@/types/marketing'
import { MARKETING_CATEGORIES, formatCurrency } from '@/lib/constants'
import { UseItemDialog } from './use-item-dialog'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
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
    <div className="space-y-8">
      {/* Available products */}
      {available.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Disponíveis para Utilizar ({available.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-5 w-5" />
            Já Utilizados ({used.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
    <Card className={`flex flex-col overflow-hidden ${used ? 'opacity-60' : ''}`}>
      {thumbnail ? (
        <div className="relative h-32 bg-muted">
          <img src={thumbnail} alt={item.name} className="w-full h-full object-cover" />
          {used && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <Badge variant="secondary" className="text-sm gap-1">
                <CheckCircle2 className="h-4 w-4" />Utilizado
              </Badge>
            </div>
          )}
        </div>
      ) : (
        <div className={`relative h-24 bg-gradient-to-br from-primary/5 to-primary/15 flex items-center justify-center ${used ? 'opacity-50' : ''}`}>
          <Icon className="h-10 w-10 text-primary/30" />
          {used && (
            <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-4 w-4" />Utilizado
              </Badge>
            </div>
          )}
        </div>
      )}

      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{item.name}</CardTitle>
          <span className="text-sm font-bold">{formatCurrency(item.price)}</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-2">
        <div className="flex flex-wrap gap-2">
          {category && (
            <Badge variant="outline" className="text-xs">
              {MARKETING_CATEGORIES[category as keyof typeof MARKETING_CATEGORIES]}
            </Badge>
          )}
          {item.pack_id && (
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">Pack</Badge>
          )}
          {requiresScheduling && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" /><span>Agendamento</span>
            </div>
          )}
          {requiresProperty && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" /><span>Imóvel</span>
            </div>
          )}
          {catalogItem?.estimated_delivery_days && catalogItem.estimated_delivery_days > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /><span>{catalogItem.estimated_delivery_days} dias</span>
            </div>
          )}
        </div>
      </CardContent>

      {!used && onUse && (
        <CardFooter className="pt-0">
          <Button className="w-full" onClick={onUse}>
            <Play className="mr-2 h-4 w-4" />
            Utilizar
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
