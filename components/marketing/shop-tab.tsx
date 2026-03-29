'use client'

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useMarketingCatalog } from '@/hooks/use-marketing-catalog'
import { useMarketingPacks } from '@/hooks/use-marketing-packs'
import { useEncomendaProducts } from '@/hooks/use-encomenda-products'
import { MARKETING_CATEGORIES, BILLING_CYCLE_LABELS } from '@/lib/constants'
import { formatCurrency } from '@/lib/constants'
import type { MarketingCatalogItem, MarketingCategory, MarketingCatalogAddon, MarketingPack } from '@/types/marketing'
import type { CartPropertyBundle, CartCampaignItem } from '@/types/marketing'
import type { Product, ProductCategory } from '@/types/encomenda'
import { OrderFormDialog } from './order-form-dialog'
import { PropertyServiceDialog } from './property-service-dialog'
import { CampaignRequestDialog } from './campaign-request-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Camera, Video, Palette, Package, Megaphone, Share2, MoreHorizontal,
  Search, Calendar, Building2, Clock, ShoppingCart, ChevronDown, ChevronUp,
  Repeat, Gift, X, Plus, Minus, Boxes, ArrowLeft, ArrowRight, Sparkles, Puzzle
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

// Pexels fallback images per category (free to use)
const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  photography: 'https://images.pexels.com/photos/6180674/pexels-photo-6180674.jpeg?auto=compress&cs=tinysrgb&w=800',
  video: 'https://images.pexels.com/photos/2873486/pexels-photo-2873486.jpeg?auto=compress&cs=tinysrgb&w=800',
  design: 'https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=800',
  physical_materials: 'https://images.pexels.com/photos/5632399/pexels-photo-5632399.jpeg?auto=compress&cs=tinysrgb&w=800',
  ads: 'https://images.pexels.com/photos/6476808/pexels-photo-6476808.jpeg?auto=compress&cs=tinysrgb&w=800',
  social_media: 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800',
  other: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800',
}

// --- Cart types ---
interface CartServiceItem {
  type: 'service'
  service: MarketingCatalogItem
  selectedAddons: MarketingCatalogAddon[]
}

interface CartPackItem {
  type: 'pack'
  pack: MarketingPack
}

export interface CartMaterialItem {
  type: 'material'
  product: Product
  quantity: number
  categoryName: string
}

export type CartItem = CartServiceItem | CartPackItem | CartMaterialItem | CartPropertyBundle | CartCampaignItem

export function cartItemPrice(item: CartItem): number {
  if (item.type === 'service') {
    return item.service.price + item.selectedAddons.reduce((s, a) => s + a.price, 0)
  }
  if (item.type === 'pack') return item.pack.price
  if (item.type === 'property_bundle') {
    return item.services.reduce((sum, s) => sum + s.service.price + s.selectedAddons.reduce((a, ad) => a + ad.price, 0), 0)
  }
  if (item.type === 'campaign') return item.totalCost
  return item.product.sell_price * item.quantity
}

export function cartItemName(item: CartItem): string {
  if (item.type === 'service') return item.service.name
  if (item.type === 'pack') return item.pack.name
  if (item.type === 'property_bundle') return `Serviços — ${item.propertyTitle}`
  if (item.type === 'campaign') return item.label
  return item.product.name
}

// --- Detail dialog types ---
type DetailItem =
  | { kind: 'service'; item: MarketingCatalogItem }
  | { kind: 'pack'; pack: MarketingPack }
  | { kind: 'material'; product: Product }

interface ShopTabProps {
  onSwitchToOrders?: () => void
  showGerirLoja?: boolean
  showHero?: boolean
  onBack?: () => void
  onCartCountChange?: (count: number) => void
  headerAction?: React.ReactNode
}

export function ShopTab({ onSwitchToOrders, showGerirLoja, showHero = true, onBack, onCartCountChange, headerAction }: ShopTabProps) {
  const { items, loading, filters, setFilters } = useMarketingCatalog()
  const { packs, loading: packsLoading } = useMarketingPacks()
  const { products, categories: materialCategories, loading: materialsLoading } = useEncomendaProducts()

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCheckout, setShowCheckout] = useState(false)

  // Property & Campaign dialogs
  const [showPropertyDialog, setShowPropertyDialog] = useState(false)
  const [showCampaignDialog, setShowCampaignDialog] = useState(false)
  const [shopSection, setShopSection] = useState<'imovel' | 'services' | 'materials' | 'campanhas'>('imovel')

  const SHOP_SECTION_LABELS: Record<string, string> = { imovel: 'Imóvel', services: 'Serviços', materials: 'Produtos', campanhas: 'Campanhas' }

  // Per-card addon selection state
  const [addonSelections, setAddonSelections] = useState<Record<string, boolean>>({})

  // Material quantities per product
  const [materialQtys, setMaterialQtys] = useState<Record<string, number>>({})
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialCategoryFilter, setMaterialCategoryFilter] = useState('all')

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<DetailItem | null>(null)
  const [detailAddonsOpen, setDetailAddonsOpen] = useState(false)

  const activeItems = items.filter(i => i.is_active)
  const activePacks = (packs || []).filter((p: MarketingPack) => p.is_active)
  const activeProducts = products.filter(p => p.is_active)

  // Split catalog items into property-requiring vs general
  const propertyServices = activeItems.filter(i => i.requires_property)
  const generalServices = activeItems.filter(i => !i.requires_property)

  const filteredProducts = useMemo(() => {
    let result = activeProducts
    if (materialSearch.trim()) {
      const q = materialSearch.toLowerCase()
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
      )
    }
    if (materialCategoryFilter !== 'all') {
      result = result.filter(p => p.category_id === materialCategoryFilter)
    }
    return result
  }, [activeProducts, materialSearch, materialCategoryFilter])

  const groupedProducts = useMemo(() => {
    const map = new Map<string, { catId: string; category: ProductCategory | null; items: Product[] }>()
    for (const product of filteredProducts) {
      const catId = product.category_id ?? 'uncategorized'
      if (!map.has(catId)) {
        const cat = materialCategories.find((c) => c.id === catId) ?? null
        map.set(catId, { catId, category: cat, items: [] })
      }
      map.get(catId)!.items.push(product)
    }
    return Array.from(map.values()).sort(
      (a, b) => (a.category?.sort_order ?? 99) - (b.category?.sort_order ?? 99)
    )
  }, [filteredProducts, materialCategories])

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + cartItemPrice(item), 0), [cart])
  const cartCount = cart.reduce((sum, item) => sum + (item.type === 'material' ? item.quantity : 1), 0)

  useEffect(() => { onCartCountChange?.(cartCount) }, [cartCount, onCartCountChange])

  // Pack savings calculation for hero
  const maxSavingsPercent = useMemo(() => {
    let max = 0
    for (const pack of activePacks) {
      const itemsTotal = (pack.items || []).reduce((sum: number, i: MarketingCatalogItem) => sum + i.price, 0)
      if (itemsTotal > 0) {
        const pct = Math.round(((itemsTotal - pack.price) / itemsTotal) * 100)
        if (pct > max) max = pct
      }
    }
    return max
  }, [activePacks])

  // Filter general services by current filters
  const filteredGeneralServices = useMemo(() => {
    let result = generalServices
    if (filters.search?.trim()) {
      const q = filters.search.toLowerCase()
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))
    }
    if (filters.category) {
      result = result.filter(s => s.category === filters.category)
    }
    return result
  }, [generalServices, filters.search, filters.category])

  const toggleAddon = (addonId: string) => {
    setAddonSelections(prev => ({ ...prev, [addonId]: !prev[addonId] }))
  }

  const addServiceToCart = (item: MarketingCatalogItem) => {
    const selectedAddons = (item.addons || []).filter(a => addonSelections[a.id])
    const cartItem: CartServiceItem = { type: 'service', service: item, selectedAddons }
    setCart(prev => [...prev, cartItem])
    const addonIds = (item.addons || []).map(a => a.id)
    setAddonSelections(prev => {
      const next = { ...prev }
      addonIds.forEach(id => delete next[id])
      return next
    })
  }

  const addPackToCart = (pack: MarketingPack) => {
    setCart(prev => [...prev, { type: 'pack', pack }])
  }

  const addMaterialToCart = (product: Product) => {
    const qty = materialQtys[product.id] || 1
    const catName = materialCategories.find(c => c.id === product.category_id)?.name ?? 'Material'
    setCart(prev => {
      const existingIdx = prev.findIndex(
        (ci) => ci.type === 'material' && ci.product.id === product.id
      )
      if (existingIdx >= 0) {
        const updated = [...prev]
        const existing = updated[existingIdx] as CartMaterialItem
        updated[existingIdx] = { ...existing, quantity: existing.quantity + qty }
        return updated
      }
      return [...prev, { type: 'material', product, quantity: qty, categoryName: catName }]
    })
    setMaterialQtys(prev => ({ ...prev, [product.id]: 1 }))
  }

  const addPropertyBundleToCart = (bundle: CartPropertyBundle) => {
    setCart(prev => [...prev, bundle])
  }

  const addCampaignToCart = (item: CartCampaignItem) => {
    setCart(prev => [...prev, item])
  }

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  const updateMaterialQty = (productId: string, delta: number) => {
    setMaterialQtys(prev => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) + delta),
    }))
  }

  const openDetail = (d: DetailItem) => {
    setDetailItem(d)
    setDetailAddonsOpen(false)
    setDetailOpen(true)
  }

  const addFromDetailAndClose = () => {
    if (!detailItem) return
    if (detailItem.kind === 'service') addServiceToCart(detailItem.item)
    else if (detailItem.kind === 'pack') addPackToCart(detailItem.pack)
    else addMaterialToCart(detailItem.product)
    setDetailOpen(false)
  }

  const allLoading = loading || packsLoading || materialsLoading

  return (
    <div>
      {/* ─── Hero Banner ─── */}
      {showHero && <div className="relative overflow-hidden bg-neutral-900 rounded-xl">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/90 via-neutral-900/70 to-neutral-900/40" />

        {showGerirLoja && (
          <a
            href="/dashboard/marketing/loja/gerir"
            className="absolute top-4 right-4 z-20 inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            Gerir Loja
          </a>
        )}

        <div className="relative z-10 px-8 py-14 sm:px-12 sm:py-20 max-w-2xl">
          <p className="text-neutral-400 text-sm font-medium tracking-widest uppercase mb-3">
            Infinity Marketing
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight">
            Serviços de Marketing
          </h2>
          <p className="text-neutral-300 mt-4 text-base sm:text-lg leading-relaxed max-w-lg">
            Fotografia, vídeo, design e materiais para elevar a apresentação dos seus imóveis.
          </p>
          <div className="flex items-center gap-3 mt-8">
            {onSwitchToOrders && (
              <button
                onClick={onSwitchToOrders}
                className="inline-flex items-center gap-2 border border-white/30 text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-white/10 transition-colors"
              >
                <ShoppingCart className="h-4 w-4" />
                Encomendas
              </button>
            )}
          </div>
        </div>
      </div>}

      {/* ─── Tab Content ─── */}
      <div key={shopSection} className={`animate-in fade-in duration-300 ${showHero ? 'mt-6' : ''}`}>

        {/* ═══════════ TAB: IMÓVEL ═══════════ */}
        {shopSection === 'imovel' && <section>
          <div
            className="relative rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300"
            style={{ height: 'calc(100vh - 7rem)' }}
            onClick={() => setShowPropertyDialog(true)}
          >
            <img
              src="https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1600"
              alt="Serviços para Imóvel"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-neutral-900/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/70 via-transparent to-neutral-900/20" />

            {/* Tab pills overlaid on image */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {headerAction}
              <div className="flex items-center gap-1 p-1 rounded-full bg-black/30 backdrop-blur-md border border-white/10 shadow-lg overflow-x-auto scrollbar-hide w-fit max-w-[calc(100vw-4rem)]">
                {([
                  { key: 'imovel' as const, label: 'Imóvel', icon: Building2 },
                  { key: 'services' as const, label: 'Serviços', icon: Camera },
                  { key: 'materials' as const, label: 'Produtos', icon: Package },
                  { key: 'campanhas' as const, label: 'Campanhas', icon: Megaphone },
                ]).map((tab) => {
                  const Icon = tab.icon
                  const isActive = shopSection === tab.key
                  return (
                    <button key={tab.key} onClick={() => setShopSection(tab.key)} className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${isActive ? 'bg-white text-neutral-900 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/15'}`}>
                      <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  )
                })}
              </div>
              <span className="sm:hidden px-3 py-1.5 rounded-full bg-white/90 text-neutral-900 text-xs font-semibold shadow-sm backdrop-blur-sm">{SHOP_SECTION_LABELS[shopSection]}</span>
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-8">
              <Building2 className="h-8 w-8 text-white/80 mb-4" />
              <h4 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
                Serviços para Imóvel
              </h4>
              <p className="text-neutral-300 text-sm sm:text-base leading-relaxed mt-3 max-w-md">
                Fotografia, vídeo e mais para o seu imóvel
              </p>
              <div className="mt-6">
                <span className="inline-flex items-center gap-2 bg-white text-neutral-900 px-7 py-2.5 rounded-full text-sm font-semibold hover:bg-neutral-100 transition-colors shadow-lg">
                  Fazer Novo Pedido
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>
        </section>}

        {/* ═══════════ TAB: SERVIÇOS ═══════════ */}
        {shopSection === 'services' && <section>
          <div className="rounded-2xl border shadow-lg bg-card overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 7rem)' }}>
            {/* Header — pills + filters */}
            <div className="flex items-center gap-2 p-4 border-b flex-wrap shrink-0">
              {headerAction}
              <div className="flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm overflow-x-auto scrollbar-hide w-fit max-w-[calc(100vw-4rem)]">
                {([
                  { key: 'imovel' as const, label: 'Imóvel', icon: Building2 },
                  { key: 'services' as const, label: 'Serviços', icon: Camera },
                  { key: 'materials' as const, label: 'Produtos', icon: Package },
                  { key: 'campanhas' as const, label: 'Campanhas', icon: Megaphone },
                ]).map((tab) => {
                  const Icon = tab.icon
                  const isActive = shopSection === tab.key
                  return (
                    <button key={tab.key} onClick={() => setShopSection(tab.key)} className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${isActive ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                      <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  )
                })}
              </div>
              <span className="sm:hidden px-3 py-1.5 rounded-full bg-muted text-foreground text-xs font-semibold">{SHOP_SECTION_LABELS[shopSection]}</span>
              <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar..."
                  className="pl-9 h-9 w-[180px] text-sm rounded-full bg-muted/50 border-0 focus-visible:ring-1"
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
              <Select
                value={filters.category || 'all'}
                onValueChange={(v) => setFilters({ ...filters, category: v === 'all' ? '' : v as MarketingCategory })}
              >
                <SelectTrigger className="h-9 w-[160px] text-sm rounded-full bg-muted/50 border-0">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(MARKETING_CATEGORIES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4">
          {loading || packsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-xl" />)}
            </div>
          ) : filteredGeneralServices.length === 0 && activePacks.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Nenhum serviço disponível"
              description="Não existem serviços activos no catálogo."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {/* Packs first */}
              {activePacks.map((pack: MarketingPack) => {
                const itemsTotal = (pack.items || []).reduce((sum, i) => sum + i.price, 0)
                const savingsPercent = itemsTotal > 0 ? Math.round(((itemsTotal - pack.price) / itemsTotal) * 100) : 0

                return (
                  <div
                    key={pack.id}
                    className="group relative flex flex-col bg-background rounded-xl border shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer"
                    onClick={() => openDetail({ kind: 'pack', pack })}
                  >
                    {/* Image */}
                    <div className="relative aspect-[4/3] bg-neutral-50 overflow-hidden">
                      <img
                        src={pack.thumbnail || 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800'}
                        alt={pack.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* Discount badge top-left */}
                      {savingsPercent > 0 && (
                        <div className="absolute top-3 left-3 bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                          -{savingsPercent}%
                        </div>
                      )}
                      {/* Pack badge top-right */}
                      <div className="absolute top-3 right-3">
                        <span className="inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm text-neutral-700 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-sm">
                          <Gift className="h-3 w-3" />
                          Pack
                        </span>
                      </div>
                      {/* Price glassmorphism tag bottom-right */}
                      <div className="absolute bottom-3 right-3">
                        <span className="inline-flex items-center gap-1.5 bg-neutral-900 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg">
                          {formatCurrency(pack.price)}
                          {itemsTotal > 0 && itemsTotal !== pack.price && (
                            <span className="text-white/60 text-xs line-through font-normal">{formatCurrency(itemsTotal)}</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Info — minimal */}
                    <div className="p-3.5">
                      <h4 className="font-semibold text-sm leading-snug">{pack.name}</h4>
                    </div>
                  </div>
                )
              })}

              {/* General services */}
              {filteredGeneralServices.map((item) => {
                const Icon = CATEGORY_ICONS[item.category] || Package
                const hasAddons = (item.addons || []).length > 0

                return (
                  <div
                    key={item.id}
                    className="group relative flex flex-col bg-background rounded-xl border shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer"
                    onClick={() => openDetail({ kind: 'service', item })}
                  >
                    {/* Image */}
                    <div className="relative aspect-[4/3] bg-neutral-50 overflow-hidden">
                      <img
                        src={item.thumbnail || CATEGORY_FALLBACK_IMAGES[item.category] || CATEGORY_FALLBACK_IMAGES.other}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* Category badge top-left */}
                      <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm text-neutral-700 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-sm">
                          <Icon className="h-3 w-3" />
                          {MARKETING_CATEGORIES[item.category]}
                        </span>
                      </div>
                      {/* Addons badge top-right */}
                      {hasAddons && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="absolute top-3 right-3 inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm text-neutral-700 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-sm hover:bg-white transition-colors"
                            >
                              <Puzzle className="h-3 w-3" />
                              {item.addons!.length} add-on{item.addons!.length > 1 ? 's' : ''}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-64 p-0 rounded-xl"
                            side="bottom"
                            align="end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="px-3.5 py-2.5 border-b">
                              <p className="text-xs font-semibold">Add-ons disponíveis</p>
                            </div>
                            <div className="p-2 space-y-0.5 max-h-48 overflow-y-auto">
                              {item.addons!.map((addon) => (
                                <label
                                  key={addon.id}
                                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={!!addonSelections[addon.id]}
                                      onChange={() => toggleAddon(addon.id)}
                                      className="rounded border-gray-300 h-3.5 w-3.5 shrink-0"
                                    />
                                    <span className="text-xs truncate">{addon.name}</span>
                                  </div>
                                  {addon.price === 0 ? (
                                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5 shrink-0">
                                      <Gift className="h-3 w-3" />Grátis
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground shrink-0">+{formatCurrency(addon.price)}</span>
                                  )}
                                </label>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                      {/* Subscription badge */}
                      {item.is_subscription && !hasAddons && (
                        <div className="absolute top-3 right-3 bg-blue-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                          Subscrição
                        </div>
                      )}
                      {/* Price glassmorphism tag bottom-right */}
                      <div className="absolute bottom-3 right-3">
                        <span className="inline-flex items-center gap-1.5 bg-neutral-900 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg">
                          {formatCurrency(item.price)}
                          {item.is_subscription && (
                            <span className="text-white/60 text-[10px] font-normal">{BILLING_CYCLE_LABELS[item.billing_cycle || 'monthly'] || '/mês'}</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Info — minimal */}
                    <div className="p-3.5">
                      <h4 className="font-semibold text-sm leading-snug">{item.name}</h4>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          </div>
        </div>
        </section>}

        {/* ═══════════ TAB: PRODUTOS ═══════════ */}
        {shopSection === 'materials' && <section>
          <div className="rounded-2xl border shadow-lg bg-card overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 7rem)' }}>
            {/* Header — pills + filters */}
            <div className="flex items-center gap-2 p-4 border-b flex-wrap shrink-0">
            {/* Tab pills inline with filters */}
            {headerAction}
            <div className="flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm overflow-x-auto scrollbar-hide w-fit max-w-[calc(100vw-4rem)]">
              {([
                { key: 'imovel' as const, label: 'Imóvel', icon: Building2 },
                { key: 'services' as const, label: 'Serviços', icon: Camera },
                { key: 'materials' as const, label: 'Produtos', icon: Package },
                { key: 'campanhas' as const, label: 'Campanhas', icon: Megaphone },
              ]).map((tab) => {
                const Icon = tab.icon
                const isActive = shopSection === tab.key
                return (
                  <button key={tab.key} onClick={() => setShopSection(tab.key)} className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${isActive ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                    <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{tab.label}</span>
                  </button>
                )
              })}
            </div>
            <span className="sm:hidden px-3 py-1.5 rounded-full bg-muted text-foreground text-xs font-semibold">{SHOP_SECTION_LABELS[shopSection]}</span>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar..."
                  className="pl-9 h-9 w-[180px] text-sm rounded-full bg-muted/50 border-0 focus-visible:ring-1"
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                />
              </div>
              <Select value={materialCategoryFilter} onValueChange={setMaterialCategoryFilter}>
                <SelectTrigger className="h-9 w-[160px] text-sm rounded-full bg-muted/50 border-0">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {materialCategories.filter(c => c.is_active).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4">
          {materialsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-xl" />)}
            </div>
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Nenhum material disponível"
              description={materialSearch ? 'Tente ajustar a pesquisa.' : 'Não existem materiais activos no catálogo.'}
            />
          ) : (
            <div className="space-y-10">
              {groupedProducts.map(({ catId, category, items: groupItems }) => (
                <div key={catId}>
                  <div className="flex items-center gap-2 mb-4">
                    <h4 className="font-semibold text-base">{category?.name ?? 'Sem Categoria'}</h4>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {groupItems.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {groupItems.map((product) => (
                      <div
                        key={product.id}
                        className="group relative flex flex-col bg-background rounded-xl border shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer"
                        onClick={() => openDetail({ kind: 'material', product })}
                      >
                        {/* Image */}
                        <div className="relative aspect-[4/3] bg-neutral-50 overflow-hidden">
                          <img
                            src={product.thumbnail_url || CATEGORY_FALLBACK_IMAGES.physical_materials}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {/* Badges top-left */}
                          {product.is_personalizable && (
                            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-neutral-700 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-sm">
                              Personalizável
                            </div>
                          )}
                          {/* Price glassmorphism tag bottom-right */}
                          <div className="absolute bottom-3 right-3">
                            <span className="inline-flex items-center bg-neutral-900 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg">
                              {formatCurrency(product.sell_price)}
                            </span>
                          </div>
                        </div>

                        {/* Info — minimal */}
                        <div className="p-3.5">
                          <h4 className="font-semibold text-sm leading-snug">{product.name}</h4>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
        </section>}

        {/* ═══════════ TAB: CAMPANHAS ═══════════ */}
        {shopSection === 'campanhas' && <section>
          <div
            className="relative rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300"
            style={{ height: 'calc(100vh - 7rem)' }}
            onClick={() => setShowCampaignDialog(true)}
          >
            <img
              src="https://images.pexels.com/photos/6476808/pexels-photo-6476808.jpeg?auto=compress&cs=tinysrgb&w=1600"
              alt="Campanhas Meta Ads"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-neutral-900/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/70 via-transparent to-neutral-900/20" />

            {/* Tab pills overlaid on image */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {headerAction}
              <div className="flex items-center gap-1 p-1 rounded-full bg-black/30 backdrop-blur-md border border-white/10 shadow-lg overflow-x-auto scrollbar-hide w-fit max-w-[calc(100vw-4rem)]">
                {([
                  { key: 'imovel' as const, label: 'Imóvel', icon: Building2 },
                  { key: 'services' as const, label: 'Serviços', icon: Camera },
                  { key: 'materials' as const, label: 'Produtos', icon: Package },
                  { key: 'campanhas' as const, label: 'Campanhas', icon: Megaphone },
                ]).map((tab) => {
                  const Icon = tab.icon
                  const isActive = shopSection === tab.key
                  return (
                    <button key={tab.key} onClick={() => setShopSection(tab.key)} className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${isActive ? 'bg-white text-neutral-900 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/15'}`}>
                      <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  )
                })}
              </div>
              <span className="sm:hidden px-3 py-1.5 rounded-full bg-white/90 text-neutral-900 text-xs font-semibold shadow-sm backdrop-blur-sm">{SHOP_SECTION_LABELS[shopSection]}</span>
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-8">
              <Megaphone className="h-8 w-8 text-white/80 mb-4" />
              <h4 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
                Campanhas Meta Ads
              </h4>
              <p className="text-neutral-300 text-sm sm:text-base leading-relaxed mt-3 max-w-md">
                Peça uma campanha publicitária para os seus imóveis
              </p>
              <div className="mt-6">
                <span className="inline-flex items-center gap-2 bg-white text-neutral-900 px-7 py-2.5 rounded-full text-sm font-semibold hover:bg-neutral-100 transition-colors shadow-lg">
                  Fazer Novo Pedido
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>
        </section>}

      </div>

      {/* ─── Cart Bottom Bar (portal to body so it's truly fixed) ─── */}
      {cartCount > 0 && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-0 left-0 right-0 z-[60] border-t bg-background/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-4 px-6 py-3 max-w-screen-2xl mx-auto">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                </div>
              </div>
              <Separator orientation="vertical" className="h-5" />
              <TooltipProvider>
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {cart.map((cartItem, idx) => (
                    <Tooltip key={idx}>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-xs gap-1 pr-1 cursor-default rounded-full">
                          {cartItem.type === 'material' && `${cartItem.quantity}× `}
                          {cartItemName(cartItem)}
                          {cartItem.type === 'pack' && <span className="text-[10px] opacity-60">Pack</span>}
                          {cartItem.type === 'material' && <span className="text-[10px] opacity-60">Material</span>}
                          {cartItem.type === 'property_bundle' && <span className="text-[10px] opacity-60">Imóvel</span>}
                          {cartItem.type === 'campaign' && <span className="text-[10px] opacity-60">Campanha</span>}
                          <button
                            onClick={() => removeFromCart(idx)}
                            className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs p-3 space-y-1.5 text-left">
                        {cartItem.type === 'service' ? (
                          <>
                            <p className="font-medium">{cartItem.service.name}</p>
                            <p className="text-xs opacity-80">{MARKETING_CATEGORIES[cartItem.service.category]}</p>
                            <div className="flex justify-between text-xs">
                              <span>Serviço</span>
                              <span>{formatCurrency(cartItem.service.price)}</span>
                            </div>
                            {cartItem.selectedAddons.length > 0 && (
                              <>
                                {cartItem.selectedAddons.map(a => (
                                  <div key={a.id} className="flex justify-between text-xs">
                                    <span>+ {a.name}</span>
                                    <span>{a.price === 0 ? 'Incluído' : formatCurrency(a.price)}</span>
                                  </div>
                                ))}
                                <div className="border-t border-background/20 pt-1 flex justify-between text-xs font-medium">
                                  <span>Subtotal</span>
                                  <span>{formatCurrency(cartItemPrice(cartItem))}</span>
                                </div>
                              </>
                            )}
                          </>
                        ) : cartItem.type === 'pack' ? (
                          <>
                            <p className="font-medium">{cartItem.pack.name}</p>
                            <p className="text-xs opacity-80">Pack</p>
                            {(cartItem.pack.items || []).map(pi => (
                              <div key={pi.id} className="flex justify-between text-xs">
                                <span>{pi.name}</span>
                                <span className="line-through opacity-60">{formatCurrency(pi.price)}</span>
                              </div>
                            ))}
                            <div className="border-t border-background/20 pt-1 flex justify-between text-xs font-medium">
                              <span>Preço do pack</span>
                              <span>{formatCurrency(cartItem.pack.price)}</span>
                            </div>
                          </>
                        ) : cartItem.type === 'property_bundle' ? (
                          <>
                            <p className="font-medium">{cartItem.propertyTitle}</p>
                            <p className="text-xs opacity-80">Serviços para imóvel</p>
                            {cartItem.services.map((s, sIdx) => (
                              <div key={sIdx}>
                                <div className="flex justify-between text-xs">
                                  <span>{s.service.name}</span>
                                  <span>{formatCurrency(s.service.price)}</span>
                                </div>
                                {s.selectedAddons.map(ad => (
                                  <div key={ad.id} className="flex justify-between text-xs pl-2">
                                    <span>+ {ad.name}</span>
                                    <span>{ad.price === 0 ? 'Incluído' : formatCurrency(ad.price)}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                            <div className="border-t border-background/20 pt-1 flex justify-between text-xs font-medium">
                              <span>Total</span>
                              <span>{formatCurrency(cartItemPrice(cartItem))}</span>
                            </div>
                          </>
                        ) : cartItem.type === 'campaign' ? (
                          <>
                            <p className="font-medium">{cartItem.label}</p>
                            <p className="text-xs opacity-80">Campanha Meta Ads</p>
                            <div className="flex justify-between text-xs">
                              <span>Objectivo</span>
                              <span>{cartItem.campaignData.objective}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span>Orçamento</span>
                              <span>{formatCurrency(cartItem.campaignData.budget_amount)} ({cartItem.campaignData.budget_type === 'daily' ? 'diário' : 'total'})</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span>Duração</span>
                              <span>{cartItem.campaignData.duration_days} dias</span>
                            </div>
                            <div className="border-t border-background/20 pt-1 flex justify-between text-xs font-medium">
                              <span>Custo total</span>
                              <span>{formatCurrency(cartItem.totalCost)}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="font-medium">{cartItem.product.name}</p>
                            <p className="text-xs opacity-80">{cartItem.categoryName}</p>
                            <div className="flex justify-between text-xs">
                              <span>{cartItem.quantity} × {formatCurrency(cartItem.product.sell_price)}</span>
                              <span className="font-medium">{formatCurrency(cartItemPrice(cartItem))}</span>
                            </div>
                          </>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-lg font-bold">{formatCurrency(cartTotal)}</span>
              <Button className="rounded-full px-6" onClick={() => setShowCheckout(true)}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Finalizar Pedido
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Detail Dialog ─── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg rounded-2xl p-0 overflow-hidden max-h-[85vh] sm:max-h-[90vh] flex flex-col gap-0">
          {detailItem && (
            <>
              {/* Image header */}
              <div className="relative aspect-video bg-neutral-100 overflow-hidden shrink-0">
                <img
                  src={
                    detailItem.kind === 'service'
                      ? (detailItem.item.thumbnail || CATEGORY_FALLBACK_IMAGES[detailItem.item.category] || CATEGORY_FALLBACK_IMAGES.other)
                      : detailItem.kind === 'pack'
                        ? (detailItem.pack.thumbnail || 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800')
                        : (detailItem.product.thumbnail_url || CATEGORY_FALLBACK_IMAGES.physical_materials)
                  }
                  alt={
                    detailItem.kind === 'service' ? detailItem.item.name
                      : detailItem.kind === 'pack' ? detailItem.pack.name
                        : detailItem.product.name
                  }
                  className="w-full h-full object-cover"
                />
                {/* Category badge top-left */}
                {detailItem.kind === 'service' && (
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm text-neutral-700 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-sm">
                      {(() => { const I = CATEGORY_ICONS[detailItem.item.category] || Package; return <I className="h-3 w-3" /> })()}
                      {MARKETING_CATEGORIES[detailItem.item.category]}
                    </span>
                  </div>
                )}
                {/* Price overlay */}
                <div className="absolute bottom-4 right-4">
                  <span className="inline-flex items-center gap-1.5 bg-neutral-900 text-white text-lg font-bold px-4 py-2 rounded-full shadow-lg">
                    {detailItem.kind === 'service' && formatCurrency(detailItem.item.price)}
                    {detailItem.kind === 'pack' && formatCurrency(detailItem.pack.price)}
                    {detailItem.kind === 'material' && formatCurrency(detailItem.product.sell_price)}
                    {detailItem.kind === 'service' && detailItem.item.is_subscription && (
                      <span className="text-white/60 text-xs font-normal">{BILLING_CYCLE_LABELS[detailItem.item.billing_cycle || 'monthly'] || '/mês'}</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Content — scrollable */}
              <div className="px-6 pb-6 pt-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-lg">
                    {detailItem.kind === 'service' && detailItem.item.name}
                    {detailItem.kind === 'pack' && detailItem.pack.name}
                    {detailItem.kind === 'material' && detailItem.product.name}
                  </DialogTitle>
                </DialogHeader>

                {/* Description */}
                {detailItem.kind === 'service' && detailItem.item.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{detailItem.item.description}</p>
                )}
                {detailItem.kind === 'pack' && detailItem.pack.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{detailItem.pack.description}</p>
                )}
                {detailItem.kind === 'material' && detailItem.product.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{detailItem.product.description}</p>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {detailItem.kind === 'service' && (
                    <>
                      {detailItem.item.is_subscription && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
                          <Repeat className="h-3 w-3" />Subscrição
                        </span>
                      )}
                      {detailItem.item.requires_scheduling && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                          <Calendar className="h-3 w-3" />Agendamento
                        </span>
                      )}
                      {detailItem.item.requires_property && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                          <Building2 className="h-3 w-3" />Imóvel
                        </span>
                      )}
                      {detailItem.item.estimated_delivery_days > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                          <Clock className="h-3 w-3" />{detailItem.item.estimated_delivery_days} dias
                        </span>
                      )}
                    </>
                  )}
                  {detailItem.kind === 'material' && (
                    <>
                      {detailItem.product.sku && (
                        <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                          SKU: {detailItem.product.sku}
                        </span>
                      )}
                      {detailItem.product.is_personalizable && (
                        <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                          Personalizável
                        </span>
                      )}
                      {detailItem.product.is_returnable && (
                        <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                          Retornável
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Pack included items */}
                {detailItem.kind === 'pack' && (detailItem.pack.items || []).length > 0 && (
                  <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inclui</p>
                    {detailItem.pack.items!.map((pi) => (
                      <div key={pi.id} className="flex items-center justify-between text-sm">
                        <span>{pi.name}</span>
                        <span className="text-muted-foreground line-through text-xs">{formatCurrency(pi.price)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Addons in detail dialog for services — collapsible */}
                {detailItem.kind === 'service' && (detailItem.item.addons || []).length > 0 && (
                  <div className="rounded-xl border bg-muted/30 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setDetailAddonsOpen(prev => !prev)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Add-ons ({detailItem.item.addons!.length})
                      </p>
                      {detailAddonsOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    {detailAddonsOpen && (
                      <div className="px-3.5 pb-3 space-y-0.5">
                        {detailItem.item.addons!.map((addon) => (
                          <label
                            key={addon.id}
                            className="flex items-center justify-between gap-2 py-1.5 px-1 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={!!addonSelections[addon.id]}
                                onChange={() => toggleAddon(addon.id)}
                                className="rounded border-gray-300 h-3.5 w-3.5 shrink-0"
                              />
                              <span className="text-sm">{addon.name}</span>
                            </div>
                            {addon.price === 0 ? (
                              <span className="text-xs text-emerald-600 font-medium flex items-center gap-0.5 shrink-0">
                                <Gift className="h-3 w-3" />Grátis
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground shrink-0">+{formatCurrency(addon.price)}</span>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Material quantity */}
                {detailItem.kind === 'material' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Quantidade:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateMaterialQty(detailItem.product.id, -1)}
                        disabled={(materialQtys[detailItem.product.id] || 1) <= 1}
                        className="h-7 w-7 rounded-full border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{materialQtys[detailItem.product.id] || 1}</span>
                      <button
                        onClick={() => updateMaterialQty(detailItem.product.id, 1)}
                        className="h-7 w-7 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Sticky add to cart button */}
              <div className="shrink-0 px-6 pb-6 pt-3 border-t bg-background">
                <Button className="w-full rounded-full" onClick={addFromDetailAndClose}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Adicionar ao Carrinho
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Property Service Dialog ─── */}
      <PropertyServiceDialog
        open={showPropertyDialog}
        onOpenChange={setShowPropertyDialog}
        propertyServices={propertyServices}
        onAddToCart={addPropertyBundleToCart}
      />

      {/* ─── Campaign Request Dialog ─── */}
      <CampaignRequestDialog
        open={showCampaignDialog}
        onOpenChange={setShowCampaignDialog}
        onAddToCart={addCampaignToCart}
      />

      {/* Checkout Dialog */}
      {showCheckout && (
        <OrderFormDialog
          open={showCheckout}
          onOpenChange={(open) => {
            if (!open) setShowCheckout(false)
          }}
          cartItems={cart}
          onRemoveItem={removeFromCart}
          onOrderPlaced={() => {
            setCart([])
            setShowCheckout(false)
          }}
        />
      )}
    </div>
  )
}
