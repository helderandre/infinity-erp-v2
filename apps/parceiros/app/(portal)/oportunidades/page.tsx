'use client'

import { useState } from 'react'
// Real CRM negocios board, scoped to deals from the partner's referred leads.
import { KanbanBoard } from '@/components/crm/kanban-board'
import { useUser } from '@/hooks/use-user'
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
  const [tab, setTab] = useState<PipelineType>('vendedor')

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-neutral-900 px-8 py-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">As minhas oportunidades</h1>
        <p className="mt-1 text-sm text-white/50">Negócios gerados a partir das suas referências</p>
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

      {/* referrerConsultantId scopes the board to deals the partner referred; read-only. */}
      <KanbanBoard pipelineType={tab} filters={{ referrerConsultantId: user?.id }} readOnly />
    </div>
  )
}
