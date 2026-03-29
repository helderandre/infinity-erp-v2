'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import {
  Megaphone, Euro, MousePointerClick, Eye, Users, TrendingUp,
  Target, Award, Calendar, RefreshCw, ArrowUpRight, BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface CampaignMetrics {
  campaign: {
    id: string; name: string; platform: string
    status: string; sector: string | null; budget: number | null
  }
  metrics: {
    spend: number; impressions: number; clicks: number
    platform_leads: number; ctr: number | null; cpl_platform: number | null
    entries: number; contacted: number; qualified: number
    converted: number; won: number; revenue: number
    contact_rate: number | null; qualify_rate: number | null
    convert_rate: number | null; win_rate: number | null
    cost_per_qualified: number | null; cost_per_won: number | null
    roas: number | null; days: number
  } | null
}

interface Totals {
  spend: number; impressions: number; clicks: number
  platform_leads: number; entries: number; contacted: number
  qualified: number; converted: number; won: number; revenue: number
  cost_per_qualified: number | null; cost_per_won: number | null; roas: number | null
}

const PLATFORM_LABELS: Record<string, string> = {
  meta: 'Meta Ads', google: 'Google Ads', website: 'Website',
  landing_page: 'Landing Page', other: 'Outro',
}
const PLATFORM_COLORS: Record<string, string> = {
  meta: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  google: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  website: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  landing_page: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
  other: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const PERIODS = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
]

export default function CampaignAnalyticsPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-96 rounded-2xl" /></div>}>
      <CampaignAnalyticsContent />
    </Suspense>
  )
}

function CampaignAnalyticsContent() {
  const [data, setData] = useState<CampaignMetrics[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const [platformFilter, setPlatformFilter] = useState('')

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const from = new Date(Date.now() - parseInt(period) * 86400000).toISOString().split('T')[0]
      const params = new URLSearchParams({ from })
      if (platformFilter) params.set('platform', platformFilter)
      const res = await fetch(`/api/crm/analytics/campaigns?${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json.campaigns ?? [])
        setTotals(json.totals ?? null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [period, platformFilter])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Desempenho de Campanhas</h2>
          <p className="text-neutral-400 mt-1.5 text-sm">
            Métricas de plataforma (Meta/Google) combinadas com dados de conversão do ERP.
          </p>
          <div className="mt-3">
            <Button size="sm" variant="ghost" asChild
              className="rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20 text-xs">
              <Link href="/dashboard/crm/analytics">
                <BarChart3 className="h-3 w-3 mr-1.5" />
                Ver Analytics de Consultores
              </Link>
            </Button>
          </div>
        </div>
        <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
          <Select value={platformFilter || 'all'} onValueChange={v => setPlatformFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[130px] h-8 rounded-full text-xs bg-white/10 backdrop-blur-sm text-white border-white/20">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(PLATFORM_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[110px] h-8 rounded-full text-xs bg-white/10 backdrop-blur-sm text-white border-white/20">
              <Calendar className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={fetchData} disabled={isLoading}
            className="rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20 h-8 w-8 p-0">
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Global KPIs */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <KpiCard icon={Euro} label="Investimento" value={fmt.currency(totals.spend)} color="red" />
          <KpiCard icon={Users} label="Leads ERP" value={totals.entries} color="blue" />
          <KpiCard icon={Target} label="Custo/Qualificada" value={totals.cost_per_qualified ? fmt.currency(totals.cost_per_qualified) : '—'} color="amber" />
          <KpiCard icon={Award} label="Custo/Venda" value={totals.cost_per_won ? fmt.currency(totals.cost_per_won) : '—'} color="purple" />
          <KpiCard icon={TrendingUp} label="ROAS" value={totals.roas ? `${totals.roas.toFixed(1)}x` : '—'}
            color={totals.roas && totals.roas >= 1 ? 'emerald' : 'red'} />
        </div>
      )}

      {/* Funnel overview */}
      {totals && totals.entries > 0 && (
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Funil Global de Campanhas
          </h3>
          <FunnelBar steps={[
            { label: 'Leads (plataforma)', value: totals.platform_leads, color: 'bg-slate-400' },
            { label: 'Entradas ERP', value: totals.entries, color: 'bg-blue-500' },
            { label: 'Contactadas', value: totals.contacted, color: 'bg-sky-500' },
            { label: 'Qualificadas', value: totals.qualified, color: 'bg-indigo-500' },
            { label: 'Convertidas', value: totals.converted, color: 'bg-purple-500' },
            { label: 'Ganhas', value: totals.won, color: 'bg-emerald-500' },
          ]} />
        </div>
      )}

      {/* Campaign Table */}
      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Megaphone className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-medium">Sem dados de campanhas</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Crie campanhas e aguarde o sync diário, ou execute-o manualmente.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              Campanhas ({data.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30 text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-medium">Campanha</th>
                  <th className="text-right px-3 py-2.5 font-medium">Gasto</th>
                  <th className="text-center px-3 py-2.5 font-medium">Leads</th>
                  <th className="text-center px-3 py-2.5 font-medium">CPL</th>
                  <th className="text-center px-3 py-2.5 font-medium">Contacto</th>
                  <th className="text-center px-3 py-2.5 font-medium">Qualif.</th>
                  <th className="text-center px-3 py-2.5 font-medium">CPQ</th>
                  <th className="text-center px-3 py-2.5 font-medium">Vendas</th>
                  <th className="text-right px-3 py-2.5 font-medium">Receita</th>
                  <th className="text-center px-4 py-2.5 font-medium">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data
                  .sort((a, b) => (b.metrics?.revenue ?? 0) - (a.metrics?.revenue ?? 0))
                  .map(({ campaign: c, metrics: m }) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-[8px] rounded-full px-1.5 shrink-0", PLATFORM_COLORS[c.platform])}>
                            {c.platform === 'meta' ? 'M' : c.platform === 'google' ? 'G' : c.platform[0].toUpperCase()}
                          </Badge>
                          <span className="font-medium truncate max-w-[200px]">{c.name}</span>
                          {c.status !== 'active' && (
                            <Badge variant="outline" className="text-[8px] rounded-full px-1.5 opacity-50">
                              {c.status === 'paused' ? 'Pausada' : 'Terminada'}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-right px-3 py-3 font-medium">{m ? fmt.currency(m.spend) : '—'}</td>
                      <td className="text-center px-3 py-3">
                        {m ? (
                          <span>{m.entries}<span className="text-muted-foreground ml-0.5">/{m.platform_leads}</span></span>
                        ) : '—'}
                      </td>
                      <td className="text-center px-3 py-3">{m?.cpl_platform ? fmt.currency(m.cpl_platform) : '—'}</td>
                      <td className="text-center px-3 py-3">
                        <RatePill value={m?.contact_rate} />
                      </td>
                      <td className="text-center px-3 py-3">{m?.qualified ?? '—'}</td>
                      <td className="text-center px-3 py-3">{m?.cost_per_qualified ? fmt.currency(m.cost_per_qualified) : '—'}</td>
                      <td className="text-center px-3 py-3">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{m?.won ?? 0}</span>
                      </td>
                      <td className="text-right px-3 py-3 font-medium">{m ? fmt.currency(m.revenue) : '—'}</td>
                      <td className="text-center px-4 py-3">
                        {m?.roas ? (
                          <span className={cn(
                            "inline-flex items-center gap-0.5 font-medium",
                            m.roas >= 1 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                          )}>
                            {m.roas >= 1 ? <ArrowUpRight className="h-3 w-3" /> : null}
                            {m.roas.toFixed(1)}x
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function KpiCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; color: string
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-600 dark:text-blue-400' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600 dark:text-amber-400' },
    red: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-600 dark:text-red-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950', text: 'text-purple-600 dark:text-purple-400' },
  }
  const c = colorMap[color] ?? colorMap.blue
  return (
    <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 transition-all hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn("p-2.5 rounded-xl", c.bg)}><Icon className={cn("h-5 w-5", c.text)} /></div>
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-[11px] text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  )
}

function RatePill({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span>—</span>
  const r = Math.round(value)
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
      r >= 80 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" :
      r >= 50 ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400" :
      "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
    )}>
      {r}%
    </span>
  )
}

function FunnelBar({ steps }: { steps: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...steps.map(s => s.value), 1)
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const pct = (step.value / max) * 100
        const convPrev = i > 0 && steps[i - 1].value > 0
          ? Math.round((step.value / steps[i - 1].value) * 100) : null
        return (
          <div key={step.label} className="flex items-center gap-4">
            <div className="w-32 text-right"><p className="text-xs font-medium">{step.label}</p></div>
            <div className="flex-1 h-7 bg-muted/30 rounded-full overflow-hidden relative">
              <div className={cn("h-full rounded-full transition-all duration-700", step.color)}
                style={{ width: `${Math.max(pct, 2)}%` }} />
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium mix-blend-difference text-white">
                {step.value}
              </span>
            </div>
            <div className="w-10 text-right">
              {convPrev !== null ? (
                <span className={cn("text-[10px] font-medium",
                  convPrev >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                )}>{convPrev}%</span>
              ) : <span className="text-[10px] text-muted-foreground">—</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// Formatters
// ============================================================================

const fmt = {
  currency: (v: number) => {
    if (v === 0) return '0 €'
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M €`
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k €`
    return `${v.toFixed(0)} €`
  },
}
