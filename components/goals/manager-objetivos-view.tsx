'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Target, TrendingUp, FileText, BarChart3, ListChecks, History, Search } from 'lucide-react'
import { useTeamSummary } from '@/hooks/use-team-summary'
import { GoalConfigSheet } from '@/components/goals/goal-config-sheet'
import { ConsultantGoalCard } from '@/components/goals/consultant-goal-card'
import { ConsultantGoalSheet } from '@/components/goals/consultant-goal-sheet'
import { TeamLeaderboard } from '@/components/goals/team-leaderboard'
import { TeamReportsSection } from '@/components/goals/team-reports-section'
import { formatCurrency } from '@/lib/constants'
import type { TeamSummaryRow } from '@/app/api/goals/team-summary/route'

type StatusFilter = 'all' | 'green' | 'orange' | 'red'
type TabValue = 'resumo' | 'relatorios' | 'historico'

interface ManagerObjetivosViewProps {
  /** True quando o utilizador também tem objetivos próprios — mostra o toggle "A minha visão · Equipa". */
  showRoleToggle?: boolean
}

export function ManagerObjetivosView({ showRoleToggle = false }: ManagerObjetivosViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [newSheetOpen, setNewSheetOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedRow, setSelectedRow] = useState<TeamSummaryRow | null>(null)

  const tabFromUrl = (searchParams.get('tab') as TabValue) || 'resumo'
  const [activeTab, setActiveTab] = useState<TabValue>(tabFromUrl)

  useEffect(() => {
    setActiveTab(tabFromUrl)
  }, [tabFromUrl])

  const { data, isLoading, refetch } = useTeamSummary(year)

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  function handleViewSwitch(view: 'self' | 'equipa') {
    const sp = new URLSearchParams(searchParams.toString())
    if (view === 'equipa') sp.set('view', 'equipa')
    else sp.delete('view')
    router.replace(`/dashboard/objetivos${sp.toString() ? `?${sp.toString()}` : ''}`)
  }

  function handleTabChange(next: string) {
    const tab = next as TabValue
    setActiveTab(tab)
    const sp = new URLSearchParams(searchParams.toString())
    if (tab === 'resumo') sp.delete('tab')
    else sp.set('tab', tab)
    router.replace(`/dashboard/objetivos${sp.toString() ? `?${sp.toString()}` : ''}`)
  }

  const filteredRows = useMemo(() => {
    if (!data) return []
    return data.consultants.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!r.commercial_name.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [data, statusFilter, search])

  const totals = data?.totals
  const ritmoPct = totals && totals.annual_target > 0
    ? (totals.realized / totals.annual_target) * 100
    : 0

  return (
    <div className="@container space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Objetivos da Equipa</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Painel de acompanhamento dos consultores em {year}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showRoleToggle && (
            <div className="inline-flex items-center rounded-full border bg-muted/40 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => handleViewSwitch('self')}
                className="rounded-full px-3 py-1 text-muted-foreground hover:text-foreground"
              >
                A minha visão
              </button>
              <button
                type="button"
                onClick={() => handleViewSwitch('equipa')}
                className="rounded-full bg-white px-3 py-1 shadow-sm"
              >
                Equipa
              </button>
            </div>
          )}
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[90px] rounded-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="rounded-full h-8 text-xs" onClick={() => setNewSheetOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Novo
          </Button>
        </div>
      </div>

      {/* Hero — 4 cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 @md:gap-4 @4xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : totals ? (
        <div className="grid grid-cols-2 gap-3 @md:gap-4 @4xl:grid-cols-4">
          <div className="rounded-2xl bg-orange-500 text-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-white/80">Objetivo Equipa</p>
              <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Target className="h-4 w-4" />
              </div>
            </div>
            <p className="text-lg @3xl:text-2xl font-bold truncate">{formatCurrency(totals.annual_target)}</p>
            <p className="text-[10px] text-white/70 mt-1">{totals.consultants_count} consultores</p>
          </div>

          <div className="rounded-2xl border bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground">Realizado</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-lg @3xl:text-2xl font-bold truncate">{formatCurrency(totals.realized)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{ritmoPct.toFixed(0)}% do alvo</p>
          </div>

          <div className="rounded-2xl border bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground">Projeção</p>
              <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p className="text-lg @3xl:text-2xl font-bold truncate">{formatCurrency(totals.projected_annual)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">a este ritmo, fim de ano</p>
          </div>

          <div className="rounded-2xl border bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground">Relatórios</p>
              <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center">
                <FileText className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <p className="text-lg @3xl:text-2xl font-bold truncate">{totals.reports_submitted}/{totals.consultants_count}</p>
            <p className="text-[10px] text-muted-foreground mt-1">submetidos esta semana</p>
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm h-auto">
          {[
            { value: 'resumo', icon: ListChecks, label: 'Resumo' },
            { value: 'relatorios', icon: FileText, label: 'Relatórios Semanais' },
            { value: 'historico', icon: History, label: 'Histórico' },
          ].map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              aria-label={label}
              className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 data-[state=active]:px-4 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground border-0 bg-transparent"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden @3xl:inline group-data-[state=active]:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Resumo ── */}
        <TabsContent value="resumo" className="mt-6 space-y-6">
          {!isLoading && data && data.consultants.length > 0 && (
            <TeamLeaderboard
              rows={data.consultants}
              onSelect={(row) => setSelectedRow(row)}
            />
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 flex-1 sm:max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar consultor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-full h-9 pl-9 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full border bg-muted/40 p-0.5 text-xs font-medium">
              {([
                { value: 'all', label: 'Todos' },
                { value: 'green', label: 'Em rota' },
                { value: 'orange', label: 'Acompanhar' },
                { value: 'red', label: 'Atrasados' },
              ] as Array<{ value: StatusFilter; label: string }>).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    statusFilter === opt.value
                      ? 'bg-white shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Card list */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border bg-white p-16 text-center shadow-sm">
              <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mb-1">
                {data && data.consultants.length === 0
                  ? `Nenhum objetivo configurado para ${year}.`
                  : 'Nenhum consultor corresponde aos filtros aplicados.'}
              </p>
              {data && data.consultants.length === 0 && (
                <Button size="sm" className="rounded-full mt-3" onClick={() => setNewSheetOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Objetivo
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRows.map((row) => (
                <ConsultantGoalCard
                  key={row.goal_id}
                  row={row}
                  onClick={() => setSelectedRow(row)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Relatórios Semanais ── */}
        <TabsContent value="relatorios" className="mt-6">
          <TeamReportsSection />
        </TabsContent>

        {/* ── Histórico ── */}
        <TabsContent value="historico" className="mt-6">
          <div className="rounded-2xl border bg-white p-12 text-center shadow-sm">
            <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mb-1">
              Histórico anual em construção.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Por enquanto, usa o selector de ano no topo para navegar.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Sheet drill-in */}
      <ConsultantGoalSheet
        goalId={selectedRow?.goal_id ?? null}
        consultantName={selectedRow?.commercial_name}
        open={!!selectedRow}
        onOpenChange={(open) => { if (!open) setSelectedRow(null) }}
      />

      <GoalConfigSheet
        open={newSheetOpen}
        onOpenChange={setNewSheetOpen}
        onSuccess={() => refetch()}
      />
    </div>
  )
}
