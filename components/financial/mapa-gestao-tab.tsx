'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Search, Euro, TrendingUp,
  Banknote, ExternalLink, MoreHorizontal, FileText, Eye,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { PaymentStatusDot } from '@/components/financial/payment-status-dot'
import { MapaGestaoFunnel } from '@/components/financial/mapa-gestao-funnel'
import { updatePaymentStatus } from '@/app/dashboard/comissoes/deals/actions'
import type { MapaGestaoRow, MapaGestaoTotals } from '@/types/financial'
import { DEAL_SCENARIOS } from '@/types/deal'
import type { DealScenario } from '@/types/deal'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface Consultant { id: string; commercial_name: string }

export function MapaGestaoTab() {
  const router = useRouter()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [consultantId, setConsultantId] = useState<string>('all')
  const [dealType, setDealType] = useState<string>('all')

  const [rows, setRows] = useState<MapaGestaoRow[]>([])
  const [totals, setTotals] = useState<MapaGestaoTotals & { partner_total: number; deal_count: number }>({
    report: 0, consultant_total: 0, network_total: 0, margin_total: 0, partner_total: 0, deal_count: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [consultants, setConsultants] = useState<Consultant[]>([])

  // Fetch consultants for filter
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
      setTotals(data.totals || { report: 0, consultant_total: 0, network_total: 0, margin_total: 0, partner_total: 0, deal_count: 0 })
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

  const handlePaymentUpdate = async (_dealId: string, paymentId: string, field: string, date: string) => {
    try {
      const result = await updatePaymentStatus(
        paymentId,
        field as 'is_signed' | 'is_received' | 'is_reported' | 'consultant_paid',
        true,
        date
      )
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
      <div className="relative overflow-hidden bg-neutral-900 rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-10 sm:px-12">
          <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">Financeiro</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">Mapa de Gestao</h2>
          <p className="text-neutral-400 mt-1.5 text-sm">{MONTHS[month - 1]} de {year}</p>

          {/* KPI row */}
          <div className="flex flex-wrap gap-6 mt-6">
            <div>
              <p className="text-neutral-500 text-[11px] font-medium uppercase tracking-wider">Report</p>
              <p className="text-white text-xl font-bold tabular-nums">{fmtCurrency(totals.report)}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-[11px] font-medium uppercase tracking-wider">Margem</p>
              <p className="text-white text-xl font-bold tabular-nums">{fmtCurrency(totals.margin_total)}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-[11px] font-medium uppercase tracking-wider">Negocios</p>
              <p className="text-white text-xl font-bold tabular-nums">{totals.deal_count}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Month navigator */}
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

        {/* Consultant filter */}
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

        {/* Deal type filter */}
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
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold w-[50px]">#</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">ID</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Consultor</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">PV</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Data</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Ass</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Rec</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Rep</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Assinatura</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Cenario</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Valor</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">%</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Report</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Margem</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => {
                  // Determine signing type label
                  const signingLabel = row.payments.length === 1
                    ? '100% Escritura'
                    : row.payments.length >= 2
                      ? `${row.payments[0]?.payment_pct || 0}% CPCV / ${row.payments[1]?.payment_pct || 0}% Esc.`
                      : '-'

                  // Aggregate status across all payments
                  const allSigned = row.payments.every((p: any) => p.is_signed)
                  const allReceived = row.payments.every((p: any) => p.is_received)
                  const allReported = row.payments.every((p: any) => p.is_reported)
                  const anySigned = row.payments.some((p: any) => p.is_signed)
                  const anyReceived = row.payments.some((p: any) => p.is_received)
                  const anyReported = row.payments.some((p: any) => p.is_reported)

                  const scenarioLabel = DEAL_SCENARIOS[row.deal_type as DealScenario]?.label ?? row.deal_type

                  return (
                    <TableRow
                      key={`${row.deal_id}-${row.share_role || 'main'}-${row.consultant?.id || idx}`}
                      className="transition-colors duration-200 hover:bg-muted/30 cursor-pointer"
                      onClick={() => router.push(`/dashboard/comissoes/deals/${row.deal_id}`)}
                    >
                      <TableCell className="text-xs text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                      <TableCell className="text-sm font-medium">
                        <div className="flex items-center gap-1.5">
                          {row.reference || row.pv_number || row.deal_id.slice(0, 8)}
                          {row.share_role === 'angariacao' && (
                            <Badge variant="outline" className="rounded-full text-[8px] font-medium px-1.5 py-0">Ang.</Badge>
                          )}
                          {row.share_role === 'comprador' && (
                            <Badge variant="outline" className="rounded-full text-[8px] font-medium px-1.5 py-0">Comp.</Badge>
                          )}
                          {row.share_role === 'referencia' && (
                            <Badge className="rounded-full text-[8px] font-medium px-1.5 py-0 bg-orange-500/10 text-orange-600 border-0">
                              Ref. {row.referral_pct_display}%
                            </Badge>
                          )}
                        </div>
                        {/* Show referral deductions on the agent's row */}
                        {row.referral_deductions && row.referral_deductions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {row.referral_deductions.map((d: any, i: number) => (
                              <span key={i} className="text-[9px] text-muted-foreground">
                                -{d.pct}% {d.type === 'externa' ? 'ext.' : ''} {d.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {row.consultant?.commercial_name?.slice(0, 2).toUpperCase() || '??'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate max-w-[120px]">{row.consultant?.commercial_name || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.pv_number || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(row.deal_date)}</TableCell>

                      {/* Status dots */}
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center">
                          <PaymentStatusDot
                            checked={allSigned}
                            label=""
                            editable={!allSigned && row.payments.length > 0}
                            onToggle={(date) => {
                              const unsigned = row.payments.find((p: any) => !p.is_signed)
                              if (unsigned) handlePaymentUpdate(row.deal_id, unsigned.id, 'is_signed', date)
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center">
                          <PaymentStatusDot
                            checked={allReceived}
                            label=""
                            editable={anySigned && !allReceived && row.payments.length > 0}
                            onToggle={(date) => {
                              const unreceived = row.payments.find((p: any) => p.is_signed && !p.is_received)
                              if (unreceived) handlePaymentUpdate(row.deal_id, unreceived.id, 'is_received', date)
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center">
                          <PaymentStatusDot
                            checked={allReported}
                            label=""
                            editable={anyReceived && !allReported && row.payments.length > 0}
                            onToggle={(date) => {
                              const unreported = row.payments.find((p: any) => p.is_received && !p.is_reported)
                              if (unreported) handlePaymentUpdate(row.deal_id, unreported.id, 'is_reported', date)
                            }}
                          />
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="secondary" className="rounded-full text-[10px] font-medium px-2.5 py-0.5 bg-muted/50 whitespace-nowrap">
                          {signingLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full text-[10px] font-medium whitespace-nowrap">
                          {row.has_share ? 'Partilha' : scenarioLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-right tabular-nums">{fmtCurrency(row.deal_value)}</TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-semibold border-0">
                          {row.commission_pct}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-right tabular-nums">{fmtCurrency(row.commission_total)}</TableCell>
                      <TableCell className="text-sm font-semibold text-right tabular-nums">{fmtCurrency(row.agency_net || row.agency_margin || 0)}</TableCell>

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

      {/* Funnel */}
      {!isLoading && rows.length > 0 && (
        <MapaGestaoFunnel totals={totals} />
      )}
    </div>
  )
}
