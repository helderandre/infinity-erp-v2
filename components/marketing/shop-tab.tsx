'use client'

import { useState, useMemo } from 'react'
import { useMarketingCatalog } from '@/hooks/use-marketing-catalog'
import { useMarketingPacks } from '@/hooks/use-marketing-packs'
import { MARKETING_CATEGORIES } from '@/lib/constants'
import { formatCurrency } from '@/lib/constants'
import type { MarketingCatalogItem, MarketingCategory, MarketingCatalogAddon, MarketingPack } from '@/types/marketing'
import { OrderFormDialog } from './order-form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Camera, Video, Palette, Package, Megaphone, Share2, MoreHorizontal,
  Search, Calendar, Building2, Clock, ShoppingCart, ChevronDown, ChevronUp,
  Repeat, Gift, X, Plus
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

type CartItem = CartServiceItem | CartPackItem

function cartItemKey(item: CartItem): string {
  if (item.type === 'service') {
    const addonIds = item.selectedAddons.map(a => a.id).sort().join(',')
    return `svc-${item.service.id}-${addonIds}`
  }
  return `pack-${item.pack.id}`
}

function cartItemPrice(item: CartItem): number {
  if (item.type === 'service') {
    return item.service.price + item.selectedAddons.reduce((s, a) => s + a.price, 0)
  }
  return item.pack.price
}

function cartItemName(item: CartItem): string {
  return item.type === 'service' ? item.service.name : item.pack.name
}

export function ShopTab() {
  const { items, loading, filters, setFilters } = useMarketingCatalog()
  const { packs, loading: packsLoading } = useMarketingPacks()

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCheckout, setShowCheckout] = useState(false)

  // Per-card addon selection state
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addonSelections, setAddonSelections] = useState<Record<string, boolean>>({})

  const activeItems = items.filter(i => i.is_active)
  const activePacks = (packs || []).filter((p: MarketingPack) => p.is_active)

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + cartItemPrice(item), 0), [cart])
  const cartCount = cart.length

  const toggleAddon = (addonId: string) => {
    setAddonSelections(prev => ({ ...prev, [addonId]: !prev[addonId] }))
  }

  const addServiceToCart = (item: MarketingCatalogItem) => {
    const selectedAddons = (item.addons || []).filter(a => addonSelections[a.id])
    const cartItem: CartServiceItem = { type: 'service', service: item, selectedAddons }
    setCart(prev => [...prev, cartItem])
    // Reset addon selections for this service
    const addonIds = (item.addons || []).map(a => a.id)
    setAddonSelections(prev => {
      const next = { ...prev }
      addonIds.forEach(id => delete next[id])
      return next
    })
    setExpandedId(null)
  }

  const addPackToCart = (pack: MarketingPack) => {
    setCart(prev => [...prev, { type: 'pack', pack }])
  }

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  const clearCart = () => {
    setCart([])
  }

  const calcCardTotal = (item: MarketingCatalogItem) => {
    const addonsTotal = (item.addons || [])
      .filter(a => addonSelections[a.id])
      .reduce((sum, a) => sum + a.price, 0)
    return item.price + addonsTotal
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar serviços..."
            className="pl-9"
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <Select
          value={filters.category || 'all'}
          onValueChange={(v) => setFilters({ ...filters, category: v === 'all' ? '' : v as MarketingCategory })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {Object.entries(MARKETING_CATEGORIES).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products */}
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Serviços Individuais</TabsTrigger>
          <TabsTrigger value="packs">Packs</TabsTrigger>
        </TabsList>

            {/* Individual Services */}
            <TabsContent value="services">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
                </div>
              ) : activeItems.length === 0 ? (
                <EmptyState
                  icon={ShoppingCart}
                  title="Nenhum serviço disponível"
                  description="Não existem serviços activos no catálogo."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeItems.map((item) => {
                    const Icon = CATEGORY_ICONS[item.category] || Package
                    const hasAddons = (item.addons || []).length > 0
                    const isExpanded = expandedId === item.id
                    const cardTotal = calcCardTotal(item)
                    const hasSelectedAddons = hasAddons && (item.addons || []).some(a => addonSelections[a.id])

                    return (
                      <Card key={item.id} className="flex flex-col overflow-hidden">
                        {/* Thumbnail */}
                        {item.thumbnail ? (
                          <div className="relative h-44 bg-muted">
                            <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
                            <div className="absolute top-2 left-2">
                              <Badge className="text-xs bg-black/60 text-white border-0 backdrop-blur-sm">
                                {MARKETING_CATEGORIES[item.category]}
                              </Badge>
                            </div>
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-md">
                              <p className="text-lg font-bold leading-tight">{formatCurrency(item.price)}</p>
                              {item.is_subscription && <span className="text-[10px] opacity-80">/mês</span>}
                            </div>
                          </div>
                        ) : (
                          <div className="relative h-32 bg-gradient-to-br from-primary/5 to-primary/15 flex items-center justify-center">
                            <Icon className="h-12 w-12 text-primary/30" />
                            <div className="absolute top-2 left-2">
                              <Badge variant="outline" className="text-xs">{MARKETING_CATEGORIES[item.category]}</Badge>
                            </div>
                            <div className="absolute top-2 right-2">
                              <p className="text-lg font-bold">{formatCurrency(item.price)}</p>
                              {item.is_subscription && <span className="text-xs text-muted-foreground">/mês</span>}
                            </div>
                          </div>
                        )}

                        <CardHeader className="pb-3 pt-4">
                          <CardTitle className="text-base">{item.name}</CardTitle>
                          <CardDescription className="text-sm line-clamp-2">{item.description}</CardDescription>
                        </CardHeader>

                        <CardContent className="flex-1 pb-3">
                          {/* Flags */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {item.requires_scheduling && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" /><span>Agendamento</span>
                              </div>
                            )}
                            {item.requires_property && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Building2 className="h-3.5 w-3.5" /><span>Imóvel</span>
                              </div>
                            )}
                            {item.estimated_delivery_days > 0 && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" /><span>{item.estimated_delivery_days} dias</span>
                              </div>
                            )}
                            {item.is_subscription && (
                              <div className="flex items-center gap-1 text-xs text-blue-600">
                                <Repeat className="h-3.5 w-3.5" /><span>Subscrição</span>
                              </div>
                            )}
                          </div>

                          {/* Add-ons */}
                          {hasAddons && (
                            <div className="border rounded-lg">
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 rounded-lg transition-colors"
                              >
                                <span>Add-ons ({item.addons!.length})</span>
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                              {isExpanded && (
                                <div className="px-3 pb-3 space-y-2">
                                  {item.addons!.map((addon) => (
                                    <label
                                      key={addon.id}
                                      className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={!!addonSelections[addon.id]}
                                          onChange={() => toggleAddon(addon.id)}
                                          className="rounded border-gray-300"
                                        />
                                        <span className="text-sm">{addon.name}</span>
                                      </div>
                                      {addon.price === 0 ? (
                                        <Badge variant="secondary" className="text-xs gap-1">
                                          <Gift className="h-3 w-3" />Incluído
                                        </Badge>
                                      ) : (
                                        <span className="text-sm font-medium text-muted-foreground">+{formatCurrency(addon.price)}</span>
                                      )}
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>

                        <CardFooter className="pt-0">
                          <div className="w-full space-y-2">
                            {hasSelectedAddons && (
                              <div className="flex justify-between text-sm px-1">
                                <span className="text-muted-foreground">Total com add-ons:</span>
                                <span className="font-bold">{formatCurrency(cardTotal)}</span>
                              </div>
                            )}
                            <Button className="w-full" onClick={() => addServiceToCart(item)}>
                              <Plus className="mr-2 h-4 w-4" />
                              Adicionar ao Carrinho
                            </Button>
                          </div>
                        </CardFooter>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* Packs */}
            <TabsContent value="packs">
              {packsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
                </div>
              ) : activePacks.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="Nenhum pack disponível"
                  description="Não existem packs activos no momento."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activePacks.map((pack: MarketingPack) => {
                    const itemsTotal = (pack.items || []).reduce((sum, i) => sum + i.price, 0)
                    const savings = itemsTotal - pack.price

                    return (
                      <Card key={pack.id} className="flex flex-col overflow-hidden">
                        {pack.thumbnail ? (
                          <div className="relative h-44 bg-muted">
                            <img src={pack.thumbnail} alt={pack.name} className="w-full h-full object-cover" />
                            <div className="absolute top-2 left-2">
                              <Badge className="text-xs bg-emerald-600 text-white border-0">Pack</Badge>
                            </div>
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-md">
                              <p className="text-lg font-bold leading-tight">{formatCurrency(pack.price)}</p>
                              {savings > 0 && <p className="text-[10px] text-emerald-300">Poupa {formatCurrency(savings)}</p>}
                            </div>
                          </div>
                        ) : (
                          <div className="relative h-32 bg-gradient-to-br from-emerald-500/5 to-emerald-500/15 flex items-center justify-center">
                            <Package className="h-12 w-12 text-emerald-500/30" />
                            <div className="absolute top-2 left-2">
                              <Badge className="text-xs bg-emerald-600 text-white border-0">Pack</Badge>
                            </div>
                            <div className="absolute top-2 right-2">
                              <p className="text-lg font-bold">{formatCurrency(pack.price)}</p>
                              {savings > 0 && <p className="text-xs text-emerald-600 font-medium">Poupa {formatCurrency(savings)}</p>}
                            </div>
                          </div>
                        )}

                        <CardHeader className="pt-4">
                          <CardTitle className="text-base">{pack.name}</CardTitle>
                          <CardDescription className="text-sm line-clamp-2">{pack.description}</CardDescription>
                        </CardHeader>

                        <CardContent className="flex-1">
                          {(pack.items || []).length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Inclui:</p>
                              {pack.items!.map((item) => (
                                <div key={item.id} className="flex items-center justify-between text-sm">
                                  <span>{item.name}</span>
                                  <span className="text-muted-foreground line-through text-xs">{formatCurrency(item.price)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>

                        <CardFooter>
                          <Button className="w-full" onClick={() => addPackToCart(pack)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar ao Carrinho
                          </Button>
                        </CardFooter>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>
      </Tabs>

      {/* Spacer so fixed bar doesn't cover content */}
      {cartCount > 0 && <div className="h-16" />}

      {/* Fixed Cart Bottom Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-4 px-6 py-3 max-w-screen-2xl mx-auto">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <span className="font-medium text-sm">
                  {cartCount} {cartCount === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <Separator orientation="vertical" className="h-5" />
              <TooltipProvider>
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {cart.map((cartItem, idx) => (
                    <Tooltip key={idx}>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-xs gap-1 pr-1 cursor-default">
                          {cartItemName(cartItem)}
                          {cartItem.type === 'pack' && <span className="text-[10px] opacity-60">Pack</span>}
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
                            {cartItem.service.requires_scheduling && (
                              <p className="text-[10px] opacity-60 flex items-center gap-1"><Calendar className="h-3 w-3" /> Requer agendamento</p>
                            )}
                            {cartItem.service.requires_property && (
                              <p className="text-[10px] opacity-60 flex items-center gap-1"><Building2 className="h-3 w-3" /> Requer imóvel</p>
                            )}
                            {cartItem.service.estimated_delivery_days > 0 && (
                              <p className="text-[10px] opacity-60 flex items-center gap-1"><Clock className="h-3 w-3" /> Entrega em {cartItem.service.estimated_delivery_days} dias</p>
                            )}
                          </>
                        ) : (
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
                        )}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-lg font-bold">{formatCurrency(cartTotal)}</span>
              <Button onClick={() => setShowCheckout(true)}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Finalizar Pedido
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Dialog */}
      {showCheckout && (
        <OrderFormDialog
          open={showCheckout}
          onOpenChange={(open) => {
            if (!open) setShowCheckout(false)
          }}
          cartItems={cart}
          onOrderPlaced={() => {
            setCart([])
            setShowCheckout(false)
          }}
        />
      )}
    </div>
  )
}
