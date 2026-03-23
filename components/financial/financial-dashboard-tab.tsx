'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Wallet, Building2, FileSignature, FileCheck, CreditCard,
  Banknote, Target,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { FinancialDashboardData } from '@/types/financial'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
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
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-10 sm:px-12">
          <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">Visao Geral</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">Dashboard Financeiro</h2>
          <p className="text-neutral-400 mt-1.5 text-sm">{MONTHS[month - 1]} de {year}</p>
        </div>
      </div>

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
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <div className="grid gap-3 grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Top KPIs */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={Banknote} label="Facturacao" value={data.revenue_this_month} color="emerald" />
            <KpiCard icon={TrendingDown} label="Despesas" value={data.expenses_this_month} color="red" />
            <KpiCard icon={Wallet} label="Resultado" value={data.result_this_month} color={data.result_this_month >= 0 ? 'emerald' : 'red'} />
            <KpiCard icon={Target} label="Margem Liquida" value={data.margin_pct} color="blue" isCurrency={false} suffix="%" />
          </div>

          {/* Pipeline */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Pipeline Financeiro</h3>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              <PipelineCard
                icon={FileSignature}
                label="Assinado por receber"
                value={data.pipeline.signed_pending_receipt}
                color="amber"
              />
              <PipelineCard
                icon={FileCheck}
                label="Recebido por reportar"
                value={data.pipeline.received_pending_report}
                color="blue"
              />
              <PipelineCard
                icon={CreditCard}
                label="A pagar consultores"
                value={data.pipeline.pending_consultant_payment}
                color="purple"
              />
            </div>
          </div>

          {/* Monthly evolution */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Evolucao Mensal</h3>
            <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
              <div className="flex items-end gap-1 h-48">
                {data.monthly_evolution.map((item, idx) => {
                  const maxVal = Math.max(...data.monthly_evolution.map((i) => i.report), 1)
                  const barHeight = (item.report / maxVal) * 100
                  const marginHeight = (item.margin / maxVal) * 100

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col items-center justify-end h-40 relative">
                        {/* Report bar */}
                        <div
                          className="w-full rounded-t-md bg-neutral-200 dark:bg-neutral-700 transition-all duration-500"
                          style={{ height: `${barHeight}%` }}
                        >
                          {/* Margin overlay */}
                          <div
                            className="w-full rounded-t-md bg-emerald-500/40 absolute bottom-0"
                            style={{ height: `${marginHeight}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[8px] text-muted-foreground truncate w-full text-center">
                        {item.month.split('/')[0]}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-600" /> Report
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500/40" /> Margem
                </span>
              </div>
            </div>
          </div>

          {/* Portfolio */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Imoveis em Carteira</h3>
            <div className="grid gap-3 grid-cols-2">
              <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-xl p-2.5 bg-blue-500/10">
                    <Building2 className="h-4 w-4 text-blue-500" />
                  </div>
                </div>
                <p className="text-xl font-bold tabular-nums">{fmtCurrency(data.portfolio.active_volume)}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">Volume dos Imoveis Activos</p>
              </div>
              <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-xl p-2.5 bg-emerald-500/10">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                </div>
                <p className="text-xl font-bold tabular-nums">{fmtCurrency(data.portfolio.potential_revenue)}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">Facturacao Potencial</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, color, isCurrency = true, suffix }: {
  icon: React.ElementType; label: string; value: number; color: string; isCurrency?: boolean; suffix?: string
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
    red: { bg: 'bg-red-500/10', text: 'text-red-500' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
  }
  const c = colorMap[color] || colorMap.blue

  return (
    <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 transition-all duration-300 hover:shadow-md hover:bg-card/80">
      <div className={`rounded-xl p-2.5 w-fit ${c.bg}`}>
        <Icon className={`h-4 w-4 ${c.text}`} />
      </div>
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">{label}</p>
      <p className={`text-xl font-bold tracking-tight ${c.text}`}>
        {isCurrency ? fmtCurrency(value) : `${value}${suffix || ''}`}
      </p>
    </div>
  )
}

function PipelineCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string
}) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/20' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/20' },
  }
  const c = colorMap[color] || colorMap.blue

  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-4 transition-all duration-300`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${c.text}`} />
        <span className={`text-xs font-medium ${c.text}`}>{label}</span>
      </div>
      <p className={`text-lg font-bold tabular-nums ${c.text}`}>{fmtCurrency(value)}</p>
    </div>
  )
}
