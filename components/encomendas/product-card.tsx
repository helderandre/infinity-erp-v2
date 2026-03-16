'use client'

import { Package, ShoppingCart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/constants'
import type { Product } from '@/types/encomenda'

interface ProductCardProps {
  product: Product
  onOrder: (product: Product) => void
}

export function ProductCard({ product, onOrder }: ProductCardProps) {
  return (
    <Card className="group overflow-hidden transition-all hover:shadow-md hover:scale-[1.01]">
      <div className="relative aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
        {product.thumbnail_url ? (
          <img
            src={product.thumbnail_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <Package className="h-12 w-12 text-muted-foreground/40" />
        )}
        {product.category && (
          <Badge
            variant="secondary"
            className="absolute top-2 left-2 text-xs"
          >
            {product.category.name}
          </Badge>
        )}
      </div>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-sm line-clamp-1">{product.name}</h3>
          {product.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {product.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {product.is_personalizable && (
            <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-600 border-0">
              Personalizavel
            </Badge>
          )}
          {product.is_returnable && (
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-0">
              Retornavel
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-lg font-bold">
            {formatCurrency(product.sell_price)}
          </span>
          <Button size="sm" onClick={() => onOrder(product)}>
            <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
            Encomendar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
