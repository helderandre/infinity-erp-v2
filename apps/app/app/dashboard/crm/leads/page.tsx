'use client'

/**
 * Leads — dedicated top-level page (above Oportunidades). Hosts the inbound
 * pipeline (kanban of lead entries). The old Meta / Distribuição tabs moved
 * out to /dashboard/crm/analise alongside the new "Análise" KPI tab.
 *
 * Hero mirrors the Oportunidades page (black card, centered title, scope
 * toggle, segmented KPI pill):
 *   1. Centered title "Leads"
 *   2. Minhas / Referenciadas scope toggle
 *   3. Novos / Contactados / Qualificados KPIs (segmented pill)
 */

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Sparkles,
  Phone,
  Check,
  XCircle,
  Settings,
  Upload,
} from 'lucide-react'

import { LeadsKanban } from '@/components/leads/pipeline/leads-kanban'
import { LeadsOutcomeSheet, type OutcomeStage } from '@/components/leads/pipeline/leads-outcome-sheet'
import { GestaoLeadsSheet } from '@/components/crm/gestao-leads-sheet'
import { BulkImportEntriesDialog } from '@/components/leads/bulk-import-entries-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/hooks/use-permissions'
import { subscribe } from '@/lib/crm/invalidator'
import { cn } from '@/lib/utils'

type View = 'minhas' | 'referenciadas'

export default function LeadsPipelinePage() {
  const searchParams = useSearchParams()
  const { hasPermission } = usePermissions()
  const canManageLeads = hasPermission('leads_management')

  const [view, setView] = useState<View>('minhas')
  const [counts, setCounts] = useState<{ novo: number; contactado: number; qualificado: number; perdido: number } | null>(null)
  const [gestaoOpen, setGestaoOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [outcomeStage, setOutcomeStage] = useState<OutcomeStage | null>(null)

  // Deep-link: ?gestao=por_atribuir|overdue|consultor auto-opens the
  // management sheet (preserves the old /crm/gestora?tab= push targets).
  const gestaoParam = searchParams.get('gestao')
  useEffect(() => {
    if (gestaoParam && canManageLeads) setGestaoOpen(true)
  }, [gestaoParam, canManageLeads])

  const gestaoInitialTab =
    gestaoParam === 'overdue' || gestaoParam === 'consultor'
      ? gestaoParam
      : 'por_atribuir'

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

  const kpiStats: {
    Icon: typeof Sparkles
    label: string
    mobileLabel: string
    value: number | null
    stage: OutcomeStage | null
  }[] = [
    { Icon: Sparkles, label: 'Novos', mobileLabel: 'Novos', value: counts?.novo ?? null, stage: null },
    { Icon: Phone, label: 'Contactados', mobileLabel: 'Contact.', value: counts?.contactado ?? null, stage: null },
    { Icon: Check, label: 'Qualificados', mobileLabel: 'Qualif.', value: counts?.qualificado ?? null, stage: 'qualificado' },
    { Icon: XCircle, label: 'Perdidos', mobileLabel: 'Perdid.', value: counts?.perdido ?? null, stage: 'perdido' },
  ]

  return (
    <div className="space-y-6">
      {/* Hero — black card mirroring /dashboard/crm (Oportunidades). */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />

        {/* Top-right actions — Importar + Gestão de Leads (management only). */}
        {canManageLeads && (
          <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
            <Button
              size="sm"
              className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
            <Button
              size="sm"
              className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
              onClick={() => setGestaoOpen(true)}
              aria-label="Gestão de Leads"
            >
              <Settings className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Gestão</span>
            </Button>
          </div>
        )}
        <div className="relative z-10 px-8 pt-8 pb-5 sm:px-10 sm:pt-10 sm:pb-6 space-y-4">
          {/* 1. Centered title. */}
          <div className="flex items-center justify-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Leads</h2>
          </div>

          {/* 2. Minhas / Referenciadas scope toggle. */}
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

          {/* 3. KPI row — segmented pill, same design as Oportunidades SummaryBar. */}
          <div className="flex justify-center">
            <div className="inline-flex items-stretch rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden">
              {kpiStats.map(({ Icon, label, mobileLabel, value, stage }, idx) => {
                const base = cn(
                  'flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 px-4 py-2 min-w-[78px] md:min-w-0',
                  idx > 0 && 'border-l border-white/10',
                )
                const inner = (
                  <>
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
                  </>
                )
                return stage ? (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setOutcomeStage(stage)}
                    className={cn(base, 'cursor-pointer transition-colors hover:bg-white/10')}
                    aria-label={`Ver leads ${label.toLowerCase()}`}
                  >
                    {inner}
                  </button>
                ) : (
                  <div key={label} className={base}>
                    {inner}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <LeadsKanban view={view} onViewChange={setView} />

      {/* Qualificados / Perdidos — clicar no contador abre um Sheet com os cards. */}
      <LeadsOutcomeSheet
        open={!!outcomeStage}
        onOpenChange={(o) => { if (!o) setOutcomeStage(null) }}
        stage={outcomeStage ?? 'qualificado'}
        scope={view}
      />

      {/* Gestão de Leads — management sheet (replaces the old /crm/gestora page). */}
      {canManageLeads && (
        <>
          <GestaoLeadsSheet
            open={gestaoOpen}
            onOpenChange={setGestaoOpen}
            initialTab={gestaoInitialTab}
          />
          <BulkImportEntriesDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            onComplete={() => loadCounts()}
          />
        </>
      )}
    </div>
  )
}
