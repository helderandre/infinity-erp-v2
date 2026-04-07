'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Banknote, MoreHorizontal, FileText, Eye, Map,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

import { PaymentStatusDot } from '@/components/financial/payment-status-dot'
import { updatePaymentStatus } from '@/app/dashboard/comissoes/deals/actions'
import type { MapaGestaoRow, MapaGestaoTotals } from '@/types/financial'
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
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [consultantId, setConsultantId] = useState<string>('all')
  const [dealType, setDealType] = useState<string>('all')

  const [rows, setRows] = useState<MapaGestaoRow[]>([])
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

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <Map className="h-5 w-5 text-neutral-400" />
            <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">Financeiro</p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Mapa de Gestao</h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            Mapa de pagamentos e split de comissões em {MONTHS[month - 1]} de {year}.
          </p>

          <div className="flex flex-wrap gap-x-6 gap-y-3 mt-6">
            <div>
              <p className="text-neutral-500 text-[11px] font-medium uppercase tracking-wider">Comissoes Consultor</p>
              <p className="text-white text-lg sm:text-xl font-bold tabular-nums">{fmtCurrency(totals.split_total)}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-[11px] font-medium uppercase tracking-wider">Rede</p>
              <p className="text-white text-lg sm:text-xl font-bold tabular-nums">{fmtCurrency(totals.network_total)}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-[11px] font-medium uppercase tracking-wider">Agencia</p>
              <p className="text-white text-lg sm:text-xl font-bold tabular-nums">{fmtCurrency(totals.agency_total)}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-[11px] font-medium uppercase tracking-wider">Linhas</p>
              <p className="text-white text-lg sm:text-xl font-bold tabular-nums">{totals.row_count}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters bar */}
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

        <Select value={consultantId} onValueChange={setConsultantId}>
          <SelectTrigger className="h-9 w-[180px] text-sm rounded-full bg-muted/50 border-0">
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
          <SelectTrigger className="h-9 w-[160px] text-sm rounded-full bg-muted/50 border-0">
            <SelectValue placeholder="Cenario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(DEAL_SCENARIOS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-card/30 backdrop-blur-sm p-12 text-center">
          <Banknote className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-medium text-muted-foreground">Sem negocios neste periodo</p>
          <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros ou seleccione outro mes.</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
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

                  return (
                    <TableRow
                      key={row.split_id}
                      className="transition-colors duration-200 hover:bg-muted/30 cursor-pointer"
                      onClick={() => router.push(`/dashboard/comissoes/deals/${row.deal_id}`)}
                    >
                      <TableCell className="text-xs text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                      <TableCell className="text-sm font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{row.reference || row.pv_number || row.deal_id.slice(0, 8)}</span>
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

                      {/* Deal-level status dots */}
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center">
                          <PaymentStatusDot
                            checked={row.is_signed}
                            label=""
                            editable={!row.is_signed}
                            onToggle={(date) => handlePaymentUpdate(row.payment_id, 'is_signed', date)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center">
                          <PaymentStatusDot
                            checked={row.is_received}
                            label=""
                            editable={row.is_signed && !row.is_received}
                            onToggle={(date) => handlePaymentUpdate(row.payment_id, 'is_received', date)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center">
                          <PaymentStatusDot
                            checked={row.is_reported}
                            label=""
                            editable={row.is_received && !row.is_reported}
                            onToggle={(date) => handlePaymentUpdate(row.payment_id, 'is_reported', date)}
                          />
                        </div>
                      </TableCell>

                      {/* Per-agent: consultant paid */}
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <PaymentStatusDot
                            checked={row.consultant_paid}
                            label=""
                            editable={false}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="text-sm text-right tabular-nums">{fmtCurrency(row.deal_value)}</TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm tabular-nums">{row.commission_pct}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm tabular-nums">{(row as any).tier_pct}%</span>
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                        {row.network_amount != null ? fmtCurrency(row.network_amount) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                        {row.agency_amount != null ? fmtCurrency(Math.max(0, row.agency_amount - row.split_amount)) : '-'}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-right tabular-nums">{fmtCurrency(row.split_amount)}</TableCell>

                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/comissoes/deals/${row.deal_id}`)}>
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
    </div>
  )
}
