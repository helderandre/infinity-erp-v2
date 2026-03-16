'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { getAgentRankings } from '@/app/dashboard/comissoes/actions'
import type { AgentRanking } from '@/types/financial'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
}

const MEDALS = ['🥇', '🥈', '🥉']

type Period = 'month' | 'quarter' | 'year'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'month', label: 'Este Mês' },
  { value: 'quarter', label: 'Este Trimestre' },
  { value: 'year', label: 'Este Ano' },
]

// ─── Page ───────────────────────────────────────────────────────────────────

export default function RankingsPage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('year')
  const [revenueRankings, setRevenueRankings] = useState<AgentRanking[]>([])
  const [acquisitionRankings, setAcquisitionRankings] = useState<AgentRanking[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [revResult, acqResult] = await Promise.all([
        getAgentRankings('revenue', period),
        getAgentRankings('acquisitions', period),
      ])
      setRevenueRankings(revResult.rankings)
      setAcquisitionRankings(acqResult.rankings)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Rankings</h1>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Ranking de Facturação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueRankings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Sem dados disponíveis.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead className="text-right">Facturação</TableHead>
                    <TableHead className="text-right">Objectivo</TableHead>
                    <TableHead className="w-32">% Atingido</TableHead>
                    <TableHead className="w-16">Var.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueRankings.map((r) => {
                    const pct = r.pct_achieved ?? 0
                    return (
                      <TableRow key={r.consultant_id}>
                        <TableCell className="font-semibold">
                          {r.position <= 3 ? MEDALS[r.position - 1] : r.position}
                        </TableCell>
                        <TableCell className="font-medium">{r.consultant_name}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(r.value)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {r.target ? formatCurrency(r.target) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(pct, 100)} className="h-2 flex-1" />
                            <span className="text-xs font-medium w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <VariationBadge value={r.variation_vs_previous} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Acquisitions Ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-blue-500" />
              Ranking de Angariações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {acquisitionRankings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Sem dados disponíveis.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead className="text-right">Angariações YTD</TableHead>
                    <TableHead className="text-right">Novas Mês</TableHead>
                    <TableHead className="text-right">Activas</TableHead>
                    <TableHead className="text-right">Vendidas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acquisitionRankings.map((r) => (
                    <TableRow key={r.consultant_id}>
                      <TableCell className="font-semibold">
                        {r.position <= 3 ? MEDALS[r.position - 1] : r.position}
                      </TableCell>
                      <TableCell className="font-medium">{r.consultant_name}</TableCell>
                      <TableCell className="text-right text-sm">{r.value}</TableCell>
                      <TableCell className="text-right text-sm">{r.new_this_month ?? 0}</TableCell>
                      <TableCell className="text-right text-sm">{r.active ?? 0}</TableCell>
                      <TableCell className="text-right text-sm">{r.sold ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function VariationBadge({ value }: { value: number | null }) {
  if (value == null || value === 0) {
    return <Minus className="h-4 w-4 text-muted-foreground mx-auto" />
  }
  if (value > 0) {
    return (
      <span className="flex items-center text-emerald-600 text-xs font-medium">
        <TrendingUp className="h-3.5 w-3.5 mr-0.5" />
        +{value.toFixed(0)}%
      </span>
    )
  }
  return (
    <span className="flex items-center text-red-500 text-xs font-medium">
      <TrendingDown className="h-3.5 w-3.5 mr-0.5" />
      {value.toFixed(0)}%
    </span>
  )
}
