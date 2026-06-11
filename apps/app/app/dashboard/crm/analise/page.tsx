'use client'

/**
 * Análise — KPI dashboard + Meta tab + Distribuição tab. Sits below
 * /dashboard/leads ("Base de Dados") in the sidebar. Folds in the
 * Meta and Distribuição surfaces that used to live as sub-tabs on
 * /dashboard/crm/leads.
 *
 * Hero mirrors /dashboard/crm (Oportunidades): centered title + pill tab
 * picker for Análise / Meta / Distribuição. Defaults to Análise.
 */

import { useState } from 'react'
import { BarChart3, Facebook } from 'lucide-react'

import { AnaliseTab } from '@/components/leads/pipeline/analise-tab'
import { MetaSectionTabs } from '@/components/analise-meta/meta-section-tabs'
import { cn } from '@/lib/utils'

type Tab = 'analise' | 'meta'

const TABS: { key: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { key: 'analise', label: 'Análise', Icon: BarChart3 },
  { key: 'meta',    label: 'Meta',    Icon: Facebook },
]

export default function AnalisePage() {
  const [tab, setTab] = useState<Tab>('analise')

  return (
    <div className="space-y-6">
      {/* Hero — black card mirroring Oportunidades. */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 pt-8 pb-5 sm:px-10 sm:pt-10 sm:pb-6 space-y-4">
          {/* Centered title. */}
          <div className="flex items-center justify-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Análise</h2>
          </div>

          {/* Tab picker. */}
          <div className="flex items-center justify-center gap-0.5 sm:gap-1 px-1 py-0.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 w-fit mx-auto">
            {TABS.map(({ key, label, Icon }) => {
              const isActive = tab === key
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  title={label}
                  className={cn(
                    'inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[11px] font-medium transition-colors duration-300',
                    isActive
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className={cn(isActive ? 'inline' : 'hidden sm:inline')}>{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {tab === 'analise' && <AnaliseTab />}
      {tab === 'meta' && <MetaSectionTabs />}
    </div>
  )
}
