'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  Bar, Line, ComposedChart, LabelList,
} from 'recharts'
import {
  TrendingUp, Wallet, Hourglass, ShoppingBag, Banknote, Camera,
  AlertCircle, ArrowUpRight, ArrowDownRight, Receipt, Pause, Play, Trash2, RefreshCcw, ChevronRight,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useConsultorSummary } from '@/hooks/use-consultor-summary'
import { usePersonalExpensesSummary } from '@/hooks/use-personal-expenses'
import { usePersonalExpenseRecurrences } from '@/hooks/use-personal-expense-recurrences'
import { cn } from '@/lib/utils'
import { ReceiptCaptureSheet } from './receipt-capture-sheet'
import { UnifiedLedger } from './unified-ledger'
import { UpcomingEntriesSheet } from './upcoming-entries-sheet'
import type { PersonalExpenseRecurrence } from '@/types/personal-expense'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
const fmtMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-PT', { month: 'short' })
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
        'group relative overflow-hidden rounded-2xl bg-gradient-to-br to-transparent text-left',
        'ring-1 ring-border/40 p-4 transition-all duration-300',
        'hover:ring-border/70 hover:shadow-[0_4px_20px_-4px_rgb(0_0_0_/_0.08)]',
        toneMap.from,
        onClick && 'cursor-pointer',
      )}
    >
      <span className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full', toneMap.accent)} />

      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', toneMap.icon)} />
        <p className="text-[11px] text-muted-foreground font-medium leading-tight flex-1">{label}</p>
        {onClick && (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
        )}
      </div>
      <p className="text-base sm:text-2xl font-semibold tracking-tight tabular-nums mt-2.5 text-foreground break-words">
        {value}
      </p>
      {hint && <div className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground">{hint}</div>}
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

  const handleSaved = () => {
    refetch()
    personalSummary.refetch()
    recurrences.refetch()
  }

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
              value="ganhos"
              className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900"
            >
              <span className="sm:hidden">Ganhos</span>
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
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
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
                hint={
                  proximas_entradas.length > 0
                    ? `${proximas_entradas.length} pagamento(s) assinado(s)`
                    : 'Sem pagamentos pendentes'
                }
              />
            </div>
          </section>

          {/* Despesas */}
          <section>
            <SectionLabel>Despesas</SectionLabel>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <KpiCard
                label="Loja (mês)"
                value={fmtCurrency(kpis.loja_mes)}
                icon={ShoppingBag}
                tone="negative"
                hint="Compras institucionais"
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
              />
            </div>
          </section>

          {/* Saldo */}
          <section>
            <SectionLabel>Saldo</SectionLabel>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
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
              />
              <KpiCard
                label="Líquido (mês)"
                value={fmtCurrency(kpis.liquido_mes)}
                icon={kpis.liquido_mes >= 0 ? ArrowUpRight : ArrowDownRight}
                tone={kpis.liquido_mes >= 0 ? 'positive' : 'negative'}
                hint="Comissões − loja − ajustes (não inclui despesas pessoais)"
              />
            </div>
          </section>

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
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-semibold tracking-tight">Ganhos e despesas</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Conta corrente unificada — empresa e pessoais num só sítio
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setCaptureOpen(true)}
              className="rounded-full shrink-0"
            >
              <Camera className="h-3.5 w-3.5 mr-1" />
              Tirar foto de recibo
            </Button>
          </div>

          {/* 3 KPIs sumário */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <KpiCard
              label="Ganhos (mês)"
              value={fmtCurrency(ganhosMes)}
              icon={TrendingUp}
              tone="positive"
            />
            <KpiCard
              label="Despesas (mês)"
              value={fmtCurrency(despesasMes)}
              icon={ArrowDownRight}
              tone="negative"
              hint={`Loja ${fmtCurrency(kpis.loja_mes)} · Pessoais ${fmtCurrency(pessoaisMes)}`}
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
              onClick={proximas_entradas.length > 0 ? () => setUpcomingOpen(true) : undefined}
            />
          </div>

          {/* Recorrências */}
          {recurrences.data.length > 0 && (
            <RecurringSection items={recurrences.data} onChanged={handleSaved} />
          )}

          {/* Timeline unificada */}
          {agentId && (
            <UnifiedLedger
              agentId={agentId}
              onPersonalChanged={handleSaved}
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
    </Tabs>
  )
}

// ─── Recorrências (pagamentos mensais activos) ─────────────────────────────

function RecurringSection({
  items, onChanged,
}: {
  items: PersonalExpenseRecurrence[]
  onChanged: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const togglePause = async (rec: PersonalExpenseRecurrence) => {
    setBusyId(rec.id)
    try {
      const res = await fetch(`/api/agent-personal-expense-recurrences/${rec.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_active: !rec.is_active }),
      })
      if (!res.ok) throw new Error()
      toast.success(rec.is_active ? 'Recorrência pausada.' : 'Recorrência reactivada.')
      onChanged()
    } catch {
      toast.error('Erro a actualizar recorrência.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (rec: PersonalExpenseRecurrence) => {
    setBusyId(rec.id)
    try {
      const res = await fetch(`/api/agent-personal-expense-recurrences/${rec.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Recorrência removida.')
      onChanged()
    } catch {
      toast.error('Erro a remover recorrência.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <RefreshCcw className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold tracking-tight">Pagamentos mensais</p>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
      </div>
      <ul className="space-y-1.5">
        {items.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-2 rounded-lg bg-card border border-border/40 px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {r.vendor_name || r.description || r.category}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Dia {r.day_of_month} · {r.category}
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-red-600 shrink-0">
              {fmtCurrency(Number(r.amount_gross))}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 shrink-0"
              onClick={() => togglePause(r)}
              disabled={busyId === r.id}
              title={r.is_active ? 'Pausar' : 'Reactivar'}
            >
              {r.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 shrink-0 text-red-600"
                  disabled={busyId === r.id}
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover pagamento mensal?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deixa de gerar despesas todos os meses. As despesas já criadas mantêm-se.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(r)}>Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>
    </div>
  )
}
