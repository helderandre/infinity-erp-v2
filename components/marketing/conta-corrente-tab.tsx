'use client'

import { useState } from 'react'
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
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, Plus, Loader2, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function ContaCorrenteTab() {
  const { balances, loading: balancesLoading, refetch: refetchBalances } = useAgentBalances()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const { transactions, loading: txLoading, typeFilter, setTypeFilter } = useContaCorrente(selectedAgent || undefined)
  const [manualDialog, setManualDialog] = useState(false)
  const [manualForm, setManualForm] = useState({ agent_id: '', type: 'DEBIT' as 'DEBIT' | 'CREDIT', amount: '', description: '' })
  const [submitting, setSubmitting] = useState(false)

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
      {/* Balances Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Saldos por Consultor</h3>
          <Button size="sm" variant="outline" onClick={() => setManualDialog(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Ajuste Manual
          </Button>
        </div>

        {balancesLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : balances.length === 0 ? (
          <EmptyState icon={Wallet} title="Sem consultores" description="Nenhum consultor activo encontrado." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {balances.map(agent => (
              <button
                key={agent.agent_id}
                className={cn(
                  'rounded-lg border p-4 text-left transition-colors hover:bg-muted/50',
                  selectedAgent === agent.agent_id && 'ring-2 ring-primary'
                )}
                onClick={() => setSelectedAgent(selectedAgent === agent.agent_id ? null : agent.agent_id)}
              >
                <p className="text-sm font-medium truncate">{agent.commercial_name}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={cn(
                    'text-xl font-bold',
                    agent.current_balance < 0 ? 'text-red-500' : 'text-emerald-500'
                  )}>
                    {formatCurrency(agent.current_balance)}
                  </span>
                  {agent.credit_limit !== null && agent.current_balance < -agent.credit_limit && (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                </div>
                {agent.credit_limit !== null && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Limite: {formatCurrency(agent.credit_limit)}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Transactions List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {selectedAgent ? 'Movimentos do Consultor' : 'Todos os Movimentos'}
          </h3>
          <Select
            value={typeFilter || 'all'}
            onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v as 'DEBIT' | 'CREDIT')}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="DEBIT">Débitos</SelectItem>
              <SelectItem value="CREDIT">Créditos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {txLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState icon={Wallet} title="Sem movimentos" description="Nenhum movimento registado." />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Saldo Após</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(tx.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {tx.agent?.commercial_name || '—'}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      {tx.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {CONTA_CORRENTE_CATEGORIES[tx.category as keyof typeof CONTA_CORRENTE_CATEGORIES] || tx.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={cn(
                        'inline-flex items-center gap-1',
                        tx.type === 'DEBIT' ? 'text-red-500' : 'text-emerald-500'
                      )}>
                        {tx.type === 'DEBIT' ? (
                          <ArrowDownCircle className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpCircle className="h-3.5 w-3.5" />
                        )}
                        {tx.type === 'DEBIT' ? '-' : '+'}{formatCurrency(tx.amount)}
                      </span>
                    </TableCell>
                    <TableCell className={cn(
                      'text-right text-sm font-medium',
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
      </div>

      {/* Manual Adjustment Dialog */}
      <Dialog open={manualDialog} onOpenChange={setManualDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajuste Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Consultor</Label>
              <Select value={manualForm.agent_id} onValueChange={(v) => setManualForm(f => ({ ...f, agent_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar consultor" /></SelectTrigger>
                <SelectContent>
                  {balances.map(a => (
                    <SelectItem key={a.agent_id} value={a.agent_id}>{a.commercial_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={manualForm.type} onValueChange={(v) => setManualForm(f => ({ ...f, type: v as 'DEBIT' | 'CREDIT' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEBIT">Débito</SelectItem>
                  <SelectItem value="CREDIT">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (€)</Label>
              <Input type="number" step="0.01" min="0.01" value={manualForm.amount} onChange={(e) => setManualForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Descrição (obrigatória)</Label>
              <Textarea value={manualForm.description} onChange={(e) => setManualForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Motivo do ajuste..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialog(false)}>Cancelar</Button>
            <Button
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
