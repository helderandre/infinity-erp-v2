'use client'

import { useState } from 'react'
import { CatalogTab } from '@/components/marketing/catalog-tab'
import { PacksTab } from '@/components/marketing/packs-tab'
import { StockShopTab } from '@/components/marketing/stock-tab'
import { ShoppingBag, PackageOpen, Boxes, ArrowLeft, Settings } from 'lucide-react'
import Link from 'next/link'

const TABS = [
  { key: 'catalog', label: 'Catálogo', icon: ShoppingBag },
  { key: 'packs', label: 'Packs', icon: PackageOpen },
  { key: 'stock', label: 'Stock', icon: Boxes },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function GerirLojaPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('catalog')

  return (
    <div>
      {/* ─── Hero Card ─── */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />

        {/* Back button */}
        <Link
          href="/dashboard/marketing/loja"
          className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors duration-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>

        <div className="relative z-10 px-8 pt-14 pb-8 sm:px-10 sm:pt-16 sm:pb-8">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="h-5 w-5 text-neutral-400" />
            <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">
              Administração
            </p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Gerir Loja
          </h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-lg">
            Gestão do catálogo de serviços, packs e stock de materiais.
          </p>
        </div>
      </div>

      {/* ─── Card with tabs inside ─── */}
      <div className="rounded-2xl border shadow-lg bg-card overflow-hidden mt-4">
        {/* Tab navigation inside the card */}
        <div className="px-5 pt-5 pb-4 border-b">
          <div className="flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm overflow-x-auto scrollbar-hide w-fit max-w-[calc(100vw-4rem)]">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                      : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content with generous padding */}
        <div className="p-6 sm:p-8">
          <div key={activeTab} className="animate-in fade-in duration-300">
            {activeTab === 'catalog' && <CatalogTab />}
            {activeTab === 'packs' && <PacksTab />}
            {activeTab === 'stock' && <StockShopTab />}
          </div>
        </div>
      </div>
    </div>
  )
}
