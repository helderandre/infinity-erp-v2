'use client'

/**
 * CRM → Análise → Meta tab — espelha a secção standalone /dashboard/analise-meta
 * dentro do shell do CRM, com 3 sub-tabs:
 *
 *   Pedidos   — pipeline kanban dos pedidos de campanha aos parceiros
 *   Campanhas — grelha de campanhas Meta sincronizadas + drill-in inline
 *   Leads     — inbox de leads Meta (pesquisa, "Por atribuir", atribuição manual)
 *
 * Os pedidos vêm primeiro: são o que antecede uma campanha ao vivo.
 */

import { useState } from 'react'

import { CampaignRequestsBoard } from '@/components/analise-meta/campaign-requests-board'
import { MetaLeadsInboxView } from '@/components/analise-meta/meta-leads-inbox-view'
import { MetaCampaignsView } from '@/components/leads/pipeline/meta-campaigns-view'
import { cn } from '@/lib/utils'

type SubTab = 'pedidos' | 'campanhas' | 'leads'

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'campanhas', label: 'Campanhas' },
  { key: 'leads', label: 'Leads' },
]

export function MetaSectionTabs() {
  const [subTab, setSubTab] = useState<SubTab>('pedidos')

  return (
    <div className="space-y-4">
      <nav className="bg-background/50 supports-[backdrop-filter]:bg-background/40 inline-flex rounded-full border border-border/40 p-1 backdrop-blur-xl">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              subTab === t.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {subTab === 'pedidos' && <CampaignRequestsBoard />}
      {subTab === 'campanhas' && <MetaCampaignsView />}
      {subTab === 'leads' && <MetaLeadsInboxView />}
    </div>
  )
}
