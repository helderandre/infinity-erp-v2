'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ShopTab } from '@/components/marketing/shop-tab'
import { OrdersTab } from '@/components/marketing/orders-tab'
import { GestaoAnalyticsTab } from '@/components/marketing/gestao-analytics-tab'
import { GestaoCalendarTab } from '@/components/marketing/gestao-calendar-tab'
import { ArtigosTab } from '@/components/marketing/artigos-tab'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Store, ClipboardList, BarChart3, ShoppingCart, Settings,
  CalendarDays, Layers,
} from 'lucide-react'

type View = 'shop' | 'orders'
type OrdersView = 'calendar' | 'articles' | 'orders' | 'analytics'

export default function MarketingLojaPage() {
  const router = useRouter()
  const [view, setView] = useState<View>('shop')
  const [ordersTab, setOrdersTab] = useState<OrdersView>('articles')
  const [cartCount, setCartCount] = useState(0)
  const [showCartWarning, setShowCartWarning] = useState(false)
  const pendingNavRef = useRef<string | null>(null)

  const handleCartCountChange = useCallback((count: number) => {
    setCartCount(count)
  }, [])

  const cartCountRef = useRef(cartCount)
  useEffect(() => { cartCountRef.current = cartCount }, [cartCount])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (cartCountRef.current > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cartCountRef.current <= 0) return
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return
      if (href.startsWith('/dashboard/marketing/loja')) return
      e.preventDefault()
      e.stopPropagation()
      pendingNavRef.current = href
      setShowCartWarning(true)
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [])

  const switchToOrders = () => {
    if (cartCount > 0) {
      pendingNavRef.current = '__orders'
      setShowCartWarning(true)
    } else {
      setView('orders')
    }
  }

  const confirmLeaveShop = () => {
    setShowCartWarning(false)
    const pendingNav = pendingNavRef.current
    pendingNavRef.current = null
    if (pendingNav === '__orders') {
      setView('orders')
    } else if (pendingNav) {
      router.push(pendingNav)
    }
  }

  const ORDERS_TABS: { key: OrdersView; label: string; icon: React.ElementType }[] = [
    { key: 'calendar', label: 'Calendário', icon: CalendarDays },
    { key: 'articles', label: 'Artigos', icon: Layers },
    { key: 'orders', label: 'Encomendas', icon: ClipboardList },
    { key: 'analytics', label: 'Análise', icon: BarChart3 },
  ]

  return (
    <div>
      {/* ═══════════ SHOP VIEW ═══════════ */}
      {view === 'shop' && (
        <div className="animate-in fade-in duration-400">
          <ShopTab
            showHero={false}
            showGerirLoja={false}
            onBack={undefined}
            onCartCountChange={handleCartCountChange}
            headerAction={
              <button
                onClick={switchToOrders}
                title="Os Meus Pedidos"
                className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-border/50 bg-muted/40 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all shadow-sm"
              >
                <ClipboardList className="h-4 w-4" />
              </button>
            }
          />
        </div>
      )}

      {/* ═══════════ ORDERS VIEW ═══════════ */}
      {view === 'orders' && (
        <div className="animate-in fade-in duration-400">
          <div className="rounded-2xl border shadow-lg bg-card overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 7rem)' }}>
            {/* Header — toggle + tabs */}
            <div className="flex items-center gap-2 p-4 border-b flex-wrap shrink-0">
              <button
                onClick={() => setView('shop')}
                title="Loja"
                className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-border/50 bg-muted/40 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all shadow-sm"
              >
                <Store className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm overflow-x-auto scrollbar-hide w-fit max-w-[calc(100vw-4rem)]">
                {ORDERS_TABS.map((t) => {
                  const Icon = t.icon
                  return (
                    <button
                      key={t.key}
                      onClick={() => setOrdersTab(t.key)}
                      className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                        ordersTab === t.key
                          ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Content — scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              <div key={ordersTab} className="animate-in fade-in duration-300">
                {ordersTab === 'calendar' && <GestaoCalendarTab />}
                {ordersTab === 'articles' && <ArtigosTab />}
                {ordersTab === 'orders' && <OrdersTab />}
                {ordersTab === 'analytics' && <GestaoAnalyticsTab />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ CART WARNING DIALOG ═══════════ */}
      <AlertDialog open={showCartWarning} onOpenChange={setShowCartWarning}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Carrinho com itens
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem {cartCount} {cartCount === 1 ? 'item' : 'itens'} no carrinho. Se sair da loja, o carrinho será perdido. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" onClick={() => { pendingNavRef.current = null }}>
              Ficar na Loja
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeaveShop} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sair e Perder Carrinho
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
