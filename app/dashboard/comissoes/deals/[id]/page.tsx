'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ArrowLeft, ChevronDown, Circle, CheckCircle2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { getDeal, updatePaymentStatus, updatePaymentInvoice } from '@/app/dashboard/comissoes/deals/actions'
import { DealComplianceTab } from '@/components/financial/deal-compliance-tab'
import type {
  Deal, DealPayment, ConsultantInvoiceType,
} from '@/types/deal'
import { DEAL_SCENARIOS, DEAL_STATUSES, PAYMENT_MOMENTS, CONSULTANT_INVOICE_TYPES } from '@/types/deal'

const fmtCurrency = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtPct = (v: number | null | undefined) => `${v ?? 0}%`

function statusIndicator(p: DealPayment) {
  const done = p.is_signed && p.is_received && p.is_reported
  const partial = p.is_signed || p.is_received || p.is_reported
  if (done) return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
  if (partial) return <Clock className="h-5 w-5 text-amber-500" />
  return <Circle className="h-5 w-5 text-slate-300" />
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})

  const loadDeal = useCallback(async () => {
    const res = await getDeal(id)
    if (res.error) {
      toast.error(res.error)
    } else {
      setDeal(res.deal ?? null)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { loadDeal() }, [loadDeal])

  const debounced = useCallback((key: string, fn: () => Promise<void>) => {
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(async () => {
      try { await fn() } catch { toast.error('Erro ao guardar.') }
    }, 500)
  }, [])

  const handleStatusChange = useCallback((paymentId: string, field: string, value: boolean | string | null) => {
    if (!deal) return
    setDeal((prev) => {
      if (!prev?.payments) return prev
      return {
        ...prev,
        payments: prev.payments.map((p) => p.id === paymentId ? { ...p, [field]: value } : p),
      }
    })
    debounced(`status-${paymentId}-${field}`, () => updatePaymentStatus(paymentId, field as 'is_signed' | 'is_received' | 'is_reported' | 'consultant_paid', value as boolean).then((r) => { if (r.error) toast.error(r.error) }))
  }, [deal, debounced])

  const handleInvoiceChange = useCallback((paymentId: string, field: string, value: string | null) => {
    if (!deal) return
    setDeal((prev) => {
      if (!prev?.payments) return prev
      return {
        ...prev,
        payments: prev.payments.map((p) => p.id === paymentId ? { ...p, [field]: value } : p),
      }
    })
    debounced(`inv-${paymentId}-${field}`, () => updatePaymentInvoice(paymentId, { [field]: value }).then((r) => { if (r.error) toast.error(r.error) }))
  }, [deal, debounced])

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">Negocio nao encontrado.</p>
        <Link href="/dashboard/comissoes" className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"><ArrowLeft className="h-3.5 w-3.5" /> Voltar</Link>
      </div>
    )
  }

  const payments = deal.payments ?? []
  const statusInfo = DEAL_STATUSES[deal.status]

  return (
    <div className="space-y-6 p-6">
      {/* Hero Header */}
      <div className="bg-neutral-900 rounded-2xl px-6 py-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
        <div className="relative space-y-2">
          <Link href="/dashboard/comissoes" className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors mb-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
          <h1 className="text-2xl font-semibold text-white">
            {deal.property?.title ?? 'Sem imovel'}
            {deal.property?.external_ref && <span className="ml-2 text-base text-neutral-400">({deal.property.external_ref})</span>}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-400">
            <span>{deal.consultant?.commercial_name ?? '—'}</span>
            <span>|</span>
            <Badge variant="outline" className="rounded-full text-[10px] font-medium border-0 bg-white/10 text-neutral-300">{DEAL_SCENARIOS[deal.deal_type as keyof typeof DEAL_SCENARIOS]?.label ?? deal.deal_type}</Badge>
            <Badge className={`${statusInfo.color} rounded-full text-[10px] font-medium border-0`}>{statusInfo.label}</Badge>
            {deal.reference && <><span>|</span><span>Ref: {deal.reference}</span></>}
            {deal.pv_number && <><span>|</span><span>PV: {deal.pv_number}</span></>}
            <span>|</span>
            <span>{new Date(deal.deal_date).toLocaleDateString('pt-PT')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Payment Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-medium">Timeline de Pagamentos</h2>
          {payments.length === 0 && <p className="text-sm text-muted-foreground">Sem momentos de pagamento.</p>}
          {payments.map((payment) => (
            <PaymentCard
              key={payment.id}
              payment={payment}
              hasShare={deal.has_share}
              onStatusChange={handleStatusChange}
              onInvoiceChange={handleInvoiceChange}
            />
          ))}
        </div>

        {/* Right — Financial Summary */}
        <div>
          <div className="sticky top-6 rounded-2xl border bg-card/50 backdrop-blur-sm">
            <div className="px-5 py-4 border-b">
              <h3 className="text-base font-semibold">Resumo Financeiro</h3>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <Row label="Valor do negocio" value={fmtCurrency(deal.deal_value)} bold />
              <Row label={`Comissao (${fmtPct(deal.commission_pct)})`} value={fmtCurrency(deal.commission_total)} bold />
              <Separator />
              {deal.has_share && (
                <>
                  <Row label="Nossa parte" value={fmtCurrency(deal.share_amount)} />
                  <Row label={`Parceiro (${deal.partner_agency_name ?? '—'})`} value={fmtCurrency(deal.partner_amount)} muted />
                  <Separator />
                </>
              )}
              <Row label={`Rede (${fmtPct(deal.network_pct)})`} value={fmtCurrency(deal.network_amount)} muted />
              <Row label="Margem agencia" value={fmtCurrency(deal.agency_margin)} />
              <Row label={`Consultor (${fmtPct(deal.consultant_pct)})`} value={fmtCurrency(deal.consultant_amount)} />
              <Row label="Liquido agencia" value={fmtCurrency(deal.agency_net)} bold />
              <Separator />
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Momentos</p>
              {payments.map((p) => {
                const done = p.is_signed && p.is_received && p.is_reported
                return (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      {statusIndicator(p)}
                      <span>{PAYMENT_MOMENTS[p.payment_moment]}</span>
                    </span>
                    <Badge variant={done ? 'default' : 'secondary'} className="rounded-full text-[10px] font-medium border-0">
                      {fmtCurrency(p.amount)} ({p.payment_pct}%)
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Compliance IMPIC */}
      <DealComplianceTab dealId={deal.id} dealValue={deal.deal_value} dealDate={deal.deal_date} />
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-muted-foreground' : ''}`}>
      <span>{label}</span>
      <span className={bold ? 'font-semibold' : ''}>{value}</span>
    </div>
  )
}

function PaymentCard({ payment, hasShare, onStatusChange, onInvoiceChange }: {
  payment: DealPayment
  hasShare: boolean
  onStatusChange: (id: string, field: string, value: boolean | string | null) => void
  onInvoiceChange: (id: string, field: string, value: string | null) => void
}) {
  const pid = payment.id
  const momentLabel = PAYMENT_MOMENTS[payment.payment_moment]
  const [open, setOpen] = useState(true)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-2xl border bg-card/50 backdrop-blur-sm">
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer hover:bg-muted/50 transition-colors px-5 py-4 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusIndicator(payment)}
                <span className="text-base font-semibold">
                  {momentLabel} — {fmtCurrency(payment.amount)} ({payment.payment_pct}%)
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-5 pb-5 space-y-5">
            {/* Status checkboxes */}
            <div className="space-y-3">
              <CheckDateRow label="Assinado" checked={payment.is_signed} date={payment.signed_date}
                onCheck={(v) => onStatusChange(pid, 'is_signed', v)}
                onDate={(v) => onStatusChange(pid, 'signed_date', v)} />
              <CheckDateRow label="Recebido" checked={payment.is_received} date={payment.received_date}
                onCheck={(v) => onStatusChange(pid, 'is_received', v)}
                onDate={(v) => onStatusChange(pid, 'received_date', v)} />
              <CheckDateRow label="Reportado" checked={payment.is_reported} date={payment.reported_date}
                onCheck={(v) => onStatusChange(pid, 'is_reported', v)}
                onDate={(v) => onStatusChange(pid, 'reported_date', v)} />
            </div>

            <Separator />

            {/* Agency invoice */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Factura Agencia</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="N.o factura" value={payment.agency_invoice_number ?? ''} onChange={(v) => onInvoiceChange(pid, 'agency_invoice_number', v || null)} />
                <Field label="Data" value={payment.agency_invoice_date ?? ''} onChange={(v) => onInvoiceChange(pid, 'agency_invoice_date', v || null)} type="date" />
                <Field label="Destinatario" value={payment.agency_invoice_recipient ?? ''} onChange={(v) => onInvoiceChange(pid, 'agency_invoice_recipient', v || null)} />
                <Field label="NIF" value={payment.agency_invoice_recipient_nif ?? ''} onChange={(v) => onInvoiceChange(pid, 'agency_invoice_recipient_nif', v || null)} />
                <Field label="Valor s/IVA" value={payment.agency_invoice_amount_net != null ? String(payment.agency_invoice_amount_net) : ''} onChange={(v) => onInvoiceChange(pid, 'agency_invoice_amount_net', v || null)} type="number" />
                <Field label="Valor c/IVA" value={payment.agency_invoice_amount_gross != null ? String(payment.agency_invoice_amount_gross) : ''} onChange={(v) => onInvoiceChange(pid, 'agency_invoice_amount_gross', v || null)} type="number" />
              </div>
            </div>

            <Separator />

            {/* Network invoice */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Factura Rede</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="N.o factura" value={payment.network_invoice_number ?? ''} onChange={(v) => onInvoiceChange(pid, 'network_invoice_number', v || null)} />
                <Field label="Data" value={payment.network_invoice_date ?? ''} onChange={(v) => onInvoiceChange(pid, 'network_invoice_date', v || null)} type="date" />
              </div>
            </div>

            <Separator />

            {/* Consultant invoice */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Factura/Recibo Consultor</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Tipo</Label>
                  <Select value={payment.consultant_invoice_type ?? ''} onValueChange={(v) => onInvoiceChange(pid, 'consultant_invoice_type', v || null)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONSULTANT_INVOICE_TYPES).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="N.o" value={payment.consultant_invoice_number ?? ''} onChange={(v) => onInvoiceChange(pid, 'consultant_invoice_number', v || null)} />
                <Field label="Data" value={payment.consultant_invoice_date ?? ''} onChange={(v) => onInvoiceChange(pid, 'consultant_invoice_date', v || null)} type="date" />
              </div>
              <CheckDateRow label="Pago ao consultor" checked={payment.consultant_paid} date={payment.consultant_paid_date}
                onCheck={(v) => onStatusChange(pid, 'consultant_paid', v)}
                onDate={(v) => onStatusChange(pid, 'consultant_paid_date', v)} />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function CheckDateRow({ label, checked, date, onCheck, onDate }: {
  label: string; checked: boolean; date: string | null
  onCheck: (v: boolean) => void; onDate: (v: string | null) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <Checkbox checked={checked} onCheckedChange={(v) => onCheck(v === true)} />
      <span className="text-sm min-w-[110px]">{label}</span>
      <Input type="date" className="h-8 w-40 text-sm" value={date ?? ''} onChange={(e) => onDate(e.target.value || null)} />
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input type={type} className="h-8 text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
