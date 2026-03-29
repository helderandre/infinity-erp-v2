'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import {
  BarChart3, Clock, PhoneCall, TrendingUp, Users, Target,
  Euro, CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight,
  RefreshCw, ChevronDown, Calendar, Megaphone,
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

interface AgentMetrics {
  agent: { id: string; name: string; active_leads: number }
  period: { from: string; to: string }
  entries: {
    total: number; contacted: number; not_contacted: number
    by_status: Record<string, number>
    by_source: Record<string, number>
  }
  response: {
    avg_minutes: number | null
    median_minutes: number | null
    sla_compliance_pct: number | null
  }
  negocios: {
    total: number; active: number; won: number; lost: number
    revenue: number; win_rate: number | null
  }
  funnel: {
    entries: number; contacted: number; qualified: number; converted: number; won: number
    contact_rate: number | null; qualify_rate: number | null
    convert_rate: number | null; win_rate: number | null
  }
  activities: { total: number; by_type: Record<string, number> }
}

const SOURCE_LABELS: Record<string, string> = {
  meta_ads: 'Meta', google_ads: 'Google', website: 'Web',
  landing_page: 'LP', partner: 'Parceiro', organic: 'Orgânico',
  walk_in: 'Walk-in', phone_call: 'Tel', social_media: 'Social', other: 'Outro',
}

const ACTIVITY_LABELS: Record<string, string> = {
  call: 'Chamadas', email: 'Emails', whatsapp: 'WhatsApp', sms: 'SMS',
  note: 'Notas', visit: 'Visitas', stage_change: 'Mudanças', assignment: 'Atribuições',
}

const PERIODS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
]

// ============================================================================
// Page
// ============================================================================

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-96 rounded-2xl" /></div>}>
      <AnalyticsContent />
    </Suspense>
  )
}

function AnalyticsContent() {
  const [data, setData] = useState<AgentMetrics[]>([])
  const [allAgents, setAllAgents] = useState<AgentMetrics[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const [selectedAgent, setSelectedAgent] = useState<string>('')

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const from = new Date(Date.now() - parseInt(period) * 86400000).toISOString()
      const params = new URLSearchParams({ from })
      if (selectedAgent) params.set('agent_id', selectedAgent)
      const res = await fetch(`/api/crm/analytics/agents?${params}`)
      if (res.ok) {
        const json = await res.json()
        const agents = json.agents ?? []
        setData(agents)
        // Keep the full agent list when fetching without filter
        if (!selectedAgent) setAllAgents(agents)
      }
    } finally {
      setIsLoading(false)
    }
  }, [period, selectedAgent])

  useEffect(() => { fetchData() }, [fetchData])

  // Aggregate totals across all agents (when no specific agent selected)
  const totals = data.reduce(
    (acc, m) => ({
      entries: acc.entries + m.entries.total,
      contacted: acc.contacted + m.entries.contacted,
      qualified: acc.qualified + m.funnel.qualified,
      converted: acc.converted + m.funnel.converted,
      won: acc.won + m.negocios.won,
      lost: acc.lost + m.negocios.lost,
      revenue: acc.revenue + m.negocios.revenue,
      activities: acc.activities + m.activities.total,
    }),
    { entries: 0, contacted: 0, qualified: 0, converted: 0, won: 0, lost: 0, revenue: 0, activities: 0 }
  )

  const avgResponse = data.length
    ? Math.round(data.reduce((s, m) => s + (m.response.avg_minutes ?? 0), 0) / data.filter(m => m.response.avg_minutes !== null).length || 0)
    : null

  const avgSla = data.length
    ? Math.round(data.reduce((s, m) => s + (m.response.sla_compliance_pct ?? 0), 0) / data.filter(m => m.response.sla_compliance_pct !== null).length || 0)
    : null

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-neutral-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">CRM</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Analytics de Consultores</h2>
          <p className="text-neutral-400 mt-1.5 text-sm">
            Métricas de desempenho, tempos de resposta, funil de conversão e actividade.
          </p>
          <div className="mt-3">
            <Button size="sm" variant="ghost" asChild
              className="rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20 text-xs">
              <Link href="/dashboard/crm/analytics/campanhas">
                <Megaphone className="h-3 w-3 mr-1.5" />
                Ver Analytics de Campanhas
              </Link>
            </Button>
          </div>
        </div>
        <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px] h-8 rounded-full text-xs bg-white/10 backdrop-blur-sm text-white border-white/20">
              <Calendar className="h-3 w-3 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="ghost" size="sm" onClick={fetchData} disabled={isLoading}
            className="rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20 h-8"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Agent Filter */}
      {allAgents.length > 1 && (
        <div className="flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSelectedAgent('')}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors duration-300 shrink-0',
              !selectedAgent
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            Todos
          </button>
          {allAgents.map(m => (
            <button
              key={m.agent.id}
              onClick={() => setSelectedAgent(m.agent.id === selectedAgent ? '' : m.agent.id)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-colors duration-300 shrink-0',
                selectedAgent === m.agent.id
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              {m.agent.name?.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {isLoading && !data.length ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={Target} label="Leads Recebidas" value={totals.entries} color="blue" />
            <KpiCard icon={PhoneCall} label="Contactadas" value={totals.contacted}
              subtitle={totals.entries ? `${Math.round((totals.contacted / totals.entries) * 100)}%` : undefined}
              color="emerald" />
            <KpiCard icon={Clock} label="Tempo Médio Resposta"
              value={avgResponse !== null ? formatMinutes(avgResponse) : '—'}
              color="amber" />
            <KpiCard icon={CheckCircle2} label="SLA Compliance"
              value={avgSla !== null ? `${avgSla}%` : '—'}
              color={avgSla !== null && avgSla >= 80 ? 'emerald' : avgSla !== null && avgSla >= 50 ? 'amber' : 'red'} />
            <KpiCard icon={TrendingUp} label="Negócios Ganhos" value={totals.won} color="emerald" />
            <KpiCard icon={XCircle} label="Negócios Perdidos" value={totals.lost} color="red" />
            <KpiCard icon={Euro} label="Receita" value={formatCurrency(totals.revenue)} color="emerald" />
            <KpiCard icon={BarChart3} label="Actividades" value={totals.activities} color="indigo" />
          </div>

          {/* Funnel */}
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Funil de Conversão
            </h3>
            <FunnelChart
              steps={[
                { label: 'Leads', value: totals.entries, color: 'bg-blue-500' },
                { label: 'Contactadas', value: totals.contacted, color: 'bg-sky-500' },
                { label: 'Qualificadas', value: totals.qualified, color: 'bg-indigo-500' },
                { label: 'Convertidas', value: totals.converted, color: 'bg-purple-500' },
                { label: 'Ganhas', value: totals.won, color: 'bg-emerald-500' },
              ]}
            />
          </div>

          {/* Agent Comparison Table */}
          {data.length > 1 && !selectedAgent && (
            <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
              <div className="px-5 py-4 border-b">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Comparação de Consultores
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-medium">Consultor</th>
                      <th className="text-center px-3 py-2.5 font-medium">Leads</th>
                      <th className="text-center px-3 py-2.5 font-medium">Contacto</th>
                      <th className="text-center px-3 py-2.5 font-medium">Tempo Resp.</th>
                      <th className="text-center px-3 py-2.5 font-medium">SLA</th>
                      <th className="text-center px-3 py-2.5 font-medium">Negócios</th>
                      <th className="text-center px-3 py-2.5 font-medium">Win Rate</th>
                      <th className="text-right px-4 py-2.5 font-medium">Receita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data
                      .sort((a, b) => b.negocios.revenue - a.negocios.revenue)
                      .map((m, idx) => (
                        <tr key={m.agent.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                {idx + 1}
                              </span>
                              <span className="font-medium">{m.agent.name}</span>
                            </div>
                          </td>
                          <td className="text-center px-3 py-3">{m.entries.total}</td>
                          <td className="text-center px-3 py-3">
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                              (m.funnel.contact_rate ?? 0) >= 80 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" :
                              (m.funnel.contact_rate ?? 0) >= 50 ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400" :
                              "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
                            )}>
                              {m.funnel.contact_rate !== null ? `${Math.round(m.funnel.contact_rate)}%` : '—'}
                            </span>
                          </td>
                          <td className="text-center px-3 py-3">
                            {m.response.median_minutes !== null ? formatMinutes(m.response.median_minutes) : '—'}
                          </td>
                          <td className="text-center px-3 py-3">
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                              (m.response.sla_compliance_pct ?? 0) >= 80 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" :
                              (m.response.sla_compliance_pct ?? 0) >= 50 ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400" :
                              "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
                            )}>
                              {m.response.sla_compliance_pct !== null ? `${m.response.sla_compliance_pct}%` : '—'}
                            </span>
                          </td>
                          <td className="text-center px-3 py-3">
                            <span className="text-emerald-600 dark:text-emerald-400">{m.negocios.won}</span>
                            <span className="text-muted-foreground mx-0.5">/</span>
                            <span className="text-red-500">{m.negocios.lost}</span>
                          </td>
                          <td className="text-center px-3 py-3">
                            {m.negocios.win_rate !== null ? `${m.negocios.win_rate}%` : '—'}
                          </td>
                          <td className="text-right px-4 py-3 font-medium">
                            {formatCurrency(m.negocios.revenue)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Individual Agent Detail (when one is selected) */}
          {selectedAgent && data.length >= 1 && (
            <AgentDetail metrics={data[0]} />
          )}
        </>
      )}
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function KpiCard({ icon: Icon, label, value, subtitle, color }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  subtitle?: string
  color: string
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-600 dark:text-blue-400' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600 dark:text-amber-400' },
    red: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-600 dark:text-red-400' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950', text: 'text-indigo-600 dark:text-indigo-400' },
  }
  const c = colorMap[color] ?? colorMap.blue

  return (
    <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 transition-all hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn("p-2.5 rounded-xl", c.bg)}>
          <Icon className={cn("h-5 w-5", c.text)} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            {subtitle && (
              <Badge variant="outline" className="text-[9px] rounded-full px-1.5 h-4">{subtitle}</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FunnelChart({ steps }: { steps: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...steps.map(s => s.value), 1)

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const pct = (step.value / max) * 100
        const conversionFromPrev = i > 0 && steps[i - 1].value > 0
          ? Math.round((step.value / steps[i - 1].value) * 100)
          : null

        return (
          <div key={step.label} className="flex items-center gap-4">
            <div className="w-24 text-right">
              <p className="text-xs font-medium">{step.label}</p>
            </div>
            <div className="flex-1 h-8 bg-muted/30 rounded-full overflow-hidden relative">
              <div
                className={cn("h-full rounded-full transition-all duration-700", step.color)}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium mix-blend-difference text-white">
                {step.value}
              </span>
            </div>
            <div className="w-12 text-right">
              {conversionFromPrev !== null ? (
                <span className={cn(
                  "text-[10px] font-medium",
                  conversionFromPrev >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                )}>
                  {conversionFromPrev}%
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">—</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AgentDetail({ metrics: m }: { metrics: AgentMetrics }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Sources breakdown */}
      <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Leads por Origem
        </h4>
        <div className="space-y-2">
          {Object.entries(m.entries.by_source)
            .sort(([, a], [, b]) => b - a)
            .map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="text-xs">{SOURCE_LABELS[source] ?? source}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full"
                      style={{ width: `${(count / m.entries.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Activities breakdown */}
      <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Actividades ({m.activities.total})
        </h4>
        <div className="space-y-2">
          {Object.entries(m.activities.by_type)
            .filter(([type]) => !['system', 'lifecycle_change', 'stage_change'].includes(type))
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-xs">{ACTIVITY_LABELS[type] ?? type}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400/60 rounded-full"
                      style={{ width: `${(count / m.activities.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function formatMinutes(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

function formatCurrency(value: number): string {
  if (value === 0) return '0 €'
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M €`
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k €`
  return `${value.toLocaleString('pt-PT')} €`
}
