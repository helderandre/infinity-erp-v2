'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, User, AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MoloniInvoicePanel, type MoloniInvoicePanelData } from '@/components/financial/sheets/moloni-invoice-panel'
import type { ProcSubtask } from '@/types/subtask'

/** Estado fiscal do `deal_payment` devolvido por /fatura-target. */
interface PaymentInfo {
  id: string
  payment_moment: string
  amount: number | null
  agency_amount: number | null
  moloni_status: number | null
  moloni_error: string | null
  moloni_document_id: number | null
  moloni_receipt_id: number | null
  moloni_creditnote_number: string | null
  moloni_email_sent_to: string | null
  agency_invoice_number: string | null
  agency_invoice_date: string | null
  agency_invoice_recipient: string | null
  agency_invoice_recipient_nif: string | null
  agency_invoice_amount_net: number | null
  agency_invoice_amount_gross: number | null
  agency_invoice_vat_pct: number | null
}

/** Mirror de FaturaTarget (derive-fatura-target.ts). */
interface FaturaTarget {
  recipientName: string | null
  nif: string | null
  amountNet: number | null
  source: 'owner' | 'partner_agency'
  ready: boolean
  blockedReason?: string
}

interface SubtaskCardMoloniInvoiceProps {
  subtask: ProcSubtask
  dealId: string | null
  /** Marca a subtarefa como concluída (PUT legacy) + refetch. */
  onCompleted: () => void
  /** Refetch do painel após mudança de estado (sem concluir). */
  onChanged?: () => void
}

const fmtEUR = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

/**
 * Card do passo "Pedido de fatura" do fecho de negócio (PROC-NEG).
 *
 * Reusa o MESMO painel de faturação Moloni do mapa de gestão
 * (`<MoloniInvoicePanel>`): factura da agência editável + bloco Moloni
 * completo (rascunho → finalizar → recibo/NC/anular → email → histórico).
 * Resolve o `deal_payment` do momento (CPCV/escritura) e pré-preenche
 * destinatário/valor a partir do cenário do negócio (`deriveFaturaTarget`):
 * angariação nossa → proprietário (comissão total); externa → agência
 * parceira (nossa parte). Finalizar a fatura conclui o passo.
 */
export function SubtaskCardMoloniInvoice({
  subtask,
  dealId,
  onCompleted,
  onChanged,
}: SubtaskCardMoloniInvoiceProps) {
  const config = (subtask.config ?? {}) as Record<string, unknown>
  const moment = (config.moment as string | undefined) ?? 'cpcv'
  const hint = config.hint as string | undefined

  const [loading, setLoading] = useState(true)
  const [payment, setPayment] = useState<PaymentInfo | null>(null)
  const [target, setTarget] = useState<FaturaTarget | null>(null)

  const load = useCallback(async () => {
    if (!dealId) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/deals/${dealId}/fatura-target?moment=${moment}`)
      if (!res.ok) return
      const json = (await res.json()) as { payment: PaymentInfo | null; target: FaturaTarget | null }
      setPayment(json.payment)
      setTarget(json.target)
    } finally {
      setLoading(false)
    }
  }, [dealId, moment])

  useEffect(() => {
    load()
  }, [load])

  const isCompleted = Boolean(subtask.is_completed)

  if (!dealId) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        Esta subtarefa requer um deal associado ao processo. Submete o negócio primeiro.
      </div>
    )
  }
  if (loading) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        A carregar a faturação…
      </div>
    )
  }
  if (!payment) {
    return (
      <div className="rounded-lg border bg-amber-50 ring-1 ring-amber-500/20 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        Ainda não há pagamento para o momento{' '}
        <strong>{moment === 'escritura' ? 'da escritura' : 'do CPCV'}</strong> neste negócio.
      </div>
    )
  }

  const panelData: MoloniInvoicePanelData = {
    paymentId: payment.id,
    agencyInvoiceNumber: payment.agency_invoice_number,
    agencyInvoiceDate: payment.agency_invoice_date,
    agencyInvoiceRecipient: payment.agency_invoice_recipient,
    agencyInvoiceRecipientNif: payment.agency_invoice_recipient_nif,
    agencyInvoiceAmountNet: payment.agency_invoice_amount_net,
    agencyInvoiceAmountGross: payment.agency_invoice_amount_gross,
    agencyInvoiceVatPct: payment.agency_invoice_vat_pct ?? null,
    moloniStatus: payment.moloni_status ?? null,
    moloniReceiptId: payment.moloni_receipt_id ?? null,
    moloniCreditnoteNumber: payment.moloni_creditnote_number ?? null,
    moloniEmailSentTo: payment.moloni_email_sent_to ?? null,
    moloniError: payment.moloni_error ?? null,
  }

  const SourceIcon = target?.source === 'partner_agency' ? Building2 : User
  const sourceLabel = target?.source === 'partner_agency' ? 'Agência parceira' : 'Proprietário'

  return (
    <div className="space-y-3">
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}

      {/* Contexto do cenário — destinatário/valor derivados do tipo de negócio. */}
      {target && (
        <div className="rounded-xl bg-muted/40 ring-1 ring-border/30 p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
            <SourceIcon className="h-3 w-3" />
            Faturar a · {sourceLabel}
          </p>
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn('text-sm font-medium truncate', !target.recipientName && 'text-muted-foreground')}>
              {target.recipientName ?? 'Por definir'}
            </span>
            <span className="text-sm font-semibold tabular-nums shrink-0">{fmtEUR(target.amountNet)}</span>
          </div>
          {!target.ready && (
            <p className="text-[11px] text-amber-700 flex items-start gap-1.5 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              {target.blockedReason ?? 'Faltam dados para emitir a fatura.'} Podes preencher manualmente abaixo.
            </p>
          )}
        </div>
      )}

      {isCompleted && (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" />
          Fatura emitida — passo concluído.
        </p>
      )}

      {/* Painel Moloni partilhado com o mapa de gestão. */}
      <MoloniInvoicePanel
        data={panelData}
        suggested={{ recipient: target?.recipientName, nif: target?.nif, amountNet: target?.amountNet }}
        onChanged={() => {
          load()
          onChanged?.()
        }}
        onFinalized={() => {
          load()
          if (!isCompleted) onCompleted()
        }}
      />
    </div>
  )
}
