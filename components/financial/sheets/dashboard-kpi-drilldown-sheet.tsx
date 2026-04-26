'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpCircle, ArrowDownCircle, ChevronRight, Loader2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { FinanceiroSheet } from './financeiro-sheet'
import { MapaRowSheet } from './mapa-row-sheet'
import { LedgerEntrySheet } from './ledger-entry-sheet'
import type { LedgerEntry } from '@/lib/financial/ledger-types'
import type { MapaGestaoRow } from '@/types/financial'
import type { DrilldownKind, DrilldownPayload, DrilldownEntry, MarginBreakdown } from '@/app/api/financial/dashboard/drilldown/route'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })

// ── Tone tokens — same scale as the page cards (KpiCard / PipelineCard).
// Keep the pairs in sync with [components/financial/financial-dashboard-tab.tsx].
type Tone = 'positive' | 'negative' | 'warning' | 'info' | 'purple'
const TONE_MAP: Record<Tone, { from: string; dot: string; iconBg: string; iconText: string }> = {
  positive: { from: 'from-emerald-500/15', dot: 'bg-emerald-500', iconBg: 'bg-emerald-500/10', iconText: 'text-emerald-600' },
  negative: { from: 'from-red-500/15', dot: 'bg-red-500', iconBg: 'bg-red-500/10', iconText: 'text-red-600' },
  warning: { from: 'from-amber-500/15', dot: 'bg-amber-500', iconBg: 'bg-amber-500/10', iconText: 'text-amber-600' },
  info: { from: 'from-blue-500/15', dot: 'bg-blue-500', iconBg: 'bg-blue-500/10', iconText: 'text-blue-600' },
  purple: { from: 'from-purple-500/15', dot: 'bg-purple-500', iconBg: 'bg-purple-500/10', iconText: 'text-purple-600' },
}

const KIND_META: Record<DrilldownKind, { title: string; subtitle: string; cumulative: boolean; tone: Tone | 'auto' }> = {
  revenue: { title: 'Facturação', subtitle: 'Recibos recebidos no mês', cumulative: false, tone: 'positive' },
  expenses: { title: 'Despesas', subtitle: 'Despesas registadas no mês', cumulative: false, tone: 'negative' },
  result: { title: 'Resultado', subtitle: 'Margem da agência menos despesas', cumulative: false, tone: 'auto' },
  margin: { title: 'Margem líquida', subtitle: 'Distribuição da facturação do mês', cumulative: false, tone: 'info' },
  signed_pending_receipt: { title: 'Assinado por receber', subtitle: 'Pagamentos assinados que ainda não foram recebidos', cumulative: true, tone: 'warning' },
  received_pending_report: { title: 'Recebido por reportar', subtitle: 'Recebidos que ainda não foram reportados', cumulative: true, tone: 'info' },
  pending_consultant_payment: { title: 'A pagar consultores', subtitle: 'Comissões a entregar aos consultores', cumulative: true, tone: 'purple' },
}

interface DashboardKpiDrilldownSheetProps {
  kind: DrilldownKind | null
  month: number
  year: number
  onClose: () => void
}

export function DashboardKpiDrilldownSheet({
  kind, month, year, onClose,
}: DashboardKpiDrilldownSheetProps) {
  const [data, setData] = useState<DrilldownPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [nestedRow, setNestedRow] = useState<MapaGestaoRow | null>(null)
  const [nestedEntry, setNestedEntry] = useState<LedgerEntry | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const refetch = useCallback(() => {
    if (!kind) return
    const params = new URLSearchParams({ kind, month: String(month), year: String(year) })
    fetch(`/api/financial/dashboard/drilldown?${params.toString()}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((payload: DrilldownPayload) => setData(payload))
      .catch(() => {})
  }, [kind, month, year])

  useEffect(() => {
    if (!kind) return
    let cancelled = false
    setLoading(true)
    setData(null)

    const params = new URLSearchParams({ kind, month: String(month), year: String(year) })
    fetch(`/api/financial/dashboard/drilldown?${params.toString()}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((payload: DrilldownPayload) => {
        if (!cancelled) setData(payload)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [kind, month, year])

  const handleEntryClick = useCallback(async (entry: DrilldownEntry) => {
    if (!entry.entityRef) return
    setOpeningId(entry.id)
    try {
      if (entry.entityRef.type === 'deal_payment') {
        const res = await fetch(`/api/financial/deal-payments/${entry.entityRef.id}/mapa-row`)
        if (!res.ok) throw new Error()
        const row: MapaGestaoRow = await res.json()
        setNestedRow(row)
      } else if (entry.entityRef.type === 'company_transaction') {
        const res = await fetch(`/api/financial/company-transactions/${entry.entityRef.id}`)
        if (!res.ok) throw new Error()
        const t: any = await res.json()
        setNestedEntry({
          id: t.id,
          date: t.date,
          side: 'out',
          family: 'expense',
          category: t.category ?? 'expense',
          categoryLabel: t.subcategory || t.category || 'Despesa',
          description: t.description ?? '',
          amount: Number(t.amount_gross || t.amount_net || 0),
        })
      }
    } catch {
      toast.error('Não foi possível abrir o detalhe.')
    } finally {
      setOpeningId(null)
    }
  }, [])

  const meta = kind ? KIND_META[kind] : null
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

  // Resolve dynamic tone for "Resultado" (positive when ≥ 0, negative otherwise).
  const tone: Tone = !meta
    ? 'info'
    : meta.tone === 'auto'
      ? ((data?.total ?? 0) >= 0 ? 'positive' : 'negative')
      : meta.tone
  const toneTokens = TONE_MAP[tone]

  return (
    <FinanceiroSheet
      open={kind !== null}
      onOpenChange={(v) => !v && onClose()}
      title={meta?.title ?? ''}
      accent={meta && (
        <span className={cn('inline-flex h-2 w-2 rounded-full', toneTokens.dot)} />
      )}
      subtitle={meta && (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span>{meta.cumulative ? 'Pendente · cumulativo' : monthLabelCap}</span>
          <span className="text-muted-foreground/60">·</span>
          <span>{meta.subtitle}</span>
        </span>
      )}
      size="wide"
      footer={
        <Button variant="ghost" onClick={onClose} className="rounded-full">
          Fechar
        </Button>
      }
    >
      {kind === 'margin' ? (
        <MarginView loading={loading} breakdown={data?.breakdown ?? null} toneFrom={toneTokens.from} />
      ) : (
        <EntriesView
          loading={loading}
          data={data}
          toneFrom={toneTokens.from}
          openingId={openingId}
          onEntryClick={handleEntryClick}
        />
      )}

      {/* Nested sheets — open over the drilldown when an entry is clicked. */}
      <MapaRowSheet
        row={nestedRow}
        onClose={() => setNestedRow(null)}
        onChanged={refetch}
      />
      <LedgerEntrySheet
        entry={nestedEntry}
        scope={{ kind: 'company' }}
        onClose={() => setNestedEntry(null)}
        onChanged={refetch}
      />
    </FinanceiroSheet>
  )
}

// ── Standard entries view (revenue/expenses/result/pipeline) ──────────────

function EntriesView({
  loading, data, toneFrom, openingId, onEntryClick,
}: {
  loading: boolean
  data: DrilldownPayload | null
  toneFrom: string
  openingId: string | null
  onEntryClick: (entry: DrilldownEntry) => void
}) {
  return (
    <>
      {/* Total tile — same gradient scale as the page card it came from. */}
      <div className={cn(
        'rounded-2xl ring-1 ring-border/40 p-5 bg-gradient-to-br to-transparent',
        toneFrom,
      )}>
        <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
          Total
        </p>
        {loading ? (
          <Skeleton className="h-8 w-40 mt-2" />
        ) : (
          <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums mt-1">
            {fmtCurrency(data?.total ?? 0)}
          </p>
        )}
        {!loading && data && (
          <p className="text-xs text-muted-foreground mt-2">
            {data.entries.length === 0 ? 'Sem entradas no período.' : `${data.entries.length} entrada${data.entries.length === 1 ? '' : 's'}`}
          </p>
        )}
      </div>

      {/* Entries list */}
      <div className="space-y-2">
        {loading && (
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </>
        )}

        {!loading && data && data.entries.length === 0 && (
          <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 py-12 text-center text-sm text-muted-foreground">
            <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Sem entradas para listar.
          </div>
        )}

        {!loading && data?.entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            opening={openingId === entry.id}
            onClick={() => onEntryClick(entry)}
          />
        ))}
      </div>
    </>
  )
}

function EntryRow({
  entry, opening, onClick,
}: {
  entry: DrilldownEntry
  opening: boolean
  onClick: () => void
}) {
  const isIn = entry.side === 'in'
  const Icon = isIn ? ArrowUpCircle : ArrowDownCircle
  const clickable = Boolean(entry.entityRef)

  return (
    <button
      type="button"
      disabled={!clickable || opening}
      onClick={clickable ? onClick : undefined}
      className={cn(
        'group relative w-full text-left rounded-2xl ring-1 ring-border/40 bg-background/60 p-4',
        'transition-all',
        clickable && 'cursor-pointer hover:ring-border/70 hover:shadow-[0_4px_16px_-6px_rgb(0_0_0_/_0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !clickable && 'cursor-default',
        opening && 'opacity-60 pointer-events-none',
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'rounded-xl p-2 shrink-0',
          isIn ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600',
        )}>
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {entry.primary}
              </p>
              {entry.secondary && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {entry.secondary}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className={cn(
                'text-sm font-semibold tabular-nums',
                isIn ? 'text-emerald-600' : 'text-red-600',
              )}>
                {isIn ? '+' : '−'} {fmtCurrency(entry.amount)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {fmtDate(entry.date)}
              </p>
            </div>
          </div>

          {entry.meta && entry.meta.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {entry.meta.map((m, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] font-normal h-5 px-2 rounded-full border-border/40 bg-muted/30"
                >
                  <span className="text-muted-foreground/80 mr-1">{m.label}:</span>
                  {m.value}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {clickable && (
          <span className="shrink-0 mt-0.5 text-muted-foreground/60">
            {opening ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </span>
        )}
      </div>
    </button>
  )
}

// ── Margin distribution view (donut + legend) ─────────────────────────────

const MARGIN_SEGMENTS: Array<{ key: keyof MarginBreakdown; label: string; color: string }> = [
  { key: 'agency', label: 'Margem da agência', color: '#10b981' },
  { key: 'consultant', label: 'Consultores', color: '#3b82f6' },
  { key: 'network', label: 'Rede (RE/MAX)', color: '#a855f7' },
  { key: 'partners', label: 'Parceiros', color: '#f59e0b' },
]

function MarginView({
  loading, breakdown, toneFrom,
}: {
  loading: boolean
  breakdown: MarginBreakdown | null
  toneFrom: string
}) {
  const chartData = useMemo(() => {
    if (!breakdown) return []
    return MARGIN_SEGMENTS
      .map((s) => ({
        key: s.key,
        label: s.label,
        color: s.color,
        value: Number(breakdown[s.key] ?? 0),
      }))
      .filter((s) => s.value > 0)
  }, [breakdown])

  const totalRevenue = breakdown?.revenue_total ?? 0

  if (loading || !breakdown) {
    return (
      <>
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </>
    )
  }

  const noData = totalRevenue === 0

  return (
    <>
      {/* Hero — margem líquida e fórmula. */}
      <div className={cn(
        'rounded-2xl ring-1 ring-border/40 p-5 bg-gradient-to-br to-transparent',
        toneFrom,
      )}>
        <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
          Margem líquida
        </p>
        <p className="text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums mt-1">
          {breakdown.margin_pct}%
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {fmtCurrency(breakdown.agency)} de margem
          {breakdown.expenses > 0 && (
            <> − {fmtCurrency(breakdown.expenses)} de despesas</>
          )}
          {' = '}
          <span className={cn(
            'font-medium tabular-nums',
            breakdown.agency_net >= 0 ? 'text-emerald-600' : 'text-red-600',
          )}>
            {fmtCurrency(breakdown.agency_net)}
          </span>
          {' líquido'}
        </p>
      </div>

      {/* Donut + legend */}
      <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold tracking-tight">Distribuição da facturação</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Para onde vai cada euro recebido — total {fmtCurrency(totalRevenue)}
            </p>
          </div>
        </div>

        {noData ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Sem facturação no período.
          </div>
        ) : (
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-[200px_1fr] items-center">
            <div className="relative h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {chartData.map((d) => (
                      <Cell key={d.key} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => fmtCurrency(Number(v))}
                    contentStyle={{
                      borderRadius: 12, fontSize: 12, border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--background) / 0.95)', backdropFilter: 'blur(8px)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="text-sm font-semibold tabular-nums leading-tight mt-0.5">
                  {fmtCurrency(totalRevenue)}
                </p>
              </div>
            </div>

            <ul className="space-y-2.5">
              {chartData.map((seg) => {
                const pct = totalRevenue > 0 ? Math.round((seg.value / totalRevenue) * 100) : 0
                return (
                  <li key={seg.key} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="truncate">{seg.label}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-medium tabular-nums">{fmtCurrency(seg.value)}</span>
                      <span className="ml-2 text-[11px] text-muted-foreground tabular-nums">
                        {pct}%
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {breakdown.expenses > 0 && (
          <div className="mt-4 pt-4 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between">
            <span>Despesas operacionais (subtraídas à margem da agência)</span>
            <span className="font-medium tabular-nums text-red-600">
              − {fmtCurrency(breakdown.expenses)}
            </span>
          </div>
        )}
      </div>
    </>
  )
}
