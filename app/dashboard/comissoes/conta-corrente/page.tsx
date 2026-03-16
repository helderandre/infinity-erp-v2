'use client'

import { useState, useMemo } from 'react'
import { useAgentBalances, useContaCorrente } from '@/hooks/use-conta-corrente'
import { CONTA_CORRENTE_CATEGORIES, formatCurrency, formatDateTime } from '@/lib/constants'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, Plus, Loader2, AlertTriangle,
  TrendingUp, TrendingDown, Settings2, ChevronLeft, ChevronRight, Users
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 15

export default function ContaCorrentePage() {
  const { balances, loading: balancesLoading, refetch: refetchBalances } = useAgentBalances()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const { transactions, total, loading: txLoading, typeFilter, setTypeFilter, refetch: refetchTx } = useContaCorrente(selectedAgent || undefined)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [manualDialog, setManualDialog] = useState(false)
  const [manualForm, setManualForm] = useState({ agent_id: '', type: 'DEBIT' as 'DEBIT' | 'CREDIT', amount: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [page, setPage] = useState(0)

  // KPIs from balances
  const kpis = useMemo(() => {
    const totalBalance = balances.reduce((s, b) => s + b.current_balance, 0)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const monthTx = transactions.filter(tx => tx.created_at >= monthStart)
    const credits = monthTx.filter(tx => tx.type === 'CREDIT').reduce((s, tx) => s + tx.amount, 0)
    const debits = monthTx.filter(tx => tx.type === 'DEBIT').reduce((s, tx) => s + tx.amount, 0)
    const adjustments = monthTx.filter(tx => tx.category === 'manual_adjustment').reduce((s, tx) => s + tx.amount, 0)
    return { totalBalance, credits, debits, adjustments }
  }, [balances, transactions])

  // Filtered & paginated transactions
  const filtered = useMemo(() => {
    if (!categoryFilter) return transactions
    return transactions.filter(tx => tx.category === categoryFilter)
  }, [transactions, categoryFilter])

  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

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
      toast.success('Movimento registado com sucesso')
      setManualDialog(false)
      setManualForm({ agent_id: '', type: 'DEBIT', amount: '', description: '' })
      refetchBalances()
      refetchTx()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao registar movimento')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedName = balances.find(b => b.agent_id === selectedAgent)?.commercial_name

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conta Corrente</h1>
          <p className="text-sm text-muted-foreground">Gestao financeira de consultores — saldos, movimentos e ajustes</p>
        </div>
        <Button onClick={() => setManualDialog(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Movimento
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total em Conta', value: kpis.totalBalance, icon: Wallet, color: kpis.totalBalance >= 0 ? 'text-emerald-600' : 'text-red-600' },
          { label: 'Creditos (mes)', value: kpis.credits, icon: TrendingUp, color: 'text-emerald-600' },
          { label: 'Debitos (mes)', value: kpis.debits, icon: TrendingDown, color: 'text-red-600' },
          { label: 'Ajustes Manuais (mes)', value: kpis.adjustments, icon: Settings2, color: 'text-amber-600' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-muted p-2.5">
                <kpi.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={cn('text-xl font-bold', kpi.color)}>{formatCurrency(kpi.value)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Balances Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Saldos por Consultor</h2>
          {selectedAgent && (
            <Button size="sm" variant="ghost" onClick={() => { setSelectedAgent(null); setPage(0) }}>
              <Users className="mr-1.5 h-3.5 w-3.5" />
              Todos os Consultores
            </Button>
          )}
        </div>
        {balancesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : balances.length === 0 ? (
          <EmptyState icon={Wallet} title="Sem consultores" description="Nenhum consultor activo encontrado." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {balances.map(agent => {
              const available = agent.credit_limit !== null ? agent.credit_limit + agent.current_balance : null
              const overLimit = agent.credit_limit !== null && agent.current_balance < -agent.credit_limit
              return (
                <button
                  key={agent.agent_id}
                  className={cn(
                    'rounded-lg border p-4 text-left transition-all hover:bg-muted/50',
                    selectedAgent === agent.agent_id && 'ring-2 ring-primary bg-muted/30',
                    agent.current_balance > 0 && 'border-emerald-200',
                    agent.current_balance < 0 && 'border-red-200',
                    agent.current_balance === 0 && 'border-muted',
                  )}
                  onClick={() => { setSelectedAgent(selectedAgent === agent.agent_id ? null : agent.agent_id); setPage(0) }}
                >
                  <p className="text-sm font-medium truncate">{agent.commercial_name}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={cn(
                      'text-xl font-bold',
                      agent.current_balance > 0 ? 'text-emerald-600' : agent.current_balance < 0 ? 'text-red-600' : 'text-muted-foreground'
                    )}>
                      {formatCurrency(agent.current_balance)}
                    </span>
                    {overLimit && <AlertTriangle className="h-4 w-4 text-red-500" />}
                  </div>
                  {agent.credit_limit !== null && (
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">Limite: {formatCurrency(agent.credit_limit)}</p>
                      <p className={cn('text-[10px]', available !== null && available < 0 ? 'text-red-500' : 'text-muted-foreground')}>
                        Disponivel: {formatCurrency(available ?? 0)}
                      </p>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold mr-auto">
          {selectedName ? `Movimentos — ${selectedName}` : 'Todos os Movimentos'}
        </h2>
        <Select value={typeFilter || 'all'} onValueChange={(v) => { setTypeFilter(v === 'all' ? '' : v as 'DEBIT' | 'CREDIT'); setPage(0) }}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="DEBIT">Debitos</SelectItem>
            <SelectItem value="CREDIT">Creditos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter || 'all'} onValueChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPage(0) }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Categorias</SelectItem>
            {Object.entries(CONTA_CORRENTE_CATEGORIES).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transactions Table */}
      {txLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Wallet} title="Sem movimentos" description="Nenhum movimento encontrado para os filtros seleccionados." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descricao</TableHead>
                <TableHead className="text-right">Montante</TableHead>
                <TableHead className="text-right">Saldo Apos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map(tx => (
                <TableRow key={tx.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(tx.created_at)}</TableCell>
                  <TableCell className="text-sm">{tx.agent?.commercial_name || '\u2014'}</TableCell>
                  <TableCell>
                    <Badge variant={tx.type === 'DEBIT' ? 'destructive' : 'default'} className={cn('text-[10px]', tx.type === 'CREDIT' && 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100')}>
                      {tx.type === 'DEBIT' ? 'Debito' : 'Credito'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {CONTA_CORRENTE_CATEGORIES[tx.category as keyof typeof CONTA_CORRENTE_CATEGORIES] || tx.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-[220px] truncate">{tx.description}</TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={cn('inline-flex items-center gap-1', tx.type === 'DEBIT' ? 'text-red-600' : 'text-emerald-600')}>
                      {tx.type === 'DEBIT' ? <ArrowDownCircle className="h-3.5 w-3.5" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
                      {tx.type === 'DEBIT' ? '-' : '+'}{formatCurrency(tx.amount)}
                    </span>
                  </TableCell>
                  <TableCell className={cn('text-right text-sm font-medium', tx.balance_after < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                    {formatCurrency(tx.balance_after)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-2">
              <p className="text-xs text-muted-foreground">
                {filtered.length} movimento{filtered.length !== 1 && 's'} &middot; Pagina {page + 1} de {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Adjustment Dialog */}
      <Dialog open={manualDialog} onOpenChange={setManualDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Movimento Manual</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Consultor</Label>
              <Select value={manualForm.agent_id} onValueChange={(v) => setManualForm(f => ({ ...f, agent_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar consultor" /></SelectTrigger>
                <SelectContent>
                  {balances.map(a => <SelectItem key={a.agent_id} value={a.agent_id}>{a.commercial_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={manualForm.type} onValueChange={(v) => setManualForm(f => ({ ...f, type: v as 'DEBIT' | 'CREDIT' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEBIT">Debito</SelectItem>
                  <SelectItem value="CREDIT">Credito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (EUR)</Label>
              <Input type="number" step="0.01" min="0.01" value={manualForm.amount} onChange={(e) => setManualForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Descricao (obrigatoria)</Label>
              <Textarea value={manualForm.description} onChange={(e) => setManualForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Motivo do ajuste..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialog(false)}>Cancelar</Button>
            <Button onClick={handleManualAdjustment} disabled={submitting || !manualForm.agent_id || !manualForm.amount || !manualForm.description}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
