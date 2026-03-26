'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Target, Eye, TrendingUp, Users } from 'lucide-react'
import { useGoals } from '@/hooks/use-goals'
import { GoalCompareTable } from '@/components/goals/goal-compare-table'
import { formatCurrency } from '@/lib/constants'

export default function ObjetivosPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const { goals, isLoading } = useGoals({ year })

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  // Summary stats
  const totalAnnual = goals.reduce((sum, g) => sum + (g.annual_revenue_target || 0), 0)
  const avgSellers = goals.length ? Math.round(goals.reduce((s, g) => s + g.pct_sellers, 0) / goals.length) : 0
  const avgBuyers = goals.length ? Math.round(goals.reduce((s, g) => s + g.pct_buyers, 0) / goals.length) : 0

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
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild className="rounded-xl">
            <Link href="/dashboard/objetivos/novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo Objetivo
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {!isLoading && goals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border bg-card/80 backdrop-blur-sm shadow-sm p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Anual</p>
              <p className="text-lg font-bold">{formatCurrency(totalAnnual)}</p>
            </div>
          </div>
          <div className="rounded-2xl border bg-card/80 backdrop-blur-sm shadow-sm p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Média Vendedores</p>
              <p className="text-lg font-bold">{avgSellers}%</p>
            </div>
          </div>
          <div className="rounded-2xl border bg-card/80 backdrop-blur-sm shadow-sm p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Média Compradores</p>
              <p className="text-lg font-bold">{avgBuyers}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Goals table */}
      <div className="rounded-2xl border bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold">Objetivos {year}</h2>
        </div>
        <div className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : goals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Target className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                Nenhum objetivo configurado para {year}.
              </p>
              <p className="text-xs text-muted-foreground/60 mb-4">
                Crie objetivos para acompanhar o desempenho dos consultores.
              </p>
              <Button asChild size="sm" className="rounded-xl">
                <Link href="/dashboard/objetivos/novo">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Objetivo
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {goals.map((goal) => {
                const weekly = goal.annual_revenue_target / goal.working_weeks_year
                const daily = weekly / goal.working_days_week

                return (
                  <Link
                    key={goal.id}
                    href={`/dashboard/objetivos/${goal.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                  >
                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{goal.consultant?.commercial_name || '—'}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Vend. {goal.pct_sellers}% · Comp. {goal.pct_buyers}%
                      </p>
                    </div>

                    {/* Stats pills */}
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="rounded-lg bg-muted/50 px-3 py-1.5 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Anual</p>
                        <p className="text-xs font-bold tabular-nums">{formatCurrency(goal.annual_revenue_target)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 px-3 py-1.5 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Semanal</p>
                        <p className="text-xs font-bold tabular-nums">{formatCurrency(weekly)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 px-3 py-1.5 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Diário</p>
                        <p className="text-xs font-bold tabular-nums">{formatCurrency(daily)}</p>
                      </div>
                    </div>

                    {/* Arrow */}
                    <Eye className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Compare Table */}
      <GoalCompareTable year={year} />
    </div>
  )
}
