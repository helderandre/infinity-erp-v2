'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Camera, RefreshCw,
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  FileImage,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

import { ReceiptScanner } from '@/components/financial/receipt-scanner'
import { CompanyStatsView } from '@/components/financial/company-stats-view'
import type { CompanyTransaction, CompanyCategory, ReceiptScanResult } from '@/types/financial'
import { COMPANY_TRANSACTION_STATUSES } from '@/types/financial'

interface PartnerOption {
  id: string
  name: string
  nif: string | null
}

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

  // Partners
  const [partners, setPartners] = useState<PartnerOption[]>([])

  // Dialogs
  const [addOpen, setAddOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

  // Stats view tab + type toggle
  const [activeTab, setActiveTab] = useState<'stats' | 'entries'>('stats')
  const [statsType, setStatsType] = useState<'income' | 'expense'>('expense')

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
    partner_id: '',
    notes: '',
  })

  useEffect(() => {
    fetch('/api/financial/company-categories')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCategories(data) })
      .catch(() => {})

    fetch('/api/partners?is_active=true&limit=200')
      .then((r) => r.json())
      .then((data) => {
        const list = data.data || data || []
        if (Array.isArray(list)) setPartners(list.map((p: any) => ({ id: p.id, name: p.name, nif: p.nif })))
      })
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
      const { partner_id, ...formRest } = form
      const res = await fetch('/api/financial/company-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formRest,
          amount_net: amountNet,
          vat_pct: vatPct,
          partner_id: partner_id || null,
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

  const handleScanConfirm = async (data: ReceiptScanResult & { category: string; receiptImageBase64: string | null }) => {
    try {
      // Duplicate detection: check if invoice_number + entity_nif already exists
      if (data.invoice_number && data.entity_nif) {
        const checkParams = new URLSearchParams({ month: String(month), year: String(year) })
        const checkRes = await fetch(`/api/financial/company-transactions?${checkParams}`)
        if (checkRes.ok) {
          const existing = await checkRes.json()
          const duplicate = (existing.data || []).find(
            (tx: CompanyTransaction) =>
              tx.invoice_number === data.invoice_number &&
              tx.entity_nif === data.entity_nif &&
              tx.status !== 'cancelled'
          )
          if (duplicate) {
            toast.warning(`Possivel duplicado: ja existe uma transaccao com a fatura ${data.invoice_number} de ${data.entity_nif}`)
          }
        }
      }

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
          receipt_url: data.receiptImageBase64,
          ai_extracted: true,
          ai_confidence: data.confidence,
          field_confidences: data.field_confidences,
          status: 'draft',
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Despesa adicionada (rascunho) — recibo guardado')
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
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as 'stats' | 'entries')}
      className="space-y-6"
    >
      {/* Hero header — contém title, month picker, tabs e action buttons */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-6 py-7 sm:px-10 sm:py-9">
          {/* Top row: title + actions */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">Financeiro</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">Gestao da Empresa</h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full bg-white/10 hover:bg-white/20 text-white border-white/20 hover:text-white"
                onClick={handleGenerateRecurring}
                disabled={isGenerating}
              >
                {isGenerating ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Gerar Recorrentes
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full bg-white/10 hover:bg-white/20 text-white border-white/20 hover:text-white"
                onClick={() => setScannerOpen(true)}
              >
                <Camera className="mr-2 h-4 w-4" />
                Digitalizar Recibo
              </Button>
              <Button
                size="sm"
                className="rounded-full bg-white text-neutral-900 hover:bg-neutral-100"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Bottom row: month picker + tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-8">
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full text-white hover:bg-white/20 hover:text-white"
                onClick={prevMonth}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-[11px] font-medium px-1.5 min-w-[90px] text-center text-white">
                {MONTHS[month - 1]} {year}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full text-white hover:bg-white/20 hover:text-white"
                onClick={nextMonth}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>

            <TabsList className="grid grid-cols-2 rounded-full p-1 h-10 bg-white/10 backdrop-blur-sm border border-white/20 w-full sm:w-auto">
              <TabsTrigger
                value="stats"
                className="rounded-full text-xs px-6 text-neutral-300 data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm"
              >
                Estatísticas
              </TabsTrigger>
              <TabsTrigger
                value="entries"
                className="rounded-full text-xs px-6 text-neutral-300 data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm"
              >
                Lançamentos
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
      </div>

      {/* ─── Tab Estatísticas ─── */}
      <TabsContent value="stats" className="space-y-6">
        {/* KPI cards — hidden on mobile */}
        <div className="hidden sm:grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={ArrowUpRight} label="Receitas" value={totalIncome} color="emerald" />
          <KpiCard icon={ArrowDownRight} label="Despesas" value={totalExpense} color="red" />
          <KpiCard icon={Wallet} label="Resultado" value={result} color={result >= 0 ? 'emerald' : 'red'} />
          <KpiCard icon={TrendingUp} label="Transaccoes" value={transactions.length} color="blue" isCurrency={false} />
        </div>

        {/* Donut chart + categories list */}
        {isLoading ? (
          <Skeleton className="h-[600px] w-full rounded-3xl" />
        ) : (
          <CompanyStatsView
            transactions={transactions}
            categories={categories}
            type={statsType}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            onTypeChange={setStatsType}
          />
        )}

        {/* Mobile-only: Balanço + Transacções pill (substitui os KPI cards no mobile) */}
        <div className="sm:hidden grid grid-cols-2 gap-1 p-1 rounded-full bg-muted/40 border border-border/30">
          <div className="flex flex-col items-center justify-center px-3 py-2 rounded-full bg-card shadow-sm">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Balanço</span>
            <span className={`text-sm font-bold tabular-nums ${result >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {fmtCurrency(result)}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center px-3 py-2 rounded-full">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Transacções</span>
            <span className="text-sm font-bold tabular-nums text-blue-600">
              {transactions.length}
            </span>
          </div>
        </div>
      </TabsContent>

      {/* ─── Tab Lançamentos ─── */}
      <TabsContent value="entries" className="space-y-6">
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
                        <div className="flex items-center gap-1.5">
                          <span>{tx.entity_name || '-'}</span>
                          {tx.receipt_url && tx.receipt_url.startsWith('data:') && (
                            <button
                              type="button"
                              onClick={() => setReceiptPreview(tx.receipt_url)}
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="Ver recibo"
                            >
                              <FileImage className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
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
      </TabsContent>

      {/* Add Transaction Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogTitle className="sr-only">Nova Transaccao</DialogTitle>
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
              <Label className="text-[11px] uppercase tracking-wider">Parceiro</Label>
              <Select
                value={form.partner_id}
                onValueChange={(v) => {
                  const partner = partners.find((p) => p.id === v)
                  setForm({
                    ...form,
                    partner_id: v,
                    entity_name: partner?.name || form.entity_name,
                    entity_nif: partner?.nif || form.entity_nif,
                  })
                }}
              >
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Seleccionar parceiro (opcional)" /></SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}{p.nif ? ` (${p.nif})` : ''}</SelectItem>
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

      {/* Receipt Preview Dialog */}
      <Dialog open={!!receiptPreview} onOpenChange={(v) => { if (!v) setReceiptPreview(null) }}>
        <DialogContent className="max-w-lg rounded-2xl p-2">
          <DialogTitle className="sr-only">Recibo Guardado</DialogTitle>
          <div className="-mx-6 -mt-6 mb-2 bg-neutral-900 rounded-t-2xl px-6 py-4">
            <h3 className="text-white font-semibold text-sm">Recibo Guardado</h3>
          </div>
          {receiptPreview && (
            <img
              src={receiptPreview}
              alt="Recibo"
              className="w-full max-h-[70vh] object-contain rounded-xl"
            />
          )}
        </DialogContent>
      </Dialog>
    </Tabs>
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
