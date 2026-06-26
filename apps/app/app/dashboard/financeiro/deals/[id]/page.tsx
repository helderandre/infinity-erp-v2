'use client'

import { useParams } from 'next/navigation'
import { useSmartBack } from '@/hooks/use-previous-pathname'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Briefcase, Building2 } from 'lucide-react'
import { useDealBundle } from '@/hooks/use-deal-bundle'
import { DealDetailTabs } from '@/components/negocios/detail/deal-detail-tabs'
import type { DealScenario } from '@/types/deal'
import { DEAL_SCENARIOS, DEAL_STATUSES } from '@/types/deal'
import { cn } from '@/lib/utils'

const SCENARIO_COLORS: Record<DealScenario, string> = {
  pleno: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30 dark:text-emerald-300',
  comprador_externo: 'bg-blue-500/15 text-blue-700 border-blue-400/30 dark:text-blue-300',
  pleno_agencia: 'bg-indigo-500/15 text-indigo-700 border-indigo-400/30 dark:text-indigo-300',
  angariacao_externa: 'bg-amber-500/15 text-amber-700 border-amber-400/30 dark:text-amber-300',
}

const STATUS_DOTS: Record<string, string> = {
  draft: 'bg-slate-400',
  submitted: 'bg-amber-500',
  active: 'bg-blue-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-500',
}

/**
 * Deal detail inside the Financeiro module. Keeps its own header + the
 * Financeiro sidebar section, but renders the SAME rich tab set as
 * /dashboard/negocios/[id] via the shared `<DealDetailTabs>`.
 */
export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const goBack = useSmartBack('/dashboard/negocios')
  const { bundle, isLoading, error } = useDealBundle(id)

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !bundle || !bundle.deal) {
    return (
      <div className="space-y-5">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1.5 bg-muted/50 hover:bg-muted text-foreground px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
        <div className="rounded-xl border bg-card shadow-sm p-12 text-center">
          <h2 className="text-lg font-semibold">Negócio não encontrado</h2>
          <p className="text-sm text-muted-foreground mt-1">
            O negócio que procura não existe ou foi eliminado.
          </p>
        </div>
      </div>
    )
  }

  const { deal, property, consultant } = bundle
  const scenario = (deal.deal_type ?? 'pleno') as DealScenario
  const scenarioInfo = DEAL_SCENARIOS[scenario]
  const statusKey = deal.status ?? 'draft'
  const statusInfo = DEAL_STATUSES[statusKey as keyof typeof DEAL_STATUSES] ?? DEAL_STATUSES.draft

  return (
    <div className="space-y-5">
      {/* ═══ Light toolbar ═══ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1.5 bg-muted/50 hover:bg-muted text-foreground px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
      </div>

      {/* ═══ Header card ═══ */}
      <div className="rounded-xl border bg-card shadow-sm p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">
                {property?.title ?? (deal.external_property_link ? 'Imóvel externo' : 'Sem imóvel')}
              </h1>
              {property?.external_ref && (
                <Badge variant="outline" className="rounded-full text-[10px] font-mono">
                  {property.external_ref}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mt-1.5">
              {property && (
                <>
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{property.city ?? '—'}</span>
                  <span>·</span>
                </>
              )}
              <span>{consultant?.commercial_name ?? '—'}</span>
              {deal.deal_date && (
                <>
                  <span>·</span>
                  <span>{new Date(deal.deal_date).toLocaleDateString('pt-PT')}</span>
                </>
              )}
              {deal.reference && (
                <>
                  <span>·</span>
                  <span>Ref {deal.reference}</span>
                </>
              )}
              {deal.pv_number && (
                <>
                  <span>·</span>
                  <span>PV {deal.pv_number}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full whitespace-nowrap border',
                SCENARIO_COLORS[scenario] || 'bg-muted text-muted-foreground border-border'
              )}
            >
              {scenarioInfo?.label ?? deal.deal_type}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium',
                statusInfo.color
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOTS[statusKey])} />
              {statusInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ Rich tab set (shared with /dashboard/negocios/[id]) ═══ */}
      <DealDetailTabs bundle={bundle} />
    </div>
  )
}
