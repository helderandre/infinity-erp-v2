'use client'

import { useState, useMemo } from 'react'
import { Search, Package } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ProductCard } from './product-card'
import type { Product, ProductCategory } from '@/types/encomenda'

interface ProductCatalogGridProps {
  products: Product[]
  categories: ProductCategory[]
  onOrder: (product: Product) => void
}

export function ProductCatalogGrid({ products, categories, onOrder }: ProductCatalogGridProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
    )
  }, [products, search])

  const grouped = useMemo(() => {
    const map = new Map<string, { catId: string; category: ProductCategory | null; items: Product[] }>()
    for (const product of filtered) {
      const catId = product.category_id ?? 'uncategorized'
      if (!map.has(catId)) {
        const cat = categories.find((c) => c.id === catId) ?? null
        map.set(catId, { catId, category: cat, items: [] })
      }
      map.get(catId)!.items.push(product)
    }
    return Array.from(map.values()).sort(
      (a, b) => (a.category?.sort_order ?? 99) - (b.category?.sort_order ?? 99)
    )
  }, [filtered, categories])

  return (
    <div className="space-y-6">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar produtos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mb-3 opacity-40" />
          <p className="font-medium">Nenhum produto encontrado</p>
          {search && (
            <p className="text-sm mt-1">
              Tente ajustar a pesquisa
            </p>
          )}
        </div>
      ) : (
        grouped.map(({ catId, category, items }) => (
          <div key={catId} className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">
                {category?.name ?? 'Sem Categoria'}
              </h2>
              <span className="text-sm text-muted-foreground">
                ({items.length})
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOrder={onOrder}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
