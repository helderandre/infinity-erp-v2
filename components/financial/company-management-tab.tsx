'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Camera, RefreshCw,
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

import { ReceiptScanner } from '@/components/financial/receipt-scanner'
import type { CompanyTransaction, CompanyCategory, ReceiptScanResult } from '@/types/financial'
import { COMPANY_TRANSACTION_STATUSES } from '@/types/financial'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function CompanyManagementTab() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [transactions, setTransactions] = useState<CompanyTransaction[]>([])
  const [categories, setCategories] = useState<CompanyCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)

  // Totals
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)

  // Dialogs
  const [addOpen, setAddOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Add form
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'expense' as 'income' | 'expense',
    category: '',
    entity_name: '',
    entity_nif: '',
    description: '',
    amount_net: '',
    vat_pct: '23',
    invoice_number: '',
    invoice_date: '',
    due_date: '',
    payment_method: '',
    notes: '',
  })

  useEffect(() => {
    fetch('/api/financial/company-categories')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCategories(data) })
      .catch(() => {})
  }, [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ month: String(month), year: String(year) })
      const res = await fetch(`/api/financial/company-transactions?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTransactions(data.data || [])
      setTotal(data.total || 0)

      // Compute totals
      const txList = data.data || []
      setTotalIncome(txList.filter((t: CompanyTransaction) => t.type === 'income').reduce((s: number, t: CompanyTransaction) => s + Number(t.amount_gross || t.amount_net), 0))
      setTotalExpense(txList.filter((t: CompanyTransaction) => t.type === 'expense').reduce((s: number, t: CompanyTransaction) => s + Number(t.amount_gross || t.amount_net), 0))
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setIsLoading(false)
    }
  }, [month, year])

  useEffect(() => { loadData() }, [loadData])

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(year - 1) } else setMonth(month - 1) }
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(year + 1) } else setMonth(month + 1) }

  const handleAddTransaction = async () => {
    if (!form.description || !form.amount_net || !form.category) {
      toast.error('Preencha os campos obrigatorios')
      return
    }
    try {
      const amountNet = parseFloat(form.amount_net)
      const vatPct = parseFloat(form.vat_pct) || 0
      const res = await fetch('/api/financial/company-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount_net: amountNet,
          vat_pct: vatPct,
          status: 'confirmed',
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Transaccao adicionada')
      setAddOpen(false)
      loadData()
    } catch {
      toast.error('Erro ao guardar')
    }
  }

  const handleScanConfirm = async (data: ReceiptScanResult & { category: string }) => {
    try {
      const res = await fetch('/api/financial/company-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: data.invoice_date || new Date().toISOString().split('T')[0],
          type: 'expense',
          category: data.category,
          entity_name: data.entity_name,
          entity_nif: data.entity_nif,
          description: data.description || 'Despesa digitalizada',
          amount_net: data.amount_net || 0,
          amount_gross: data.amount_gross,
          vat_amount: data.vat_amount,
          vat_pct: data.vat_pct,
          invoice_number: data.invoice_number,
          invoice_date: data.invoice_date,
          ai_extracted: true,
          ai_confidence: data.confidence,
          status: 'draft',
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Despesa adicionada (rascunho)')
      loadData()
    } catch {
      toast.error('Erro ao guardar despesa')
    }
  }

  const handleGenerateRecurring = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/financial/recurring-templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      })
      const data = await res.json()
      toast.success(data.message || `${data.generated} transaccoes geradas`)
      loadData()
    } catch {
      toast.error('Erro ao gerar recorrentes')
    } finally {
      setIsGenerating(false)
    }
  }

  const result = totalIncome - totalExpense

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-10 sm:px-12">
          <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">Financeiro</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">Gestao da Empresa</h2>
          <p className="text-neutral-400 mt-1.5 text-sm">{MONTHS[month - 1]} de {year}</p>

          <div className="flex flex-wrap gap-6 mt-6">
            <div>
              <p className="text-neutral-500 text-[11px] font-medium uppercase tracking-wider">Receitas</p>
              <p className="text-emerald-400 text-xl font-bold tabular-nums">{fmtCurrency(totalIncome)}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-[11px] font-medium uppercase tracking-wider">Despesas</p>
              <p className="text-red-400 text-xl font-bold tabular-nums">{fmtCurrency(totalExpense)}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-[11px] font-medium uppercase tracking-wider">Resultado</p>
              <p className={`text-xl font-bold tabular-nums ${result >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtCurrency(result)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium px-2 min-w-[120px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={handleGenerateRecurring} disabled={isGenerating}>
            {isGenerating ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Gerar Recorrentes
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setScannerOpen(true)}>
            <Camera className="mr-2 h-4 w-4" />
            Digitalizar Recibo
          </Button>
          <Button size="sm" className="rounded-full" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={ArrowUpRight} label="Receitas" value={totalIncome} color="emerald" />
        <KpiCard icon={ArrowDownRight} label="Despesas" value={totalExpense} color="red" />
        <KpiCard icon={Wallet} label="Resultado" value={result} color={result >= 0 ? 'emerald' : 'red'} />
        <KpiCard icon={TrendingUp} label="Transaccoes" value={transactions.length} color="blue" isCurrency={false} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-2xl border bg-card/30 backdrop-blur-sm p-12 text-center">
          <Wallet className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-medium text-muted-foreground">Sem transaccoes neste periodo</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold w-[40px]">#</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Entidade</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Vencimento</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">N.o Fatura</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Valor s/IVA</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Valor c/IVA</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Pagamento</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Descricao</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Rubrica</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx, idx) => {
                  const statusInfo = COMPANY_TRANSACTION_STATUSES[tx.status]
                  return (
                    <TableRow key={tx.id} className="transition-colors duration-200 hover:bg-muted/30">
                      <TableCell className="text-xs text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                      <TableCell className="text-sm">
                        <div>{tx.entity_name || '-'}</div>
                        {tx.ai_extracted && <Badge className="bg-purple-500/10 text-purple-600 text-[8px] border-0 mt-0.5">IA</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.due_date ? fmtDate(tx.due_date) : '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.invoice_number || '-'}</TableCell>
                      <TableCell className="text-sm font-semibold text-right tabular-nums">{fmtCurrency(Number(tx.amount_net))}</TableCell>
                      <TableCell className="text-sm font-semibold text-right tabular-nums">
                        {tx.amount_gross ? fmtCurrency(Number(tx.amount_gross)) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.payment_date ? fmtDate(tx.payment_date) : '-'}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{tx.description}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full text-[10px] font-medium bg-muted/50 whitespace-nowrap">
                          {tx.category}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Add Transaction Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Nova Transaccao</h3>
                <p className="text-neutral-400 text-xs mt-0.5">Adicionar receita ou despesa</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Tipo</Label>
                <Select value={form.type} onValueChange={(v: 'income' | 'expense') => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Data</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-8 text-sm mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider">Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {categories.filter((c) => c.type === form.type || c.type === 'both').map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider">Entidade</Label>
              <Input value={form.entity_name} onChange={(e) => setForm({ ...form, entity_name: e.target.value })} className="h-8 text-sm mt-1" placeholder="Nome do fornecedor" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider">Descricao</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-8 text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Valor s/IVA</Label>
                <Input type="number" step="0.01" value={form.amount_net} onChange={(e) => setForm({ ...form, amount_net: e.target.value })} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider">IVA %</Label>
                <Input type="number" value={form.vat_pct} onChange={(e) => setForm({ ...form, vat_pct: e.target.value })} className="h-8 text-sm mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] uppercase tracking-wider">N.o Fatura</Label>
                <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Vencimento</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="h-8 text-sm mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button className="rounded-full" onClick={handleAddTransaction}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Scanner */}
      <ReceiptScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        categories={categories}
        onConfirm={handleScanConfirm}
      />
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color, isCurrency = true }: {
  icon: React.ElementType; label: string; value: number; color: string; isCurrency?: boolean
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
    red: { bg: 'bg-red-500/10', text: 'text-red-500' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  }
  const c = colorMap[color] || colorMap.blue

  return (
    <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 transition-all duration-300 hover:shadow-md hover:bg-card/80">
      <div className={`rounded-xl p-2.5 w-fit ${c.bg}`}>
        <Icon className={`h-4 w-4 ${c.text}`} />
      </div>
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">{label}</p>
      <p className={`text-xl font-bold tracking-tight ${c.text}`}>
        {isCurrency ? fmtCurrency(value) : value}
      </p>
    </div>
  )
}
