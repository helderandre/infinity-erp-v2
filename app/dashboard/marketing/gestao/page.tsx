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
  const [activeTab, setActiveTab] = useState<TabKey>('calendar')

  return (
    <div>
      {/* ─── Hero Card ─── */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="h-5 w-5 text-neutral-400" />
            <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">
              Gestão
            </p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Os Meus Pedidos
          </h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            Calendário, serviços activos, materiais pendentes e histórico completo.
          </p>
        </div>
      </div>

      {/* ─── Pill Toggle Navigation ─── */}
      <div className="mt-6">
        <div className="inline-flex items-center gap-2 p-1 rounded-full bg-muted/30 backdrop-blur-sm overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap
                  transition-colors duration-300
                  ${isActive
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="mt-6 pb-6">
        <div key={activeTab} className="animate-in fade-in duration-300">
          {activeTab === 'calendar' && <GestaoCalendarTab />}
          {activeTab === 'active-services' && <GestaoActiveServicesTab />}
          {activeTab === 'materials' && <GestaoMaterialsTab />}
          {activeTab === 'history' && <GestaoHistoryTab />}
        </div>
      </div>
    </div>
  )
}
