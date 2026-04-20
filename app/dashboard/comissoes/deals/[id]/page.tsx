'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ArrowLeft,
  ChevronDown,
  Circle,
  CheckCircle2,
  Clock,
  Briefcase,
  Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getDeal,
  updatePaymentStatus,
  updatePaymentInvoice,
} from '@/app/dashboard/comissoes/deals/actions'
import { DealComplianceTab } from '@/components/financial/deal-compliance-tab'
import type { Deal, DealPayment, DealScenario } from '@/types/deal'
import {
  DEAL_SCENARIOS,
  DEAL_STATUSES,
  PAYMENT_MOMENTS,
  CONSULTANT_INVOICE_TYPES,
} from '@/types/deal'
import { cn } from '@/lib/utils'

const fmtCurrency = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtPct = (v: number | null | undefined) => `${v ?? 0}%`

const SCENARIO_COLORS: Record<DealScenario, string> = {
  pleno: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30 dark:text-emerald-300',
  comprador_externo: 'bg-blue-500/15 text-blue-700 border-blue-400/30 dark:text-blue-300',
  pleno_agencia: 'bg-indigo-500/15 text-indigo-700 border-indigo-400/30 dark:text-indigo-300',
  angariacao_externa: 'bg-amber-500/15 text-amber-700 border-amber-400/30 dark:text-amber-300',
}

const STATUS_DOTS: Record<string, string> = {
  draft: 'bg-slate-400',
  submitted: 'bg-amber-500',
  active: 'bg-blue-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-500',
}

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

  useEffect(() => {
    loadDeal()
  }, [loadDeal])

  const debounced = useCallback((key: string, fn: () => Promise<void>) => {
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(async () => {
      try {
        await fn()
      } catch {
        toast.error('Erro ao guardar.')
      }
    }, 500)
  }, [])

  const handleStatusChange = useCallback(
    (paymentId: string, field: string, value: boolean | string | null) => {
      if (!deal) return
      setDeal((prev) => {
        if (!prev?.payments) return prev
        return {
          ...prev,
          payments: prev.payments.map((p) =>
            p.id === paymentId ? { ...p, [field]: value } : p
          ),
        }
      })
      const dateFields = [
        'signed_date',
        'received_date',
        'reported_date',
        'consultant_paid_date',
      ]
      if (dateFields.includes(field)) {
        debounced(`inv-${paymentId}-${field}`, () =>
          updatePaymentInvoice(paymentId, { [field]: value }).then((r) => {
            if (r.error) toast.error(r.error)
          })
        )
      } else {
        debounced(`status-${paymentId}-${field}`, () =>
          updatePaymentStatus(
            paymentId,
            field as 'is_signed' | 'is_received' | 'is_reported',
            value as boolean
          ).then((r) => {
            if (r.error) toast.error(r.error)
          })
        )
      }
    },
    [deal, debounced]
  )

  const handleInvoiceChange = useCallback(
    (paymentId: string, field: string, value: string | null) => {
      if (!deal) return
      setDeal((prev) => {
        if (!prev?.payments) return prev
        return {
          ...prev,
          payments: prev.payments.map((p) =>
            p.id === paymentId ? { ...p, [field]: value } : p
          ),
        }
      })
      debounced(`inv-${paymentId}-${field}`, () =>
        updatePaymentInvoice(paymentId, { [field]: value }).then((r) => {
          if (r.error) toast.error(r.error)
        })
      )
    },
    [deal, debounced]
  )

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="space-y-5">
        <Link
          href="/dashboard/negocios"
          className="inline-flex items-center gap-1.5 bg-muted/50 hover:bg-muted text-foreground px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
        <div className="rounded-xl border bg-card shadow-sm p-12 text-center">
          <h2 className="text-lg font-semibold">Negócio não encontrado</h2>
          <p className="text-sm text-muted-foreground mt-1">
            O negócio que procura não existe ou foi eliminado.
          </p>
        </div>
      </div>
    )
  }

  const payments = deal.payments ?? []
  const scenario = deal.deal_type as DealScenario
  const scenarioInfo = DEAL_SCENARIOS[scenario]
  const statusInfo = DEAL_STATUSES[deal.status]
  const ref = deal.reference || deal.pv_number || deal.id.slice(0, 8)

  return (
    <div className="space-y-5">
      {/* ═══ Light toolbar ═══ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <Link
          href="/dashboard/negocios"
          className="inline-flex items-center gap-1.5 bg-muted/50 hover:bg-muted text-foreground px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
      </div>

      {/* ═══ Header card ═══ */}
      <div className="rounded-xl border bg-card shadow-sm p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">
                {deal.property?.title ?? (deal.external_property_link ? 'Imóvel externo' : 'Sem imóvel')}
              </h1>
              {deal.property?.external_ref && (
                <Badge variant="outline" className="rounded-full text-[10px] font-mono">
                  {deal.property.external_ref}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mt-1.5">
              {deal.property && (
                <>
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{deal.property.city ?? '—'}</span>
                  <span>·</span>
                </>
              )}
              <span>{deal.consultant?.commercial_name ?? '—'}</span>
              <span>·</span>
              <span>{new Date(deal.deal_date).toLocaleDateString('pt-PT')}</span>
              {deal.reference && (
                <>
                  <span>·</span>
                  <span>Ref {deal.reference}</span>
                </>
              )}
              {deal.pv_number && (
                <>
                  <span>·</span>
                  <span>PV {deal.pv_number}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full whitespace-nowrap border',
                SCENARIO_COLORS[scenario] || 'bg-muted text-muted-foreground border-border'
              )}
            >
              {scenarioInfo?.label ?? deal.deal_type}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium',
                statusInfo.color
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOTS[deal.status])} />
              {statusInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ Content grid ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Left: Payments timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Cronograma de Pagamentos</h2>
              {payments.length > 0 && (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {payments.length} momento{payments.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Sem momentos de pagamento.
              </p>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <PaymentCard
                    key={payment.id}
                    payment={payment}
                    onStatusChange={handleStatusChange}
                    onInvoiceChange={handleInvoiceChange}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Financial summary */}
        <div className="lg:sticky lg:top-4">
          <div className="rounded-xl border bg-card shadow-sm p-5 space-y-3">
            <h3 className="text-base font-semibold">Resumo Financeiro</h3>
            <div className="space-y-2.5 text-sm">
              <Row label="Valor do negócio" value={fmtCurrency(deal.deal_value)} bold />
              <Row
                label={`Comissão (${fmtPct(deal.commission_pct)})`}
                value={fmtCurrency(deal.commission_total)}
                bold
              />
              <Separator />
              {deal.has_share && (
                <>
                  <Row label="Nossa parte" value={fmtCurrency(deal.share_amount)} />
                  <Row
                    label={`Parceiro (${deal.partner_agency_name ?? '—'})`}
                    value={fmtCurrency(deal.partner_amount)}
                    muted
                  />
                  <Separator />
                </>
              )}
              <Row
                label={`Rede (${fmtPct(deal.network_pct)})`}
                value={fmtCurrency(deal.network_amount)}
                muted
              />
              <Row label="Margem agência" value={fmtCurrency(deal.agency_margin)} />
              <Row
                label={`Consultor (${fmtPct(deal.consultant_pct)})`}
                value={fmtCurrency(deal.consultant_amount)}
              />
              <Row label="Líquido agência" value={fmtCurrency(deal.agency_net)} bold />
              <Separator />
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Momentos
              </p>
              {payments.map((p) => {
                const done = p.is_signed && p.is_received && p.is_reported
                return (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      {statusIndicator(p)}
                      <span>{PAYMENT_MOMENTS[p.payment_moment]}</span>
                    </span>
                    <Badge
                      variant={done ? 'default' : 'secondary'}
                      className="rounded-full text-[10px] font-medium border-0"
                    >
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

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
}) {
  return (
    <div className={cn('flex justify-between', muted && 'text-muted-foreground')}>
      <span>{label}</span>
      <span className={bold ? 'font-semibold' : ''}>{value}</span>
    </div>
  )
}

function PaymentCard({
  payment,
  onStatusChange,
  onInvoiceChange,
}: {
  payment: DealPayment
  onStatusChange: (id: string, field: string, value: boolean | string | null) => void
  onInvoiceChange: (id: string, field: string, value: string | null) => void
}) {
  const pid = payment.id
  const momentLabel = PAYMENT_MOMENTS[payment.payment_moment]
  const [open, setOpen] = useState(true)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer hover:bg-muted/40 transition-colors px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {statusIndicator(payment)}
                <span className="text-sm font-semibold truncate">
                  {momentLabel} — {fmtCurrency(payment.amount)} ({payment.payment_pct}%)
                </span>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform shrink-0',
                  open && 'rotate-180'
                )}
              />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-5 pb-5 space-y-5 border-t bg-muted/20 pt-5">
            {/* Status checkboxes */}
            <div className="space-y-3">
              <CheckDateRow
                label="Assinado"
                checked={payment.is_signed}
                date={payment.signed_date}
                onCheck={(v) => onStatusChange(pid, 'is_signed', v)}
                onDate={(v) => onStatusChange(pid, 'signed_date', v)}
              />
              <CheckDateRow
                label="Recebido"
                checked={payment.is_received}
                date={payment.received_date}
                onCheck={(v) => onStatusChange(pid, 'is_received', v)}
                onDate={(v) => onStatusChange(pid, 'received_date', v)}
              />
              <CheckDateRow
                label="Reportado"
                checked={payment.is_reported}
                date={payment.reported_date}
                onCheck={(v) => onStatusChange(pid, 'is_reported', v)}
                onDate={(v) => onStatusChange(pid, 'reported_date', v)}
              />
            </div>

            <Separator />

            {/* Agency invoice */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Factura da Agência
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="N.º Factura"
                  value={payment.agency_invoice_number ?? ''}
                  onChange={(v) => onInvoiceChange(pid, 'agency_invoice_number', v || null)}
                />
                <Field
                  label="Data"
                  value={payment.agency_invoice_date ?? ''}
                  onChange={(v) => onInvoiceChange(pid, 'agency_invoice_date', v || null)}
                  type="date"
                />
                <Field
                  label="Destinatário"
                  value={payment.agency_invoice_recipient ?? ''}
                  onChange={(v) => onInvoiceChange(pid, 'agency_invoice_recipient', v || null)}
                />
                <Field
                  label="NIF"
                  value={payment.agency_invoice_recipient_nif ?? ''}
                  onChange={(v) =>
                    onInvoiceChange(pid, 'agency_invoice_recipient_nif', v || null)
                  }
                />
                <Field
                  label="Valor s/IVA"
                  value={
                    payment.agency_invoice_amount_net != null
                      ? String(payment.agency_invoice_amount_net)
                      : ''
                  }
                  onChange={(v) =>
                    onInvoiceChange(pid, 'agency_invoice_amount_net', v || null)
                  }
                  type="number"
                />
                <Field
                  label="Valor c/IVA"
                  value={
                    payment.agency_invoice_amount_gross != null
                      ? String(payment.agency_invoice_amount_gross)
                      : ''
                  }
                  onChange={(v) =>
                    onInvoiceChange(pid, 'agency_invoice_amount_gross', v || null)
                  }
                  type="number"
                />
              </div>
            </div>

            <Separator />

            {/* Network invoice */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Factura da Rede
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="N.º Factura"
                  value={payment.network_invoice_number ?? ''}
                  onChange={(v) => onInvoiceChange(pid, 'network_invoice_number', v || null)}
                />
                <Field
                  label="Data"
                  value={payment.network_invoice_date ?? ''}
                  onChange={(v) => onInvoiceChange(pid, 'network_invoice_date', v || null)}
                  type="date"
                />
              </div>
            </div>

            <Separator />

            {/* Consultant invoice */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Factura/Recibo do Consultor
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Tipo
                  </Label>
                  <Select
                    value={payment.consultant_invoice_type ?? ''}
                    onValueChange={(v) =>
                      onInvoiceChange(pid, 'consultant_invoice_type', v || null)
                    }
                  >
                    <SelectTrigger className="rounded-full">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONSULTANT_INVOICE_TYPES).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Field
                  label="N.º"
                  value={payment.consultant_invoice_number ?? ''}
                  onChange={(v) => onInvoiceChange(pid, 'consultant_invoice_number', v || null)}
                />
                <Field
                  label="Data"
                  value={payment.consultant_invoice_date ?? ''}
                  onChange={(v) => onInvoiceChange(pid, 'consultant_invoice_date', v || null)}
                  type="date"
                />
              </div>
              <CheckDateRow
                label="Pago ao consultor"
                checked={payment.consultant_paid}
                date={payment.consultant_paid_date}
                onCheck={(v) => onStatusChange(pid, 'consultant_paid', v)}
                onDate={(v) => onStatusChange(pid, 'consultant_paid_date', v)}
              />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function CheckDateRow({
  label,
  checked,
  date,
  onCheck,
  onDate,
}: {
  label: string
  checked: boolean
  date: string | null
  onCheck: (v: boolean) => void
  onDate: (v: string | null) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <Checkbox checked={checked} onCheckedChange={(v) => onCheck(v === true)} />
      <span className="text-sm min-w-[110px]">{label}</span>
      <Input
        type="date"
        className="h-8 w-40 text-sm rounded-full"
        value={date ?? ''}
        onChange={(e) => onDate(e.target.value || null)}
      />
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        type={type}
        className="h-8 text-sm rounded-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
