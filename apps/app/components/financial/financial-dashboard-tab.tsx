'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight, ArrowDownRight, ArrowDownLeft, Euro, TrendingUp, TrendingDown,
  Receipt, Wallet, FileText, Building2, ChevronRight, Plus, ListChecks,
  ReceiptText, CreditCard, BarChart3, Sparkles, AlertCircle, RefreshCcw,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { FinancialAnnualOverview } from '@/types/financial'
import { categoryHex, categoryIcon } from '@/lib/financial/company-category-visuals'
import { DashboardKpiDrilldownSheet } from './sheets/dashboard-kpi-drilldown-sheet'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
const fmtDateShort = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) : '—'

const MONTHS_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const PANEL =
  'rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]'

// ─── Tab principal ──────────────────────────────────────────────────────────

export function FinancialDashboardTab() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState<FinancialAnnualOverview | null>(null)
  const [hasError, setHasError] = useState(false)
  const [expensesDrilldown, setExpensesDrilldown] = useState(false)

  const loadData = useCallback(async () => {
    setHasError(false)
    try {
      const res = await fetch(`/api/financial/dashboard/annual?year=${year}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setHasError(true)
      toast.error('Erro ao carregar a visão geral')
    }
  }, [year])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="space-y-4">
      {/* Header + selector de ano */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Finanças</h2>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            Visão geral de {year}
          </p>
        </div>
        <YearToggle year={year} currentYear={currentYear} onChange={setYear} />
      </div>

      {!data && hasError ? (
        <ErrorState year={year} onRetry={loadData} />
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-4">
          {/* ── Linha 1: Resultado + Recebido + Despesas ───────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <ResultadoHero data={data} />
            <RecebidoCard data={data} />
            <DespesasCard data={data} onDrilldown={() => setExpensesDrilldown(true)} />
          </div>

          {/* ── Tesouraria (indicadores extra) ─────────────────────────── */}
          <TesourariaStrip data={data} />

          {/* ── Linha 2: Despesas por categoria + lateral ──────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <CategoriasCard data={data} className="lg:col-span-2" />
            <div className="space-y-4">
              <MaiorDespesaCard data={data} onVerDespesas={() => setExpensesDrilldown(true)} />
              <AcoesRapidasCard />
            </div>
          </div>

          {/* ── Linha 3: Faturação mensal + Movimentos ─────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <FaturacaoMensalCard data={data} className="lg:col-span-2" />
            <MovimentosCard data={data} />
          </div>
        </div>
      )}

      <DashboardKpiDrilldownSheet
        kind={expensesDrilldown ? 'expenses' : null}
        month={1}
        year={year}
        scope="year"
        titleOverride={`Despesas de ${year}`}
        onClose={() => setExpensesDrilldown(false)}
      />
    </div>
  )
}

// ─── Selector de ano ────────────────────────────────────────────────────────

function YearToggle({
  year, currentYear, onChange,
}: { year: number; currentYear: number; onChange: (y: number) => void }) {
  // Mostra o ano anterior + o actual, como na referência.
  const years = [currentYear - 1, currentYear]
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/50 backdrop-blur-sm border border-border/40 shadow-sm">
      {years.map((y) => (
        <button
          key={y}
          type="button"
          onClick={() => onChange(y)}
          className={cn(
            'h-7 px-3.5 rounded-full text-xs font-semibold tabular-nums transition-all duration-200',
            year === y
              ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {y}
        </button>
      ))}
    </div>
  )
}

// ─── Delta YoY ──────────────────────────────────────────────────────────────

function DeltaChip({
  current, prev, goodWhenUp = true, dark = false,
}: { current: number; prev: number; goodWhenUp?: boolean; dark?: boolean }) {
  if (!prev || prev === 0) return null
  const pct = Math.round(((current - prev) / Math.abs(prev)) * 100)
  if (pct === 0) return null
  const up = pct > 0
  const positive = up === goodWhenUp
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
        dark
          ? positive ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'
          : positive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600',
      )}
      title="Variação vs. ano anterior"
    >
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}{pct}%
    </span>
  )
}

// ─── Card Resultado (hero escuro) ───────────────────────────────────────────

function ResultadoHero({ data }: { data: FinancialAnnualOverview }) {
  return (
    <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-neutral-900 text-white dark:bg-neutral-800 dark:ring-1 dark:ring-white/10 p-6 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.4)]">
      <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/[0.04]" />
      <div className="absolute right-16 top-8 h-24 w-24 rounded-full bg-white/[0.03]" />

      <div className="relative">
        <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium">
          <Euro className="h-4 w-4" />
          Resultado {data.year}
        </div>

        <div className="mt-2 flex flex-wrap items-end gap-3">
          <span className="text-3xl sm:text-4xl font-bold tracking-tight tabular-nums">
            {fmtCurrency(data.resultado)}
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Margem {data.margem_pct}%
          </span>
          <DeltaChip current={data.resultado} prev={data.prev.resultado} dark />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
          <HeroStat label="Recebido" value={data.recebido} />
          <HeroStat label="A receber" value={data.a_receber} />
          <HeroStat label="IVA a pagar" value={data.iva_a_pagar} />
        </div>
      </div>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium truncate">{label}</p>
      <p className="text-sm sm:text-base font-semibold tabular-nums text-white mt-0.5 truncate">
        {fmtCurrency(value)}
      </p>
    </div>
  )
}

// ─── Cards Recebido / Despesas ──────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, hint, tone, delta, onClick,
}: {
  icon: React.ElementType
  label: string
  value: number
  hint?: React.ReactNode
  tone: 'positive' | 'negative'
  delta?: React.ReactNode
  onClick?: () => void
}) {
  const toneMap = {
    positive: { bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
    negative: { bg: 'bg-red-500/10', text: 'text-red-600' },
  }[tone]
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        PANEL, 'group p-5 text-left w-full transition-all duration-300',
        onClick && 'cursor-pointer hover:ring-border/80 hover:shadow-[0_4px_24px_-8px_rgb(0_0_0_/_0.12)]',
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn('rounded-xl p-2 w-fit', toneMap.bg)}>
          <Icon className={cn('h-4 w-4', toneMap.text)} />
        </div>
        {onClick && (
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
        )}
      </div>
      <p className="text-[11px] text-muted-foreground font-medium mt-3">{label}</p>
      <p className="text-2xl font-bold tracking-tight tabular-nums mt-1">{fmtCurrency(value)}</p>
      <div className="mt-1.5 flex items-center gap-2 flex-wrap min-h-[18px]">
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
        {delta}
      </div>
    </Wrapper>
  )
}

function RecebidoCard({ data }: { data: FinancialAnnualOverview }) {
  return (
    <StatCard
      icon={ArrowUpRight}
      label="Recebido"
      value={data.recebido}
      tone="positive"
      hint={`${fmtCurrency(data.faturado)} faturado em ${data.year}`}
      delta={<DeltaChip current={data.recebido} prev={data.prev.recebido} />}
    />
  )
}

function DespesasCard({ data, onDrilldown }: { data: FinancialAnnualOverview; onDrilldown: () => void }) {
  return (
    <StatCard
      icon={ArrowDownRight}
      label="Despesas"
      value={data.despesas}
      tone="negative"
      onClick={onDrilldown}
      hint={`${data.subscricoes_ativas} subscriç${data.subscricoes_ativas === 1 ? 'ão' : 'ões'} activa${data.subscricoes_ativas === 1 ? '' : 's'}`}
      delta={<DeltaChip current={data.despesas} prev={data.prev.despesas} goodWhenUp={false} />}
    />
  )
}

// ─── Tesouraria (indicadores extra) ─────────────────────────────────────────

function TesourariaStrip({ data }: { data: FinancialAnnualOverview }) {
  const items: { label: string; value: number; icon: React.ElementType; href: string; accent: string }[] = [
    { label: 'Por reportar à AT', value: data.pipeline.por_reportar, icon: ReceiptText, href: '/dashboard/financeiro/mapa-gestao', accent: 'bg-blue-500/60' },
    { label: 'A pagar a consultores', value: data.pipeline.a_pagar_consultores, icon: CreditCard, href: '/dashboard/financeiro/comissoes', accent: 'bg-purple-500/60' },
    { label: 'Volume em carteira', value: data.carteira.volume, icon: Building2, href: '/dashboard/imoveis', accent: 'bg-slate-400/50' },
    { label: 'Faturação potencial', value: data.carteira.potencial, icon: Sparkles, href: '/dashboard/financeiro/mapa-gestao', accent: 'bg-emerald-500/60' },
  ]
  return (
    <div className="space-y-2">
      <p className="px-1 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium">
        Tesouraria · posição actual
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((it) => (
        <Link
          key={it.label}
          href={it.href}
          className={cn(PANEL, 'group relative overflow-hidden p-4 transition-all duration-300 hover:ring-border/80')}
        >
          <span className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full', it.accent)} />
          <div className="flex items-center gap-1.5">
            <it.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium leading-tight truncate">{it.label}</p>
          </div>
          <p className="text-base sm:text-lg font-semibold tracking-tight tabular-nums mt-1.5 truncate">
            {fmtCurrency(it.value)}
          </p>
        </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Despesas por categoria (donut + legenda) ───────────────────────────────

function CategoriasCard({ data, className }: { data: FinancialAnnualOverview; className?: string }) {
  const slices = data.por_categoria
  const total = data.despesas

  const chartData = useMemo(
    () => slices.map((s, i) => ({ ...s, fill: categoryHex(s.color, i) })),
    [slices],
  )

  return (
    <div className={cn(PANEL, 'p-5 sm:p-6', className)}>
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Despesas por categoria</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Total {fmtCurrency(total)} · {data.year}
          </p>
        </div>
        <Link
          href="/dashboard/financeiro/gestao-empresa"
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 shrink-0"
        >
          Ver todas <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {slices.length === 0 || total === 0 ? (
        <div className="h-[220px] flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
          <Receipt className="h-7 w-7 mb-2 opacity-40" />
          Sem despesas registadas em {data.year}.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[200px_1fr] items-center">
          <div className="relative w-full">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={84}
                  paddingAngle={3}
                  cornerRadius={7}
                  stroke="none"
                  isAnimationActive
                  animationDuration={500}
                >
                  {chartData.map((s, i) => (
                    <Cell key={i} fill={s.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [fmtCurrency(Number(value)), name]}
                  contentStyle={{
                    borderRadius: 12, fontSize: 12, border: '1px solid var(--border)',
                    backgroundColor: 'color-mix(in oklab, var(--background) 92%, transparent)', backdropFilter: 'blur(8px)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Total</span>
              <span className="text-sm font-bold tracking-tight tabular-nums">{fmtCurrency(total)}</span>
              <span className="text-[10px] text-muted-foreground">{slices.length} categoria{slices.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          <ul className="space-y-2">
            {slices.slice(0, 6).map((s, i) => {
              const Icon = categoryIcon(s.icon)
              return (
                <li key={s.category} className="flex items-center gap-2.5 text-xs min-w-0">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: categoryHex(s.color, i) }}
                  />
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1 font-medium">{s.category}</span>
                  <span className="tabular-nums shrink-0 whitespace-nowrap font-semibold">{fmtCurrency(s.amount)}</span>
                  <span className="tabular-nums shrink-0 w-9 text-right text-muted-foreground">{s.pct}%</span>
                </li>
              )
            })}
            {slices.length > 6 && (
              <li className="text-[11px] text-muted-foreground pl-[22px]">+{slices.length - 6} outras categorias</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Maior despesa (card escuro) ────────────────────────────────────────────

function MaiorDespesaCard({
  data, onVerDespesas,
}: { data: FinancialAnnualOverview; onVerDespesas: () => void }) {
  const m = data.maior_despesa
  // Membro de objecto (não const capitalizada) — evita o aviso static-components
  // ao renderizar um ícone resolvido dinamicamente.
  const glyph = { Icon: m ? categoryIcon(m.icon) : Receipt }
  return (
    <div className="relative overflow-hidden rounded-3xl bg-neutral-900 text-white dark:bg-neutral-800 dark:ring-1 dark:ring-white/10 p-5 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.4)]">
      <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-white/[0.04]" />
      <div className="relative">
        <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium">
          <glyph.Icon className="h-4 w-4" />
          Maior despesa
        </div>
        {m ? (
          <>
            <p className="text-xl font-bold tracking-tight mt-1.5">{m.category}</p>
            <p className="text-[11px] text-neutral-400 mt-1">
              {fmtCurrency(m.amount)} este ano — {m.pct}% do total
            </p>
            <button
              type="button"
              onClick={onVerDespesas}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-medium transition-colors"
            >
              Ver despesas <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <p className="text-sm text-neutral-400 mt-2">Sem despesas registadas em {data.year}.</p>
        )}
      </div>
    </div>
  )
}

// ─── Acções rápidas ─────────────────────────────────────────────────────────

function AcoesRapidasCard() {
  const actions = [
    { label: 'Nova despesa', icon: Plus, href: '/dashboard/financeiro/gestao-empresa' },
    { label: 'Faturas', icon: FileText, href: '/dashboard/financeiro/mapa-gestao' },
    { label: 'Tesouraria', icon: Wallet, href: '/dashboard/financeiro/conta-corrente' },
    { label: 'Comissões', icon: BarChart3, href: '/dashboard/financeiro/comissoes' },
  ]
  return (
    <div className={cn(PANEL, 'p-5')}>
      <h3 className="text-sm font-semibold tracking-tight mb-3">Acções rápidas</h3>
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="group flex flex-col gap-2 rounded-2xl ring-1 ring-border/40 p-3 transition-all duration-300 hover:ring-border/80 hover:bg-muted/40"
          >
            <span className="rounded-lg bg-muted/60 p-2 w-fit group-hover:bg-background transition-colors">
              <a.icon className="h-4 w-4 text-foreground/80" />
            </span>
            <span className="text-[11px] font-medium leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Faturação mensal (barras) ──────────────────────────────────────────────

function FaturacaoMensalCard({ data, className }: { data: FinancialAnnualOverview; className?: string }) {
  const chartData = useMemo(
    () => data.faturacao_mensal.map((m) => ({
      m: MONTHS_ABBR[m.month - 1],
      Recebido: m.recebido,
      Despesas: m.despesas,
    })),
    [data.faturacao_mensal],
  )
  const hasData = data.faturacao_mensal.some((m) => m.recebido > 0 || m.despesas > 0)

  return (
    <div className={cn(PANEL, 'p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5 mb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Faturação mensal</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Recebido vs. despesas em {data.year}</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: '#10b981' }} /> Recebido
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: '#94a3b8' }} /> Despesas
          </span>
        </div>
      </div>

      {!hasData ? (
        <div className="h-[260px] flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
          <BarChart3 className="h-7 w-7 mb-2 opacity-40" />
          Sem movimentos em {data.year}.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 12, right: 8, bottom: 0, left: -16 }} barGap={2}>
            <defs>
              <linearGradient id="ann-recebido" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id="ann-despesas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
            <XAxis dataKey="m" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: any, name: any) => [fmtCurrency(Number(value)), name]}
              contentStyle={{
                borderRadius: 12, fontSize: 12, border: '1px solid var(--border)',
                backgroundColor: 'color-mix(in oklab, var(--background) 92%, transparent)', backdropFilter: 'blur(8px)',
              }}
              cursor={{ fill: 'color-mix(in oklab, var(--muted) 40%, transparent)' }}
            />
            <Bar dataKey="Recebido" fill="url(#ann-recebido)" radius={[5, 5, 0, 0]} maxBarSize={22} />
            <Bar dataKey="Despesas" fill="url(#ann-despesas)" radius={[5, 5, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── Movimentos recentes ────────────────────────────────────────────────────

function MovimentosCard({ data }: { data: FinancialAnnualOverview }) {
  const items = data.movimentos_recentes
  return (
    <div className={cn(PANEL, 'p-5 sm:p-6')}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold tracking-tight">Movimentos recentes</h3>
        <Link
          href="/dashboard/financeiro/conta-corrente"
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        >
          Ver tudo <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="h-[180px] flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
          <ListChecks className="h-7 w-7 mb-2 opacity-40" />
          Sem movimentos em {data.year}.
        </div>
      ) : (
        <ul className="divide-y divide-border/40">
          {items.map((mv) => {
            const isIncome = mv.kind === 'income'
            return (
              <li key={mv.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    'h-9 w-9 shrink-0 rounded-full flex items-center justify-center',
                    isIncome ? 'bg-emerald-500/10' : 'bg-red-500/10',
                  )}
                >
                  {isIncome
                    ? <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                    : <ArrowDownLeft className="h-4 w-4 text-red-600" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{mv.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {fmtDateShort(mv.date)}{mv.subtitle ? ` · ${mv.subtitle}` : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'text-[13px] font-semibold tabular-nums shrink-0 whitespace-nowrap',
                    isIncome ? 'text-emerald-600' : 'text-red-600',
                  )}
                >
                  {isIncome ? '+' : '−'} {fmtCurrency(mv.amount)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─── Estado de erro ─────────────────────────────────────────────────────────

function ErrorState({ year, onRetry }: { year: number; onRetry: () => void }) {
  return (
    <div className={cn(PANEL, 'p-10 flex flex-col items-center justify-center text-center')}>
      <AlertCircle className="h-8 w-8 text-amber-500 mb-3" />
      <p className="text-sm font-medium">Não foi possível carregar a visão geral de {year}.</p>
      <p className="text-[11px] text-muted-foreground mt-1">Verifica a ligação e tenta novamente.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-4 py-1.5 text-xs font-medium transition-opacity hover:opacity-90"
      >
        <RefreshCcw className="h-3.5 w-3.5" />
        Tentar novamente
      </button>
    </div>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Skeleton className="h-44 rounded-3xl lg:col-span-2" />
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-44 rounded-3xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-3xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-72 rounded-3xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-80 rounded-3xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  )
}
