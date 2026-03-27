'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Pencil, Plus, Target, Filter, History, TrendingUp, TrendingDown,
  ArrowLeft, DollarSign, BarChart3, Zap, Phone, MapPin, Home, Handshake,
  UserCheck, MessageSquare, RotateCcw,
} from 'lucide-react'
import { useGoalDashboard } from '@/hooks/use-goal-dashboard'
import { useGoalActivities } from '@/hooks/use-goal-activities'
import { GoalActivityForm } from '@/components/goals/goal-activity-form'
import { GoalStatusIndicator } from '@/components/goals/goal-status-indicator'
import { getGoalStatus } from '@/lib/goals/calculations'
import { formatCurrency, GOAL_PERIOD_LABELS, GOAL_ACTIVITY_TYPES, GOAL_ORIGINS, formatDate } from '@/lib/constants'
import type { GoalPeriod, GoalActivityType, GoalStatus as GStatus } from '@/types/goal'

const ACTIVITY_ICONS: Record<GoalActivityType, React.ElementType> = {
  call: Phone, visit: MapPin, listing: Home, sale_close: Handshake,
  buyer_close: Handshake, lead_contact: MessageSquare, buyer_qualify: UserCheck, follow_up: RotateCcw,
}
const ACTIVITY_COLORS: Record<GoalActivityType, string> = {
  call: 'text-blue-500 bg-blue-50', visit: 'text-violet-500 bg-violet-50',
  listing: 'text-emerald-500 bg-emerald-50', sale_close: 'text-green-600 bg-green-50',
  buyer_close: 'text-green-600 bg-green-50', lead_contact: 'text-sky-500 bg-sky-50',
  buyer_qualify: 'text-amber-500 bg-amber-50', follow_up: 'text-orange-500 bg-orange-50',
}

export default function ObjetivoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { dashboard, progress, isLoading, refetch } = useGoalDashboard(id)
  const { activities, refetch: refetchActivities } = useGoalActivities({ goalId: id })
  const [activityDialogOpen, setActivityDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('objetivos')

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-[500px] rounded-2xl" />
      </div>
    )
  }

  if (!dashboard) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Objetivo não encontrado.</div>
  }

  const { goal, financial, funnel_sellers, funnel_buyers, reality_check, today } = dashboard
  const progressPct = Math.min((reality_check.total_realized / financial.annual.total) * 100, 100)
  const isOnTrack = reality_check.status === 'green'

  // Today's activities
  const todayStr = new Date().toISOString().split('T')[0]
  const todayActs = activities.filter(a => a.activity_date === todayStr)

  // This week's activities
  const now = new Date()
  const dow = now.getDay()
  const monOff = dow === 0 ? -6 : 1 - dow
  const monday = new Date(now); monday.setDate(now.getDate() + monOff)
  const mondayStr = monday.toISOString().split('T')[0]
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const sundayStr = sunday.toISOString().split('T')[0]
  const weekActs = activities.filter(a => a.activity_date >= mondayStr && a.activity_date <= sundayStr)

  const sellerParams = [
    { label: 'Valor médio venda', value: goal.sellers_avg_sale_value ? formatCurrency(goal.sellers_avg_sale_value) : null },
    { label: 'Comissão média', value: goal.sellers_avg_commission_pct ? `${goal.sellers_avg_commission_pct}%` : null },
    { label: '% angariações vendidas', value: goal.sellers_pct_listings_sold ? `${goal.sellers_pct_listings_sold}%` : null },
    { label: '% visita → angariação', value: goal.sellers_pct_visit_to_listing ? `${goal.sellers_pct_visit_to_listing}%` : null },
    { label: '% lead → visita', value: goal.sellers_pct_lead_to_visit ? `${goal.sellers_pct_lead_to_visit}%` : null },
    { label: 'Chamadas por lead', value: goal.sellers_avg_calls_per_lead },
  ]
  const buyerParams = [
    { label: 'Valor médio compra', value: goal.buyers_avg_purchase_value ? formatCurrency(goal.buyers_avg_purchase_value) : null },
    { label: 'Comissão média', value: goal.buyers_avg_commission_pct ? `${goal.buyers_avg_commission_pct}%` : null },
    { label: 'Taxa de fecho', value: goal.buyers_close_rate ? `${goal.buyers_close_rate}%` : null },
    { label: '% lead → qualificado', value: goal.buyers_pct_lead_to_qualified ? `${goal.buyers_pct_lead_to_qualified}%` : null },
    { label: 'Chamadas por lead', value: goal.buyers_avg_calls_per_lead },
  ]

  // Weekly metrics for resumo semanal
  const weeklyMetrics = [
    { key: 'lead_contact' as GoalActivityType, target: Math.ceil(funnel_sellers.weekly.leads + funnel_buyers.weekly.leads) },
    { key: 'call' as GoalActivityType, target: Math.ceil(funnel_sellers.weekly.calls + funnel_buyers.weekly.calls) },
    { key: 'visit' as GoalActivityType, target: Math.ceil(funnel_sellers.weekly.visits) },
    { key: 'listing' as GoalActivityType, target: Math.ceil(funnel_sellers.weekly.listings) },
    { key: 'follow_up' as GoalActivityType, target: Math.ceil((funnel_sellers.weekly.leads + funnel_buyers.weekly.leads) * 0.5) },
    { key: 'buyer_qualify' as GoalActivityType, target: Math.ceil(funnel_buyers.weekly.qualified) },
  ]

  return (
    <div className="space-y-6">
      {/* ── Black hero card ── */}
      <div className="rounded-2xl bg-neutral-900 text-white p-6 shadow-lg">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/objetivos" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/20 hover:text-white transition-all">
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </Link>
            <div>
              <p className="text-xs text-white/50">Objetivos {goal.year}</p>
              <h1 className="text-xl font-bold">{goal.consultant?.commercial_name || 'Consultor'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary" className="rounded-full h-8 text-xs bg-white/10 text-white border-0 hover:bg-white/20">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Registar
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader><DialogTitle>Registar Actividade</DialogTitle></DialogHeader>
                <GoalActivityForm goalId={id} onSuccess={() => { setActivityDialogOpen(false); refetch(); refetchActivities() }} onCancel={() => setActivityDialogOpen(false)} />
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="secondary" asChild className="rounded-full h-8 text-xs bg-white/10 text-white border-0 hover:bg-white/20">
              <Link href={`/dashboard/objetivos/${id}/editar`}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar</Link>
            </Button>
          </div>
        </div>

        {/* Key numbers row */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Objetivo Anual</p>
            <p className="text-2xl font-bold mt-0.5">{formatCurrency(financial.annual.total)}</p>
            <p className="text-[10px] text-white/40 mt-0.5">V. {goal.pct_sellers}% · C. {goal.pct_buyers}%</p>
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Realizado</p>
            <p className="text-2xl font-bold mt-0.5">{formatCurrency(reality_check.total_realized)}</p>
            <p className={`text-[10px] mt-0.5 ${isOnTrack ? 'text-emerald-400' : 'text-red-400'}`}>
              {reality_check.pct_achieved.toFixed(0)}% do esperado
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Projeção</p>
            <p className="text-2xl font-bold mt-0.5">{formatCurrency(reality_check.projected_annual)}</p>
            <p className="text-[10px] text-white/40 mt-0.5">
              {reality_check.gap > 0 ? `Gap ${formatCurrency(reality_check.gap)}` : 'No alvo'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Obj. Semanal</p>
            <p className="text-2xl font-bold mt-0.5">{formatCurrency(financial.weekly.total)}</p>
            <p className="text-[10px] text-white/40 mt-0.5">
              Diário: {formatCurrency(financial.daily.total)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Progresso anual</p>
            <p className="text-xs font-bold tabular-nums">{progressPct.toFixed(1)}%</p>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                reality_check.status === 'green' ? 'bg-emerald-400' :
                reality_check.status === 'orange' ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] text-white/30 mt-1.5">{reality_check.message}</p>
        </div>
      </div>

      {/* ── Main content card with tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          {/* Tab bar — pill style */}
          <div className="px-6 pt-5 pb-4">
            <TabsList className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm h-auto">
              {[
                { value: 'objetivos', icon: Target, label: 'Objetivos' },
                { value: 'acoes', icon: Zap, label: 'Ações' },
                { value: 'funil-vendedores', icon: Filter, label: 'Funil Vendedores' },
                { value: 'funil-compradores', icon: Filter, label: 'Funil Compradores' },
                { value: 'historico', icon: History, label: 'Histórico' },
              ].map(({ value, icon: Icon, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground border-0 bg-transparent"
                >
                  <Icon className={`h-3.5 w-3.5 ${value === 'funil-compradores' ? 'rotate-180' : ''}`} />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ── Tab: Objetivos ── */}
          <TabsContent value="objetivos" className="mt-0 p-6 space-y-6">
            {/* KPI cards row */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl bg-orange-500 text-white p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-medium text-white/80 uppercase tracking-wider">Anual</p>
                  <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center"><Target className="h-3.5 w-3.5" /></div>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(financial.annual.total)}</p>
                {progress && <p className="text-[10px] text-white/70 mt-1">Real. {formatCurrency(progress.annual.realized)}</p>}
              </div>
              {(['monthly', 'weekly', 'daily'] as GoalPeriod[]).map(period => {
                const target = financial[period]
                const realized = period === 'monthly' ? progress?.monthly.realized : period === 'weekly' ? progress?.weekly.realized : null
                return (
                  <div key={period} className="rounded-2xl border p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{GOAL_PERIOD_LABELS[period]}</p>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(target.total)}</p>
                    {realized !== null && realized !== undefined && (
                      <p className="text-[10px] text-muted-foreground mt-1">Real. <span className="font-medium text-foreground">{formatCurrency(realized)}</span></p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">V. {formatCurrency(target.sellers)} · C. {formatCurrency(target.buyers)}</p>
                  </div>
                )
              })}
            </div>

            {/* Breakdown: periods as table-style card */}
            <div className="rounded-2xl border overflow-hidden">
              <div className="px-5 py-3 border-b bg-muted/20">
                <p className="text-xs font-semibold">Detalhe por Período</p>
              </div>
              <div className="grid grid-cols-4 divide-x">
                {(['annual', 'monthly', 'weekly', 'daily'] as GoalPeriod[]).map(period => {
                  const t = financial[period]
                  return (
                    <div key={period} className="p-4 text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium mb-1">{GOAL_PERIOD_LABELS[period]}</p>
                      <p className="text-base font-bold">{formatCurrency(t.total)}</p>
                      <div className="flex justify-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span>V. {formatCurrency(t.sellers)}</span>
                        <span>C. {formatCurrency(t.buyers)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          {/* ── Tab: Ações ── */}
          <TabsContent value="acoes" className="mt-0 p-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Ações de Hoje */}
              <div className="rounded-2xl border overflow-hidden">
                <div className="px-5 py-3 border-b bg-muted/20">
                  <p className="text-xs font-semibold">Ações de Hoje</p>
                </div>
                <div className="divide-y">
                  {[
                    { label: 'Leads a contactar', target: today.leads_to_contact, done: todayActs.filter(a => a.activity_type === 'lead_contact').length, statusKey: 'leads' },
                    { label: 'Chamadas', target: today.calls_minimum, done: todayActs.filter(a => a.activity_type === 'call').length, statusKey: 'calls' },
                    { label: 'Visitas', target: today.visits_to_schedule, done: todayActs.filter(a => a.activity_type === 'visit').length, statusKey: 'visits' },
                    { label: 'Follow-ups', target: today.follow_ups, done: todayActs.filter(a => a.activity_type === 'follow_up').length, statusKey: 'follow_ups' },
                  ].map(m => {
                    const status = (today.status[m.statusKey] as GStatus) || 'red'
                    return (
                      <div key={m.label} className="flex items-center gap-4 px-5 py-3">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          status === 'green' ? 'bg-emerald-500' : status === 'orange' ? 'bg-amber-500' : 'bg-red-400'
                        }`} />
                        <span className="text-sm flex-1">{m.label}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{m.done} / {m.target}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Resumo Semanal */}
              <div className="rounded-2xl border overflow-hidden">
                <div className="px-5 py-3 border-b bg-muted/20">
                  <p className="text-xs font-semibold">Resumo Semanal</p>
                  <p className="text-[10px] text-muted-foreground">
                    {monday.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })} — {sunday.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
                <div className="divide-y">
                  {weeklyMetrics.map(({ key, target }) => {
                    const done = weekActs.filter(a => a.activity_type === key).reduce((s, a) => s + (a.quantity || 1), 0)
                    const pct = target > 0 ? Math.min((done / target) * 100, 100) : 0
                    const status = getGoalStatus(done, target)
                    return (
                      <div key={key} className="flex items-center gap-4 px-5 py-3">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          status === 'green' ? 'bg-emerald-500' : status === 'orange' ? 'bg-amber-500' : 'bg-red-400'
                        }`} />
                        <span className="text-sm flex-1">{(GOAL_ACTIVITY_TYPES as Record<string, string>)[key]}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{done} / {target}</span>
                        <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden shrink-0">
                          <div className={`h-full rounded-full ${
                            status === 'green' ? 'bg-emerald-500' : status === 'orange' ? 'bg-amber-500' : 'bg-red-400'
                          }`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Tab: Funil Vendedores ── */}
          <TabsContent value="funil-vendedores" className="mt-0 p-6 space-y-6">
            <FunnelSection
              title="Funil Vendedores"
              pct={goal.pct_sellers}
              funnel={funnel_sellers}
              rows={[
                { key: 'revenue', label: 'Faturação' },
                { key: 'sales', label: 'Vendas' },
                { key: 'listings', label: 'Angariações' },
                { key: 'visits', label: 'Visitas' },
                { key: 'leads', label: 'Leads' },
                { key: 'calls', label: 'Chamadas' },
              ]}
              params={sellerParams}
            />
          </TabsContent>

          {/* ── Tab: Funil Compradores ── */}
          <TabsContent value="funil-compradores" className="mt-0 p-6 space-y-6">
            <FunnelSection
              title="Funil Compradores"
              pct={goal.pct_buyers}
              funnel={funnel_buyers}
              rows={[
                { key: 'revenue', label: 'Faturação' },
                { key: 'closes', label: 'Fechos' },
                { key: 'qualified', label: 'Qualificados' },
                { key: 'leads', label: 'Leads' },
                { key: 'calls', label: 'Chamadas' },
              ]}
              params={buyerParams}
            />
          </TabsContent>

          {/* ── Tab: Histórico ── */}
          <TabsContent value="historico" className="mt-0">
            <div className="px-6 py-4 border-b bg-muted/20">
              <p className="text-xs font-semibold">Histórico de Actividades</p>
            </div>
            <div className="divide-y">
              {activities.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma actividade registada.</div>
              ) : (
                activities.slice(0, 50).map(activity => {
                  const Icon = ACTIVITY_ICONS[activity.activity_type] || MessageSquare
                  const colorClass = ACTIVITY_COLORS[activity.activity_type] || 'text-slate-500 bg-slate-50'
                  return (
                    <div key={activity.id} className="flex items-center gap-4 px-6 py-3.5">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{(GOAL_ACTIVITY_TYPES as Record<string, string>)[activity.activity_type]}</span>
                          <span className="text-[10px] text-muted-foreground">({(GOAL_ORIGINS as Record<string, string>)[activity.origin]})</span>
                        </div>
                        {activity.notes && <p className="text-xs text-muted-foreground truncate">{activity.notes}</p>}
                      </div>
                      {activity.revenue_amount ? (
                        <span className="text-sm font-semibold text-emerald-600 shrink-0">{formatCurrency(activity.revenue_amount)}</span>
                      ) : null}
                      <span className="text-xs text-muted-foreground shrink-0">{formatDate(activity.activity_date)}</span>
                    </div>
                  )
                })
              )}
            </div>
            {activities.length > 50 && (
              <div className="px-6 py-3 border-t text-center text-xs text-muted-foreground">
                A mostrar as 50 mais recentes de {activities.length} actividades
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

/* ── Funnel section (used by both seller & buyer tabs) ── */
function FunnelSection({
  title, pct, funnel, rows, params,
}: {
  title: string
  pct: number
  funnel: Record<GoalPeriod, Record<string, number>>
  rows: { key: string; label: string }[]
  params: { label: string; value: string | number | null }[]
}) {
  const periods: GoalPeriod[] = ['annual', 'monthly', 'weekly', 'daily']

  function fmt(key: string, value: number): string {
    if (key === 'revenue') return formatCurrency(value)
    if (value >= 1) return Math.round(value).toLocaleString('pt-PT')
    if (value === 0) return '0'
    return value.toFixed(1)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">— {pct}% do objetivo</span>
      </div>

      {/* Funnel table */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="grid grid-cols-5 bg-muted/20 border-b">
          <div className="px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">KPI</div>
          {periods.map(p => (
            <div key={p} className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
              {GOAL_PERIOD_LABELS[p]}
            </div>
          ))}
        </div>
        <div className="divide-y">
          {rows.map(row => (
            <div key={row.key} className="grid grid-cols-5">
              <div className="px-5 py-3 text-sm font-medium">{row.label}</div>
              {periods.map(p => (
                <div key={p} className="px-4 py-3 text-sm tabular-nums text-right">
                  {fmt(row.key, (funnel[p] as Record<string, number>)[row.key] || 0)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Parameters */}
      {params.length > 0 && (
        <div className="rounded-2xl border p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Parâmetros do Funil</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {params.map(p => (
              <div key={p.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="font-medium tabular-nums">{p.value ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
