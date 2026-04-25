'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  PieChart, Pie, Cell, Line, ComposedChart, LabelList,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Wallet, Hourglass, ShoppingBag, Banknote, Clock,
  AlertCircle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useConsultorSummary } from '@/hooks/use-consultor-summary'
import { cn } from '@/lib/utils'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
const fmtMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-PT', { month: 'short' })
}
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const PIE_COLORS = [
  '#0ea5e9', '#10b981', '#f59e0b', '#a855f7', '#ef4444',
  '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#ec4899',
]

function KpiCard({
  label, value, icon: Icon, tone = 'neutral', hint,
}: {
  label: string
  value: string
  icon: React.ElementType
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
      {/* Accent line on the left */}
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

export function ConsultorResumo({ agentId }: { agentId?: string }) {
  const { data, loading, error } = useConsultorSummary(agentId)

  const ccUsage = useMemo(() => {
    if (!data?.kpis.credit_limit || data.kpis.credit_limit === 0) return null
    const used = Math.max(0, -data.kpis.saldo_cc)
    return Math.round((used / data.kpis.credit_limit) * 100)
  }, [data?.kpis.credit_limit, data?.kpis.saldo_cc])

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border bg-card/50 p-8 text-center">
        <AlertCircle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
        <p className="text-sm text-muted-foreground">{error ?? 'Sem dados disponíveis.'}</p>
      </div>
    )
  }

  const { kpis, monthly_series, loja_breakdown, proximas_entradas, ultimas_movimentacoes } = data
  const lojaTotal = loja_breakdown.reduce((s, b) => s + b.amount, 0)

  return (
    <Tabs defaultValue="visao" className="space-y-5">
      <div className="overflow-x-auto -mx-1 px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          <TabsList className="bg-transparent p-0 h-auto">
            <TabsTrigger
              value="visao"
              className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900"
            >
              <span className="sm:hidden">Geral</span>
              <span className="hidden sm:inline">Visão geral</span>
            </TabsTrigger>
            <TabsTrigger
              value="despesas"
              className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900"
            >
              Despesas e entradas
            </TabsTrigger>
            <TabsTrigger
              value="historico"
              className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900"
            >
              Histórico
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* ─── Tab 1: Visão geral (KPIs 3×2 + evolução 12 meses) ────────── */}
      <TabsContent value="visao" className="m-0">
      <Card className="rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm p-4 sm:p-6 space-y-6 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
        <div className="flex items-end justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Visão geral</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Indicadores do mês e evolução nos últimos 12 meses
            </p>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          <KpiCard
            label="Comissões (mês)"
            value={fmtCurrency(kpis.comissoes_mes)}
            icon={TrendingUp}
            tone="positive"
          />
          <KpiCard
            label="Comissões (ano)"
            value={fmtCurrency(kpis.comissoes_ytd)}
            icon={Banknote}
            tone="info"
          />
          <KpiCard
            label="A receber"
            value={fmtCurrency(kpis.a_receber)}
            icon={Hourglass}
            tone="warning"
            hint={proximas_entradas.length > 0 ? `${proximas_entradas.length} pagamento(s) assinado(s)` : 'Sem pagamentos pendentes'}
          />
          <KpiCard
            label="Loja (mês)"
            value={fmtCurrency(kpis.loja_mes)}
            icon={ShoppingBag}
            tone="negative"
          />
          <KpiCard
            label="Saldo conta corrente"
            value={fmtCurrency(kpis.saldo_cc)}
            icon={Wallet}
            tone={kpis.saldo_cc < 0 ? 'warning' : 'neutral'}
            hint={
              kpis.credit_limit != null && (
                <span className="flex items-center gap-1">
                  Limite: {fmtCurrency(kpis.credit_limit)}
                  {ccUsage != null && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'ml-1 h-4 text-[10px] px-1 rounded-full',
                        ccUsage >= 80 ? 'border-red-300 text-red-600' : ccUsage >= 50 ? 'border-amber-300 text-amber-600' : 'border-emerald-300 text-emerald-600'
                      )}
                    >
                      {ccUsage}% usado
                    </Badge>
                  )}
                </span>
              )
            }
          />
          <KpiCard
            label="Líquido (mês)"
            value={fmtCurrency(kpis.liquido_mes)}
            icon={kpis.liquido_mes >= 0 ? ArrowUpRight : ArrowDownRight}
            tone={kpis.liquido_mes >= 0 ? 'positive' : 'negative'}
          />
        </div>

        <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-4 sm:p-5 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-tight">Evolução · últimos 12 meses</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Receita (verde) vs. despesas (vermelho), líquido em linha
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: '#10b981' }} /> Comissões
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: '#ef4444' }} /> Loja
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: '#6366f1' }} /> Líquido
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthly_series} margin={{ top: 24, right: 12, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="bar-comissoes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.55} />
                </linearGradient>
                <linearGradient id="bar-despesas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={fmtMonth}
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
                formatter={(value: any) => fmtCurrency(Number(value))}
                labelFormatter={fmtMonth}
                contentStyle={{
                  borderRadius: 12, fontSize: 12, border: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--background) / 0.95)', backdropFilter: 'blur(8px)',
                }}
                cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
              />
              <Bar dataKey="comissoes" name="Comissões" fill="url(#bar-comissoes)" radius={[6, 6, 0, 0]} maxBarSize={28}>
                <LabelList
                  dataKey="comissoes"
                  position="top"
                  fontSize={9}
                  fill="#10b981"
                  formatter={(v: number) => v > 0 ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)) : ''}
                />
              </Bar>
              <Bar dataKey="despesas" name="Despesas" fill="url(#bar-despesas)" radius={[6, 6, 0, 0]} maxBarSize={28}>
                <LabelList
                  dataKey="despesas"
                  position="top"
                  fontSize={9}
                  fill="#ef4444"
                  formatter={(v: number) => v > 0 ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)) : ''}
                />
              </Bar>
              <Line
                type="monotone"
                dataKey="liquido"
                name="Líquido"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
      </TabsContent>

      {/* ─── Tab 2: Despesas e próximas entradas ──────────────────────── */}
      <TabsContent value="despesas" className="m-0">
      <Card className="rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm p-4 sm:p-6 space-y-6 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Despesas e próximas entradas</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Distribuição da loja no ano e comissões a receber
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 min-w-0">
          {/* Donut moderno */}
          <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-4 sm:p-5 min-w-0 overflow-hidden">
            <p className="text-xs font-medium tracking-tight">Despesas da loja</p>
            <p className="text-[11px] text-muted-foreground">Ano {new Date().getFullYear()}</p>

            {loja_breakdown.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                Sem despesas este ano.
              </div>
            ) : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <defs>
                      {loja_breakdown.map((_, i) => (
                        <linearGradient key={i} id={`pie-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={PIE_COLORS[i % PIE_COLORS.length]} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={PIE_COLORS[i % PIE_COLORS.length]} stopOpacity={0.65} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={loja_breakdown}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={66}
                      outerRadius={96}
                      paddingAngle={4}
                      cornerRadius={8}
                      stroke="none"
                      isAnimationActive
                      animationDuration={600}
                    >
                      {loja_breakdown.map((_, i) => (
                        <Cell key={i} fill={`url(#pie-grad-${i})`} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [fmtCurrency(Number(value)), name]}
                      contentStyle={{
                        borderRadius: 12, fontSize: 12, border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--background) / 0.95)',
                        backdropFilter: 'blur(8px)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Total no centro */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total</span>
                  <span className="text-base font-bold tracking-tight tabular-nums">{fmtCurrency(lojaTotal)}</span>
                </div>
              </div>
            )}

            {/* Legenda compacta com swatches arredondados */}
            {loja_breakdown.length > 0 && (
              <ul className="mt-3 space-y-1">
                {loja_breakdown.slice(0, 5).map((b, i) => {
                  const pct = lojaTotal > 0 ? Math.round((b.amount / lojaTotal) * 100) : 0
                  return (
                    <li key={b.category} className="flex items-center justify-between gap-2 text-[11px] min-w-0">
                      <span className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="truncate">{b.category}</span>
                      </span>
                      <span className="text-muted-foreground tabular-nums shrink-0 whitespace-nowrap">
                        {fmtCurrency(b.amount)} · {pct}%
                      </span>
                    </li>
                  )
                })}
                {loja_breakdown.length > 5 && (
                  <li className="text-[11px] text-muted-foreground pl-3.5">
                    +{loja_breakdown.length - 5} outros
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Próximas entradas */}
          <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-4 sm:p-5 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-tight">Próximas entradas</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">A aguardar recebimento</p>
              </div>
              <Badge variant="outline" className="rounded-full text-[10px] bg-amber-500/5 border-amber-500/30 text-amber-700 dark:text-amber-400 shrink-0 whitespace-nowrap">
                {fmtCurrency(kpis.a_receber)}
              </Badge>
            </div>
            {proximas_entradas.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                Sem comissões a receber.
              </div>
            ) : (
              <ul className="space-y-2">
                {proximas_entradas.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-background/80 ring-1 ring-border/30 px-3 py-2.5 transition-colors hover:ring-border/60 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="rounded-full p-2 bg-gradient-to-br from-amber-500/15 to-amber-500/5 shrink-0">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.payment_moment ?? 'Pagamento'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Assinado em {fmtDate(p.signed_date)}
                          {p.kind === 'split' && <span className="ml-2 text-indigo-600">· partilha</span>}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0 whitespace-nowrap">{fmtCurrency(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>
      </TabsContent>

      {/* ─── Tab 3: Histórico ──────────────────────────────────────── */}
      <TabsContent value="historico" className="m-0">
      <Card className="rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm p-4 sm:p-6 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
        <div className="mb-4">
          <h3 className="text-base font-semibold tracking-tight">Histórico</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            10 movimentos mais recentes da conta corrente
          </p>
        </div>
        {ultimas_movimentacoes.length === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">
            Sem movimentações registadas.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {ultimas_movimentacoes.map((m) => {
              const isCredit = m.type === 'CREDIT'
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-background/60 ring-1 ring-border/30 px-3 py-2.5 transition-colors hover:ring-border/60 min-w-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={cn(
                      'rounded-full p-2 shrink-0 bg-gradient-to-br',
                      isCredit ? 'from-emerald-500/15 to-emerald-500/5' : 'from-red-500/15 to-red-500/5'
                    )}>
                      {isCredit
                        ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                        : <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{m.description}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{fmtDate(m.date)}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-sm font-semibold tabular-nums shrink-0 whitespace-nowrap',
                    isCredit ? 'text-emerald-600' : 'text-red-600'
                  )}>
                    {isCredit ? '+' : '−'} {fmtCurrency(m.amount)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      </TabsContent>
    </Tabs>
  )
}
