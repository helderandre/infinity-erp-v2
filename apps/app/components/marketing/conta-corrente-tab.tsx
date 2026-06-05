'use client'

import { useState, useMemo } from 'react'
import { useAgentBalances, useContaCorrente } from '@/hooks/use-conta-corrente'
import { CONTA_CORRENTE_CATEGORIES, formatCurrency, formatDateTime } from '@/lib/constants'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, Plus, Loader2, AlertTriangle,
  TrendingUp, TrendingDown, Settings2, User, Search
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns'

type TimelinePreset = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all'

function getDateRange(preset: TimelinePreset): { from: string; to: string } | undefined {
  const now = new Date()
  switch (preset) {
    case 'this_month':
      return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() }
    case 'last_month': {
      const prev = subMonths(now, 1)
      return { from: startOfMonth(prev).toISOString(), to: endOfMonth(prev).toISOString() }
    }
    case 'last_3_months':
      return { from: startOfMonth(subMonths(now, 2)).toISOString(), to: endOfMonth(now).toISOString() }
    case 'this_year':
      return { from: startOfYear(now).toISOString(), to: endOfYear(now).toISOString() }
    case 'all':
      return undefined
  }
}

const TIMELINE_LABELS: Record<TimelinePreset, string> = {
  this_month: 'Este Mes',
  last_month: 'Mes Anterior',
  last_3_months: 'Ultimos 3 Meses',
  this_year: 'Este Ano',
  all: 'Tudo',
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export function ContaCorrenteTab() {
  const { balances, loading: balancesLoading, refetch: refetchBalances } = useAgentBalances()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<TimelinePreset>('this_month')
  const dateRange = getDateRange(timeline)
  const { transactions, loading: txLoading, typeFilter, setTypeFilter } = useContaCorrente(
    selectedAgent || undefined,
    dateRange
  )
  const [manualDialog, setManualDialog] = useState(false)
  const [manualForm, setManualForm] = useState({ agent_id: '', type: 'DEBIT' as 'DEBIT' | 'CREDIT', amount: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [agentSearch, setAgentSearch] = useState('')

  const selectedBalance = balances.find(b => b.agent_id === selectedAgent)

  const filteredAgents = useMemo(() => {
    if (!agentSearch.trim()) return balances
    const q = agentSearch.toLowerCase()
    return balances.filter(a => a.commercial_name.toLowerCase().includes(q))
  }, [balances, agentSearch])

  const kpis = useMemo(() => {
    const balance = selectedAgent
      ? (balances.find(b => b.agent_id === selectedAgent)?.current_balance ?? 0)
      : balances.reduce((s, b) => s + b.current_balance, 0)
    const credits = transactions.filter(tx => tx.type === 'CREDIT').reduce((s, tx) => s + tx.amount, 0)
    const debits = transactions.filter(tx => tx.type === 'DEBIT').reduce((s, tx) => s + tx.amount, 0)
    return { balance, credits, debits, movements: transactions.length }
  }, [balances, transactions, selectedAgent])

  const handleManualAdjustment = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/marketing/conta-corrente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...manualForm,
          category: 'manual_adjustment',
          amount: Number(manualForm.amount),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Movimento registado')
      setManualDialog(false)
      setManualForm({ agent_id: '', type: 'DEBIT', amount: '', description: '' })
      refetchBalances()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao registar movimento')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── Agents Horizontal Scroll ─── */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Pesquisar consultor..."
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              className="pl-9 h-8 rounded-full bg-muted/50 border-0 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full px-4 h-8 text-xs backdrop-blur-sm bg-background/50"
            onClick={() => setManualDialog(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Ajuste Manual
          </Button>
        </div>

        {balancesLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-[100px] w-[130px] flex-shrink-0 rounded-2xl" />
            ))}
          </div>
        ) : balances.length === 0 ? (
          <EmptyState icon={Wallet} title="Sem consultores" description="Nenhum consultor activo encontrado." />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {/* "Todos" card */}
            <button
              className={cn(
                'group flex-shrink-0 flex flex-col items-center gap-2 rounded-2xl p-4 w-[120px]',
                'bg-card/50 backdrop-blur-sm transition-all duration-300',
                'hover:shadow-lg hover:bg-card/80',
                !selectedAgent
                  ? 'border-2 border-neutral-900 dark:border-white shadow-md bg-card/80'
                  : 'border border-border hover:border-muted-foreground/20'
              )}
              onClick={() => setSelectedAgent(null)}
            >
              <div className="h-11 w-11 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-400 dark:from-neutral-600 dark:to-neutral-800 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">Todos</span>
              <span className={cn(
                'text-xs font-bold',
                kpis.balance >= 0 ? 'text-emerald-500' : 'text-red-500'
              )}>
                {formatCurrency(balances.reduce((s, b) => s + b.current_balance, 0))}
              </span>
            </button>

            {filteredAgents.map(agent => {
              const isSelected = selectedAgent === agent.agent_id
              const overLimit = agent.credit_limit !== null && agent.current_balance < -agent.credit_limit
              return (
                <button
                  key={agent.agent_id}
                  className={cn(
                    'group flex-shrink-0 flex flex-col items-center gap-2 rounded-2xl p-4 w-[120px]',
                    'bg-card/50 backdrop-blur-sm transition-all duration-300',
                    'hover:shadow-lg hover:bg-card/80',
                    isSelected
                      ? 'border-2 border-neutral-900 dark:border-white shadow-md bg-card/80'
                      : 'border border-border hover:border-muted-foreground/20'
                  )}
                  onClick={() => setSelectedAgent(isSelected ? null : agent.agent_id)}
                >
                  <div className="relative">
                    <Avatar className="h-11 w-11 ring-2 ring-background shadow-sm">
                      <AvatarImage src={agent.profile_photo_url || undefined} alt={agent.commercial_name} />
                      <AvatarFallback className="bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-600 dark:to-neutral-700 text-[10px] font-semibold">
                        {getInitials(agent.commercial_name)}
                      </AvatarFallback>
                    </Avatar>
                    {overLimit && (
                      <div className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
                        <AlertTriangle className="h-2 w-2 text-white" />
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground truncate w-full text-center">
                    {agent.commercial_name.split(' ')[0]}
                  </span>
                  <span className={cn(
                    'text-xs font-bold',
                    agent.current_balance > 0 ? 'text-emerald-500' : agent.current_balance < 0 ? 'text-red-500' : 'text-muted-foreground'
                  )}>
                    {formatCurrency(agent.current_balance)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Saldo', value: kpis.balance, icon: Wallet, color: kpis.balance >= 0 ? 'text-emerald-500' : 'text-red-500', iconBg: kpis.balance >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10', iconColor: kpis.balance >= 0 ? 'text-emerald-500' : 'text-red-500' },
          { label: 'Creditos', value: kpis.credits, icon: TrendingUp, color: 'text-emerald-500', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
          { label: 'Debitos', value: kpis.debits, icon: TrendingDown, color: 'text-red-500', iconBg: 'bg-red-500/10', iconColor: 'text-red-500' },
          { label: 'Movimentos', value: kpis.movements, icon: Settings2, color: 'text-foreground', iconBg: 'bg-muted', iconColor: 'text-muted-foreground', isCurrency: false },
        ].map(kpi => (
          <div
            key={kpi.label}
            className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 transition-all duration-300 hover:shadow-md hover:bg-card/80"
          >
            <div className="flex items-center gap-3">
              <div className={cn('rounded-xl p-2', kpi.iconBg)}>
                <kpi.icon className={cn('h-4 w-4', kpi.iconColor)} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{kpi.label}</p>
                <p className={cn('text-lg font-bold tracking-tight', kpi.color)}>
                  {'isCurrency' in kpi && kpi.isCurrency === false ? kpi.value : formatCurrency(kpi.value)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Timeline + Filters ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm">
          {(Object.keys(TIMELINE_LABELS) as TimelinePreset[]).map(key => (
            <button
              key={key}
              onClick={() => setTimeline(key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors duration-300',
                timeline === key
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {TIMELINE_LABELS[key]}
            </button>
          ))}
        </div>

        <Select
          value={typeFilter || 'all'}
          onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v as 'DEBIT' | 'CREDIT')}
        >
          <SelectTrigger className="w-[120px] rounded-full bg-muted/50 border-0 h-8 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="DEBIT">Debitos</SelectItem>
            <SelectItem value="CREDIT">Creditos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ─── Transactions Table ─── */}
      {txLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState icon={Wallet} title="Sem movimentos" description="Nenhum movimento encontrado." />
      ) : (
        <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Data</TableHead>
                {!selectedAgent && (
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Consultor</TableHead>
                )}
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Descricao</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Categoria</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Valor</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map(tx => (
                <TableRow key={tx.id} className="transition-colors duration-200 hover:bg-muted/30">
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(tx.created_at)}
                  </TableCell>
                  {!selectedAgent && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium">{tx.agent?.commercial_name || '\u2014'}</span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="text-sm max-w-[200px] truncate text-muted-foreground">
                    {tx.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="rounded-full text-[10px] font-medium px-2.5 py-0.5 bg-muted/50">
                      {CONTA_CORRENTE_CATEGORIES[tx.category as keyof typeof CONTA_CORRENTE_CATEGORIES] || tx.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      tx.type === 'DEBIT'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                    )}>
                      {tx.type === 'DEBIT' ? (
                        <ArrowDownCircle className="h-3 w-3" />
                      ) : (
                        <ArrowUpCircle className="h-3 w-3" />
                      )}
                      {tx.type === 'DEBIT' ? '-' : '+'}{formatCurrency(tx.amount)}
                    </span>
                  </TableCell>
                  <TableCell className={cn(
                    'text-right text-sm font-semibold',
                    tx.balance_after < 0 ? 'text-red-500' : 'text-muted-foreground'
                  )}>
                    {formatCurrency(tx.balance_after)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ─── Manual Adjustment Dialog ─── */}
      <Dialog open={manualDialog} onOpenChange={setManualDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                <Settings2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white">Ajuste Manual</DialogTitle>
                <p className="text-neutral-400 text-xs mt-0.5">Registar um movimento manual</p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Consultor</Label>
              <Select value={manualForm.agent_id} onValueChange={(v) => setManualForm(f => ({ ...f, agent_id: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar consultor" /></SelectTrigger>
                <SelectContent>
                  {balances.map(a => (
                    <SelectItem key={a.agent_id} value={a.agent_id}>{a.commercial_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Tipo</Label>
              <Select value={manualForm.type} onValueChange={(v) => setManualForm(f => ({ ...f, type: v as 'DEBIT' | 'CREDIT' }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEBIT">Debito</SelectItem>
                  <SelectItem value="CREDIT">Credito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Valor (EUR)</Label>
              <Input type="number" step="0.01" min="0.01" className="rounded-xl" value={manualForm.amount} onChange={(e) => setManualForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Descricao (obrigatoria)</Label>
              <Textarea className="rounded-xl" value={manualForm.description} onChange={(e) => setManualForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Motivo do ajuste..." />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" className="rounded-full" onClick={() => setManualDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-full"
              onClick={handleManualAdjustment}
              disabled={submitting || !manualForm.agent_id || !manualForm.amount || !manualForm.description}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
