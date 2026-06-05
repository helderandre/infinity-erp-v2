'use client'

/**
 * Detail sheet for /dashboard/crm/analise → Análise tab. Glassmorphic Sheet
 * (right on desktop, bottom on mobile) that renders one of three layouts
 * based on the card the user clicked:
 *
 *   - 'donut'    → circular distribution + legend (origem, portal, funil,
 *                  motivos de perda, negócios por tipo)
 *   - 'list'     → list of underlying items (top-row KPI cards)
 *   - 'timeline' → daily bar chart + list (middle-row money & time cards)
 *
 * Items are fetched once from /api/leads/analytics/items when the sheet
 * opens; the configured `kind` slices them client-side.
 */

import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, isValid, differenceInDays, differenceInHours } from 'date-fns'
import { pt } from 'date-fns/locale'

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getSourceBrand, getPortalBrand, type BrandMeta } from '@/lib/leads/source-brand'

// ─── Kinds ────────────────────────────────────────────────────────────────

export type SheetKind =
  // Donut — reuse data already loaded by the parent
  | { layout: 'donut'; title: string; data: Record<string, number>; brandKind?: 'source' | 'portal' | 'plain'; colorMap?: Record<string, string>; labelMap?: Record<string, string> }
  // List — show items filtered by selector
  | { layout: 'list'; title: string; selector: ItemSelector }
  // Timeline + list — daily bars + items
  | { layout: 'timeline'; title: string; selector: ItemSelector; useDate: 'created_at' | 'won_date' | 'processed_at'; valueKey?: 'count' | 'value' }

type ItemSelector =
  | { kind: 'entries'; filter: 'all' | 'qualified' | 'lost' | 'novo' | 'contactado' }
  | { kind: 'negocios'; filter: 'all' | 'open' | 'won' | 'lost' }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: SheetKind | null
  from: string | null // YYYY-MM-DD
  to: string | null
  agentParam?: string // 'all' | uuid (only meaningful for management)
}

const EUR = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
})

// ─── Donut ────────────────────────────────────────────────────────────────

interface DonutSegment { key: string; value: number; color: string; label: string; logoUrl?: string | null }

function Donut({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const size = 220
  const radius = 88
  const inner = 56
  const cx = size / 2
  const cy = size / 2
  let cumulative = 0
  const paths = segments.map((s) => {
    const startA = (cumulative / total) * Math.PI * 2 - Math.PI / 2
    cumulative += s.value
    const endA = (cumulative / total) * Math.PI * 2 - Math.PI / 2
    const large = endA - startA > Math.PI ? 1 : 0
    const x1 = cx + radius * Math.cos(startA)
    const y1 = cy + radius * Math.sin(startA)
    const x2 = cx + radius * Math.cos(endA)
    const y2 = cy + radius * Math.sin(endA)
    const x3 = cx + inner * Math.cos(endA)
    const y3 = cy + inner * Math.sin(endA)
    const x4 = cx + inner * Math.cos(startA)
    const y4 = cy + inner * Math.sin(startA)
    const d = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4}`,
      'Z',
    ].join(' ')
    return { key: s.key, d, color: s.color }
  })

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {paths.map((p) => (
            <path key={p.key} d={p.d} fill={p.color} stroke="hsl(var(--background))" strokeWidth="1.5" />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold tabular-nums">{total}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {segments.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0
          return (
            <li key={s.key} className="flex items-center gap-3 text-xs">
              {s.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logoUrl} alt="" className="h-4 w-4 rounded-sm shrink-0" />
              ) : (
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              )}
              <span className="flex-1 truncate">{s.label}</span>
              <span className="tabular-nums text-muted-foreground">{s.value}</span>
              <span className="tabular-nums font-medium w-12 text-right">{pct.toFixed(0)}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Item helpers ─────────────────────────────────────────────────────────

interface EntryRow {
  id: string
  source: string | null
  status: string | null
  created_at: string
  first_contact_at: string | null
  processed_at: string | null
  lost_reason: string | null
  raw_name: string | null
  raw_email: string | null
  raw_phone: string | null
  contact?: { id: string; nome: string | null; email: string | null; telemovel: string | null } | null
}
interface NegocioRow {
  id: string
  created_at: string
  won_date: string | null
  lost_date: string | null
  lost_reason: string | null
  expected_value: number | string | null
  orcamento: number | string | null
  preco_venda: number | string | null
  business_type: string | null
  tipo: string | null
  lead?: { id: string; nome: string | null } | null
}

function entryName(e: EntryRow): string {
  return e.contact?.nome || e.raw_name || e.raw_email || e.raw_phone || 'Sem nome'
}
function negocioValue(n: NegocioRow): number {
  const raw = n.preco_venda ?? n.expected_value ?? n.orcamento
  return raw != null ? Number(raw) || 0 : 0
}
function negocioStatus(n: NegocioRow): { label: string; color: string } {
  if (n.won_date) return { label: 'Ganho', color: 'text-emerald-600 dark:text-emerald-400' }
  if (n.lost_date) return { label: 'Perdido', color: 'text-red-600 dark:text-red-400' }
  return { label: 'Aberto', color: 'text-blue-600 dark:text-blue-400' }
}

function filterEntries(entries: EntryRow[], sel: Extract<ItemSelector, { kind: 'entries' }>): EntryRow[] {
  switch (sel.filter) {
    case 'qualified':  return entries.filter((e) => e.status === 'converted')
    case 'lost':       return entries.filter((e) => e.status === 'discarded')
    case 'novo':       return entries.filter((e) => e.status === 'new' || e.status === 'seen')
    case 'contactado': return entries.filter((e) => e.status === 'processing')
    default:           return entries
  }
}
function filterNegocios(negs: NegocioRow[], sel: Extract<ItemSelector, { kind: 'negocios' }>): NegocioRow[] {
  switch (sel.filter) {
    case 'won':  return negs.filter((n) => !!n.won_date)
    case 'lost': return negs.filter((n) => !!n.lost_date)
    case 'open': return negs.filter((n) => !n.won_date && !n.lost_date)
    default:     return negs
  }
}

// ─── Timeline ─────────────────────────────────────────────────────────────

function Timeline({ buckets, valueKey }: { buckets: { date: string; count: number; value: number }[]; valueKey: 'count' | 'value' }) {
  const max = Math.max(1, ...buckets.map((b) => (valueKey === 'value' ? b.value : b.count)))
  const total = buckets.reduce((a, b) => a + (valueKey === 'value' ? b.value : b.count), 0)
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
          Linha do tempo
        </span>
        <span className="text-xs font-semibold tabular-nums">
          {valueKey === 'value' ? EUR.format(total) : total}
        </span>
      </div>
      {/* Fixed-height row + every bar is a flex child whose %-height resolves
          against the row's height (h-32). items-end keeps shorter bars
          anchored to the baseline. */}
      <div className="flex items-end gap-1 h-32">
        {buckets.map((b) => {
          const v = valueKey === 'value' ? b.value : b.count
          const h = (v / max) * 100
          return (
            <div
              key={b.date}
              className="flex-1 rounded-t-sm bg-primary/70 hover:bg-primary transition-colors min-w-[2px]"
              style={{ height: v > 0 ? `${Math.max(h, 2)}%` : '2px' }}
              title={`${format(parseISO(b.date), 'd MMM yyyy', { locale: pt })}: ${valueKey === 'value' ? EUR.format(b.value) : b.count}`}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{buckets[0] ? format(parseISO(buckets[0].date), 'd MMM', { locale: pt }) : ''}</span>
        <span>{buckets[buckets.length - 1] ? format(parseISO(buckets[buckets.length - 1].date), 'd MMM', { locale: pt }) : ''}</span>
      </div>
    </div>
  )
}

function bucketByDay(
  items: { ts: string; value: number }[],
  fromISO: string,
  toISO: string,
): { date: string; count: number; value: number }[] {
  const from = new Date(fromISO)
  const to = new Date(toISO)
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000))
  const buckets: Record<string, { count: number; value: number }> = {}
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getTime() + i * 86400000)
    const key = format(d, 'yyyy-MM-dd')
    buckets[key] = { count: 0, value: 0 }
  }
  for (const it of items) {
    if (!it.ts) continue
    const key = format(new Date(it.ts), 'yyyy-MM-dd')
    if (!buckets[key]) continue
    buckets[key].count += 1
    buckets[key].value += it.value
  }
  return Object.entries(buckets).map(([date, b]) => ({ date, ...b }))
}

// ─── Sheet ────────────────────────────────────────────────────────────────

export function AnaliseDetailSheet({ open, onOpenChange, config, from, to, agentParam }: Props) {
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [negocios, setNegocios] = useState<NegocioRow[]>([])
  const [loading, setLoading] = useState(false)
  const needsItems = config?.layout !== 'donut'

  useEffect(() => {
    if (!open || !needsItems || !from || !to) return
    let cancelled = false
    const fetchItems = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          from: new Date(`${from}T00:00:00.000Z`).toISOString(),
          to: new Date(`${to}T23:59:59.999Z`).toISOString(),
        })
        if (agentParam) params.set('agent_id', agentParam)
        const res = await fetch(`/api/leads/analytics/items?${params}`)
        if (!res.ok) throw new Error()
        const json = await res.json()
        if (cancelled) return
        setEntries(json.entries ?? [])
        setNegocios(json.negocios ?? [])
      } catch {
        if (!cancelled) { setEntries([]); setNegocios([]) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchItems()
    return () => { cancelled = true }
  }, [open, needsItems, from, to, agentParam])

  const filteredEntries = useMemo(() => {
    if (!config || config.layout === 'donut') return []
    if (config.selector.kind !== 'entries') return []
    return filterEntries(entries, config.selector)
  }, [config, entries])
  const filteredNegocios = useMemo(() => {
    if (!config || config.layout === 'donut') return []
    if (config.selector.kind !== 'negocios') return []
    return filterNegocios(negocios, config.selector)
  }, [config, negocios])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'p-0 flex flex-col gap-0',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          'w-full sm:max-w-[520px] sm:rounded-l-3xl border-l border-border/40',
        )}
      >
        <SheetHeader className="px-5 py-4 border-b border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/20 backdrop-blur-md">
          <SheetTitle className="text-base">{config?.title ?? 'Detalhe'}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {!config ? null : config.layout === 'donut' ? (
            <DonutSection config={config} />
          ) : loading ? (
            <Skeleton className="h-32 w-full rounded-2xl" />
          ) : config.layout === 'list' ? (
            <ListSection
              selector={config.selector}
              entries={filteredEntries}
              negocios={filteredNegocios}
            />
          ) : (
            <TimelineSection
              config={config}
              entries={filteredEntries}
              negocios={filteredNegocios}
              fromISO={from!}
              toISO={to!}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Sections ─────────────────────────────────────────────────────────────

function DonutSection({ config }: { config: Extract<SheetKind, { layout: 'donut' }> }) {
  const segments: DonutSegment[] = Object.entries(config.data)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => {
      let brand: BrandMeta | null = null
      if (config.brandKind === 'source') brand = getSourceBrand(key)
      else if (config.brandKind === 'portal') brand = getPortalBrand(key)
      const color = brand?.color ?? config.colorMap?.[key] ?? '#94A3B8'
      const label = brand?.label ?? config.labelMap?.[key] ?? key
      return { key, value, color, label, logoUrl: brand?.logoUrl ?? null }
    })
  const total = segments.reduce((a, s) => a + s.value, 0)
  if (total === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período.</p>
  return <Donut segments={segments} total={total} />
}

function ListSection({
  selector, entries, negocios,
}: { selector: ItemSelector; entries: EntryRow[]; negocios: NegocioRow[] }) {
  if (selector.kind === 'entries') {
    if (entries.length === 0) return <Empty />
    return (
      <ul className="space-y-2">
        {entries.map((e) => {
          const brand = getSourceBrand(e.source ?? 'unknown')
          return (
            <li
              key={e.id}
              className="flex items-center gap-3 rounded-2xl bg-background border border-border/40 shadow-sm hover:shadow-md transition-shadow px-3 py-2.5 text-sm"
            >
              {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logoUrl} alt="" className="h-5 w-5 rounded-md shrink-0" />
              ) : (
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: brand.color }} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{entryName(e)}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {brand.label} · {format(new Date(e.created_at), 'd MMM yyyy', { locale: pt })}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    )
  }
  if (negocios.length === 0) return <Empty />
  return (
    <ul className="space-y-2">
      {negocios.map((n) => {
        const s = negocioStatus(n)
        const v = negocioValue(n)
        return (
          <li
            key={n.id}
            className="flex items-center gap-3 rounded-2xl bg-background border border-border/40 shadow-sm hover:shadow-md transition-shadow px-3 py-2.5 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{n.lead?.nome ?? 'Sem nome'}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                <span className={s.color}>{s.label}</span>
                {n.business_type ? ` · ${n.business_type}` : ''}
                {' · '}
                {format(new Date(n.created_at), 'd MMM yyyy', { locale: pt })}
              </p>
            </div>
            <span className="text-xs font-semibold tabular-nums shrink-0">
              {v > 0 ? EUR.format(v) : '—'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function TimelineSection({
  config, entries, negocios, fromISO, toISO,
}: {
  config: Extract<SheetKind, { layout: 'timeline' }>
  entries: EntryRow[]
  negocios: NegocioRow[]
  fromISO: string
  toISO: string
}) {
  const items = useMemo(() => {
    if (config.selector.kind === 'entries') {
      return entries
        .map((e) => ({
          ts: (e[config.useDate as keyof EntryRow] as string | null | undefined) ?? '',
          value: 0,
        }))
        .filter((it) => it.ts)
    }
    return negocios
      .map((n) => ({
        ts: (n[config.useDate as keyof NegocioRow] as string | null | undefined) ?? '',
        value: negocioValue(n),
      }))
      .filter((it) => it.ts)
  }, [config, entries, negocios])

  const buckets = useMemo(
    () => bucketByDay(items, fromISO, toISO),
    [items, fromISO, toISO],
  )
  const valueKey = config.valueKey ?? 'count'

  return (
    <div className="space-y-5">
      <Timeline buckets={buckets} valueKey={valueKey} />
      <ListSection selector={config.selector} entries={entries} negocios={negocios} />
    </div>
  )
}

function Empty() {
  return <p className="text-sm text-muted-foreground py-8 text-center">Sem itens no período.</p>
}

// Stop unused-import lint about helpers used through the file.
void differenceInDays; void differenceInHours; void isValid
