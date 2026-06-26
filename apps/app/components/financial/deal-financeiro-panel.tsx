'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyInput } from '@/components/ui/currency-input'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ChevronDown,
  Circle,
  CheckCircle2,
  Clock,
  Euro,
  Lock,
  RotateCcw,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getDeal,
  updatePaymentStatus,
  updatePaymentInvoice,
  setPaymentAmountOverride,
  clearPaymentOverrides,
  setSplitAmountOverride,
  clearSplitOverride,
  updateSplitPaid,
  createManualSplit,
  deleteSplit,
  recalcDealPayments,
} from '@/app/dashboard/financeiro/deals/actions'
import type { Deal, DealPayment, DealPaymentSplit, PaymentMoment } from '@/types/deal'
import { PAYMENT_MOMENTS, CONSULTANT_INVOICE_TYPES } from '@/types/deal'
import { usePermissions } from '@/hooks/use-permissions'
import { cn } from '@/lib/utils'

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

/**
 * Painel financeiro de um deal — "Cronograma de Pagamentos" (momentos
 * editáveis: assinado/recebido/reportado + facturas agência/rede/consultor) +
 * "Resumo Financeiro" (comissão, partilha, rede, margem, consultor, líquido).
 *
 * Auto-contido: carrega o deal por `dealId` (server action `getDeal`) e gere o
 * seu próprio estado de edição com debounce → `updatePaymentStatus` /
 * `updatePaymentInvoice`. É a fonte única de verdade desta vista, partilhada
 * pela página do deal (`/dashboard/financeiro/deals/[id]`) e pela secção
 * Processos do imóvel (sub-tab "Financeiro").
 */
export function DealFinanceiroPanel({ dealId }: { dealId: string }) {
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [recalcOpen, setRecalcOpen] = useState(false)
  const [recalcing, setRecalcing] = useState(false)
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('financial')

  const loadData = useCallback(async () => {
    const res = await getDeal(dealId)
    if (res.error) toast.error(res.error)
    else setDeal(res.deal ?? null)
  }, [dealId])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      const res = await getDeal(dealId)
      if (!active) return
      if (res.error) toast.error(res.error)
      else setDeal(res.deal ?? null)
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [dealId])

  const handleRecalc = useCallback(async () => {
    setRecalcing(true)
    const res = await recalcDealPayments(dealId)
    setRecalcing(false)
    setRecalcOpen(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    if (res.skipped.length > 0) {
      toast.success(`${res.updated} actualizados`, {
        description:
          'Preservados: ' +
          res.skipped.map((s) => `${PAYMENT_MOMENTS[s.moment as PaymentMoment] ?? s.moment} (${s.reason})`).join(', '),
      })
    } else {
      toast.success(`${res.updated} actualizados`)
    }
    await loadData()
  }, [dealId, loadData])

  const debounced = useCallback((key: string, fn: () => Promise<void>) => {
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(() => {
      void fn()
    }, 600)
  }, [])

  const handleStatusChange = useCallback(
    (paymentId: string, field: string, value: boolean | string | null) => {
      setDeal((prev) => {
        if (!prev?.payments) return prev
        return {
          ...prev,
          payments: prev.payments.map((p) =>
            p.id === paymentId ? { ...p, [field]: value } : p
          ),
        }
      })
      const dateFields = ['signed_date', 'received_date', 'reported_date', 'consultant_paid_date']
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
    [debounced]
  )

  const handleInvoiceChange = useCallback(
    (paymentId: string, field: string, value: string | null) => {
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
    [debounced]
  )

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-8 flex items-start gap-3 animate-in fade-in duration-200">
        <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
          <Euro className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">Sem deal financeiro</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            O lado financeiro aparece quando a oportunidade é submetida para fecho.
          </p>
        </div>
      </div>
    )
  }

  const payments = deal.payments ?? []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start animate-in fade-in duration-200">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Cronograma de Pagamentos</h2>
            <div className="flex items-center gap-2">
              {payments.length > 0 && (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {payments.length} momento{payments.length !== 1 ? 's' : ''}
                </Badge>
              )}
              {canEdit && payments.length > 0 && (
                <AlertDialog open={recalcOpen} onOpenChange={setRecalcOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-full h-8 gap-1.5 text-xs">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Recalcular automático
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Recalcular automático?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Vamos recalcular os montantes a partir do valor e percentagem actuais do
                        negócio. As tuas edições manuais são preservadas, bem como tudo o que já foi
                        faturado ou recebido — esses momentos ficam intocados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={recalcing}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault()
                          void handleRecalc()
                        }}
                        disabled={recalcing}
                      >
                        {recalcing ? 'A recalcular…' : 'Recalcular'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
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
                  canEdit={canEdit}
                  onStatusChange={handleStatusChange}
                  onInvoiceChange={handleInvoiceChange}
                  onChanged={loadData}
                />
              ))}
            </div>
          )}
        </div>
      </div>

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
                    {fmtCurrency(p.amount_override ?? p.amount)} ({p.payment_pct}%)
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>
      </div>
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

/** Lê o valor efectivo de um campo de montante (override ?? auto). */
function effectiveAmount(payment: DealPayment, field: PaymentMoneyField): number | null {
  const override = payment[`${field}_override` as keyof DealPayment] as number | null | undefined
  return override ?? (payment[field as keyof DealPayment] as number | null | undefined) ?? null
}

type PaymentMoneyField = 'amount' | 'network_amount' | 'agency_amount' | 'partner_amount'

function PaymentCard({
  payment,
  canEdit,
  onStatusChange,
  onInvoiceChange,
  onChanged,
}: {
  payment: DealPayment
  canEdit: boolean
  onStatusChange: (id: string, field: string, value: boolean | string | null) => void
  onInvoiceChange: (id: string, field: string, value: string | null) => void
  onChanged: () => Promise<void> | void
}) {
  const pid = payment.id
  const momentLabel = PAYMENT_MOMENTS[payment.payment_moment]
  const [open, setOpen] = useState(true)

  // Montantes bloqueados quando faturado (Moloni 1/2) ou já recebido.
  const moneyLocked =
    payment.moloni_status === 1 || payment.moloni_status === 2 || payment.is_received === true
  const lockedReason =
    payment.moloni_status === 1 || payment.moloni_status === 2
      ? 'Já foi emitida fatura no Moloni — os montantes deste pagamento estão bloqueados.'
      : 'Pagamento já recebido — os montantes estão bloqueados. Desmarca "Recebido" para editar.'

  const hasOverride =
    payment.amount_override != null ||
    payment.network_amount_override != null ||
    payment.agency_amount_override != null ||
    payment.partner_amount_override != null

  const splits = (payment.splits ?? []).filter((s) => !s.is_deleted)
  // "Pago" derivado dos splits (read-only): todas as partes não-eliminadas pagas.
  const allSplitsPaid = splits.length > 0 && splits.every((s) => s.consultant_paid)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer hover:bg-muted/40 transition-colors px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {statusIndicator(payment)}
                <span className="text-sm font-semibold truncate">
                  {momentLabel} — {fmtCurrency(payment.amount_override ?? payment.amount)} ({payment.payment_pct}%)
                </span>
                {hasOverride && (
                  <Badge variant="outline" className="rounded-full text-[9px] px-1.5 py-0 shrink-0">
                    Manual
                  </Badge>
                )}
                {allSplitsPaid && (
                  <Badge className="rounded-full text-[9px] px-1.5 py-0 shrink-0 border-0 bg-emerald-500/15 text-emerald-600">
                    Pago
                  </Badge>
                )}
                {payment.amounts_locked && (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
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
            {/* Montantes editáveis */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Montantes
                </p>
                {canEdit && hasOverride && (
                  <ClearPaymentButton paymentId={pid} disabled={moneyLocked} onChanged={onChanged} />
                )}
              </div>
              {moneyLocked && (
                <p className="flex items-center gap-1.5 text-[11px] text-amber-600">
                  <Lock className="h-3 w-3" />
                  {lockedReason}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <MoneyField
                  label="Total"
                  payment={payment}
                  field="amount"
                  canEdit={canEdit}
                  locked={moneyLocked}
                  onChanged={onChanged}
                />
                <MoneyField
                  label="Margem agência"
                  payment={payment}
                  field="agency_amount"
                  canEdit={canEdit}
                  locked={moneyLocked}
                  onChanged={onChanged}
                />
                <MoneyField
                  label="Convictus"
                  payment={payment}
                  field="network_amount"
                  canEdit={canEdit}
                  locked={moneyLocked}
                  onChanged={onChanged}
                />
                <MoneyField
                  label="Parceiro"
                  payment={payment}
                  field="partner_amount"
                  canEdit={canEdit}
                  locked={moneyLocked}
                  onChanged={onChanged}
                />
              </div>
            </div>

            <Separator />

            {/* Partes (splits) */}
            <SplitsSection
              paymentId={pid}
              splits={splits}
              canEdit={canEdit}
              locked={moneyLocked}
              onChanged={onChanged}
            />

            <Separator />

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
                  onChange={(v) => onInvoiceChange(pid, 'agency_invoice_recipient_nif', v || null)}
                />
                <Field
                  label="Valor s/IVA"
                  value={
                    payment.agency_invoice_amount_net != null
                      ? String(payment.agency_invoice_amount_net)
                      : ''
                  }
                  onChange={(v) => onInvoiceChange(pid, 'agency_invoice_amount_net', v || null)}
                  type="number"
                />
                <Field
                  label="Valor c/IVA"
                  value={
                    payment.agency_invoice_amount_gross != null
                      ? String(payment.agency_invoice_amount_gross)
                      : ''
                  }
                  onChange={(v) => onInvoiceChange(pid, 'agency_invoice_amount_gross', v || null)}
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
                    onValueChange={(v) => onInvoiceChange(pid, 'consultant_invoice_type', v || null)}
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
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

/* ─── Edição de montantes ──────────────────────────────────────────────────── */

function MoneyField({
  label,
  payment,
  field,
  canEdit,
  locked,
  onChanged,
}: {
  label: string
  payment: DealPayment
  field: PaymentMoneyField
  canEdit: boolean
  locked: boolean
  onChanged: () => Promise<void> | void
}) {
  const auto = (payment[field as keyof DealPayment] as number | null | undefined) ?? null
  const override = payment[`${field}_override` as keyof DealPayment] as number | null | undefined
  const isOverride = override != null
  const effective = effectiveAmount(payment, field)
  const [value, setValue] = useState<number | null>(effective)
  const [saving, setSaving] = useState(false)

  // Mantém o input sincronizado quando o pagamento é recarregado.
  useEffect(() => {
    setValue(effectiveAmount(payment, field))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective, payment.id])

  const disabled = !canEdit || locked

  const commit = async () => {
    if (disabled) return
    if (value === effective) return
    setSaving(true)
    const res = await setPaymentAmountOverride(payment.id, field, value)
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      setValue(effective)
      return
    }
    toast.success('Montante actualizado')
    await onChanged()
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
        {isOverride && (
          <span className="text-[10px] text-muted-foreground">auto: {fmtCurrency(auto)}</span>
        )}
      </div>
      {disabled ? (
        <div
          className={cn(
            'h-8 flex items-center px-3 rounded-full text-sm tabular-nums',
            'bg-muted/40 text-muted-foreground'
          )}
        >
          {fmtCurrency(effective)}
        </div>
      ) : (
        <CurrencyInput
          className="h-8 text-sm rounded-full"
          value={value}
          onChange={setValue}
          onBlur={() => void commit()}
          disabled={saving}
        />
      )}
    </div>
  )
}

function ClearPaymentButton({
  paymentId,
  disabled,
  onChanged,
}: {
  paymentId: string
  disabled: boolean
  onChanged: () => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    const res = await clearPaymentOverrides(paymentId)
    setBusy(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Montantes repostos')
    await onChanged()
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
      disabled={busy || disabled}
      onClick={() => void run()}
    >
      <RotateCcw className="h-3 w-3" />
      Repor automático
    </Button>
  )
}

/* ─── Partes (splits) ──────────────────────────────────────────────────────── */

function SplitsSection({
  paymentId,
  splits,
  canEdit,
  locked,
  onChanged,
}: {
  paymentId: string
  splits: DealPaymentSplit[]
  canEdit: boolean
  locked: boolean
  onChanged: () => Promise<void> | void
}) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          Comissões por interveniente
        </p>
        {canEdit && !locked && !adding && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] gap-1"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3 w-3" />
            Adicionar parte
          </Button>
        )}
      </div>

      {splits.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">Sem partes definidas.</p>
      ) : (
        <div className="space-y-2">
          {splits.map((split) => (
            <SplitRow
              key={split.id}
              split={split}
              canEdit={canEdit}
              locked={locked}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}

      {adding && (
        <AddSplitForm
          paymentId={paymentId}
          onClose={() => setAdding(false)}
          onChanged={onChanged}
        />
      )}
    </div>
  )
}

function SplitRow({
  split,
  canEdit,
  locked,
  onChanged,
}: {
  split: DealPaymentSplit
  canEdit: boolean
  locked: boolean
  onChanged: () => Promise<void> | void
}) {
  const auto = split.amount ?? null
  const isOverride = split.amount_override != null
  const effective = split.amount_override ?? split.amount ?? null
  const [value, setValue] = useState<number | null>(effective)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(split.amount_override ?? split.amount ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [split.amount_override, split.amount, split.id])

  const name =
    split.agent?.commercial_name ?? split.manual_label ?? 'Interveniente'
  const disabled = !canEdit || locked || split.consultant_paid

  const commit = async () => {
    if (disabled) return
    if (value === effective) return
    setSaving(true)
    const res = await setSplitAmountOverride(split.id, { amount: value })
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      setValue(effective)
      return
    }
    toast.success('Comissão actualizada')
    await onChanged()
  }

  const clear = async () => {
    setSaving(true)
    const res = await clearSplitOverride(split.id)
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Comissão reposta')
    await onChanged()
  }

  const remove = async () => {
    const res = await deleteSplit(split.id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Parte removida')
    await onChanged()
  }

  const [togglingPaid, setTogglingPaid] = useState(false)
  const togglePaid = async (next: boolean) => {
    setTogglingPaid(true)
    const res = await updateSplitPaid(split.id, next)
    setTogglingPaid(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(next ? 'Parte marcada como paga' : 'Pagamento desmarcado')
    await onChanged()
  }

  return (
    <div className="flex items-center gap-2 rounded-xl ring-1 ring-border/40 bg-background px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm truncate">{name}</span>
          {(split.is_manual || isOverride) && (
            <Badge variant="outline" className="rounded-full text-[9px] px-1.5 py-0 shrink-0">
              Manual
            </Badge>
          )}
          {split.consultant_paid && (
            <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
        </div>
        {isOverride && (
          <span className="text-[10px] text-muted-foreground">auto: {fmtCurrency(auto)}</span>
        )}
      </div>
      {canEdit && (
        <label className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none">
          <Checkbox
            checked={split.consultant_paid}
            disabled={togglingPaid}
            onCheckedChange={(v) => void togglePaid(v === true)}
          />
          <span className="text-[11px] text-muted-foreground">Pago</span>
        </label>
      )}
      {disabled ? (
        <div className="h-8 flex items-center px-3 rounded-full text-sm tabular-nums bg-muted/40 text-muted-foreground w-32 justify-end">
          {fmtCurrency(effective)}
        </div>
      ) : (
        <CurrencyInput
          className="h-8 text-sm rounded-full w-32"
          value={value}
          onChange={setValue}
          onBlur={() => void commit()}
          disabled={saving}
        />
      )}
      {canEdit && isOverride && !locked && !split.consultant_paid && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                disabled={saving}
                onClick={() => void clear()}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Repor automático</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {canEdit && !locked && !split.consultant_paid && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover esta parte?</AlertDialogTitle>
              <AlertDialogDescription>
                Vais remover a parte de <strong>{name}</strong> ({fmtCurrency(effective)}) deste
                pagamento. Podes voltar a adicioná-la manualmente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  void remove()
                }}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

function AddSplitForm({
  paymentId,
  onClose,
  onChanged,
}: {
  paymentId: string
  onClose: () => void
  onChanged: () => Promise<void> | void
}) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!label.trim()) {
      toast.error('Indica um nome para a parte.')
      return
    }
    if (amount == null) {
      toast.error('Indica um valor.')
      return
    }
    setSaving(true)
    const res = await createManualSplit(paymentId, {
      manual_label: label.trim(),
      amount,
      role: 'referral',
    })
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Parte adicionada')
    onClose()
    await onChanged()
  }

  return (
    <div className="rounded-xl ring-1 ring-border/40 bg-background p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nome</Label>
          <Input
            className="h-8 text-sm rounded-full"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: João Silva"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Valor</Label>
          <CurrencyInput
            className="h-8 text-sm rounded-full"
            value={amount}
            onChange={setAmount}
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1"
          disabled={saving}
          onClick={onClose}
        >
          <X className="h-3 w-3" />
          Cancelar
        </Button>
        <Button
          size="sm"
          className="h-7 px-3 text-[11px]"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? 'A guardar…' : 'Adicionar'}
        </Button>
      </div>
    </div>
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
