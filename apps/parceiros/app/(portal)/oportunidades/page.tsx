'use client'

import { useEffect, useState } from 'react'
// Real CRM negocios board, scoped to deals from the partner's referred leads.
import { KanbanBoard } from '@/components/crm/kanban-board'
import { useUser } from '@/hooks/use-user'
import { formatEUR } from '@/hooks/use-partner-ledger'
import type { PipelineType } from '@/types/leads-crm'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const TABS: { key: PipelineType; label: string }[] = [
  { key: 'comprador', label: 'Compradores' },
  { key: 'vendedor', label: 'Vendedores' },
  { key: 'arrendatario', label: 'Arrendatários' },
  { key: 'arrendador', label: 'Senhorios' },
]

export default function OportunidadesPage() {
  const { user } = useUser()
  // Referred Meta-campaign leads are buyer registrations, so default to the
  // Compradores pipeline (where the referred deals live).
  const [tab, setTab] = useState<PipelineType>('comprador')

  // Potential commission (the partner's referrer slice) per pipeline, summed
  // across all in-pipeline deals. The kanban API returns this as
  // totals.possible_commission when scoped by referrer_consultant_id.
  const [potential, setPotential] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    Promise.all(
      TABS.map((t) =>
        fetch(`/api/crm/kanban/${t.key}?referrer_consultant_id=${user.id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => [t.key, Number(d?.totals?.possible_commission) || 0] as const)
          .catch(() => [t.key, 0] as const),
      ),
    ).then((pairs) => {
      if (!cancelled) setPotential(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const total = potential
    ? Object.values(potential).reduce((s, v) => s + v, 0)
    : null

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-neutral-900 px-6 py-7 text-center sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">As minhas oportunidades</h1>
        <p className="mt-1 text-sm text-white/50">Negócios gerados a partir das suas referências</p>

        {/* Potencial total + breakdown per pipeline — compact */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Potencial total</span>
          <span className="text-xl font-bold tabular-nums text-white">
            {total !== null ? formatEUR(total) : '—'}
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {TABS.map((t) => (
            <div
              key={t.key}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 backdrop-blur-sm"
            >
              <p className="truncate text-[8px] font-medium uppercase tracking-wider text-white/40">{t.label}</p>
              <p className="text-xs font-semibold tabular-nums text-white">
                {potential ? formatEUR(potential[t.key] ?? 0) : '—'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline tabs — only the active one shows its label on mobile. */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                active ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600 ring-1 ring-black/5 hover:bg-neutral-100',
              )}
            >
              <span className={cn(active ? 'inline' : 'hidden sm:inline')}>{t.label}</span>
              <span className={cn(active ? 'hidden' : 'inline sm:hidden')}>{t.label.slice(0, 1)}</span>
            </button>
          )
        })}
      </div>

      {/* referrerConsultantId scopes the board to deals the partner referred;
          read-only with the stripped-down partner card. Only mount once we
          have the user id — otherwise the board fires an initial fetch without
          the referrer filter and flashes an empty/incorrect board on login. */}
      {user?.id ? (
        <KanbanBoard
          pipelineType={tab}
          filters={{ referrerConsultantId: user.id }}
          readOnly
          cardVariant="partner"
        />
      ) : (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="min-w-[230px] w-[230px] flex-shrink-0 space-y-2">
              <div className="h-16 w-full rounded-2xl bg-muted/50 animate-pulse" />
              <div className="h-24 w-full rounded-xl bg-muted/40 animate-pulse" />
              <div className="h-24 w-full rounded-xl bg-muted/40 animate-pulse" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
