'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { GOAL_PERIOD_LABELS, formatCurrency } from '@/lib/constants'
import type { GoalPeriod, SellerFunnelTargets, BuyerFunnelTargets } from '@/types/goal'

interface GoalFunnelTableProps {
  title: string
  type: 'sellers' | 'buyers'
  funnel: Record<GoalPeriod, SellerFunnelTargets | BuyerFunnelTargets>
  pct: number
  params?: {
    label: string
    value: string | number | null
  }[]
}

export function GoalFunnelTable({ title, type, funnel, pct, params }: GoalFunnelTableProps) {
  const periods: GoalPeriod[] = ['annual', 'monthly', 'weekly', 'daily']

  const rows = type === 'sellers'
    ? [
        { key: 'revenue', label: 'Faturação' },
        { key: 'sales', label: 'Vendas' },
        { key: 'listings', label: 'Angariações' },
        { key: 'visits', label: 'Visitas' },
        { key: 'leads', label: 'Leads' },
        { key: 'calls', label: 'Chamadas' },
      ]
    : [
        { key: 'revenue', label: 'Faturação' },
        { key: 'closes', label: 'Fechos' },
        { key: 'qualified', label: 'Qualificados' },
        { key: 'leads', label: 'Leads' },
        { key: 'calls', label: 'Chamadas' },
      ]

  function formatValue(key: string, value: number): string {
    if (key === 'revenue') return formatCurrency(value)
    if (value >= 1) return Math.round(value).toLocaleString('pt-PT')
    if (value === 0) return '0'
    return value.toFixed(1)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {title} — {pct}% do objetivo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">KPI</TableHead>
              {periods.map((p) => (
                <TableHead key={p} className="text-right">{GOAL_PERIOD_LABELS[p]}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium">{row.label}</TableCell>
                {periods.map((p) => (
                  <TableCell key={p} className="text-right tabular-nums">
                    {formatValue(row.key, (funnel[p] as unknown as Record<string, number>)[row.key] || 0)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {params && params.length > 0 && (
          <div className="mt-4 rounded-lg border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Parâmetros do Funil</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {params.map((p) => (
                <div key={p.label} className="flex justify-between">
                  <span className="text-muted-foreground">{p.label}</span>
                  <span className="font-medium">{p.value ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
