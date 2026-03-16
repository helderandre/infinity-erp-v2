'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Plus, Search, CheckCheck, Check, Banknote, X, Loader2,
  ChevronLeft, ChevronRight, Clock, CheckCircle2, TrendingUp,
} from 'lucide-react'
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

import {
  getTransactions, createTransaction, updateTransactionStatus, bulkApproveTransactions,
} from '@/app/dashboard/comissoes/actions'
import { getRecruiters } from '@/app/dashboard/recrutamento/actions'
import type { FinancialTransaction, TransactionStatus } from '@/types/financial'
import { TRANSACTION_TYPES, TRANSACTION_STATUSES } from '@/types/financial'

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

function KpiCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-5 w-5 shrink-0 ${color}`} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{fmtCurrency(value)}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ComissoesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])

  // KPIs
  const [kpis, setKpis] = useState({ pending: 0, approved: 0, paidMonth: 0, paidYtd: 0 })

  // Filters
  const [filterConsultant, setFilterConsultant] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Partial<FinancialTransaction>>({ ...emptyForm })

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  // Load consultants once
  useEffect(() => { getRecruiters().then(r => setConsultants(r.recruiters)) }, [])

  // Compute KPIs from a separate unfiltered call
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
      setKpis({ pending, approved, paidMonth, paidYtd })
    })
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { transactions: data, total: count } = await getTransactions({
        consultant_id: filterConsultant || undefined,
        status: filterStatus || undefined,
        type: filterType || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
        page,
      })
      setTransactions(data)
      setTotal(count)
      setSelected(new Set())
    } catch {
      toast.error('Erro ao carregar transacções.')
    } finally {
      setLoading(false)
    }
  }, [filterConsultant, filterStatus, filterType, filterDateFrom, filterDateTo, page])

  useEffect(() => { loadData() }, [loadData])

  // ── Handlers ──

  const handleCreate = async () => {
    if (!form.consultant_id) { toast.error('Seleccione um consultor.'); return }
    setSaving(true)
    const { error } = await createTransaction(form)
    setSaving(false)
    if (error) { toast.error(error) } else {
      toast.success('Transacção criada com sucesso.')
      setDialogOpen(false)
      setForm({ ...emptyForm })
      loadData()
    }
  }

  const handleStatusChange = async (id: string, status: TransactionStatus) => {
    const { error } = await updateTransactionStatus(id, status)
    if (error) { toast.error(error) } else {
      toast.success(`Estado actualizado para "${TRANSACTION_STATUSES[status].label}".`)
      loadData()
    }
  }

  const handleBulkApprove = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    const { error } = await bulkApproveTransactions(ids)
    if (error) { toast.error(error) } else {
      toast.success(`${ids.length} transacção(ões) aprovada(s).`)
      loadData()
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

  // ── Skeleton ──

  if (loading && transactions.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Comissões</h1>
        <Button className="gap-2" onClick={() => { setForm({ ...emptyForm }); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" />
          Nova Transacção
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Comissões Pendentes" value={kpis.pending} icon={Clock} color="text-amber-600" />
        <KpiCard label="Comissões Aprovadas" value={kpis.approved} icon={CheckCircle2} color="text-blue-600" />
        <KpiCard label="Pagas (Mês)" value={kpis.paidMonth} icon={Banknote} color="text-emerald-600" />
        <KpiCard label="Pagas (YTD)" value={kpis.paidYtd} icon={TrendingUp} color="text-indigo-600" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-44">
              <Label className="text-xs text-muted-foreground mb-1 block">Consultor</Label>
              <Select value={filterConsultant} onValueChange={v => { setFilterConsultant(v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {consultants.map(c => <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Label className="text-xs text-muted-foreground mb-1 block">Estado</Label>
              <Select value={filterStatus} onValueChange={v => { setFilterStatus(v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(TRANSACTION_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
              <Select value={filterType} onValueChange={v => { setFilterType(v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(TRANSACTION_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
              <Input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(1) }} />
            </div>
            <div className="w-36">
              <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
              <Input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(1) }} />
            </div>
            {selected.size > 0 && (
              <Button variant="outline" size="sm" className="gap-2 ml-auto" onClick={handleBulkApprove}>
                <CheckCheck className="h-4 w-4" />
                Aprovar {selected.size}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={transactions.filter(t => t.status === 'pending').length > 0 && transactions.filter(t => t.status === 'pending').every(t => selected.has(t.id))}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Imóvel</TableHead>
                <TableHead className="text-right">Valor Negócio</TableHead>
                <TableHead className="text-right">Com. Agência</TableHead>
                <TableHead className="text-right">Com. Consultor</TableHead>
                <TableHead>Partilha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acções</TableHead>
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
                      {statusInfo && <Badge variant="secondary" className={statusInfo.color}>{statusInfo.label}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {t.status === 'pending' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Aprovar" onClick={() => handleStatusChange(t.id, 'approved')}>
                            <Check className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {t.status === 'approved' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar pago" onClick={() => handleStatusChange(t.id, 'paid')}>
                            <Banknote className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        {(t.status === 'pending' || t.status === 'approved') && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Cancelar" onClick={() => handleStatusChange(t.id, 'cancelled')}>
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
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} transacção(ões) &middot; Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Seguinte <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Transacção</DialogTitle></DialogHeader>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar Transacção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
