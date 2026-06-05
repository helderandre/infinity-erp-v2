'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, CheckCheck, Check, Banknote, X, Loader2,
  ChevronLeft, ChevronRight, Clock, CheckCircle2, TrendingUp,
  Briefcase, Activity, CircleDollarSign, AlertCircle, Download,
} from 'lucide-react'
import { CsvExportDialog } from '@/components/shared/csv-export-dialog'
import { EmpresaTabsNav } from '@/components/financial/empresa-tabs-nav'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import {
  getTransactions, createTransaction, updateTransactionStatus, bulkApproveTransactions,
} from '@/app/dashboard/financeiro/actions'
import { getRecruiters } from '@/app/dashboard/recrutamento/actions'
import { getDeals, getDealStats, getConsultantsForSelect } from '@/app/dashboard/financeiro/deals/actions'
import { DealForm } from '@/components/financial/deal-form'
import type { FinancialTransaction, TransactionStatus } from '@/types/financial'
import { TRANSACTION_TYPES, TRANSACTION_STATUSES } from '@/types/financial'
import type { Deal, DealStatus, DealScenario } from '@/types/deal'
import { DEAL_SCENARIOS, DEAL_STATUSES, PAYMENT_MOMENTS } from '@/types/deal'

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })

const ITEMS_PER_PAGE = 25

const emptyForm: Partial<FinancialTransaction> = {
  consultant_id: '',
  transaction_type: 'commission_sale',
  deal_value: undefined,
  agency_commission_pct: undefined,
  agency_commission_amount: undefined,
  consultant_split_pct: undefined,
  consultant_commission_amount: undefined,
  is_shared_deal: false,
  share_type: null,
  share_agency_name: null,
  share_pct: undefined,
  share_amount: undefined,
  transaction_date: new Date().toISOString().split('T')[0],
  description: '',
  notes: '',
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color, isCurrency = true }: {
  label: string; value: number; icon: React.ElementType; color: string; isCurrency?: boolean
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    'text-slate-600': { bg: 'bg-slate-500/10', text: 'text-slate-600' },
    'text-blue-600': { bg: 'bg-blue-500/10', text: 'text-blue-600' },
    'text-emerald-600': { bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
    'text-amber-600': { bg: 'bg-amber-500/10', text: 'text-amber-600' },
    'text-indigo-600': { bg: 'bg-indigo-500/10', text: 'text-indigo-600' },
  }
  const c = colorMap[color] || { bg: 'bg-muted', text: color }

  return (
    <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 transition-all duration-300 hover:shadow-md hover:bg-card/80">
      <div className={`rounded-xl p-2.5 w-fit ${c.bg}`}>
        <Icon className={`h-4 w-4 ${c.text}`} />
      </div>
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">{label}</p>
      <p className={`text-base sm:text-xl font-bold tracking-tight truncate ${c.text}`}>
        {isCurrency ? fmtCurrency(value) : value}
      </p>
    </div>
  )
}

// ─── Payment Moment Dots ────────────────────────────────────────────────────

function PaymentMomentBadges({ payments }: { payments: Deal['payments'] }) {
  if (!payments || payments.length === 0) return <span className="text-muted-foreground">—</span>

  return (
    <div className="flex items-center gap-3">
      {payments.map((p) => {
        let dotColor = 'bg-slate-300' // not signed
        if (p.is_received) dotColor = 'bg-emerald-500'
        else if (p.is_signed) dotColor = 'bg-amber-500'

        return (
          <span key={p.id} className="inline-flex items-center gap-1 text-xs whitespace-nowrap">
            <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
            {PAYMENT_MOMENTS[p.payment_moment] ?? p.payment_moment}
          </span>
        )
      })}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ComissoesPage() {
  const router = useRouter()

  // ── Transaction state (existing) ──
  const [exportOpen, setExportOpen] = useState(false)
  const [txLoading, setTxLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [txTotal, setTxTotal] = useState(0)
  const [txPage, setTxPage] = useState(1)
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])

  // Transaction KPIs
  const [txKpis, setTxKpis] = useState({ pending: 0, approved: 0, paidMonth: 0, paidYtd: 0 })

  // Transaction Filters
  const [filterConsultant, setFilterConsultant] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Transaction Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Partial<FinancialTransaction>>({ ...emptyForm })

  const txTotalPages = Math.ceil(txTotal / ITEMS_PER_PAGE)

  // ── Deal state (new) ──
  const [dealLoading, setDealLoading] = useState(true)
  const [deals, setDeals] = useState<Deal[]>([])
  const [dealTotal, setDealTotal] = useState(0)
  const [dealPage, setDealPage] = useState(1)
  const [dealStats, setDealStats] = useState({ total_deals: 0, active_deals: 0, total_commission: 0, pending_payments: 0 })
  const [dealFormOpen, setDealFormOpen] = useState(false)
  const [dealConsultants, setDealConsultants] = useState<{ id: string; commercial_name: string }[]>([])

  // Deal Filters
  const [dealFilterConsultant, setDealFilterConsultant] = useState('')
  const [dealFilterType, setDealFilterType] = useState('')
  const [dealFilterStatus, setDealFilterStatus] = useState('')
  const [dealFilterDateFrom, setDealFilterDateFrom] = useState('')
  const [dealFilterDateTo, setDealFilterDateTo] = useState('')

  const dealTotalPages = Math.ceil(dealTotal / ITEMS_PER_PAGE)

  // ── Load consultants once ──
  useEffect(() => {
    getRecruiters().then(r => setConsultants(r.recruiters))
    getConsultantsForSelect().then(r => { if (!r.error) setDealConsultants(r.consultants) })
  }, [])

  // ── Transaction KPIs ──
  useEffect(() => {
    getTransactions({ page: 1 }).then(({ transactions: all }) => {
      const now = new Date()
      const yearStart = `${now.getFullYear()}-01-01`
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      let pending = 0, approved = 0, paidMonth = 0, paidYtd = 0
      for (const t of all) {
        const amt = t.consultant_commission_amount ?? t.agency_commission_amount ?? 0
        if (t.status === 'pending') pending += amt
        if (t.status === 'approved') approved += amt
        if (t.status === 'paid' && t.paid_at && t.paid_at >= monthStart) paidMonth += amt
        if (t.status === 'paid' && t.paid_at && t.paid_at >= yearStart) paidYtd += amt
      }
      setTxKpis({ pending, approved, paidMonth, paidYtd })
    })
  }, [])

  // ── Transaction data ──
  const loadTransactions = useCallback(async () => {
    setTxLoading(true)
    try {
      const { transactions: data, total: count } = await getTransactions({
        consultant_id: filterConsultant || undefined,
        status: filterStatus || undefined,
        type: filterType || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
        page: txPage,
      })
      setTransactions(data)
      setTxTotal(count)
      setSelected(new Set())
    } catch {
      toast.error('Erro ao carregar transacções.')
    } finally {
      setTxLoading(false)
    }
  }, [filterConsultant, filterStatus, filterType, filterDateFrom, filterDateTo, txPage])

  useEffect(() => { loadTransactions() }, [loadTransactions])

  // ── Deal stats ──
  const loadDealStats = useCallback(async () => {
    const stats = await getDealStats()
    if (!stats.error) {
      setDealStats({
        total_deals: stats.total_deals,
        active_deals: stats.active_deals,
        total_commission: stats.total_commission,
        pending_payments: stats.pending_payments,
      })
    }
  }, [])

  useEffect(() => { loadDealStats() }, [loadDealStats])

  // ── Deal data ──
  const loadDeals = useCallback(async () => {
    setDealLoading(true)
    try {
      const { deals: data, total: count, error } = await getDeals({
        consultant_id: dealFilterConsultant || undefined,
        deal_type: dealFilterType || undefined,
        status: dealFilterStatus || undefined,
        date_from: dealFilterDateFrom || undefined,
        date_to: dealFilterDateTo || undefined,
        page: dealPage,
      })
      if (error) throw new Error(error)
      setDeals(data)
      setDealTotal(count)
    } catch {
      toast.error('Erro ao carregar negócios.')
    } finally {
      setDealLoading(false)
    }
  }, [dealFilterConsultant, dealFilterType, dealFilterStatus, dealFilterDateFrom, dealFilterDateTo, dealPage])

  useEffect(() => { loadDeals() }, [loadDeals])

  // ── Transaction Handlers ──

  const handleCreate = async () => {
    if (!form.consultant_id) { toast.error('Seleccione um consultor.'); return }
    setSaving(true)
    const { error } = await createTransaction(form)
    setSaving(false)
    if (error) { toast.error(error) } else {
      toast.success('Transacção criada com sucesso.')
      setDialogOpen(false)
      setForm({ ...emptyForm })
      loadTransactions()
    }
  }

  const handleStatusChange = async (id: string, status: TransactionStatus) => {
    const { error } = await updateTransactionStatus(id, status)
    if (error) { toast.error(error) } else {
      toast.success(`Estado actualizado para "${TRANSACTION_STATUSES[status].label}".`)
      loadTransactions()
    }
  }

  const handleBulkApprove = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    const { error } = await bulkApproveTransactions(ids)
    if (error) { toast.error(error) } else {
      toast.success(`${ids.length} transacção(ões) aprovada(s).`)
      loadTransactions()
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const pendingIds = transactions.filter(t => t.status === 'pending').map(t => t.id)
    if (pendingIds.every(id => selected.has(id))) setSelected(new Set())
    else setSelected(new Set(pendingIds))
  }

  const updateForm = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }))

  // ── Deal Handlers ──

  const handleDealFormSuccess = () => {
    setDealFormOpen(false)
    loadDeals()
    loadDealStats()
  }

  // ── Skeleton ──

  if (txLoading && transactions.length === 0 && dealLoading && deals.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <EmpresaTabsNav active="comissoes" />
        <Button
          size="sm"
          variant="outline"
          className="rounded-full shrink-0"
          onClick={() => setExportOpen(true)}
        >
          <Download className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Exportar</span>
        </Button>
      </div>

      <Tabs defaultValue="negocios">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          <TabsList className="bg-transparent p-0 h-auto">
            <TabsTrigger value="negocios" className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900">Negocios</TabsTrigger>
            <TabsTrigger value="transaccoes" className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900">Transaccoes</TabsTrigger>
          </TabsList>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB: Negócios (Deals)
            ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="negocios" className="space-y-6 mt-6">
          {/* Deal KPI Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total Negócios" value={dealStats.total_deals} icon={Briefcase} color="text-slate-600" isCurrency={false} />
            <KpiCard label="Negócios Ativos" value={dealStats.active_deals} icon={Activity} color="text-blue-600" isCurrency={false} />
            <KpiCard label="Comissão Total" value={dealStats.total_commission} icon={CircleDollarSign} color="text-emerald-600" />
            <KpiCard label="Pagamentos Pendentes" value={dealStats.pending_payments} icon={AlertCircle} color="text-amber-600" />
          </div>

          {/* Filters + Action */}
          <div className="flex flex-wrap gap-3 items-center">
                <Select value={dealFilterConsultant} onValueChange={v => { setDealFilterConsultant(v === 'all' ? '' : v); setDealPage(1) }}>
                    <SelectTrigger className="h-9 w-[170px] text-sm rounded-full bg-muted/50 border-0"><SelectValue placeholder="Consultor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {dealConsultants.map(c => <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                <Select value={dealFilterType} onValueChange={v => { setDealFilterType(v === 'all' ? '' : v); setDealPage(1) }}>
                    <SelectTrigger className="h-9 w-[150px] text-sm rounded-full bg-muted/50 border-0"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {Object.entries(DEAL_SCENARIOS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                <Select value={dealFilterStatus} onValueChange={v => { setDealFilterStatus(v === 'all' ? '' : v); setDealPage(1) }}>
                    <SelectTrigger className="h-9 w-[140px] text-sm rounded-full bg-muted/50 border-0"><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {Object.entries(DEAL_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                <Input type="date" value={dealFilterDateFrom} onChange={e => { setDealFilterDateFrom(e.target.value); setDealPage(1) }} className="h-9 w-[140px] text-sm rounded-full bg-muted/50 border-0" placeholder="De" />
                <Input type="date" value={dealFilterDateTo} onChange={e => { setDealFilterDateTo(e.target.value); setDealPage(1) }} className="h-9 w-[140px] text-sm rounded-full bg-muted/50 border-0" placeholder="Ate" />
                <Button className="gap-2 ml-auto rounded-full" onClick={() => setDealFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Registar Negocio
                </Button>
          </div>

          {/* Deals Table */}
          <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Data</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Imovel</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Consultor</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Tipo</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Valor</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Comissao</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Estado</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Momentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : deals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-16">
                        <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        Nenhum negocio encontrado.
                      </TableCell>
                    </TableRow>
                  ) : deals.map(d => {
                    const statusInfo = DEAL_STATUSES[d.status as DealStatus]
                    return (
                      <TableRow
                        key={d.id}
                        className="cursor-pointer transition-colors duration-200 hover:bg-muted/30"
                        onClick={() => router.push(`/dashboard/financeiro/deals/${d.id}`)}
                      >
                        <TableCell className="text-sm whitespace-nowrap">{fmtDate(d.deal_date)}</TableCell>
                        <TableCell className="text-sm max-w-[180px] truncate">
                          {d.property ? `${d.property.external_ref ?? ''} ${d.property.title}`.trim() : '—'}
                        </TableCell>
                        <TableCell className="text-sm">{d.consultant?.commercial_name ?? '—'}</TableCell>
                        <TableCell className="text-sm">{DEAL_SCENARIOS[d.deal_type as DealScenario]?.label ?? d.deal_type}</TableCell>
                        <TableCell className="text-sm text-right">{fmtCurrency(d.deal_value)}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{fmtCurrency(d.commission_total)}</TableCell>
                        <TableCell>
                          {statusInfo && <Badge className={`${statusInfo.color} rounded-full text-[10px] font-medium border-0`}>{statusInfo.label}</Badge>}
                        </TableCell>
                        <TableCell>
                          <PaymentMomentBadges payments={d.payments} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
          </div>

          {/* Deal Pagination */}
          {dealTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {dealTotal} negocio(s) · Pagina {dealPage} de {dealTotalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-full" disabled={dealPage <= 1} onClick={() => setDealPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <Button variant="outline" size="sm" className="rounded-full" disabled={dealPage >= dealTotalPages} onClick={() => setDealPage(p => p + 1)}>
                  Seguinte <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Deal Form Dialog */}
          <DealForm
            open={dealFormOpen}
            onOpenChange={setDealFormOpen}
            onSuccess={handleDealFormSuccess}
          />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB: Transacções (existing)
            ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="transaccoes" className="space-y-6 mt-6">
          {/* Transaction KPI Cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Comissões Pendentes" value={txKpis.pending} icon={Clock} color="text-amber-600" />
            <KpiCard label="Comissões Aprovadas" value={txKpis.approved} icon={CheckCircle2} color="text-blue-600" />
            <KpiCard label="Pagas (Mês)" value={txKpis.paidMonth} icon={Banknote} color="text-emerald-600" />
            <KpiCard label="Pagas (YTD)" value={txKpis.paidYtd} icon={TrendingUp} color="text-indigo-600" />
          </div>

          {/* Transaction Filters */}
          <div className="flex flex-wrap gap-3 items-center">
                <Select value={filterConsultant} onValueChange={v => { setFilterConsultant(v === 'all' ? '' : v); setTxPage(1) }}>
                    <SelectTrigger className="h-9 w-[170px] text-sm rounded-full bg-muted/50 border-0"><SelectValue placeholder="Consultor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {consultants.map(c => <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={v => { setFilterStatus(v === 'all' ? '' : v); setTxPage(1) }}>
                    <SelectTrigger className="h-9 w-[140px] text-sm rounded-full bg-muted/50 border-0"><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {Object.entries(TRANSACTION_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={v => { setFilterType(v === 'all' ? '' : v); setTxPage(1) }}>
                    <SelectTrigger className="h-9 w-[160px] text-sm rounded-full bg-muted/50 border-0"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {Object.entries(TRANSACTION_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setTxPage(1) }} className="h-9 w-[140px] text-sm rounded-full bg-muted/50 border-0" />
                <Input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setTxPage(1) }} className="h-9 w-[140px] text-sm rounded-full bg-muted/50 border-0" />
                <div className="ml-auto flex items-center gap-2">
                  {selected.size > 0 && (
                    <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={handleBulkApprove}>
                      <CheckCheck className="h-4 w-4" />
                      Aprovar {selected.size}
                    </Button>
                  )}
                  <Button className="gap-2 rounded-full" onClick={() => { setForm({ ...emptyForm }); setDialogOpen(true) }}>
                    <Plus className="h-4 w-4" />
                    Nova Transaccao
                  </Button>
                </div>
          </div>

          {/* Transaction Table */}
          <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-10 text-[11px] uppercase tracking-wider font-semibold">
                      <Checkbox
                        checked={transactions.filter(t => t.status === 'pending').length > 0 && transactions.filter(t => t.status === 'pending').every(t => selected.has(t.id))}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Data</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Consultor</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Tipo</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Imovel</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Valor</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Com. Agencia</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Com. Consultor</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Partilha</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Estado</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Accoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                        Nenhuma transacção encontrada.
                      </TableCell>
                    </TableRow>
                  ) : transactions.map(t => {
                    const statusInfo = TRANSACTION_STATUSES[t.status as TransactionStatus]
                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          {t.status === 'pending' && (
                            <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                          )}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{fmtDate(t.transaction_date)}</TableCell>
                        <TableCell className="text-sm">{t.consultant?.commercial_name ?? '—'}</TableCell>
                        <TableCell className="text-sm">{TRANSACTION_TYPES[t.transaction_type] ?? t.transaction_type}</TableCell>
                        <TableCell className="text-sm max-w-[150px] truncate">
                          {t.property ? `${t.property.external_ref ?? ''} ${t.property.title}`.trim() : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-right">{t.deal_value ? fmtCurrency(t.deal_value) : '—'}</TableCell>
                        <TableCell className="text-sm text-right">{t.agency_commission_amount ? fmtCurrency(t.agency_commission_amount) : '—'}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{t.consultant_commission_amount ? fmtCurrency(t.consultant_commission_amount) : '—'}</TableCell>
                        <TableCell className="text-sm">{t.is_shared_deal ? (t.share_pct ? `${t.share_pct}%` : 'Sim') : '—'}</TableCell>
                        <TableCell>
                          {statusInfo && <Badge className={`${statusInfo.color} rounded-full text-[10px] font-medium border-0`}>{statusInfo.label}</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {t.status === 'pending' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" title="Aprovar" onClick={() => handleStatusChange(t.id, 'approved')}>
                                <Check className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            {t.status === 'approved' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" title="Marcar pago" onClick={() => handleStatusChange(t.id, 'paid')}>
                                <Banknote className="h-4 w-4 text-emerald-600" />
                              </Button>
                            )}
                            {(t.status === 'pending' || t.status === 'approved') && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" title="Cancelar" onClick={() => handleStatusChange(t.id, 'cancelled')}>
                                <X className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
          </div>

          {/* Transaction Pagination */}
          {txTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {txTotal} transaccao(oes) · Pagina {txPage} de {txTotalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-full" disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <Button variant="outline" size="sm" className="rounded-full" disabled={txPage >= txTotalPages} onClick={() => setTxPage(p => p + 1)}>
                  Seguinte <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Transaction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
          <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Nova Transaccao</h3>
                <p className="text-neutral-400 text-xs mt-0.5">Registar comissao ou despesa</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Consultor *</Label>
              <Select value={form.consultant_id ?? ''} onValueChange={v => updateForm('consultant_id', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar consultor" /></SelectTrigger>
                <SelectContent>
                  {consultants.map(c => <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={form.transaction_type ?? 'commission_sale'} onValueChange={v => updateForm('transaction_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRANSACTION_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Valor Negócio</Label>
                <Input type="number" placeholder="0.00" value={form.deal_value ?? ''} onChange={e => updateForm('deal_value', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div className="grid gap-2">
                <Label>Data Transacção</Label>
                <Input type="date" value={form.transaction_date ?? ''} onChange={e => updateForm('transaction_date', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Com. Agência %</Label>
                <Input type="number" step="0.01" placeholder="5" value={form.agency_commission_pct ?? ''} onChange={e => updateForm('agency_commission_pct', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div className="grid gap-2">
                <Label>Com. Agência (valor)</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={form.agency_commission_amount ?? ''} onChange={e => updateForm('agency_commission_amount', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Split Consultor %</Label>
                <Input type="number" step="0.01" placeholder="50" value={form.consultant_split_pct ?? ''} onChange={e => updateForm('consultant_split_pct', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div className="grid gap-2">
                <Label>Com. Consultor (valor)</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={form.consultant_commission_amount ?? ''} onChange={e => updateForm('consultant_commission_amount', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.description ?? ''} onChange={e => updateForm('description', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea rows={2} value={form.notes ?? ''} onChange={e => updateForm('notes', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="gap-2 rounded-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar Transaccao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CsvExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        endpoint="/api/export/commissions"
        title="Comissões"
      />
    </div>
  )
}
