// @ts-nocheck
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { usePermissions } from '@/hooks/use-permissions'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  TrendingUp, TrendingDown, Minus, Building2, Target, Euro,
  Trophy, Calendar, AlertTriangle, AlertCircle,
  ArrowRight, Clock, FileSignature, Home, Handshake,
  PiggyBank, Receipt, Wallet,
  MapPin, FileCheck, UserCheck, ChevronRight, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getAgentDashboard,
} from '@/app/dashboard/financeiro/actions'
import {
  getDrillDownProperties,
  getDrillDownTransactions,
} from '@/app/dashboard/drill-down-actions'
import type {
  AgentDashboard as AgentData,
} from '@/types/financial'
import Link from 'next/link'
import { MobileDashboard } from '@/components/dashboard/mobile/mobile-dashboard'
import { ManagerMobileDashboard } from '@/components/dashboard/mobile/manager-mobile-dashboard'
import { ManagementDashboard } from '@/components/dashboard/management-dashboard'
import { ConsultorDashboard } from '@/components/dashboard/consultor-dashboard'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import {
  DrillDownSheet,
  type DrillDownConfig,
} from '@/components/dashboard/shared/drill-down-sheet'

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const fmtFull = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const fmtCompact = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1,
})

function today() {
  return new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function startOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

// DrillDownSheet + DrillDownConfig moved to
// components/dashboard/shared/drill-down-sheet.tsx — imported above.

// ─── Mini Sparkline SVG ──────────────────────────────────────────────────────

function MiniSparkline({ data, color, height = 32, width = 64 }: {
  data: number[]; color: string; height?: number; width?: number
}) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height * 0.8) - height * 0.1
    return `${x},${y}`
  }).join(' ')

  const trend = data[data.length - 1] >= data[data.length - 2]

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trend ? '#10b981' : '#ef4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={trend ? '#10b981' : '#ef4444'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={trend ? '#10b981' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor, valueColor, onClick, trend, sparkData }: {
  label: string; value: string; sub?: string; icon: React.ElementType
  iconBg: string; iconColor: string; valueColor?: string; onClick?: () => void
  trend?: { value: number; label: string }; sparkData?: number[]
}) {
  const Comp = onClick ? 'button' : 'div'
  const isUp = trend && trend.value >= 0
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'relative rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-md hover:border-neutral-300 dark:hover:border-white/20 text-left w-full overflow-hidden',
        onClick && 'cursor-pointer group'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-2">{label}</p>
          <p className={cn('text-lg sm:text-2xl font-bold tracking-tight tabular-nums truncate', valueColor)}>{value}</p>
          <div className="flex items-center gap-2 mt-1">
            {trend && (
              <span className={cn(
                'inline-flex items-center gap-0.5 text-[11px] font-medium',
                isUp ? 'text-emerald-600' : 'text-red-500'
              )}>
                {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {isUp ? '+' : ''}{trend.value}%
              </span>
            )}
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          </div>
        </div>
        {sparkData && sparkData.length > 1 && (
          <div className="shrink-0 mt-1">
            <MiniSparkline data={sparkData} color={label.replace(/\s/g, '')} />
          </div>
        )}
        {!sparkData && onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground shrink-0 transition-colors mt-2" />}
      </div>
    </Comp>
  )
}

// ─── Mini stat row ───────────────────────────────────────────────────────────

function MiniStat({ label, value, accent, onClick }: {
  label: string; value: string | number; accent?: string; onClick?: () => void
}) {
  if (onClick) {
    return (
      <button onClick={onClick}
        className="flex items-center justify-between w-full text-left rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 px-3.5 py-2.5 mb-1.5 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors group"
      >
        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
        <span className="flex items-center gap-1.5">
          <span className={cn('text-xs font-bold tabular-nums', accent)}>{value}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
        </span>
      </button>
    )
  }
  return (
    <div className="flex items-center justify-between rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 px-3.5 py-2.5 mb-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-bold tabular-nums', accent)}>{value}</span>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function AgentDashboardView({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter()
  const [data, setData] = useState<AgentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetConfig, setSheetConfig] = useState<DrillDownConfig | null>(null)

  const openDrillDown = useCallback((config: DrillDownConfig) => {
    setSheetConfig(config); setSheetOpen(true)
  }, [])

  useEffect(() => {
    getAgentDashboard(userId).then(res => {
      if (!res.error) { const { error: _, ...rest } = res; setData(rest) }
      setLoading(false)
    })
  }, [userId])

  if (loading || !data) return <DashboardSkeleton />

  const barMax = Math.max(...data.monthly_evolution.map(m => Math.max(m.revenue, m.target)), 1)
  const pctRing = Math.min(data.pct_achieved, 100)
  const monthlyTarget = data.annual_target / 12
  const monthlyPct = monthlyTarget > 0 ? Math.min((data.revenue_this_month / monthlyTarget) * 100, 100) : 0

  const actionIcons: Record<string, React.ElementType> = {
    visit: MapPin, cpcv: FileSignature, escritura: FileCheck,
    contract_expiry: Clock, lead_followup: UserCheck,
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <DrillDownSheet config={sheetConfig} open={sheetOpen} onOpenChange={setSheetOpen} />

      {/* Hero */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-2xl shadow-xl shadow-neutral-900/20">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/15 via-transparent to-violet-600/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/85 to-neutral-900/70" />
        <div className="relative z-10 px-8 py-8 sm:px-10 sm:py-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase mb-1">O Meu Espaço</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Olá, {userName.split(' ')[0]}</h1>
              <p className="text-neutral-500 text-sm capitalize mt-0.5">{today()}</p>
            </div>
            <div className="hidden md:flex items-center gap-6">
              {/* Progress ring */}
              <div className="relative h-16 w-16">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className={pctRing >= 80 ? 'text-emerald-400' : pctRing >= 50 ? 'text-amber-400' : 'text-red-400'}
                    strokeDasharray={`${pctRing} ${100 - pctRing}`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                  {Math.round(data.pct_achieved)}%
                </span>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-white tabular-nums">{fmt.format(data.revenue_ytd)}</p>
                <p className="text-[10px] text-neutral-400 uppercase tracking-wider">de {fmtCompact.format(data.annual_target)}</p>
              </div>
              {data.ranking_position > 0 && (
                <>
                  <div className="h-10 w-px bg-white/10" />
                  <Badge variant="outline" className="text-sm px-3 py-1.5 gap-1.5 border-white/20 text-white rounded-full">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    #{data.ranking_position}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Facturação YTD" value={fmt.format(data.revenue_ytd)} icon={Euro}
          iconBg="bg-neutral-100 dark:bg-white/10" iconColor="text-foreground"
          onClick={() => openDrillDown({ title: 'As Minhas Transacções (Ano)', fetcher: () => getDrillDownTransactions({ consultant_id: userId, date_from: `${new Date().getFullYear()}-01-01` }) })}
        />
        <KpiCard label="Este Mês" value={fmt.format(data.revenue_this_month)} icon={Receipt}
          iconBg="bg-neutral-100 dark:bg-white/10" iconColor="text-foreground"
          onClick={() => openDrillDown({ title: 'Transacções Este Mês', fetcher: () => getDrillDownTransactions({ consultant_id: userId, date_from: startOfMonth() }) })}
        />
        <KpiCard label="Objectivo Anual" value={fmt.format(data.annual_target)} icon={Target}
          iconBg="bg-neutral-100 dark:bg-white/10" iconColor="text-foreground"
        />
        <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex items-center gap-4">
          <div className="relative h-14 w-14 shrink-0">
            <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5"
                className={pctRing >= 80 ? 'text-emerald-500' : pctRing >= 50 ? 'text-amber-500' : 'text-red-500'}
                strokeDasharray={`${pctRing} ${100 - pctRing}`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{Math.round(data.pct_achieved)}%</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Atingido</p>
            <p className="text-sm font-bold">{fmt.format(data.revenue_ytd)}</p>
            <p className="text-[11px] text-muted-foreground">de {fmt.format(data.annual_target)}</p>
          </div>
        </div>
      </div>

      {/* Row 2: Properties + Objectives */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* My Properties */}
        <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
          <h3 className="text-sm font-semibold mb-4">Os Meus Imóveis</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Ativas', value: data.my_properties.active, status: 'active' },
              { label: 'Reservadas', value: data.my_properties.reserved, status: 'reserved' },
              { label: 'Vendidas', value: data.my_properties.sold_year, status: 'sold' },
              { label: 'Volume', value: fmtCompact.format(data.my_properties.volume), status: null },
            ].map(tile => tile.status ? (
              <button key={tile.label} onClick={() => openDrillDown({ title: `Os Meus Imóveis — ${tile.label}`, fetcher: () => getDrillDownProperties({ consultant_id: userId, status: tile.status }) })}
                className="rounded-xl p-4 text-center transition-all hover:shadow-md cursor-pointer group bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10"
              >
                <p className="text-2xl font-bold tabular-nums">{tile.value}</p>
                <p className="text-[11px] text-muted-foreground">{tile.label}</p>
              </button>
            ) : (
              <div key={tile.label} className="rounded-xl p-4 text-center bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10">
                <p className="text-xl font-bold tabular-nums">{tile.value}</p>
                <p className="text-[11px] text-muted-foreground">{tile.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Objectives */}
        <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
          <h3 className="text-sm font-semibold mb-4">Objectivos vs Realizado</h3>
          <div className="space-y-5">
            {[
              { label: 'Anual', actual: data.revenue_ytd, target: data.annual_target, pct: data.pct_achieved },
              { label: 'Mensal', actual: data.revenue_this_month, target: monthlyTarget, pct: monthlyPct },
            ].map(obj => (
              <div key={obj.label}>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium">{obj.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {fmtCompact.format(obj.actual)} / {fmtCompact.format(obj.target)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden">
                    <div className={cn(
                      'h-full rounded-full transition-all duration-500',
                      obj.pct >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                      obj.pct >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                      'bg-gradient-to-r from-red-400 to-red-600'
                    )} style={{ width: `${Math.min(obj.pct, 100)}%` }} />
                  </div>
                  <span className={cn(
                    'text-sm font-bold tabular-nums w-12 text-right',
                    obj.pct >= 80 ? 'text-emerald-600' : obj.pct >= 50 ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {Math.round(obj.pct)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Actions + Comparison */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Actions */}
        <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
          <h3 className="text-sm font-semibold mb-4">Próximas Acções</h3>
          {data.upcoming_actions.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Sparkles className="h-6 w-6 mb-2 opacity-40" />
              <p className="text-sm">Sem acções pendentes</p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.upcoming_actions.slice(0, 7).map((a, i) => {
                const Icon = actionIcons[a.type] || Calendar
                const isToday = a.date === new Date().toISOString().split('T')[0]
                return (
                  <Link key={i} href={a.link || '#'}
                    className={cn('flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted/30 transition-colors group', isToday && 'bg-blue-500/10')}
                  >
                    <div className={cn('rounded-lg p-2', isToday ? 'bg-blue-500/15 text-blue-600' : 'bg-muted/50 text-muted-foreground')}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{a.title}</p>
                      {a.property_ref && <p className="text-[11px] text-muted-foreground">{a.property_ref}</p>}
                    </div>
                    <p className={cn('text-xs font-medium shrink-0', isToday ? 'text-blue-600' : 'text-muted-foreground')}>
                      {isToday ? 'Hoje' : new Date(a.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Vs Average */}
        <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
          <h3 className="text-sm font-semibold mb-4">Eu vs Média da Agência</h3>
          {data.vs_average.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem dados</p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-[10px] text-muted-foreground uppercase tracking-wider mb-2 px-1">
                <span /><span className="text-right">Eu</span><span className="text-right">Média</span><span />
              </div>
              {data.vs_average.map((v, i) => {
                const DirIcon = v.direction === 'above' ? TrendingUp : v.direction === 'below' ? TrendingDown : Minus
                const dirClass = v.direction === 'above' ? 'text-foreground bg-neutral-100 dark:bg-white/10' : v.direction === 'below' ? 'text-muted-foreground bg-neutral-100 dark:bg-white/10' : 'text-muted-foreground bg-neutral-100 dark:bg-white/10'
                return (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center py-3 border-b border-border/50 last:border-0 px-1">
                    <span className="text-sm">{v.metric}</span>
                    <span className="text-sm font-bold tabular-nums text-right">{fmtCompact.format(v.my_value)}</span>
                    <span className="text-sm text-muted-foreground tabular-nums text-right">{fmtCompact.format(v.agency_avg)}</span>
                    <div className={cn('rounded-full p-1', dirClass)}><DirIcon className="h-3 w-3" /></div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Row 4: Monthly Evolution */}
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">Evolução Mensal</h3>
            <p className="text-[11px] text-muted-foreground">Facturação por mês vs objectivo</p>
          </div>
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-5 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" />Facturação</span>
            <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-amber-400" />Objectivo</span>
          </div>
        </div>
        <div className="flex items-end gap-1 h-44">
          {data.monthly_evolution.map((m, i) => {
            const h = Math.max((m.revenue / barMax) * 100, 3)
            const tH = Math.max((m.target / barMax) * 100, 0)
            return (
              <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                {/* Target line */}
                {m.target > 0 && (
                  <div className="absolute w-[calc(100%+2px)] border-t-2 border-dashed border-amber-400/40" style={{ bottom: `${tH}%` }} />
                )}
                <div className="w-full rounded-t-md bg-gradient-to-t from-blue-500 to-blue-400 opacity-80 group-hover:opacity-100 transition-all"
                  style={{ height: `${h}%` }}
                />
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-neutral-900 text-white rounded-lg px-3 py-2 text-xs shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                  <p className="font-semibold">{m.month}</p>
                  <p className="text-neutral-300">Receita: {fmtFull.format(m.revenue)}</p>
                  <p className="text-neutral-400">Meta: {fmtFull.format(m.target)}</p>
                </div>
                <span className="text-[8px] text-muted-foreground mt-1.5 truncate w-full text-center">{m.month}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT PERSONAL SECTION (for managers — own objectives + agenda)
// ═══════════════════════════════════════════════════════════════════════════════

function AgentPersonalSection({ userId }: { userId: string }) {
  const [data, setData] = useState<AgentData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAgentDashboard(userId).then(res => {
      if (!res.error) { const { error: _, ...rest } = res; setData(rest) }
      setLoading(false)
    })
  }, [userId])

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }
  if (!data) return null

  const monthlyTarget = data.annual_target / 12
  const monthlyPct = monthlyTarget > 0 ? Math.min((data.revenue_this_month / monthlyTarget) * 100, 100) : 0

  const actionIcons: Record<string, React.ElementType> = {
    visit: MapPin, cpcv: FileSignature, escritura: FileCheck,
    contract_expiry: Clock, lead_followup: UserCheck,
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Objectives */}
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
        <h3 className="text-sm font-semibold mb-4">Os Meus Objectivos</h3>
        <div className="space-y-5">
          {[
            { label: 'Anual', actual: data.revenue_ytd, target: data.annual_target, pct: data.pct_achieved },
            { label: 'Mensal', actual: data.revenue_this_month, target: monthlyTarget, pct: monthlyPct },
          ].map(obj => (
            <div key={obj.label}>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">{obj.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {fmtCompact.format(obj.actual)} / {fmtCompact.format(obj.target)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden">
                  <div className={cn(
                    'h-full rounded-full transition-all duration-500',
                    obj.pct >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                    obj.pct >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                    'bg-gradient-to-r from-red-400 to-red-600'
                  )} style={{ width: `${Math.min(obj.pct, 100)}%` }} />
                </div>
                <span className={cn(
                  'text-sm font-bold tabular-nums w-12 text-right',
                  obj.pct >= 80 ? 'text-emerald-600' : obj.pct >= 50 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {Math.round(obj.pct)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Actions */}
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
        <h3 className="text-sm font-semibold mb-4">Próximas Acções</h3>
        {data.upcoming_actions.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <Sparkles className="h-6 w-6 mb-2 opacity-40" />
            <p className="text-sm">Sem acções pendentes</p>
          </div>
        ) : (
          <div className="space-y-1">
            {data.upcoming_actions.slice(0, 7).map((a, i) => {
              const Icon = actionIcons[a.type] || Calendar
              const isToday = a.date === new Date().toISOString().split('T')[0]
              return (
                <Link key={i} href={a.link || '#'}
                  className={cn('flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted/30 transition-colors group', isToday && 'bg-blue-500/10')}
                >
                  <div className={cn('rounded-lg p-2', isToday ? 'bg-blue-500/15 text-blue-600' : 'bg-muted/50 text-muted-foreground')}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{a.title}</p>
                    {a.property_ref && <p className="text-[11px] text-muted-foreground">{a.property_ref}</p>}
                  </div>
                  <p className={cn('text-xs font-medium shrink-0', isToday ? 'text-blue-600' : 'text-muted-foreground')}>
                    {isToday ? 'Hoje' : new Date(a.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser()
  const { hasPermission, isBroker, loading: permLoading } = usePermissions()

  if (userLoading || permLoading || !user) return <DashboardSkeleton />

  const isManagement = isBroker() || hasPermission('financial' as any)

  return (
    <>
      <div className="md:hidden">
        {isManagement ? (
          <ManagerMobileDashboard user={user} />
        ) : (
          <MobileDashboard user={user} />
        )}
      </div>
      <div className="hidden md:block">
        {isManagement ? (
          <div className="space-y-5">
            <DashboardHero user={user} />
            <ManagementDashboard />
            <AgentPersonalSection userId={user.id} />
          </div>
        ) : (
          <ConsultorDashboard user={user} />
        )}
      </div>
    </>
  )
}
