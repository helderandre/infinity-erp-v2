'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { GoalStatusIndicator } from './goal-status-indicator'
import { formatCurrency } from '@/lib/constants'
import type { GoalCompareRow } from '@/types/goal'

interface GoalCompareTableProps {
  year: number
}

export function GoalCompareTable({ year }: GoalCompareTableProps) {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const [rows, setRows] = useState<GoalCompareRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState('')

  useEffect(() => {
    async function fetchCompare() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/goals/compare?year=${year}&period=${period}`)
        if (!res.ok) throw new Error()
        const json = await res.json()
        setRows(json.data || [])
        if (json.dateFrom && json.dateTo) {
          setDateRange(`${json.dateFrom} — ${json.dateTo}`)
        }
      } catch {
        setRows([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchCompare()
  }, [year, period])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base">Comparação de Consultores</CardTitle>
          {dateRange && <p className="text-xs text-muted-foreground">{dateRange}</p>}
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as 'weekly' | 'monthly')}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum objetivo configurado para {year}.
          </p>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="space-y-2.5 sm:hidden">
              {rows.map((row) => (
                <div key={row.consultant_id} className="rounded-xl border bg-card p-3.5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold truncate flex-1 min-w-0">{row.commercial_name}</p>
                    <GoalStatusIndicator status={row.status} size="md" />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Objetivo</p>
                      <p className="text-sm font-bold tabular-nums truncate">{formatCurrency(row.target)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Realizado</p>
                      <p className="text-sm font-bold tabular-nums truncate">{formatCurrency(row.realized)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t">
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Leads</p>
                      <p className="text-xs font-medium tabular-nums">{row.leads.done}/{row.leads.target}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Chamadas</p>
                      <p className="text-xs font-medium tabular-nums">{row.calls.done}/{row.calls.target}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Visitas</p>
                      <p className="text-xs font-medium tabular-nums">{row.visits.done}/{row.visits.target}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consultor</TableHead>
                    <TableHead className="text-right">Objetivo</TableHead>
                    <TableHead className="text-right">Realizado</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead className="text-right">Visitas</TableHead>
                    <TableHead className="w-[50px] text-center">St.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.consultant_id}>
                      <TableCell className="font-medium">{row.commercial_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(row.target)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(row.realized)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.leads.done}/{row.leads.target}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.calls.done}/{row.calls.target}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.visits.done}/{row.visits.target}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <GoalStatusIndicator status={row.status} size="md" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
