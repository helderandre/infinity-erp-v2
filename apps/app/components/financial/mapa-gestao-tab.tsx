'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Banknote, MoreHorizontal, FileText, Eye,
  Wallet, Network, Building, ListOrdered, RotateCcw, Pencil, Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'

import { PaymentStatusDot } from '@/components/financial/payment-status-dot'
import {
  updatePaymentStatus, setSplitAmountOverride, clearSplitOverride,
} from '@/app/dashboard/financeiro/deals/actions'
import { usePermissions } from '@/hooks/use-permissions'
import type { MapaGestaoRow, MapaGestaoTotals } from '@/types/financial'
import { MapaGestaoFunnel } from './mapa-gestao-funnel'
import { MapaRowSheet } from './sheets/mapa-row-sheet'
import { DEAL_SCENARIOS, PAYMENT_MOMENTS } from '@/types/deal'
import type { PaymentMoment } from '@/types/deal'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const ROLE_LABELS: Record<string, string> = {
  main: 'Vendedor',
  partner: 'Comprador',
  referral: 'Referência',
}

interface Consultant { id: string; commercial_name: string }

export function MapaGestaoTab() {
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('financial')
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [consultantId, setConsultantId] = useState<string>('all')
  const [dealType, setDealType] = useState<string>('all')

  const [rows, setRows] = useState<MapaGestaoRow[]>([])
  const [selectedRow, setSelectedRow] = useState<MapaGestaoRow | null>(null)
  const [totals, setTotals] = useState<MapaGestaoTotals>({
    split_total: 0, network_total: 0, agency_total: 0, partner_total: 0, row_count: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [consultants, setConsultants] = useState<Consultant[]>([])

  useEffect(() => {
    fetch('/api/consultants?status=active')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setConsultants(data.map((c: any) => ({ id: c.id, commercial_name: c.commercial_name })))
        }
      })
      .catch(() => {})
  }, [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ month: String(month), year: String(year) })
      if (consultantId !== 'all') params.set('consultant_id', consultantId)
      if (dealType !== 'all') params.set('deal_type', dealType)

      const res = await fetch(`/api/financial/mapa-gestao?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar dados')
      const data = await res.json()
      setRows(data.rows || [])
      setTotals(data.totals || { split_total: 0, network_total: 0, agency_total: 0, partner_total: 0, row_count: 0 })
    } catch {
      toast.error('Erro ao carregar mapa de gestao')
    } finally {
      setIsLoading(false)
    }
  }, [month, year, consultantId, dealType])

  useEffect(() => { loadData() }, [loadData])

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1) }
    else setMonth(month + 1)
  }

  const handlePaymentUpdate = async (paymentId: string, field: 'is_signed' | 'is_received' | 'is_reported', date: string) => {
    try {
      const result = await updatePaymentStatus(paymentId, field, true, date)
      if (result.error) throw new Error(result.error)
      toast.success('Actualizado com sucesso')
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao actualizar')
    }
  }

  // ── Edição inline "tipo Excel" do split (valor + escalão) ──────────────
  const saveSplitOverride = useCallback(
    async (splitId: string, data: { amount?: number | null; split_pct?: number | null }) => {
      const result = await setSplitAmountOverride(splitId, data)
      if (!result.success) {
        toast.error(result.error || 'Erro ao guardar')
        return false
      }
      toast.success('Guardado')
      loadData()
      return true
    },
    [loadData],
  )

  const clearSplit = useCallback(async (splitId: string) => {
    const result = await clearSplitOverride(splitId)
    if (!result.success) {
      toast.error(result.error || 'Erro ao repor')
      return
    }
    toast.success('Reposto automático')
    loadData()
  }, [loadData])

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-5">
      {/* ─── Sheet 1: Indicadores + filtros + tabela ─────────────────── */}
      <Card className="rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm p-6 space-y-6 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Mapa de gestão</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Splits de comissões em {MONTHS[month - 1]} de {year}
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KpiTile label="Comissões consultor" value={fmtCurrency(totals.split_total)} icon={Wallet} tone="positive" />
          <KpiTile label="Rede" value={fmtCurrency(totals.network_total)} icon={Network} tone="info" />
          <KpiTile label="Agência" value={fmtCurrency(totals.agency_total)} icon={Building} tone="violet" />
          <KpiTile label="Linhas" value={String(totals.row_count)} icon={ListOrdered} tone="neutral" />
        </div>

        {/* Filtros */}
        <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/40 ring-1 ring-border/30">
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

          <Select value={consultantId} onValueChange={setConsultantId}>
            <SelectTrigger className="h-9 w-[180px] text-sm rounded-full bg-background/60 ring-1 ring-border/40 border-0">
              <SelectValue placeholder="Consultor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os consultores</SelectItem>
              {consultants.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dealType} onValueChange={setDealType}>
            <SelectTrigger className="h-9 w-[160px] text-sm rounded-full bg-background/60 ring-1 ring-border/40 border-0">
              <SelectValue placeholder="Cenário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(DEAL_SCENARIOS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        {isLoading ? (
          <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-12 text-center">
            <Banknote className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="font-medium text-muted-foreground">Sem negócios neste período</p>
            <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros ou seleccione outro mês.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 overflow-hidden">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold w-[40px]">#</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Ref</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Consultor</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Momento</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Data</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Ass</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Rec</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Rep</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Pago</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Valor Neg.</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Comissao</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Escalao</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Convictus</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Margem</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Pag. Consultor</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => {
                  const momentLabel = PAYMENT_MOMENTS[row.payment_moment as PaymentMoment] ?? row.payment_moment
                  // Parte já paga ao consultor bloqueia a edição de valor/escalão
                  // (o server action setSplitAmountOverride recusa-os). Reflectimos isso na UI.
                  const rowCanEdit = canEdit && !row.consultant_paid

                  return (
                    <TableRow
                      key={row.split_id}
                      className="transition-colors duration-200 hover:bg-muted/30 cursor-pointer"
                      onClick={() => setSelectedRow(row)}
                    >
                      <TableCell className="text-xs text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                      <TableCell className="text-sm font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{row.reference || row.pv_number || row.deal_id.slice(0, 8)}</span>
                          {row.split_is_manual && (
                            <Badge
                              variant="outline"
                              className="rounded-full text-[9px] font-medium px-1.5 py-0 h-4 border-amber-500/40 text-amber-600 bg-amber-500/5"
                            >
                              {row.manual_label?.trim() || 'Manual'}
                            </Badge>
                          )}
                          {row.split_role === 'referral' && (
                            <span className="text-[10px] text-orange-600">Ref.</span>
                          )}
                          {row.split_role === 'partner' && (
                            <span className="text-[10px] text-muted-foreground">Parc.</span>
                          )}
                          {(row as any).share_pct < 100 && (
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {(row as any).share_pct}%
                            </span>
                          )}
                          {(row as any).tier_pct < 100 && (
                            <span className="text-[10px] text-blue-600 tabular-nums">
                              {(row as any).tier_pct}%
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {row.agent?.commercial_name?.slice(0, 2).toUpperCase() || '??'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate max-w-[120px]">{row.agent?.commercial_name || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full text-[10px] font-medium px-2.5 py-0.5 bg-muted/50 whitespace-nowrap">
                          {momentLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-sm ${(row as any).date_type === 'predicted' ? 'text-amber-500 italic' : 'text-muted-foreground'}`}>
                        {row.signed_date ? fmtDate(row.signed_date) : fmtDate(row.deal_date)}
                        {(row as any).date_type === 'predicted' && <span className="text-[9px] ml-1">(prev.)</span>}
                      </TableCell>

                      {/* Deal-level status dots — click row para editar no sheet */}
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <PaymentStatusDot checked={row.is_signed} label="" editable={false} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <PaymentStatusDot checked={row.is_received} label="" editable={false} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <PaymentStatusDot checked={row.is_reported} label="" editable={false} />
                        </div>
                      </TableCell>

                      {/* Per-agent: consultant paid */}
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <PaymentStatusDot checked={row.consultant_paid} label="" editable={false} />
                        </div>
                      </TableCell>

                      <TableCell className="text-sm text-right tabular-nums">{fmtCurrency(row.deal_value)}</TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm tabular-nums">{row.commission_pct}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <EditableTierCell
                          row={row}
                          canEdit={rowCanEdit}
                          paidLock={canEdit && row.consultant_paid}
                          onSave={(split_pct) => saveSplitOverride(row.split_id, { split_pct })}
                          onClear={() => clearSplit(row.split_id)}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                        {row.network_amount != null ? fmtCurrency(row.network_amount) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                        {row.agency_amount != null ? fmtCurrency(Math.max(0, row.agency_amount - row.split_amount)) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <EditableSplitAmountCell
                          row={row}
                          canEdit={rowCanEdit}
                          paidLock={canEdit && row.consultant_paid}
                          onSave={(amount) => saveSplitOverride(row.split_id, { amount })}
                          onClear={() => clearSplit(row.split_id)}
                        />
                      </TableCell>

                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/financeiro/deals/${row.deal_id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver negocio
                            </DropdownMenuItem>
                            {row.proc_instance_id && (
                              <DropdownMenuItem onClick={() => router.push(`/dashboard/processos/${row.proc_instance_id}`)}>
                                <FileText className="mr-2 h-4 w-4" />
                                Ver processo
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
        )}
      </Card>

      {/* ─── Sheet 2: Funnel (consultor → rede → agência) ──────────── */}
      <Card className="rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm p-6 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
        <div className="mb-5">
          <h3 className="text-base font-semibold tracking-tight">Distribuição de comissões</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Repartição em três níveis: consultor → rede → agência
          </p>
        </div>
        <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-6">
          <MapaGestaoFunnel totals={totals} />
        </div>
      </Card>

      <MapaRowSheet
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onChanged={loadData}
      />
    </div>
    </TooltipProvider>
  )
}

// ─── Célula editável: Pag. Consultor (valor) ──────────────────────────────

function EditableSplitAmountCell({
  row, canEdit, paidLock, onSave, onClear,
}: {
  row: MapaGestaoRow
  canEdit: boolean
  paidLock?: boolean
  onSave: (amount: number | null) => Promise<boolean>
  onClear: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<number | null>(row.split_amount)
  const [saving, setSaving] = useState(false)
  const committedRef = useRef(false)

  const startEdit = () => {
    if (!canEdit || saving) return
    setDraft(row.split_amount)
    committedRef.current = false
    setEditing(true)
  }

  const commit = async () => {
    if (committedRef.current) return
    committedRef.current = true
    const next = draft
    if (next === row.split_amount) { setEditing(false); return }
    setSaving(true)
    const ok = await onSave(next)
    setSaving(false)
    setEditing(false)
    if (!ok) committedRef.current = false
  }

  const cancel = () => {
    committedRef.current = true
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <CurrencyInput
          autoFocus
          value={draft}
          onChange={setDraft}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { e.preventDefault(); cancel() }
          }}
          className="h-7 w-[110px] text-sm text-right tabular-nums"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group flex items-center justify-end gap-1.5',
        canEdit && 'cursor-text rounded-md px-1 -mx-1 hover:bg-muted/50',
      )}
      onClick={(e) => { if (canEdit) { e.stopPropagation(); startEdit() } }}
    >
      {row.split_amount_is_override && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"
              onClick={(e) => e.stopPropagation()}
            />
          </TooltipTrigger>
          <TooltipContent side="top">auto: {fmtCurrency(row.split_amount_auto)}</TooltipContent>
        </Tooltip>
      )}
      <span className="text-sm font-semibold tabular-nums">{fmtCurrency(row.split_amount)}</span>
      {paidLock && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Lock className="h-3 w-3 text-muted-foreground shrink-0" onClick={(e) => e.stopPropagation()} />
          </TooltipTrigger>
          <TooltipContent side="top">Parte já paga — desmarca o pagamento para editar</TooltipContent>
        </Tooltip>
      )}
      {canEdit && row.split_amount_is_override && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded-full text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); onClear() }}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Repor automático</TooltipContent>
        </Tooltip>
      )}
      {canEdit && !row.split_amount_is_override && (
        <Pencil className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  )
}

// ─── Célula editável: Escalão (%) ─────────────────────────────────────────

function EditableTierCell({
  row, canEdit, paidLock, onSave, onClear,
}: {
  row: MapaGestaoRow
  canEdit: boolean
  paidLock?: boolean
  onSave: (split_pct: number | null) => Promise<boolean>
  onClear: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(String(row.tier_pct))
  const [saving, setSaving] = useState(false)
  const committedRef = useRef(false)

  const startEdit = () => {
    if (!canEdit || saving) return
    setDraft(String(row.tier_pct))
    committedRef.current = false
    setEditing(true)
  }

  const commit = async () => {
    if (committedRef.current) return
    committedRef.current = true
    const parsed = draft.trim() === '' ? null : Number(draft.replace(',', '.'))
    if (parsed != null && Number.isNaN(parsed)) { setEditing(false); return }
    if (parsed === row.tier_pct) { setEditing(false); return }
    setSaving(true)
    const ok = await onSave(parsed)
    setSaving(false)
    setEditing(false)
    if (!ok) committedRef.current = false
  }

  const cancel = () => {
    committedRef.current = true
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <Input
          autoFocus
          type="number"
          step="0.01"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { e.preventDefault(); cancel() }
          }}
          className="h-7 w-[72px] text-sm text-right tabular-nums"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group flex items-center justify-end gap-1.5',
        canEdit && 'cursor-text rounded-md px-1 -mx-1 hover:bg-muted/50',
      )}
      onClick={(e) => { if (canEdit) { e.stopPropagation(); startEdit() } }}
    >
      {row.split_pct_is_override && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"
              onClick={(e) => e.stopPropagation()}
            />
          </TooltipTrigger>
          <TooltipContent side="top">auto: {row.tier_pct_auto}%</TooltipContent>
        </Tooltip>
      )}
      <span className="text-sm tabular-nums">{row.tier_pct}%</span>
      {paidLock && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Lock className="h-3 w-3 text-muted-foreground shrink-0" onClick={(e) => e.stopPropagation()} />
          </TooltipTrigger>
          <TooltipContent side="top">Parte já paga — desmarca o pagamento para editar</TooltipContent>
        </Tooltip>
      )}
      {canEdit && row.split_pct_is_override && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded-full text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); onClear() }}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Repor automático</TooltipContent>
        </Tooltip>
      )}
      {canEdit && !row.split_pct_is_override && (
        <Pencil className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  )
}

// ─── KPI Tile (mesmo padrão do Resumo) ────────────────────────────────────

function KpiTile({
  label, value, icon: Icon, tone,
}: {
  label: string
  value: string
  icon: React.ElementType
  tone: 'positive' | 'negative' | 'warning' | 'info' | 'neutral' | 'violet'
}) {
  const toneMap = {
    neutral: { from: 'from-slate-500/10', icon: 'text-slate-600 dark:text-slate-300', accent: 'bg-slate-400/40' },
    positive: { from: 'from-emerald-500/15', icon: 'text-emerald-600', accent: 'bg-emerald-500/60' },
    negative: { from: 'from-red-500/15', icon: 'text-red-600', accent: 'bg-red-500/60' },
    warning: { from: 'from-amber-500/15', icon: 'text-amber-600', accent: 'bg-amber-500/60' },
    info: { from: 'from-blue-500/15', icon: 'text-blue-600', accent: 'bg-blue-500/60' },
    violet: { from: 'from-violet-500/15', icon: 'text-violet-600', accent: 'bg-violet-500/60' },
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
