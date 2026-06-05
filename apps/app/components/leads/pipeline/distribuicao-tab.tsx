'use client'

/**
 * Leads → Distribuição tab. Where leads come from (source breakdown) + a
 * lifecycle-status breakdown. Helps the consultor understand the mix
 * (Meta vs referência vs website…).
 */

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ENTRY_SOURCE_LABELS } from '@/lib/constants-leads-crm'

interface Distribution {
  total: number
  with_referral: number
  by_source: Record<string, number>
  by_status: Record<string, number>
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Novo',
  seen: 'Visto',
  processing: 'Contactado',
  converted: 'Qualificado',
  discarded: 'Perdido',
}

const STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  seen: '#3b82f6',
  processing: '#f59e0b',
  converted: '#10b981',
  discarded: '#ef4444',
}

const SOURCE_COLOR = '#6366f1'

export function DistribuicaoTab() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Distribution | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/leads/distribution')
        setData(await res.json())
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

  if (!data || data.total === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-12 text-center text-sm">
          Ainda não há leads para analisar.
        </CardContent>
      </Card>
    )
  }

  const sourceRows = Object.entries(data.by_source).sort((a, b) => b[1] - a[1])
  const statusRows = Object.entries(data.by_status).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Total de leads" value={data.total} />
        <Kpi label="Com referência" value={data.with_referral} />
        <Kpi
          label="Taxa de qualificação"
          value={`${data.total ? Math.round(((data.by_status.converted ?? 0) / data.total) * 100) : 0}%`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">Por origem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {sourceRows.map(([source, count]) => (
              <Bar
                key={source}
                label={ENTRY_SOURCE_LABELS[source as keyof typeof ENTRY_SOURCE_LABELS] ?? source}
                count={count}
                total={data.total}
                color={SOURCE_COLOR}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">Por estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {statusRows.map(([status, count]) => (
              <Bar
                key={status}
                label={STATUS_LABELS[status] ?? status}
                count={count}
                total={data.total}
                color={STATUS_COLORS[status] ?? '#64748b'}
              />
            ))}
          </CardContent>
        </Card>
      </div>
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

function Bar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {count} <span className="text-xs">({pct}%)</span>
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
