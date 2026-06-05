'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency } from '@/lib/constants'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Camera, Video, Palette, Package, Megaphone, Share2, MoreHorizontal,
  TrendingUp, Wallet, Wrench, RefreshCw, BarChart3, Users,
} from 'lucide-react'

// ── Category icons ──
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  photography: Camera,
  video: Video,
  design: Palette,
  physical_materials: Package,
  ads: Megaphone,
  social_media: Share2,
  other: MoreHorizontal,
}

// ── PT month abbreviations ──
const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function monthLabel(yyyymm: string): string {
  const [year, month] = yyyymm.split('-')
  const idx = parseInt(month, 10) - 1
  return `${PT_MONTHS[idx] ?? month} ${year}`
}

// ── Types ──
interface MonthlySpending {
  month: string
  services: number
  materials: number
  subscriptions: number
  total: number
}

interface CategoryBreakdown {
  category: string
  label: string
  total: number
  count: number
}

interface Totals {
  services: number
  materials: number
  subscriptions: number
  grand_total: number
}

interface AnalyticsData {
  monthly_spending: MonthlySpending[]
  category_breakdown: CategoryBreakdown[]
  totals: Totals
}

interface Agent {
  id: string
  commercial_name: string
}

// ── Bar colors ──
const BAR_COLORS = {
  services: 'bg-blue-500',
  materials: 'bg-orange-500',
  subscriptions: 'bg-purple-500',
}

const BAR_LABELS: Record<string, string> = {
  services: 'Servicos',
  materials: 'Materiais',
  subscriptions: 'Subscricoes',
}

export function GestaoAnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<string>('last_6m')
  const [agentId, setAgentId] = useState<string>('me')
  const [agents, setAgents] = useState<Agent[]>([])
  const [canSeeAll, setCanSeeAll] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (agentId !== 'me') {
        params.set('agent_id', agentId)
      }
      const res = await fetch(`/api/marketing/gestao/analytics?${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
        // If the API returned agents_list, user has marketing permission
        if (json.agents_list && json.agents_list.length > 0) {
          setAgents(json.agents_list)
          setCanSeeAll(true)
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [period, agentId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Max total for bar scaling ──
  const maxMonthTotal = data
    ? Math.max(...data.monthly_spending.map((m) => m.total), 1)
    : 1

  return (
    <div className="space-y-8">
      {/* ── Filters Row ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-[160px] text-sm rounded-full bg-muted/50 border-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last_6m">Ultimos 6 meses</SelectItem>
            <SelectItem value="last_12m">Ultimos 12 meses</SelectItem>
            <SelectItem value="ytd">Ano corrente</SelectItem>
          </SelectContent>
        </Select>

        {canSeeAll && (
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="h-9 w-[200px] text-sm rounded-full bg-muted/50 border-0">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Consultor" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="me">Os meus dados</SelectItem>
              <SelectItem value="all">Todos os consultores</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.commercial_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Summary Cards ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : !data ? (
        <EmptyState
          icon={BarChart3}
          title="Sem dados de analise"
          description="Nao foi possivel carregar os dados. Tente novamente."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              label="Total Gasto"
              value={data.totals.grand_total}
              icon={Wallet}
              color="bg-neutral-900 dark:bg-white"
              textColor="text-white dark:text-neutral-900"
              iconColor="text-white/70 dark:text-neutral-400"
            />
            <SummaryCard
              label="Servicos"
              value={data.totals.services}
              icon={Wrench}
              color="bg-blue-500/10"
              textColor="text-foreground"
              iconColor="text-blue-500"
              dotColor="bg-blue-500"
            />
            <SummaryCard
              label="Materiais"
              value={data.totals.materials}
              icon={Package}
              color="bg-orange-500/10"
              textColor="text-foreground"
              iconColor="text-orange-500"
              dotColor="bg-orange-500"
            />
            <SummaryCard
              label="Subscricoes"
              value={data.totals.subscriptions}
              icon={RefreshCw}
              color="bg-purple-500/10"
              textColor="text-foreground"
              iconColor="text-purple-500"
              dotColor="bg-purple-500"
            />
          </div>

          {/* ── Monthly Spending Chart ── */}
          <div className="rounded-xl border bg-background p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-base">Gastos Mensais</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Distribuicao por tipo ao longo do tempo</p>
              </div>
              <div className="flex items-center gap-4">
                {Object.entries(BAR_COLORS).map(([key, color]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
                    <span className="text-[11px] text-muted-foreground">{BAR_LABELS[key]}</span>
                  </div>
                ))}
              </div>
            </div>

            {data.monthly_spending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Sem dados para o periodo seleccionado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.monthly_spending.map((m) => {
                  const servPct = maxMonthTotal > 0 ? (m.services / maxMonthTotal) * 100 : 0
                  const matPct = maxMonthTotal > 0 ? (m.materials / maxMonthTotal) * 100 : 0
                  const subPct = maxMonthTotal > 0 ? (m.subscriptions / maxMonthTotal) * 100 : 0

                  return (
                    <div key={m.month} className="group flex items-center gap-4">
                      <span className="text-xs text-muted-foreground w-20 shrink-0 text-right font-medium">
                        {monthLabel(m.month)}
                      </span>
                      <div className="flex-1 flex items-center gap-0.5 h-8 rounded-full overflow-hidden bg-muted/30">
                        {m.services > 0 && (
                          <div
                            className={`${BAR_COLORS.services} h-full rounded-l-full transition-all duration-500 group-hover:opacity-90`}
                            style={{ width: `${Math.max(servPct, 1)}%` }}
                            title={`Servicos: ${formatCurrency(m.services)}`}
                          />
                        )}
                        {m.materials > 0 && (
                          <div
                            className={`${BAR_COLORS.materials} h-full transition-all duration-500 group-hover:opacity-90 ${m.services === 0 ? 'rounded-l-full' : ''}`}
                            style={{ width: `${Math.max(matPct, 1)}%` }}
                            title={`Materiais: ${formatCurrency(m.materials)}`}
                          />
                        )}
                        {m.subscriptions > 0 && (
                          <div
                            className={`${BAR_COLORS.subscriptions} h-full rounded-r-full transition-all duration-500 group-hover:opacity-90 ${m.services === 0 && m.materials === 0 ? 'rounded-l-full' : ''}`}
                            style={{ width: `${Math.max(subPct, 1)}%` }}
                            title={`Subscricoes: ${formatCurrency(m.subscriptions)}`}
                          />
                        )}
                      </div>
                      <span className="text-sm font-semibold w-24 text-right tabular-nums">
                        {formatCurrency(m.total)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Category Breakdown ── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-semibold text-base">Por Categoria</h3>
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                {data.category_breakdown.length} {data.category_breakdown.length === 1 ? 'categoria' : 'categorias'}
              </span>
            </div>

            {data.category_breakdown.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border rounded-xl bg-background">
                <TrendingUp className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Sem dados de categorias</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {data.category_breakdown.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.category] || Package
                  const pctOfTotal = data.totals.grand_total > 0
                    ? Math.round((cat.total / data.totals.grand_total) * 100)
                    : 0

                  return (
                    <div
                      key={cat.category}
                      className="flex flex-col gap-3 p-5 rounded-xl border bg-background hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center">
                            <Icon className="h-4.5 w-4.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium leading-none">{cat.label}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {cat.count} {cat.count === 1 ? 'item' : 'itens'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {pctOfTotal}%
                        </span>
                      </div>
                      <div>
                        <p className="text-lg font-bold tabular-nums">{formatCurrency(cat.total)}</p>
                        {/* Mini progress bar */}
                        <div className="mt-2 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-foreground/20 transition-all duration-500"
                            style={{ width: `${pctOfTotal}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Summary Card Component ──
function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  textColor,
  iconColor,
  dotColor,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: string
  textColor: string
  iconColor: string
  dotColor?: string
}) {
  return (
    <div className={`rounded-xl p-5 ${color} transition-all duration-300 hover:shadow-md`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {dotColor && <div className={`h-2 w-2 rounded-full ${dotColor}`} />}
          <span className={`text-xs font-medium ${dotColor ? 'text-muted-foreground' : textColor + ' opacity-70'}`}>
            {label}
          </span>
        </div>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <p className={`text-xl font-bold tabular-nums ${textColor}`}>
        {formatCurrency(value)}
      </p>
    </div>
  )
}
