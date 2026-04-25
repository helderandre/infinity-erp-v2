'use client'

import { useMemo, useState } from 'react'
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, TrendingUp, TrendingDown,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useLedger } from '@/hooks/use-ledger'
import { formatCurrency, formatDateTime } from '@/lib/constants'
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns'
import type { LedgerScope, LedgerEntry } from '@/lib/financial/ledger-types'
import { LedgerEntrySheet } from '@/components/financial/sheets/ledger-entry-sheet'

type Preset = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all'
type SubTab = 'all' | 'comissoes' | 'despesas'

const PRESET_LABELS: Record<Preset, string> = {
  this_month: 'Este mês',
  last_month: 'Mês anterior',
  last_3_months: 'Últimos 3 meses',
  this_year: 'Este ano',
  all: 'Tudo',
}

function rangeOf(p: Preset) {
  const now = new Date()
  switch (p) {
    case 'this_month': return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() }
    case 'last_month': {
      const prev = subMonths(now, 1)
      return { from: startOfMonth(prev).toISOString(), to: endOfMonth(prev).toISOString() }
    }
    case 'last_3_months': return { from: startOfMonth(subMonths(now, 2)).toISOString(), to: endOfMonth(now).toISOString() }
    case 'this_year': return { from: startOfYear(now).toISOString(), to: endOfYear(now).toISOString() }
    case 'all': return undefined
  }
}

interface ContaCorrenteUnifiedProps {
  scope: LedgerScope
}

export function ContaCorrenteUnified({ scope }: ContaCorrenteUnifiedProps) {
  const [preset, setPreset] = useState<Preset>('this_month')
  const [subTab, setSubTab] = useState<SubTab>('all')
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null)
  const range = rangeOf(preset)
  const { entries, loading, refetch } = useLedger({ scope, range })

  const filtered = useMemo(() => {
    if (subTab === 'all') return entries
    if (subTab === 'comissoes') return entries.filter((e) => e.family === 'commission')
    return entries.filter((e) => e.family === 'expense')
  }, [entries, subTab])

  const totals = useMemo(() => {
    const inSum = entries.filter((e) => e.side === 'in').reduce((s, e) => s + e.amount, 0)
    const outSum = entries.filter((e) => e.side === 'out').reduce((s, e) => s + e.amount, 0)
    return { in: inSum, out: outSum, net: inSum - outSum }
  }, [entries])

  const lastBalance = useMemo(() => {
    if (scope.kind !== 'agent') return null
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))
    return sorted[0]?.balanceAfter ?? 0
  }, [entries, scope.kind])

  return (
    <div className="space-y-6">
      {/* KPI strip — period totals */}
      <div className={cn(
        'grid gap-3',
        scope.kind === 'agent' ? 'grid-cols-1 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'
      )}>
        <KpiTile
          label={`Entradas (${PRESET_LABELS[preset].toLowerCase()})`}
          value={formatCurrency(totals.in)}
          icon={ArrowUpCircle}
          tone="positive"
        />
        <KpiTile
          label={`Saídas (${PRESET_LABELS[preset].toLowerCase()})`}
          value={formatCurrency(totals.out)}
          icon={ArrowDownCircle}
          tone="negative"
        />
        <KpiTile
          label="Resultado"
          value={formatCurrency(totals.net)}
          icon={totals.net >= 0 ? TrendingUp : TrendingDown}
          tone={totals.net >= 0 ? 'positive' : 'negative'}
        />
        {scope.kind === 'agent' && (
          <KpiTile
            label="Saldo actual"
            value={formatCurrency(lastBalance ?? 0)}
            icon={Wallet}
            tone={(lastBalance ?? 0) < 0 ? 'warning' : 'info'}
          />
        )}
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={preset} onValueChange={(v: Preset) => setPreset(v)}>
          <SelectTrigger className="h-9 w-[180px] text-sm rounded-full bg-muted/50 border-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRESET_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sub-tabs (Tudo / Comissões / Despesas) */}
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as SubTab)}>
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          <TabsList className="bg-transparent p-0 h-auto">
            <TabsTrigger
              value="all"
              className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900"
            >
              Tudo
              <Badge variant="outline" className="ml-2 h-4 text-[10px] px-1 rounded-full border-current/30">
                {entries.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="comissoes"
              className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900"
            >
              Comissões
              <Badge variant="outline" className="ml-2 h-4 text-[10px] px-1 rounded-full border-current/30">
                {entries.filter((e) => e.family === 'commission').length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="despesas"
              className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900"
            >
              Despesas
              <Badge variant="outline" className="ml-2 h-4 text-[10px] px-1 rounded-full border-current/30">
                {entries.filter((e) => e.family === 'expense').length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="mt-4">
          <LedgerTable
            entries={filtered}
            loading={loading}
            showBalance={scope.kind === 'agent'}
            onSelect={setSelectedEntry}
          />
        </TabsContent>
        <TabsContent value="comissoes" className="mt-4">
          <LedgerTable
            entries={filtered}
            loading={loading}
            showBalance={scope.kind === 'agent'}
            onSelect={setSelectedEntry}
          />
        </TabsContent>
        <TabsContent value="despesas" className="mt-4">
          <LedgerTable
            entries={filtered}
            loading={loading}
            showBalance={scope.kind === 'agent'}
            onSelect={setSelectedEntry}
          />
        </TabsContent>
      </Tabs>

      <LedgerEntrySheet
        entry={selectedEntry}
        scope={scope}
        onClose={() => setSelectedEntry(null)}
        onChanged={refetch}
      />
    </div>
  )
}

function KpiTile({
  label, value, icon: Icon, tone,
}: {
  label: string
  value: string
  icon: React.ElementType
  tone: 'positive' | 'negative' | 'warning' | 'info'
}) {
  const map = {
    positive: { bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
    negative: { bg: 'bg-red-500/10', text: 'text-red-600' },
    warning: { bg: 'bg-amber-500/10', text: 'text-amber-600' },
    info: { bg: 'bg-blue-500/10', text: 'text-blue-600' },
  }[tone]
  return (
    <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
      <div className={cn('rounded-xl p-2.5 w-fit', map.bg)}>
        <Icon className={cn('h-4 w-4', map.text)} />
      </div>
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">{label}</p>
      <p className={cn('text-base sm:text-xl font-bold tracking-tight truncate', map.text)}>{value}</p>
    </div>
  )
}

function LedgerTable({
  entries, loading, showBalance, onSelect,
}: {
  entries: LedgerEntry[]
  loading: boolean
  showBalance: boolean
  onSelect?: (entry: LedgerEntry) => void
}) {
  if (loading) {
    return (
      <Card className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
        <div className="p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      </Card>
    )
  }

  if (entries.length === 0) {
    return (
      <Card className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
        <div className="py-16 text-center text-sm text-muted-foreground">
          <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Sem movimentos no período seleccionado.
        </div>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Data</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Tipo</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Categoria</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Descrição</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Valor</TableHead>
            {showBalance && (
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Saldo</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => {
            const isIn = e.side === 'in'
            return (
              <TableRow
                key={e.id}
                className={cn(onSelect && 'cursor-pointer transition-colors hover:bg-muted/40')}
                onClick={onSelect ? () => onSelect(e) : undefined}
              >
                <TableCell className="text-sm whitespace-nowrap">{formatDateTime(e.date)}</TableCell>
                <TableCell>
                  <Badge className={cn(
                    'rounded-full text-[10px] font-medium border-0',
                    isIn
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
                  )}>
                    {isIn ? 'Entrada' : 'Saída'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{e.categoryLabel}</TableCell>
                <TableCell className="text-sm max-w-[260px] truncate">{e.description}</TableCell>
                <TableCell className={cn('text-sm text-right font-medium tabular-nums', isIn ? 'text-emerald-600' : 'text-red-600')}>
                  {isIn ? '+' : '−'} {formatCurrency(e.amount)}
                </TableCell>
                {showBalance && (
                  <TableCell className="text-sm text-right tabular-nums">
                    {e.balanceAfter != null ? formatCurrency(e.balanceAfter) : '—'}
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}
