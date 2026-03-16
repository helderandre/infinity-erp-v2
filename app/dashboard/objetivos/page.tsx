'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Target, Eye } from 'lucide-react'
import { useGoals } from '@/hooks/use-goals'
import { GoalCompareTable } from '@/components/goals/goal-compare-table'
import { GoalStatusIndicator } from '@/components/goals/goal-status-indicator'
import { formatCurrency } from '@/lib/constants'

export default function ObjetivosPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const { goals, isLoading } = useGoals({ year })

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Objetivos</h1>
          <p className="text-sm text-muted-foreground">
            Quadro de objetivos multi-temporal dos consultores
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild>
            <Link href="/dashboard/objetivos/novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo Objetivo
            </Link>
          </Button>
        </div>
      </div>

      {/* Goals List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Objetivos {year}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : goals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Nenhum objetivo configurado para {year}.
              </p>
              <Button asChild className="mt-4" size="sm">
                <Link href="/dashboard/objetivos/novo">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Objetivo
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultor</TableHead>
                  <TableHead className="text-right">Objetivo Anual</TableHead>
                  <TableHead className="text-right">% Vendedores</TableHead>
                  <TableHead className="text-right">% Compradores</TableHead>
                  <TableHead className="text-right">Semanal</TableHead>
                  <TableHead className="text-right">Diário</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map((goal) => {
                  const weekly = goal.annual_revenue_target / goal.working_weeks_year
                  const daily = weekly / goal.working_days_week

                  return (
                    <TableRow key={goal.id}>
                      <TableCell className="font-medium">
                        {goal.consultant?.commercial_name || '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(goal.annual_revenue_target)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {goal.pct_sellers}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {goal.pct_buyers}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(weekly)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(daily)}
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/dashboard/objetivos/${goal.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Compare Table */}
      <GoalCompareTable year={year} />
    </div>
  )
}
