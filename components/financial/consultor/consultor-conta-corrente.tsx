'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Wallet, ArrowDownCircle, ArrowUpCircle, ExternalLink } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useContaCorrente } from '@/hooks/use-conta-corrente'
import { CONTA_CORRENTE_CATEGORIES, formatCurrency, formatDateTime } from '@/lib/constants'
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns'

type Preset = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all'

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

const PRESET_LABELS: Record<Preset, string> = {
  this_month: 'Este mês',
  last_month: 'Mês anterior',
  last_3_months: 'Últimos 3 meses',
  this_year: 'Este ano',
  all: 'Tudo',
}

export function ConsultorContaCorrente({ agentId }: { agentId: string }) {
  const [preset, setPreset] = useState<Preset>('this_month')
  const range = rangeOf(preset)
  const { transactions, loading, typeFilter, setTypeFilter } = useContaCorrente(agentId, range)

  const credits = transactions.filter((t) => t.type === 'CREDIT').reduce((s, t) => s + Number(t.amount || 0), 0)
  const debits = transactions.filter((t) => t.type === 'DEBIT').reduce((s, t) => s + Number(t.amount || 0), 0)
  const lastBalance = transactions[0]?.balance_after ?? 0

  return (
    <div className="space-y-6">
      {/* Header KPIs */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
          <div className="rounded-xl p-2.5 w-fit bg-emerald-500/10">
            <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">
            Entradas ({PRESET_LABELS[preset].toLowerCase()})
          </p>
          <p className="text-base sm:text-xl font-bold tracking-tight text-emerald-600">
            {formatCurrency(credits)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
          <div className="rounded-xl p-2.5 w-fit bg-red-500/10">
            <ArrowDownCircle className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">
            Saídas ({PRESET_LABELS[preset].toLowerCase()})
          </p>
          <p className="text-base sm:text-xl font-bold tracking-tight text-red-600">
            {formatCurrency(debits)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
          <div className={cn('rounded-xl p-2.5 w-fit', lastBalance < 0 ? 'bg-amber-500/10' : 'bg-blue-500/10')}>
            <Wallet className={cn('h-4 w-4', lastBalance < 0 ? 'text-amber-600' : 'text-blue-600')} />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">
            Saldo actual
          </p>
          <p className={cn('text-base sm:text-xl font-bold tracking-tight', lastBalance < 0 ? 'text-amber-600' : 'text-foreground')}>
            {formatCurrency(lastBalance)}
          </p>
        </div>
      </div>

      {/* Filters */}
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
        <Select value={typeFilter || 'all'} onValueChange={(v) => setTypeFilter(v === 'all' ? '' : (v as 'CREDIT' | 'DEBIT'))}>
          <SelectTrigger className="h-9 w-[140px] text-sm rounded-full bg-muted/50 border-0">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="CREDIT">Entradas</SelectItem>
            <SelectItem value="DEBIT">Saídas</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button asChild size="sm" variant="outline" className="rounded-full gap-2">
            <Link href="/dashboard/financeiro/conta-corrente">
              Ver detalhe completo
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Sem movimentações no período seleccionado.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Data</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Tipo</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Categoria</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Descrição</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Valor</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => {
                const isCredit = t.type === 'CREDIT'
                const cat = CONTA_CORRENTE_CATEGORIES[t.category as keyof typeof CONTA_CORRENTE_CATEGORIES]
                return (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm whitespace-nowrap">{formatDateTime(t.date)}</TableCell>
                    <TableCell>
                      <Badge className={cn('rounded-full text-[10px] font-medium border-0', isCredit ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300')}>
                        {isCredit ? 'Entrada' : 'Saída'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{cat?.label ?? t.category}</TableCell>
                    <TableCell className="text-sm max-w-[260px] truncate">{t.description}</TableCell>
                    <TableCell className={cn('text-sm text-right font-medium tabular-nums', isCredit ? 'text-emerald-600' : 'text-red-600')}>
                      {isCredit ? '+' : '−'} {formatCurrency(t.amount)}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{formatCurrency(t.balance_after)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
