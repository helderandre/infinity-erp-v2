'use client'

/**
 * Leads — dedicated top-level page (above Oportunidades). Three tabs:
 *   1. Pipeline      — kanban of lead entries by lifecycle status
 *   2. Meta          — the consultor's attributed campaigns/ads + results
 *   3. Distribuição  — where leads come from + lifecycle breakdown
 *
 * Hero mirrors the Oportunidades page (black card, centered title, pill tab
 * picker, segmented-pill KPI row). Order inside the hero:
 *   1. Pipeline / Meta / Distribuição picker (the equivalent of Compradores etc.)
 *   2. Centered title "Leads"
 *   3. Minhas / Referenciadas scope toggle
 *   4. Novos / Contactados / Qualificados KPIs (segmented pill)
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Facebook,
  PieChart,
  Target,
  Sparkles,
  Phone,
  Check,
} from 'lucide-react'

import { LeadsKanban } from '@/components/leads/pipeline/leads-kanban'
import { MetaTab } from '@/components/leads/pipeline/meta-tab'
import { DistribuicaoTab } from '@/components/leads/pipeline/distribuicao-tab'
import { Skeleton } from '@/components/ui/skeleton'
import { subscribe } from '@/lib/crm/invalidator'
import { cn } from '@/lib/utils'

type View = 'minhas' | 'referenciadas'
type SubTab = 'pipeline' | 'meta' | 'distribuicao'

const SUB_TABS: { key: SubTab; label: string; Icon: typeof Target }[] = [
  { key: 'pipeline', label: 'Pipeline', Icon: Target },
  { key: 'meta', label: 'Meta', Icon: Facebook },
  { key: 'distribuicao', label: 'Distribuição', Icon: PieChart },
]

export default function LeadsPipelinePage() {
  const [subTab, setSubTab] = useState<SubTab>('pipeline')
  const [view, setView] = useState<View>('minhas')
  const [counts, setCounts] = useState<{ novo: number; contactado: number; qualificado: number } | null>(null)

  const loadCounts = useCallback(async () => {
    try {
      const url =
        view === 'referenciadas'
          ? '/api/lead-entries/status-counts?scope=referred'
          : '/api/lead-entries/status-counts'
      const res = await fetch(url)
      if (!res.ok) return
      const json = await res.json()
      if (json?.counts) setCounts(json.counts)
    } catch {}
  }, [view])

  useEffect(() => { loadCounts() }, [loadCounts])
  // Re-fetch counts when entry status / referral state changes elsewhere
  // (e.g. drag in the kanban moves an entry → counts shift).
  useEffect(() => {
    const off1 = subscribe('lead-entries', loadCounts)
    const off2 = subscribe('referrals', loadCounts)
    return () => { off1(); off2() }
  }, [loadCounts])

  const kpiStats = [
    { Icon: Sparkles, label: 'Novos', mobileLabel: 'Novos', value: counts?.novo ?? null },
    { Icon: Phone, label: 'Contactados', mobileLabel: 'Contact.', value: counts?.contactado ?? null },
    { Icon: Check, label: 'Qualificados', mobileLabel: 'Qualif.', value: counts?.qualificado ?? null },
  ]

  return (
    <div className="space-y-6">
      {/* Hero — black card mirroring /dashboard/crm (Oportunidades). */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 pt-6 pb-5 sm:px-10 sm:pt-8 sm:pb-6 space-y-4">
          {/* 1. Pipeline / Meta / Distribuição — primary pill tabs. */}
          <div className="flex items-center justify-center gap-0.5 sm:gap-1 px-1 py-0.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 w-fit mx-auto">
            {SUB_TABS.map(({ key, label, Icon }) => {
              const isActive = subTab === key
              return (
                <button
                  key={key}
                  onClick={() => setSubTab(key)}
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

          {/* 2. Centered title. */}
          <div className="flex items-center justify-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Leads</h2>
          </div>

          {/* 3. Minhas / Referenciadas scope toggle. */}
          <div className="flex items-center justify-center gap-0.5 px-1 py-0.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 w-fit mx-auto">
            {(['minhas', 'referenciadas'] as const).map((v) => {
              const isActive = view === v
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 sm:px-4 py-1 rounded-full text-[11px] sm:text-xs font-medium transition-colors duration-300',
                    isActive
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10',
                  )}
                >
                  {v === 'minhas' ? 'Minhas' : 'Referenciadas'}
                </button>
              )
            })}
          </div>

          {/* 4. KPI row — segmented pill, same design as Oportunidades SummaryBar. */}
          <div className="flex justify-center">
            <div className="inline-flex items-stretch rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden">
              {kpiStats.map(({ Icon, label, mobileLabel, value }, idx) => (
                <div
                  key={label}
                  className={cn(
                    'flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 px-4 py-2 min-w-[78px] md:min-w-0',
                    idx > 0 && 'border-l border-white/10',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="hidden md:block h-3 w-3 text-white/50" />
                    <span className="text-[8px] md:text-[10px] uppercase tracking-wider font-medium text-white/50 whitespace-nowrap leading-none">
                      <span className="md:hidden">{mobileLabel}</span>
                      <span className="hidden md:inline">{label}</span>
                    </span>
                  </div>
                  {value === null ? (
                    <Skeleton className="h-3.5 w-10 bg-white/10" />
                  ) : (
                    <span className="text-sm font-bold text-white tabular-nums whitespace-nowrap leading-tight">
                      {value}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {subTab === 'pipeline' && <LeadsKanban view={view} onViewChange={setView} />}
      {subTab === 'meta' && <MetaTab />}
      {subTab === 'distribuicao' && <DistribuicaoTab />}
    </div>
  )
}
