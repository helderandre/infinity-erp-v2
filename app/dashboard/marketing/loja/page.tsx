'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ShopTab } from '@/components/marketing/shop-tab'
import { OrdersTab } from '@/components/marketing/orders-tab'
import { GestaoAnalyticsTab } from '@/components/marketing/gestao-analytics-tab'
import { ArrowLeft, ClipboardList, BarChart3 } from 'lucide-react'

type OrdersView = 'orders' | 'analytics'

export default function MarketingLojaPage() {
  const [activeView, setActiveView] = useState<'shop' | 'orders'>('shop')
  const [ordersTab, setOrdersTab] = useState<OrdersView>('orders')

  return (
    <div>
      {activeView === 'shop' ? (
        <ShopTab onSwitchToOrders={() => setActiveView('orders')} showGerirLoja />
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-6 duration-400">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <Button variant="ghost" size="sm" onClick={() => setActiveView('shop')} className="gap-1.5 rounded-full">
              <ArrowLeft className="h-4 w-4" />
              Voltar à Loja
            </Button>

            {/* Tab pills */}
            <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-muted/30 backdrop-blur-sm">
              <button
                onClick={() => setOrdersTab('orders')}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-300 ${
                  ordersTab === 'orders'
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Encomendas
              </button>
              <button
                onClick={() => setOrdersTab('analytics')}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-300 ${
                  ordersTab === 'analytics'
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Análise
              </button>
            </div>
          </div>

          {/* Content */}
          <div key={ordersTab} className="animate-in fade-in duration-300">
            {ordersTab === 'orders' && <OrdersTab />}
            {ordersTab === 'analytics' && <GestaoAnalyticsTab />}
          </div>
        </div>
      )}
    </div>
  )
}
