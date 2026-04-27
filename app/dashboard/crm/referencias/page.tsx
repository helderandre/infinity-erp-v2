'use client'

/**
 * Referências — same kanban as the Pipeline page but feeds it the
 * referrerConsultantId filter so the user sees négocios whose commission
 * slice they're owed (not the ones they're working themselves).
 *
 * Reuses the existing <KanbanBoard> — no duplicate kanban implementation.
 * The only differences vs. /dashboard/crm are the page chrome and the
 * filter feed.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  ShoppingCart, Store, Key, Building2, Send, ChevronDown, Inbox,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { KanbanBoard } from '@/components/crm/kanban-board'
import { NegocioDetailSheet } from '@/components/crm/negocio-detail-sheet'
import { SummaryBar } from '@/components/crm/summary-bar'
import { ReferenciadasPendingSheet } from '@/components/crm/referenciadas-pending-sheet'
import { useUser } from '@/hooks/use-user'
import type { PipelineType } from '@/types/leads-crm'

const PIPELINE_TYPES: PipelineType[] = ['comprador', 'vendedor', 'arrendatario', 'arrendador']

const PIPELINE_TYPE_LABELS_PLURAL: Record<PipelineType, string> = {
  comprador: 'Compradores',
  vendedor: 'Vendedores',
  arrendatario: 'Arrendatários',
  arrendador: 'Senhorios',
}

const PIPELINE_ICONS: Record<PipelineType, React.ElementType> = {
  comprador: ShoppingCart,
  vendedor: Store,
  arrendatario: Key,
  arrendador: Building2,
}

export default function ReferenciasPage() {
  const { user, loading: userLoading } = useUser()
  const [activeTab, setActiveTab] = useState<PipelineType>('comprador')
  const [openNegocioId, setOpenNegocioId] = useState<string | null>(null)
  const [pendingOpen, setPendingOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  // Lead-entries the current user has referred but that haven't been
  // qualified yet — surfaces the "Tens X por qualificar" pill.
  const fetchPendingCount = useCallback(async () => {
    if (!user?.id) return
    try {
      const params = new URLSearchParams({
        from_consultant_id: user.id,
        status: 'pending',
        per_page: '100',
      })
      const res = await fetch(`/api/crm/referrals?${params}`)
      if (!res.ok) return
      const json = await res.json()
      const count = (json.data ?? []).filter((r: { entry_id: string | null }) => !!r.entry_id).length
      setPendingCount(count)
    } catch {
      // best-effort — pill just doesn't show a count
    }
  }, [user?.id])

  useEffect(() => {
    fetchPendingCount()
  }, [fetchPendingCount])

  if (userLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Hero — mirrors the Pipeline page layout, centered + chevron to swap
          back to Pipeline. */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 pt-8 pb-5 sm:px-10 sm:pt-10 sm:pb-6">
          {/* Top row: "Tens X por qualificar" pill — mirrors the
              "Tens X leads" pill on the Pipeline page. Only renders when
              the user has at least one pending entry-referral. */}
          {pendingCount !== null && pendingCount > 0 && (
            <div className="mb-2 flex justify-center">
              <button
                type="button"
                onClick={() => setPendingOpen(true)}
                className="relative inline-flex items-center gap-1.5 rounded-full bg-white text-neutral-900 px-3.5 py-1.5 text-xs font-semibold shadow-md ring-1 ring-black/5 hover:bg-white/90 transition-colors"
              >
                <Inbox className="h-3.5 w-3.5" />
                Tens {pendingCount} {pendingCount === 1 ? 'referência' : 'referências'} por qualificar
                <span
                  className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-sky-500 ring-2 ring-neutral-900 animate-pulse"
                  aria-label={`${pendingCount} referências por qualificar`}
                />
              </button>
            </div>
          )}

          {(pendingCount === null || pendingCount === 0) && (
            <div className="mb-2 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white/80 px-3 py-1 text-[11px] font-medium">
                <Send className="h-3 w-3" />
                Negócios que referenciaste
              </span>
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Referências
            </h2>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Outras vistas"
                  className="h-7 w-7 rounded-full inline-flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="center"
                sideOffset={6}
                className="w-44 p-1"
              >
                <Link
                  href="/dashboard/crm"
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-foreground/80 hover:bg-muted/60 transition-colors"
                >
                  <span>Pipeline</span>
                </Link>
              </PopoverContent>
            </Popover>
          </div>

          {/* Pipeline-type tabs — same component shape as the Pipeline page. */}
          <div className="mt-4 flex items-center justify-center gap-0.5 sm:gap-1 px-1 py-0.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 w-fit mx-auto">
            {PIPELINE_TYPES.map((type) => {
              const Icon = PIPELINE_ICONS[type]
              const isActive = activeTab === type
              const label = PIPELINE_TYPE_LABELS_PLURAL[type]
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveTab(type)}
                  title={label}
                  className={cn(
                    'inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[11px] font-medium transition-colors duration-300',
                    isActive
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className={cn(isActive ? 'inline' : 'hidden sm:inline')}>
                    {label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Financial KPIs — referrer's slice. The kanban API multiplies
              the commission lines by each card's referral_pct when given
              referrer_consultant_id, so the figures are what the user
              actually stands to receive across all referred deals. */}
          <div className="mt-4 flex justify-center">
            <SummaryBar
              pipelineType={activeTab}
              inHero
              referrerConsultantId={user.id}
            />
          </div>
        </div>
      </div>

      {/* The same kanban — filter swapped + readOnly so the referrer
          can't drag, multi-select, or mutate négocios owned by someone
          else. Every négocio the recipient creates with the referenced
          contacto carries my slice automatically (set at create time by
          resolveInheritedReferralForNegocio). */}
      <KanbanBoard
        pipelineType={activeTab}
        filters={{ referrerConsultantId: user.id }}
        onCardClick={(n) => setOpenNegocioId(n.id)}
        readOnly
      />

      {/* Same détail sheet, locked into read-only — Editar / Eliminar /
          Referenciar are hidden and an "Apenas leitura" pill takes their
          place in the header. */}
      <NegocioDetailSheet
        negocioId={openNegocioId}
        open={!!openNegocioId}
        onOpenChange={(o) => { if (!o) setOpenNegocioId(null) }}
        readOnly
      />

      {/* Pending entry-referrals — leads I sent that aren't yet qualified. */}
      <ReferenciadasPendingSheet
        open={pendingOpen}
        onOpenChange={setPendingOpen}
        consultantId={user.id}
        onChange={fetchPendingCount}
      />
    </div>
  )
}
