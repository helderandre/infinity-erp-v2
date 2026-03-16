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
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Comparação de Consultores</CardTitle>
          {dateRange && <p className="text-xs text-muted-foreground">{dateRange}</p>}
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as 'weekly' | 'monthly')}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
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
        )}
      </CardContent>
    </Card>
  )
}
