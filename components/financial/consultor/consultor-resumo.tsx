'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  Bar, Line, ComposedChart, LabelList,
} from 'recharts'
import {
  TrendingUp, Wallet, Hourglass, ShoppingBag, Banknote, Camera,
  AlertCircle, ArrowUpRight, ArrowDownRight, Receipt, RefreshCcw, ChevronRight,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useConsultorSummary } from '@/hooks/use-consultor-summary'
import { usePersonalExpensesSummary } from '@/hooks/use-personal-expenses'
import { usePersonalExpenseRecurrences } from '@/hooks/use-personal-expense-recurrences'
import { cn } from '@/lib/utils'
import { ReceiptCaptureSheet } from './receipt-capture-sheet'
import { UnifiedLedger } from './unified-ledger'
import { UpcomingEntriesSheet } from './upcoming-entries-sheet'
import { KpiDetailSheet, type KpiTone } from './kpi-detail-sheet'
import { RecurringPaymentsSheet } from './recurring-payments-sheet'
import { ExpensesByCategoryWidget } from './expenses-by-category-widget'
import { PeriodPicker, type PeriodValue } from './period-picker'
import type { UnifiedFilter } from '@/lib/financial/unified-entry'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
const fmtMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-PT', { month: 'short' })
}

interface KpiSheetSpec {
  title: string
  subtitle: string
  filter: UnifiedFilter
  totalAmount: number
  tone: KpiTone
}

function monthRange(): { from: string; to: string } {
  const now = new Date()
  return {
    from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    to: now.toISOString().slice(0, 10),
  }
}
function ytdRange(): { from: string; to: string } {
  const now = new Date()
  return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().slice(0, 10) }
}

function KpiCard({
  label, value, icon: Icon, tone = 'neutral', hint, onClick,
}: {
  label: string
  value: string
  icon: React.ElementType
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'info'
  hint?: React.ReactNode
  onClick?: () => void
}) {
  const toneMap = {
    neutral: { from: 'from-slate-500/10', icon: 'text-slate-600 dark:text-slate-300', accent: 'bg-slate-400/40' },
    positive: { from: 'from-emerald-500/15', icon: 'text-emerald-600', accent: 'bg-emerald-500/60' },
    negative: { from: 'from-red-500/15', icon: 'text-red-600', accent: 'bg-red-500/60' },
    warning: { from: 'from-amber-500/15', icon: 'text-amber-600', accent: 'bg-amber-500/60' },
    info: { from: 'from-blue-500/15', icon: 'text-blue-600', accent: 'bg-blue-500/60' },
  }[tone]

  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-gradient-to-br to-transparent text-left w-full',
        'ring-1 ring-border/40 p-3 sm:p-4 transition-all duration-300',
        'hover:ring-border/70 hover:shadow-[0_4px_20px_-4px_rgb(0_0_0_/_0.08)]',
        toneMap.from,
        onClick && 'cursor-pointer',
      )}
    >
      <span className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full', toneMap.accent)} />

      <div className="flex items-center gap-1.5 sm:gap-2">
        <Icon className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0', toneMap.icon)} />
        <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium leading-tight flex-1 truncate">{label}</p>
        {onClick && (
          <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
        )}
      </div>
      <p className="text-base sm:text-2xl font-semibold tracking-tight tabular-nums mt-2 sm:mt-2.5 text-foreground break-words">
        {value}
      </p>
      {hint && <div className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground line-clamp-2">{hint}</div>}
    </Wrapper>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium mb-2">
      {children}
    </p>
  )
}

export function ConsultorResumo({ agentId }: { agentId?: string }) {
  const { data, loading, error, refetch } = useConsultorSummary(agentId)
  const personalSummary = usePersonalExpensesSummary({})
  const recurrences = usePersonalExpenseRecurrences({ activeOnly: true })

  const [captureOpen, setCaptureOpen] = useState(false)
  const [upcomingOpen, setUpcomingOpen] = useState(false)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [kpiSheet, setKpiSheet] = useState<KpiSheetSpec | null>(null)
  // Period partilhado entre o donut e o timeline na Tab 2.
  const [tab2Period, setTab2Period] = useState<PeriodValue>({ preset: 'month' })

  const ccUsage = useMemo(() => {
    if (!data?.kpis.credit_limit || data.kpis.credit_limit === 0) return null
    const used = Math.max(0, -data.kpis.saldo_cc)
    return Math.round((used / data.kpis.credit_limit) * 100)
  }, [data?.kpis.credit_limit, data?.kpis.saldo_cc])

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
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

  const { kpis, monthly_series, proximas_entradas } = data
  const pessoaisMes = personalSummary.data?.month_amount ?? 0
  const ganhosMes = kpis.comissoes_mes
  const despesasMes = kpis.loja_mes + pessoaisMes
  // Rendimento líquido real do consultor — inclui despesas pessoais.
  // (kpis.liquido_mes vem do backend = comissões − loja − ajustes; subtraímos pessoais aqui)
  const liquidoMesReal = kpis.liquido_mes - pessoaisMes

  const handleSaved = () => {
    refetch()
    personalSummary.refetch()
    recurrences.refetch()
  }

  return (
    <Tabs defaultValue="visao" className="space-y-5">
      <div className="flex justify-center sm:justify-start overflow-x-auto -mx-1 px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              value="ganhos"
              className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900"
            >
              <span className="sm:hidden">Balanço</span>
              <span className="hidden sm:inline">Ganhos e despesas</span>
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* ─── Tab 1: Visão geral — KPIs em 3 grupos lógicos + chart ──────── */}
      <TabsContent value="visao" className="m-0">
        <Card className="rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm p-4 sm:p-6 space-y-6 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Visão geral</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Indicadores do mês e evolução nos últimos 12 meses
            </p>
          </div>

          {/* Receitas */}
          <section>
            <SectionLabel>Receitas</SectionLabel>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
              <KpiCard
                label="Comissões (mês)"
                value={fmtCurrency(kpis.comissoes_mes)}
                icon={TrendingUp}
                tone="positive"
                onClick={() => setKpiSheet({
                  title: 'Comissões — mês',
                  subtitle: 'Comissões registadas neste mês',
                  filter: { source: 'company', types: ['commission'], ...monthRange() },
                  totalAmount: kpis.comissoes_mes,
                  tone: 'positive',
                })}
              />
              <KpiCard
                label="Comissões (ano)"
                value={fmtCurrency(kpis.comissoes_ytd)}
                icon={Banknote}
                tone="info"
                onClick={() => setKpiSheet({
                  title: 'Comissões — ano',
                  subtitle: 'Comissões registadas no ano corrente',
                  filter: { source: 'company', types: ['commission'], ...ytdRange() },
                  totalAmount: kpis.comissoes_ytd,
                  tone: 'info',
                })}
              />
              <KpiCard
                label="A receber"
                value={fmtCurrency(kpis.a_receber)}
                icon={Hourglass}
                tone="warning"
                hint={
                  proximas_entradas.length > 0
                    ? `${proximas_entradas.length} pagamento(s) assinado(s)`
                    : 'Sem pagamentos pendentes'
                }
                onClick={() => setUpcomingOpen(true)}
              />
            </div>
          </section>

          {/* Despesas */}
          <section>
            <SectionLabel>Despesas</SectionLabel>
            <div className="grid gap-3 grid-cols-2">
              <KpiCard
                label="Loja (mês)"
                value={fmtCurrency(kpis.loja_mes)}
                icon={ShoppingBag}
                tone="negative"
                hint="Compras institucionais"
                onClick={() => setKpiSheet({
                  title: 'Loja — mês',
                  subtitle: 'Compras na loja institucional',
                  filter: { source: 'company', types: ['shop'], ...monthRange() },
                  totalAmount: kpis.loja_mes,
                  tone: 'negative',
                })}
              />
              <KpiCard
                label="Pessoais (mês)"
                value={fmtCurrency(pessoaisMes)}
                icon={Receipt}
                tone="negative"
                hint={
                  personalSummary.data?.count != null
                    ? `${personalSummary.data.count} recibo(s) arquivado(s)`
                    : 'Despesas de actividade'
                }
                onClick={() => setKpiSheet({
                  title: 'Despesas pessoais — mês',
                  subtitle: 'Recibos pessoais arquivados neste mês',
                  filter: { source: 'personal', ...monthRange() },
                  totalAmount: pessoaisMes,
                  tone: 'negative',
                })}
              />
            </div>
          </section>

          {/* Saldo */}
          <section>
            <SectionLabel>Saldo</SectionLabel>
            <div className="grid gap-3 grid-cols-2">
              <KpiCard
                label="Conta corrente"
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
                onClick={() => setKpiSheet({
                  title: 'Conta corrente',
                  subtitle: 'Movimentos da empresa (sem despesas pessoais)',
                  filter: { source: 'company' },
                  totalAmount: kpis.saldo_cc,
                  tone: kpis.saldo_cc < 0 ? 'warning' : 'neutral',
                })}
              />
              <KpiCard
                label="Líquido (mês)"
                value={fmtCurrency(liquidoMesReal)}
                icon={liquidoMesReal >= 0 ? ArrowUpRight : ArrowDownRight}
                tone={liquidoMesReal >= 0 ? 'positive' : 'negative'}
                onClick={() => setKpiSheet({
                  title: 'Líquido — mês',
                  subtitle: 'Todos os movimentos do mês (empresa + pessoais)',
                  filter: { ...monthRange() },
                  totalAmount: liquidoMesReal,
                  tone: liquidoMesReal >= 0 ? 'positive' : 'negative',
                })}
              />
            </div>
          </section>

          {/* Donut: despesas por categoria (com period picker) */}
          {agentId && <ExpensesByCategoryWidget agentId={agentId} />}

          {/* Evolução 12 meses */}
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
                <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
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
                  <LabelList dataKey="comissoes" position="top" fontSize={9} fill="#10b981"
                    formatter={(v: number) => v > 0 ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)) : ''} />
                </Bar>
                <Bar dataKey="despesas" name="Despesas" fill="url(#bar-despesas)" radius={[6, 6, 0, 0]} maxBarSize={28}>
                  <LabelList dataKey="despesas" position="top" fontSize={9} fill="#ef4444"
                    formatter={(v: number) => v > 0 ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)) : ''} />
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

      {/* ─── Tab 2: Ganhos e despesas — KPIs + timeline + recorrências ──── */}
      <TabsContent value="ganhos" className="m-0">
        <Card className="rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm p-4 sm:p-6 space-y-6 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
          <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:items-start sm:justify-between sm:gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-semibold tracking-tight">Ganhos e despesas</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Conta corrente unificada — empresa e pessoais num só sítio
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRecurringOpen(true)}
                className="rounded-full w-full sm:w-auto"
              >
                <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                <span className="truncate">Pagamentos mensais</span>
                {recurrences.data.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                    {recurrences.data.length}
                  </Badge>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => setCaptureOpen(true)}
                className="rounded-full w-full sm:w-auto"
              >
                <Camera className="h-3.5 w-3.5 mr-1" />
                <span className="truncate">Registar despesa</span>
              </Button>
            </div>
          </div>

          {/* 3 KPIs sumário */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <KpiCard
              label="Ganhos (mês)"
              value={fmtCurrency(ganhosMes)}
              icon={TrendingUp}
              tone="positive"
              onClick={() => setKpiSheet({
                title: 'Ganhos — mês',
                subtitle: 'Comissões e ajustes positivos do mês',
                filter: { source: 'company', side: 'in', ...monthRange() },
                totalAmount: ganhosMes,
                tone: 'positive',
              })}
            />
            <KpiCard
              label="Despesas (mês)"
              value={fmtCurrency(despesasMes)}
              icon={ArrowDownRight}
              tone="negative"
              hint={`Loja ${fmtCurrency(kpis.loja_mes)} · Pessoais ${fmtCurrency(pessoaisMes)}`}
              onClick={() => setKpiSheet({
                title: 'Despesas — mês',
                subtitle: 'Loja institucional + despesas pessoais do mês',
                filter: { side: 'out', ...monthRange() },
                totalAmount: despesasMes,
                tone: 'negative',
              })}
            />
            <KpiCard
              label="A receber"
              value={fmtCurrency(kpis.a_receber)}
              icon={Hourglass}
              tone="warning"
              hint={
                proximas_entradas.length > 0
                  ? `${proximas_entradas.length} pagamento(s) — ver lista`
                  : 'Sem pagamentos pendentes'
              }
              onClick={() => setUpcomingOpen(true)}
            />
          </div>

          {/* Period picker partilhado — controla donut + timeline */}
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-medium">
              Período
            </p>
            <PeriodPicker value={tab2Period} onChange={setTab2Period} />
          </div>

          {/* Donut: despesas por categoria (mesmo período do timeline) */}
          {agentId && (
            <ExpensesByCategoryWidget
              agentId={agentId}
              period={tab2Period}
              onPeriodChange={setTab2Period}
              hideSubtitle
            />
          )}

          {/* Timeline unificada (controlado pelo período acima) */}
          {agentId && (
            <UnifiedLedger
              agentId={agentId}
              onPersonalChanged={handleSaved}
              externalPeriod={tab2Period}
            />
          )}
        </Card>
      </TabsContent>

      {/* Sheets globais */}
      <ReceiptCaptureSheet
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        onSaved={handleSaved}
      />
      <UpcomingEntriesSheet
        open={upcomingOpen}
        onOpenChange={setUpcomingOpen}
        entries={proximas_entradas as any}
        totalAmount={kpis.a_receber}
      />
      <RecurringPaymentsSheet
        open={recurringOpen}
        onOpenChange={setRecurringOpen}
        onChanged={handleSaved}
      />
      {agentId && (
        <KpiDetailSheet
          open={!!kpiSheet}
          onOpenChange={(o) => { if (!o) setKpiSheet(null) }}
          agentId={agentId}
          title={kpiSheet?.title ?? ''}
          subtitle={kpiSheet?.subtitle}
          tone={kpiSheet?.tone ?? 'neutral'}
          filter={kpiSheet?.filter ?? {}}
          totalAmount={kpiSheet?.totalAmount ?? 0}
          onPersonalChanged={handleSaved}
        />
      )}
    </Tabs>
  )
}
