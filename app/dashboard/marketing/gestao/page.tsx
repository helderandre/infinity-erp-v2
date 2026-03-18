'use client'

import { useState } from 'react'
import { GestaoCalendarTab } from '@/components/marketing/gestao-calendar-tab'
import { GestaoActiveServicesTab } from '@/components/marketing/gestao-active-services-tab'
import { GestaoMaterialsTab } from '@/components/marketing/gestao-materials-tab'
import { GestaoHistoryTab } from '@/components/marketing/gestao-history-tab'
import { CalendarDays, Zap, Package, Clock, ShoppingBag } from 'lucide-react'

const TABS = [
  { key: 'calendar', label: 'Calendário', icon: CalendarDays },
  { key: 'active-services', label: 'Serviços Activos', icon: Zap },
  { key: 'materials', label: 'Materiais Pendentes', icon: Package },
  { key: 'history', label: 'Histórico', icon: Clock },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function MarketingGestaoPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('active-services')

  return (
    <div>
      {/* ─── Hero Card ─── */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-8 sm:px-10 sm:py-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Os Meus Pedidos
          </h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            Serviços activos, materiais pendentes e histórico completo.
          </p>
        </div>
      </div>

      {/* ─── Card with tabs inside ─── */}
      <div className="rounded-2xl border shadow-lg bg-card overflow-hidden flex flex-col mt-4" style={{ height: 'calc(100vh - 14rem)' }}>
        {/* Tab navigation inside the card header */}
        <div className="flex items-center gap-2 p-4 border-b shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm overflow-x-auto scrollbar-hide w-fit max-w-[calc(100vw-4rem)]">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                    isActive
                      ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          <div key={activeTab} className="animate-in fade-in duration-300">
            {activeTab === 'calendar' && <GestaoCalendarTab />}
            {activeTab === 'active-services' && <GestaoActiveServicesTab />}
            {activeTab === 'materials' && <GestaoMaterialsTab />}
            {activeTab === 'history' && <GestaoHistoryTab />}
          </div>
        </div>
      </div>
    </div>
  )
}
