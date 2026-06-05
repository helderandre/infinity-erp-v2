'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, Calendar, Plus, Home, ShoppingCart, Key, TrendingUp } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { WeeklyReportForm } from '@/components/goals/weekly-report-form'
import { WeeklyReportAIAdvice } from '@/components/goals/weekly-report-ai-advice'
import { DeclareActivitiesDialog } from '@/components/goals/declare-activities-dialog'
import { GOAL_ACTIVITY_TYPES } from '@/lib/constants'
import { useGoals } from '@/hooks/use-goals'
import { useGoalActivities } from '@/hooks/use-goal-activities'
import type { AIAdvice, GoalActivityType } from '@/types/goal'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function formatWeekRange(monday: string): string {
  const start = new Date(monday)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  return `${start.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })} — ${end.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}`
}

function formatCommission(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k€`
  return `${Math.round(value)}€`
}

const TRACKED_TYPES: GoalActivityType[] = ['call', 'visit', 'lead_contact', 'listing', 'follow_up', 'buyer_qualify']

const SOURCE_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads', google_ads: 'Google Ads', website: 'Website',
  landing_page: 'Landing Page', partner: 'Parceiro', organic: 'Orgânico',
  walk_in: 'Presencial', phone_call: 'Chamada', social_media: 'Redes Sociais',
  referral: 'Referência', other: 'Outro',
}

interface PipelineValue { compra: number; venda: number; arrendamento: number; total: number }
interface LeadSource { source: string; count: number }

export function WeeklyReportSheet({ open, onOpenChange }: Props) {
  const isMobile = useIsMobile()
  const [weekStart, setWeekStart] = useState(getMonday(new Date()))
  const [report, setReport] = useState<{
    id: string; status: string; notes_wins: string | null; notes_challenges: string | null
    notes_next_week: string | null; manager_feedback: string | null; ai_advice: string | null
    [key: string]: unknown
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [advice, setAdvice] = useState<AIAdvice | null>(null)
  const [declareOpen, setDeclareOpen] = useState(false)
  const [pipelineValue, setPipelineValue] = useState<PipelineValue | null>(null)
  const [leadSources, setLeadSources] = useState<LeadSource[]>([])

  const year = new Date(weekStart).getFullYear()
  const { goals } = useGoals({ year })
  const currentGoal = goals[0]
  const { activities, refetch: refetchActivities } = useGoalActivities({ goalId: currentGoal?.id || null })

  const loadReport = useCallback(async () => {
    if (!open) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/goals/weekly-reports?week_start=${weekStart}`)
      const json = await res.json()
      const existing = (json.data || [])[0]
      if (existing) {
        setReport(existing)
        if (existing.ai_advice) {
          try { setAdvice(JSON.parse(existing.ai_advice)) } catch { setAdvice(null) }
        } else { setAdvice(null) }
      } else { setReport(null); setAdvice(null) }
    } catch { setReport(null) } finally { setIsLoading(false) }
  }, [weekStart, open])

  const loadInsights = useCallback(async () => {
    if (!open) return
    try {
      const res = await fetch(`/api/goals/weekly-reports/my-insights?week_start=${weekStart}`)
      if (res.ok) {
        const json = await res.json()
        setPipelineValue(json.pipeline_value || null)
        setLeadSources(json.lead_sources || [])
      }
    } catch { setPipelineValue(null); setLeadSources([]) }
  }, [weekStart, open])

  useEffect(() => { loadReport(); loadInsights() }, [loadReport, loadInsights])

  const handleSave = async (data: { notes_wins?: string | null; notes_challenges?: string | null; notes_next_week?: string | null; submit?: boolean }) => {
    if (report?.id) {
      const res = await fetch(`/api/goals/weekly-reports/${report.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Erro ao guardar')
      await loadReport()
    } else {
      const res = await fetch('/api/goals/weekly-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ week_start: weekStart, goal_id: currentGoal?.id, ...data }) })
      if (!res.ok) throw new Error('Erro ao criar')
      await loadReport()
    }
  }

  const handleGenerateAdvice = async (type: 'weekly' | 'monthly' | 'manager_prep'): Promise<AIAdvice | null> => {
    if (!report?.id) return null
    const res = await fetch(`/api/goals/weekly-reports/${report.id}/ai-advice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) })
    if (!res.ok) throw new Error('Erro ao gerar conselho')
    const result = await res.json()
    setAdvice(result)
    return result
  }

  const navigateWeek = (dir: -1 | 1) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + dir * 7)
    setWeekStart(d.toISOString().split('T')[0])
  }

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekEndStr = weekEnd.toISOString().split('T')[0]
  const weekActivities = activities.filter((a) => a.activity_date >= weekStart && a.activity_date <= weekEndStr)

  const breakdown: Record<string, { system: number; declared: number; total: number }> = {}
  for (const type of TRACKED_TYPES) breakdown[type] = { system: 0, declared: 0, total: 0 }
  for (const a of weekActivities) {
    if (!breakdown[a.activity_type]) continue
    const qty = a.quantity || 1
    if (a.origin_type === 'declared') breakdown[a.activity_type].declared += qty
    else breakdown[a.activity_type].system += qty
    breakdown[a.activity_type].total += qty
  }

  const totalAll = Object.values(breakdown).reduce((s, b) => s + b.total, 0)
  const totalSystem = Object.values(breakdown).reduce((s, b) => s + b.system, 0)
  const totalDeclared = totalAll - totalSystem
  const isSubmitted = report?.status === 'submitted' || report?.status === 'reviewed'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/95 supports-[backdrop-filter]:bg-background/85 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[92dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-3xl sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        {/* Header */}
        <div className="shrink-0 px-5 sm:px-7 pt-7 sm:pt-8 pb-4 border-b border-border/30">
          <div className="flex items-start justify-between gap-3">
            <SheetHeader className="p-0 gap-0 flex-1 min-w-0">
              <SheetTitle className="text-lg sm:text-xl font-semibold leading-tight tracking-tight">
                Relatório Semanal
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                Reflecte sobre a tua semana e submete ao Team Leader
              </SheetDescription>
            </SheetHeader>
          </div>

          {/* Week navigator — second row, full width on mobile */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateWeek(-1)}
              className="rounded-full h-8 w-8 shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 rounded-full bg-muted/60 px-3 sm:px-4 py-1.5 min-w-0 flex-1 sm:flex-none">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium truncate">{formatWeekRange(weekStart)}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateWeek(1)}
              disabled={weekStart >= getMonday(new Date())}
              className="rounded-full h-8 w-8 shrink-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-7 py-5 space-y-5">
          {isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : (
            <>
              {/* KPI cards — 2 cols mobile, 4 cols desktop */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-2xl bg-orange-500 text-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-medium text-white/80">Total Actividades</p>
                    <div className="h-7 w-7 rounded-xl bg-white/20 flex items-center justify-center">
                      <TrendingUp className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold tabular-nums">{totalAll}</p>
                  <p className="text-[10px] text-white/70 mt-1">
                    {totalSystem} sistema · {totalDeclared} adicionais
                  </p>
                </div>
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-medium text-muted-foreground">Comissão Venda</p>
                    <div className="h-7 w-7 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Home className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold tabular-nums">{formatCommission(pipelineValue?.venda || 0)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Preço × 5%</p>
                </div>
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-medium text-muted-foreground">Comissão Compra</p>
                    <div className="h-7 w-7 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <ShoppingCart className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold tabular-nums">{formatCommission(pipelineValue?.compra || 0)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Orçamento × 5%</p>
                </div>
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-medium text-muted-foreground">Comissão Arrend.</p>
                    <div className="h-7 w-7 rounded-xl bg-purple-50 flex items-center justify-center">
                      <Key className="h-3.5 w-3.5 text-purple-600" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold tabular-nums">{formatCommission(pipelineValue?.arrendamento || 0)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Renda × 150%</p>
                </div>
              </div>

              {/* Lead sources */}
              {leadSources.length > 0 && (
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 sm:p-5 shadow-sm">
                  <h3 className="text-sm font-semibold mb-3">Origem dos Leads</h3>
                  <div className="flex flex-wrap gap-2">
                    {leadSources.map((ls) => (
                      <div key={ls.source} className="flex items-center gap-2 rounded-xl border px-3 py-1.5">
                        <span className="text-xs text-muted-foreground">{SOURCE_LABELS[ls.source] || ls.source}</span>
                        <span className="text-xs font-bold tabular-nums">{ls.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activities table */}
              <div className="rounded-2xl border bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-3 border-b">
                  <h3 className="text-sm font-semibold">Actividades da Semana</h3>
                  {!isSubmitted && currentGoal && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeclareOpen(true)}
                      className="rounded-full text-xs h-8 self-start sm:self-auto"
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Registar adicionais
                    </Button>
                  )}
                </div>

                <div className="divide-y">
                  {TRACKED_TYPES.map((type) => {
                    const b = breakdown[type]
                    if (!b) return null
                    const maxBar = Math.max(b.total, 1)
                    const systemPct = (b.system / maxBar) * 100
                    const declaredPct = (b.declared / maxBar) * 100
                    return (
                      <div key={type} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${b.total > 0 ? 'bg-emerald-500' : 'bg-red-400'}`}
                        />
                        <span className="text-sm flex-1 min-w-0 truncate">
                          {(GOAL_ACTIVITY_TYPES as Record<string, string>)[type] || type}
                        </span>
                        {b.declared > 0 && (
                          <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums shrink-0">
                            {b.system} + {b.declared}
                          </span>
                        )}
                        <span className="text-sm font-bold tabular-nums w-7 text-right shrink-0">
                          {b.total}
                        </span>
                        <div className="hidden sm:flex h-2 w-20 rounded-full bg-muted overflow-hidden shrink-0">
                          {b.system > 0 && (
                            <div className="h-full bg-emerald-500" style={{ width: `${systemPct}%` }} />
                          )}
                          {b.declared > 0 && (
                            <div className="h-full bg-emerald-300" style={{ width: `${declaredPct}%` }} />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="px-4 sm:px-5 py-2.5 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> No sistema
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-300" /> Adicionais
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">Total: {totalAll}</span>
                </div>
              </div>

              {/* Reflection form */}
              <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 sm:p-5 shadow-sm">
                <h3 className="text-sm font-semibold mb-4">Reflexão Semanal</h3>
                <WeeklyReportForm
                  reportId={report?.id || null}
                  initialData={
                    report
                      ? {
                          notes_wins: report.notes_wins,
                          notes_challenges: report.notes_challenges,
                          notes_next_week: report.notes_next_week,
                          status: report.status,
                        }
                      : undefined
                  }
                  onSave={handleSave}
                  onSubmitted={loadReport}
                />
              </div>

              {/* Manager feedback */}
              {report?.manager_feedback && (
                <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-purple-800 mb-2">Feedback do Team Leader</h3>
                  <p className="text-sm text-purple-700 leading-relaxed">{report.manager_feedback}</p>
                </div>
              )}

              {/* AI advice */}
              <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 sm:p-5 shadow-sm">
                <h3 className="text-sm font-semibold mb-4">Conselhos IA</h3>
                {report?.id ? (
                  <WeeklyReportAIAdvice advice={advice} onGenerate={handleGenerateAdvice} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Guarda o relatório primeiro para gerar conselhos personalizados.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Declare activities dialog — nested above the sheet */}
        {currentGoal && (
          <DeclareActivitiesDialog
            open={declareOpen}
            onOpenChange={setDeclareOpen}
            goalId={currentGoal.id}
            onSuccess={() => {
              refetchActivities()
              loadReport()
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
