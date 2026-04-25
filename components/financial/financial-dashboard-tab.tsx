'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Wallet, Building2, FileSignature, FileCheck, CreditCard,
  Banknote, Target,
} from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, LabelList,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { FinancialDashboardData } from '@/types/financial'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function FinancialDashboardTab() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<FinancialDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/financial/dashboard?month=${month}&year=${year}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      toast.error('Erro ao carregar dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [month, year])

  useEffect(() => { loadData() }, [loadData])

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(year - 1) } else setMonth(month - 1) }
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(year + 1) } else setMonth(month + 1) }

  return (
    <div className="space-y-5">
      {/* Month nav */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium px-2 min-w-[120px] text-center">{MONTHS[month - 1]} {year}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="space-y-5">
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-44 rounded-3xl" />
        </div>
      ) : (
        <>
          {/* ─── Sheet 1: Indicadores do mês (KPIs + pipeline) ──────────── */}
          <Card className="rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm p-6 space-y-6 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Indicadores do mês</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Facturação, despesas e margem em {MONTHS[month - 1]} de {year}
              </p>
            </div>

            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <KpiCard icon={Banknote} label="Facturação" value={fmtCurrency(data.revenue_this_month)} tone="positive" />
              <KpiCard icon={TrendingDown} label="Despesas" value={fmtCurrency(data.expenses_this_month)} tone="negative" />
              <KpiCard icon={Wallet} label="Resultado" value={fmtCurrency(data.result_this_month)} tone={data.result_this_month >= 0 ? 'positive' : 'negative'} />
              <KpiCard icon={Target} label="Margem líquida" value={`${data.margin_pct}%`} tone="info" />
            </div>

            <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-5 space-y-3">
              <p className="text-xs font-semibold tracking-tight">Pipeline financeiro</p>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                <PipelineCard
                  icon={FileSignature}
                  label="Assinado por receber"
                  value={data.pipeline.signed_pending_receipt}
                  tone="warning"
                />
                <PipelineCard
                  icon={FileCheck}
                  label="Recebido por reportar"
                  value={data.pipeline.received_pending_report}
                  tone="info"
                />
                <PipelineCard
                  icon={CreditCard}
                  label="A pagar consultores"
                  value={data.pipeline.pending_consultant_payment}
                  tone="purple"
                />
              </div>
            </div>
          </Card>

          {/* ─── Sheet 2: Evolução mensal ──────────────────────────────── */}
          <Card className="rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm p-6 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
            <div className="flex items-end justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Evolução mensal</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Volume reportado vs. margem realizada
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: '#94a3b8' }} /> Reportado
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: '#10b981' }} /> Margem
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-5">
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart
                  data={data.monthly_evolution}
                  margin={{ top: 24, right: 12, bottom: 0, left: -12 }}
                >
                  <defs>
                    <linearGradient id="bar-report" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.45} />
                    </linearGradient>
                    <linearGradient id="bar-margin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(v: string) => v.split('/')[0]}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [fmtCurrency(Number(value)), name === 'report' ? 'Reportado' : 'Margem']}
                    labelFormatter={(label: string) => `Mês ${label}`}
                    contentStyle={{
                      borderRadius: 12, fontSize: 12, border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--background) / 0.95)', backdropFilter: 'blur(8px)',
                    }}
                    cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  />
                  <Bar dataKey="report" name="Reportado" fill="url(#bar-report)" radius={[6, 6, 0, 0]} maxBarSize={28}>
                    <LabelList
                      dataKey="report"
                      position="top"
                      fontSize={9}
                      fill="#64748b"
                      formatter={(v: number) => v > 0 ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)) : ''}
                    />
                  </Bar>
                  <Bar dataKey="margin" name="Margem" fill="url(#bar-margin)" radius={[6, 6, 0, 0]} maxBarSize={28}>
                    <LabelList
                      dataKey="margin"
                      position="top"
                      fontSize={9}
                      fill="#10b981"
                      formatter={(v: number) => v > 0 ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)) : ''}
                    />
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* ─── Sheet 3: Imóveis em carteira ──────────────────────────── */}
          <Card className="rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm p-6 space-y-5 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Imóveis em carteira</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Volume activo e facturação potencial
              </p>
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <KpiCard
                icon={Building2}
                label="Volume dos imóveis activos"
                value={fmtCurrency(data.portfolio.active_volume)}
                tone="info"
              />
              <KpiCard
                icon={TrendingUp}
                label="Facturação potencial"
                value={fmtCurrency(data.portfolio.potential_revenue)}
                tone="positive"
              />
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

// ─── KPI Card (mesmo padrão do ConsultorResumo) ───────────────────────────

function KpiCard({
  icon: Icon, label, value, tone = 'neutral', hint,
}: {
  icon: React.ElementType
  label: string
  value: string
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'info'
  hint?: React.ReactNode
}) {
  const toneMap = {
    neutral: { from: 'from-slate-500/10', icon: 'text-slate-600 dark:text-slate-300', accent: 'bg-slate-400/40' },
    positive: { from: 'from-emerald-500/15', icon: 'text-emerald-600', accent: 'bg-emerald-500/60' },
    negative: { from: 'from-red-500/15', icon: 'text-red-600', accent: 'bg-red-500/60' },
    warning: { from: 'from-amber-500/15', icon: 'text-amber-600', accent: 'bg-amber-500/60' },
    info: { from: 'from-blue-500/15', icon: 'text-blue-600', accent: 'bg-blue-500/60' },
  }[tone]

  return (
    <div className={cn(
      'group relative overflow-hidden rounded-2xl bg-gradient-to-br to-transparent',
      'ring-1 ring-border/40 p-4 transition-all duration-300',
      'hover:ring-border/70 hover:shadow-[0_4px_20px_-4px_rgb(0_0_0_/_0.08)]',
      toneMap.from,
    )}>
      <span className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full', toneMap.accent)} />

      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', toneMap.icon)} />
        <p className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</p>
      </div>
      <p className="text-base sm:text-2xl font-semibold tracking-tight tabular-nums mt-2.5 text-foreground break-words">
        {value}
      </p>
      {hint && <div className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

// ─── Pipeline Card ────────────────────────────────────────────────────────

function PipelineCard({
  icon: Icon, label, value, tone,
}: {
  icon: React.ElementType
  label: string
  value: number
  tone: 'warning' | 'info' | 'purple'
}) {
  const toneMap = {
    warning: { from: 'from-amber-500/15', icon: 'text-amber-600', accent: 'bg-amber-500/60' },
    info: { from: 'from-blue-500/15', icon: 'text-blue-600', accent: 'bg-blue-500/60' },
    purple: { from: 'from-purple-500/15', icon: 'text-purple-600', accent: 'bg-purple-500/60' },
  }[tone]

  return (
    <div className={cn(
      'group relative overflow-hidden rounded-2xl bg-gradient-to-br to-transparent',
      'ring-1 ring-border/40 p-4 transition-all duration-300',
      'hover:ring-border/70 hover:shadow-[0_4px_20px_-4px_rgb(0_0_0_/_0.08)]',
      toneMap.from,
    )}>
      <span className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full', toneMap.accent)} />

      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', toneMap.icon)} />
        <p className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</p>
      </div>
      <p className="text-base sm:text-xl font-semibold tracking-tight tabular-nums mt-2 text-foreground break-words">
        {fmtCurrency(value)}
      </p>
    </div>
  )
}
