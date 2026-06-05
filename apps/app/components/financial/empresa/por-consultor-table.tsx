'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Search, ArrowUpRight, Users, Wallet, Hourglass, ShoppingBag,
  TrendingUp, ArrowUpDown,
} from 'lucide-react'
import { ConsultorDetailSheet } from '@/components/financial/sheets/consultor-detail-sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'

interface ConsultantSummary {
  id: string
  commercial_name: string
  profile_photo_url: string | null
  comissoes_ytd: number
  loja_ytd: number
  saldo_cc: number
  credit_limit: number | null
  a_receber: number
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v ?? 0)

type SortKey = 'commercial_name' | 'comissoes_ytd' | 'loja_ytd' | 'saldo_cc' | 'a_receber'

const SORT_LABELS: Record<SortKey, string> = {
  commercial_name: 'Nome',
  comissoes_ytd: 'Comissões YTD',
  a_receber: 'A receber',
  loja_ytd: 'Loja YTD',
  saldo_cc: 'Saldo conta corrente',
}

export function PorConsultorTable() {
  const [data, setData] = useState<ConsultantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('comissoes_ytd')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<ConsultantSummary | null>(null)
  const debounced = useDebounce(search, 250)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/financial/consultants-summary')
        const json = await res.json()
        setData(json.consultants ?? [])
      } catch {
        setData([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const lower = debounced.toLowerCase().trim()
    return data
      .filter((c) => !lower || c.commercial_name?.toLowerCase().includes(lower))
      .sort((a, b) => {
        const av = a[sortKey] as number | string
        const bv = b[sortKey] as number | string
        const cmp = typeof av === 'string'
          ? String(av).localeCompare(String(bv))
          : Number(av) - Number(bv)
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [data, debounced, sortKey, sortDir])

  const totals = useMemo(() => {
    return data.reduce((acc, c) => {
      acc.comissoes += c.comissoes_ytd
      acc.loja += c.loja_ytd
      acc.saldo += c.saldo_cc
      acc.aReceber += c.a_receber
      return acc
    }, { comissoes: 0, loja: 0, saldo: 0, aReceber: 0 })
  }, [data])

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ─── Sheet 1: KPIs agregados ──────────────────────────────────── */}
      <Card className="rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm p-6 space-y-5 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Visão geral</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Totais agregados de {data.length} consultor(es) activo(s)
          </p>
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KpiTile label="Consultores activos" value={String(data.length)} icon={Users} tone="neutral" />
          <KpiTile label="Comissões YTD" value={fmt(totals.comissoes)} icon={TrendingUp} tone="positive" />
          <KpiTile label="A receber" value={fmt(totals.aReceber)} icon={Hourglass} tone="warning" />
          <KpiTile label="Loja YTD" value={fmt(totals.loja)} icon={ShoppingBag} tone="negative" />
        </div>
      </Card>

      {/* ─── Sheet 2: Lista de consultores em cards ───────────────────── */}
      <Card className="rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm p-6 space-y-5 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Consultores</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Click num cartão para ver a vista financeira completa
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-initial sm:w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Pesquisar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 rounded-full bg-background/60 ring-1 ring-border/40 border-0 text-xs"
              />
            </div>
            <Select
              value={`${sortKey}:${sortDir}`}
              onValueChange={(v) => {
                const [k, d] = v.split(':') as [SortKey, 'asc' | 'desc']
                setSortKey(k); setSortDir(d)
              }}
            >
              <SelectTrigger className="h-9 w-[180px] rounded-full bg-background/60 ring-1 ring-border/40 border-0 text-xs">
                <ArrowUpDown className="h-3 w-3 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortKey[]).flatMap((k) => [
                  <SelectItem key={`${k}:desc`} value={`${k}:desc`}>{SORT_LABELS[k]} ↓</SelectItem>,
                  <SelectItem key={`${k}:asc`} value={`${k}:asc`}>{SORT_LABELS[k]} ↑</SelectItem>,
                ])}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 py-16 text-center text-sm text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Sem consultores a mostrar.
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <ConsultorCard
                key={c.id}
                consultant={c}
                onClick={() => setSelected(c)}
              />
            ))}
          </div>
        )}
      </Card>

      <ConsultorDetailSheet consultant={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

// ─── ConsultorCard (substitui linha de tabela) ─────────────────────────────

function ConsultorCard({
  consultant: c, onClick,
}: {
  consultant: ConsultantSummary
  onClick: () => void
}) {
  const usage = c.credit_limit && c.credit_limit > 0
    ? Math.round((Math.max(0, -c.saldo_cc) / c.credit_limit) * 100)
    : null
  const initials = c.commercial_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '—'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group text-left rounded-2xl bg-background/60 ring-1 ring-border/40 p-4',
        'transition-all duration-300',
        'hover:ring-border hover:shadow-[0_4px_20px_-4px_rgb(0_0_0_/_0.08)] hover:bg-background/80',
      )}
    >
      {/* Header: avatar + name */}
      <div className="flex items-center gap-3 mb-4">
        <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
          <AvatarImage src={c.profile_photo_url ?? undefined} />
          <AvatarFallback className="text-xs bg-gradient-to-br from-neutral-200 to-neutral-400 dark:from-neutral-600 dark:to-neutral-800">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight truncate">{c.commercial_name}</p>
          {c.credit_limit != null && usage != null && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              Limite: {fmt(c.credit_limit)} ·{' '}
              <span className={cn(
                usage >= 80 ? 'text-red-600' :
                usage >= 50 ? 'text-amber-600' :
                'text-emerald-600'
              )}>{usage}% usado</span>
            </p>
          )}
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>

      {/* Stats grid 2x2 */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Comissões YTD" value={fmt(c.comissoes_ytd)} tone="positive" />
        <Stat label="A receber" value={fmt(c.a_receber)} tone="warning" />
        <Stat label="Loja YTD" value={fmt(c.loja_ytd)} tone="negative" />
        <Stat
          label="Saldo CC"
          value={fmt(c.saldo_cc)}
          tone={c.saldo_cc < 0 ? 'warning' : 'neutral'}
        />
      </div>
    </button>
  )
}

function Stat({
  label, value, tone,
}: {
  label: string
  value: string
  tone: 'positive' | 'negative' | 'warning' | 'neutral'
}) {
  const map = {
    positive: 'text-emerald-600',
    negative: 'text-red-600',
    warning: 'text-amber-600',
    neutral: 'text-foreground',
  }[tone]
  return (
    <div className="rounded-xl bg-muted/30 ring-1 ring-border/30 p-2.5">
      <p className="text-[10px] text-muted-foreground font-medium leading-tight truncate">{label}</p>
      <p className={cn('text-sm font-semibold tracking-tight tabular-nums truncate mt-0.5', map)}>
        {value}
      </p>
    </div>
  )
}

// ─── KPI tile (aggregate) ──────────────────────────────────────────────────

function KpiTile({
  label, value, icon: Icon, tone,
}: {
  label: string
  value: string
  icon: React.ElementType
  tone: 'positive' | 'negative' | 'warning' | 'neutral'
}) {
  const toneMap = {
    neutral: { from: 'from-slate-500/10', icon: 'text-slate-600 dark:text-slate-300', accent: 'bg-slate-400/40' },
    positive: { from: 'from-emerald-500/15', icon: 'text-emerald-600', accent: 'bg-emerald-500/60' },
    negative: { from: 'from-red-500/15', icon: 'text-red-600', accent: 'bg-red-500/60' },
    warning: { from: 'from-amber-500/15', icon: 'text-amber-600', accent: 'bg-amber-500/60' },
  }[tone]

  return (
    <div className={cn(
      'group relative overflow-hidden rounded-2xl bg-gradient-to-br to-transparent',
      'ring-1 ring-border/40 p-4 transition-all duration-300',
      'hover:ring-border/70 hover:shadow-[0_4px_20px_-4px_rgb(0_0_0_/_0.08)]',
      toneMap.from,
    )}>
      <span className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full', toneMap.accent)} />
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', toneMap.icon)} />
        <p className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</p>
      </div>
      <p className="text-base sm:text-2xl font-semibold tracking-tight tabular-nums mt-2.5 text-foreground break-words">
        {value}
      </p>
    </div>
  )
}

