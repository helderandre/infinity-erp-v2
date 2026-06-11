'use client'

/**
 * Leads → Meta tab. Shows the Meta campaigns/ads attributed to the current
 * consultor (assignment rules they own) and the results: leads received and how
 * many entered the CRM. Read-only.
 */

import { useEffect, useState } from 'react'
import { Loader2, Target, Image as ImageIcon, Gift } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatEur } from '@/lib/meta/labels'

interface Item {
  key: string
  scope: 'campaign' | 'ad'
  target_id: string
  name: string | null
  status: string | null
  has_referral: boolean
  referral_pct: number | null
  total_leads: number
  in_crm: number
  assigned_to: string | null
  spend: number | null
  cost_per_lead: number | null
  currency: string | null
}

export function MetaTab() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [totals, setTotals] = useState({ total_leads: 0, in_crm: 0, spend: 0 })
  const [mode, setMode] = useState<'all' | 'mine'>('mine')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/leads/meta-performance')
        const json = await res.json()
        setItems(json.items ?? [])
        setTotals(json.totals ?? { total_leads: 0, in_crm: 0, spend: 0 })
        setMode(json.mode === 'all' ? 'all' : 'mine')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-12 text-center text-sm">
          {mode === 'all' ? (
            <>Ainda não há campanhas Meta sincronizadas.</>
          ) : (
            <>
              Ainda não tem campanhas ou anúncios Meta atribuídos a si.
              <br />
              A gestão atribui campanhas em <strong>Análise Meta</strong> e os leads passam a chegar aqui.
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={mode === 'all' ? 'Campanhas' : 'Campanhas / anúncios'} value={items.length} />
        <Kpi label="Leads recebidos" value={totals.total_leads} />
        <Kpi label="No CRM" value={totals.in_crm} />
        <Kpi label="Gasto total" value={formatEur(totals.spend)} />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            {mode === 'all' ? 'Todas as campanhas Meta' : 'Atribuídos a si'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {items.map((it) => (
              <li key={it.key} className="flex items-center gap-3 p-3">
                <span className="text-muted-foreground shrink-0">
                  {it.scope === 'ad' ? <ImageIcon className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="line-clamp-1 text-sm font-medium">
                      {it.name ?? it.target_id}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
                    <Badge variant="outline" className="text-[10px]">
                      {it.scope === 'ad' ? 'Anúncio' : 'Campanha'}
                    </Badge>
                    {it.assigned_to ? (
                      <span className="text-muted-foreground">Atribuída a {it.assigned_to}</span>
                    ) : mode === 'all' ? (
                      <span className="text-amber-600">Por atribuir</span>
                    ) : null}
                    {it.has_referral && (
                      <span className="text-amber-600 flex items-center gap-1">
                        <Gift className="h-3 w-3" />
                        {it.referral_pct ? `${it.referral_pct}%` : 'referral'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-right">
                  <div>
                    <p className="text-sm font-semibold tabular-nums">{it.total_leads}</p>
                    <p className="text-muted-foreground text-[10px]">leads</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold tabular-nums">{it.in_crm}</p>
                    <p className="text-muted-foreground text-[10px]">no CRM</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold tabular-nums">
                      {it.spend !== null ? formatEur(it.spend, it.currency, { maximumFractionDigits: 0 }) : '—'}
                    </p>
                    <p className="text-muted-foreground text-[10px]">gasto</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold tabular-nums">
                      {it.cost_per_lead !== null ? formatEur(it.cost_per_lead, it.currency) : '—'}
                    </p>
                    <p className="text-muted-foreground text-[10px]">custo/lead</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
