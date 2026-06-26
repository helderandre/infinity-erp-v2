'use client'

import { useEffect, useState } from 'react'
import {
  Receipt, Loader2, Save, Send, Trash2, ShieldCheck, AlertTriangle,
  Mail, FileMinus2, Coins, Ban, Eye, History,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { cn } from '@/lib/utils'
import { MoloniDocumentSheet } from './moloni-document-sheet'
import { updatePaymentInvoice } from '@/app/dashboard/financeiro/deals/actions'
import { getAgencySettings } from '@/app/dashboard/financeiro/actions'
import { vatPctFromSettings, DEFAULT_VAT_PCT } from '@/lib/financial/vat-settings'
import {
  issueMoloniDraft, finalizeMoloniInvoice, deleteMoloniDraft,
  issueMoloniReceipt, issueMoloniCreditNote, cancelMoloniDocument, sendMoloniInvoiceEmail,
  reissueMoloniInvoice,
} from '@/app/dashboard/financeiro/deals/moloni-actions'

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
const isoDate = (d: string | null) => (d ? d.slice(0, 10) : '')
const fmtVat = (p: number) => `${Number.isInteger(p) ? p : p.toFixed(1).replace('.', ',')}%`
const fmtMoney = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

/** Dados fiscais do `deal_payment` que o painel precisa para o estado inicial. */
export interface MoloniInvoicePanelData {
  paymentId: string
  agencyInvoiceNumber: string | null
  agencyInvoiceDate: string | null
  agencyInvoiceRecipient: string | null
  agencyInvoiceRecipientNif: string | null
  agencyInvoiceAmountNet: number | null
  agencyInvoiceAmountGross: number | null
  /** IVA (%) snapshot desta fatura; null = ainda não emitida (usa a definição corrente). */
  agencyInvoiceVatPct: number | null
  moloniStatus: number | null
  moloniReceiptId: number | null
  moloniCreditnoteNumber: string | null
  moloniEmailSentTo: string | null
  moloniError: string | null
}

export interface MoloniInvoicePanelProps {
  data: MoloniInvoicePanelData
  /**
   * Valores sugeridos (ex.: `deriveFaturaTarget` no fecho de negócio) usados
   * para pré-preencher os campos da factura da agência quando ainda vazios.
   * Em mapa de gestão não é passado → comportamento idêntico ao anterior.
   */
  suggested?: { recipient?: string | null; nif?: string | null; amountNet?: number | null }
  onChanged?: () => void
  /** Disparado quando a factura passa a Emitida·AT (status 1). */
  onFinalized?: () => void
}

/**
 * Painel de faturação Moloni — extraído de `mapa-row-sheet.tsx` (tab Gestão)
 * para ser partilhado entre o mapa de gestão e o passo "Pedido de fatura" do
 * fecho de negócio. Contém os campos editáveis da factura da agência + o bloco
 * Moloni completo (rascunho → finalizar → recibo/NC/anular → email → histórico).
 * Toda a lógica fiscal vive nas server actions (`moloni-actions.ts`), gated a
 * `financial`.
 */
export function MoloniInvoicePanel({ data, suggested, onChanged, onFinalized }: MoloniInvoicePanelProps) {
  // Campos editáveis da factura da agência (alimentam o rascunho Moloni).
  const [agencyInvNum, setAgencyInvNum] = useState(data.agencyInvoiceNumber ?? '')
  const [agencyInvDate, setAgencyInvDate] = useState(isoDate(data.agencyInvoiceDate))
  const [agencyInvRecipient, setAgencyInvRecipient] = useState(data.agencyInvoiceRecipient ?? suggested?.recipient ?? '')
  const [agencyInvNif, setAgencyInvNif] = useState(data.agencyInvoiceRecipientNif ?? suggested?.nif ?? '')
  const [agencyInvNet, setAgencyInvNet] = useState(
    data.agencyInvoiceAmountNet != null ? String(data.agencyInvoiceAmountNet)
      : suggested?.amountNet != null ? String(suggested.amountNet) : ''
  )
  const [savingAgency, setSavingAgency] = useState(false)

  // IVA corrente da definição financeira — usada para faturas ainda por emitir.
  // Faturas já emitidas mostram a taxa com que foram emitidas (snapshot).
  const [defaultVatPct, setDefaultVatPct] = useState<number>(DEFAULT_VAT_PCT)
  useEffect(() => {
    let active = true
    getAgencySettings()
      .then((res) => { if (active && !res.error) setDefaultVatPct(vatPctFromSettings(res.settings)) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  // Total ao cliente = líquido + IVA. IVA = snapshot da fatura (se já emitida) ou
  // a definição financeira corrente (faturas novas).
  const effectiveVatPct = data.agencyInvoiceVatPct ?? defaultVatPct
  const netNum = agencyInvNet ? Number(agencyInvNet) || 0 : 0
  const grossNum = Math.round(netNum * (1 + effectiveVatPct / 100) * 100) / 100
  const ivaNum = Math.round((grossNum - netNum) * 100) / 100

  // Moloni (faturação) — estado optimista local, re-sincronizado ao mudar de pagamento.
  const [moloniBusy, setMoloniBusy] = useState<
    null | 'draft' | 'finalize' | 'delete' | 'receipt' | 'creditnote' | 'email' | 'cancel' | 'reissue'
  >(null)
  const [confirmFinalize, setConfirmFinalize] = useState(false)
  const [confirmCredit, setConfirmCredit] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState(data.moloniEmailSentTo ?? '')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewView, setPreviewView] = useState<'invoice' | 'creditnote'>('invoice')
  const [previewDirectDoc, setPreviewDirectDoc] = useState<{ id: number; label: string } | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [history, setHistory] = useState<any[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [moloni, setMoloni] = useState<{
    status: number | null
    number: string | null
    receiptId: number | null
    creditnoteNumber: string | null
    emailedTo: string | null
  }>({
    status: data.moloniStatus ?? null,
    number: data.agencyInvoiceNumber ?? null,
    receiptId: data.moloniReceiptId ?? null,
    creditnoteNumber: data.moloniCreditnoteNumber ?? null,
    emailedTo: data.moloniEmailSentTo ?? null,
  })

  useEffect(() => {
    setAgencyInvNum(data.agencyInvoiceNumber ?? '')
    setAgencyInvDate(isoDate(data.agencyInvoiceDate))
    setAgencyInvRecipient(data.agencyInvoiceRecipient ?? suggested?.recipient ?? '')
    setAgencyInvNif(data.agencyInvoiceRecipientNif ?? suggested?.nif ?? '')
    setAgencyInvNet(
      data.agencyInvoiceAmountNet != null ? String(data.agencyInvoiceAmountNet)
        : suggested?.amountNet != null ? String(suggested.amountNet) : ''
    )
    setMoloni({
      status: data.moloniStatus ?? null,
      number: data.agencyInvoiceNumber ?? null,
      receiptId: data.moloniReceiptId ?? null,
      creditnoteNumber: data.moloniCreditnoteNumber ?? null,
      emailedTo: data.moloniEmailSentTo ?? null,
    })
    setConfirmFinalize(false)
    setConfirmCredit(false)
    setConfirmCancel(false)
    setEmailOpen(false)
    setEmailTo(data.moloniEmailSentTo ?? '')
    setPreviewOpen(false)
    setPreviewView('invoice')
    setPreviewDirectDoc(null)
    setHistoryOpen(false)
    setHistory(null)
  }, [data.paymentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const paymentId = data.paymentId

  const handleSaveAgency = async () => {
    setSavingAgency(true)
    try {
      const res = await updatePaymentInvoice(paymentId, {
        agency_invoice_number: agencyInvNum || undefined,
        agency_invoice_date: agencyInvDate || undefined,
        agency_invoice_recipient: agencyInvRecipient || undefined,
        agency_invoice_recipient_nif: agencyInvNif || undefined,
        agency_invoice_amount_net: agencyInvNet ? netNum : undefined,
        agency_invoice_amount_gross: agencyInvNet ? grossNum : undefined,
      })
      if (!res.success) throw new Error(res.error ?? 'Erro')
      toast.success('Factura da agência guardada')
      onChanged?.()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao guardar')
    } finally {
      setSavingAgency(false)
    }
  }

  const handleIssueMoloniDraft = async () => {
    setMoloniBusy('draft')
    try {
      const res = await issueMoloniDraft(paymentId, {
        recipient: agencyInvRecipient || undefined,
        recipient_nif: agencyInvNif || undefined,
        amount_net: agencyInvNet ? Number(agencyInvNet) : undefined,
      })
      if (!res.success) throw new Error(res.error ?? 'Erro')
      setMoloni((m) => ({ ...m, status: res.status ?? 0, number: res.number ?? m.number }))
      toast.success(res.number ? `Rascunho criado no Moloni (${res.number})` : 'Rascunho criado no Moloni')
      onChanged?.()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao emitir rascunho no Moloni')
    } finally {
      setMoloniBusy(null)
    }
  }

  const handleFinalizeMoloni = async () => {
    setMoloniBusy('finalize')
    try {
      const res = await finalizeMoloniInvoice(paymentId)
      if (!res.success) throw new Error(res.error ?? 'Erro')
      setMoloni((m) => ({ ...m, status: 1, number: res.number ?? m.number }))
      setConfirmFinalize(false)
      toast.success(`Factura emitida e reportada à AT${res.number ? ` (${res.number})` : ''}`)
      onChanged?.()
      onFinalized?.()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao finalizar a factura')
    } finally {
      setMoloniBusy(null)
    }
  }

  const handleDeleteMoloniDraft = async () => {
    setMoloniBusy('delete')
    try {
      const res = await deleteMoloniDraft(paymentId)
      if (!res.success) throw new Error(res.error ?? 'Erro')
      setMoloni({ status: null, number: null, receiptId: null, creditnoteNumber: null, emailedTo: null })
      toast.success('Rascunho eliminado no Moloni')
      onChanged?.()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao eliminar o rascunho')
    } finally {
      setMoloniBusy(null)
    }
  }

  const handleIssueReceipt = async () => {
    setMoloniBusy('receipt')
    try {
      const res = await issueMoloniReceipt(paymentId)
      if (!res.success) throw new Error(res.error ?? 'Erro')
      setMoloni((m) => ({ ...m, receiptId: res.receipt_id ?? -1 }))
      toast.success('Recibo emitido (fatura marcada como paga)')
      onChanged?.()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao emitir o recibo')
    } finally {
      setMoloniBusy(null)
    }
  }

  const handleIssueCreditNote = async () => {
    setMoloniBusy('creditnote')
    try {
      const res = await issueMoloniCreditNote(paymentId)
      if (!res.success) throw new Error(res.error ?? 'Erro')
      setMoloni((m) => ({ ...m, status: 2, creditnoteNumber: res.creditnote_number ?? m.creditnoteNumber }))
      setConfirmCredit(false)
      toast.success(`Nota de crédito emitida${res.creditnote_number ? ` (${res.creditnote_number})` : ''}`)
      setPreviewDirectDoc(null)
      setPreviewView('creditnote')
      setPreviewOpen(true)
      setHistory(null)
      onChanged?.()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao emitir a nota de crédito')
    } finally {
      setMoloniBusy(null)
    }
  }

  const handleCancelMoloni = async () => {
    setMoloniBusy('cancel')
    try {
      const res = await cancelMoloniDocument(paymentId)
      if (!res.success) throw new Error(res.error ?? 'Erro')
      setMoloni((m) => ({ ...m, status: 2 }))
      setConfirmCancel(false)
      toast.success('Documento anulado no Moloni')
      onChanged?.()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao anular o documento')
    } finally {
      setMoloniBusy(null)
    }
  }

  const handleSendEmail = async () => {
    setMoloniBusy('email')
    try {
      const res = await sendMoloniInvoiceEmail(paymentId, { to: emailTo || undefined })
      if (!res.success) throw new Error(res.error ?? 'Erro')
      setMoloni((m) => ({ ...m, emailedTo: res.emailed_to ?? emailTo }))
      setEmailOpen(false)
      toast.success(`Fatura enviada${res.emailed_to ? ` para ${res.emailed_to}` : ''}`)
      onChanged?.()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao enviar a fatura por email')
    } finally {
      setMoloniBusy(null)
    }
  }

  const handleReissue = async () => {
    setMoloniBusy('reissue')
    try {
      const res = await reissueMoloniInvoice(paymentId)
      if (!res.success) throw new Error(res.error ?? 'Erro')
      setMoloni({ status: null, number: null, receiptId: null, creditnoteNumber: null, emailedTo: null })
      setHistory(null)
      toast.success('Pronto para emitir uma nova fatura')
      onChanged?.()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao reabrir o ciclo de faturação')
    } finally {
      setMoloniBusy(null)
    }
  }

  const handleToggleHistory = async () => {
    const next = !historyOpen
    setHistoryOpen(next)
    if (next && history === null) {
      setHistoryLoading(true)
      try {
        const r = await fetch(`/api/financial/moloni/deal-payments/${paymentId}/history`)
        const j = await r.json()
        setHistory(r.ok ? j.data ?? [] : [])
      } catch {
        setHistory([])
      } finally {
        setHistoryLoading(false)
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openHistoryDoc = (h: any) => {
    const label =
      (h.kind === 'creditnote' ? 'Nota de crédito' : h.kind === 'receipt' ? 'Recibo' : 'Fatura') +
      (h.number ? ` ${h.number}` : '')
    setPreviewDirectDoc({ id: h.moloni_document_id, label })
    setPreviewOpen(true)
  }

  return (
    <>
      {/* Factura da agência */}
      <Section icon={Receipt} title="Factura da agência" onSave={handleSaveAgency} saving={savingAgency}>
        <Field label="Número" value={agencyInvNum} onChange={setAgencyInvNum} placeholder="FT 2026/123" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" type="date" value={agencyInvDate} onChange={setAgencyInvDate} />
          <Field label="NIF cliente" value={agencyInvNif} onChange={setAgencyInvNif} placeholder="123456789" />
        </div>
        <Field label="Cliente" value={agencyInvRecipient} onChange={setAgencyInvRecipient} placeholder="Nome do cliente" />
        <Field label="Valor (líquido · s/ IVA)" type="currency" value={agencyInvNet} onChange={setAgencyInvNet} />
        <div className="grid grid-cols-2 gap-3">
          <ReadonlyMoney label={`IVA · ${fmtVat(effectiveVatPct)}`} value={ivaNum} />
          <ReadonlyMoney label="Total ao cliente · c/ IVA" value={grossNum} strong />
        </div>
        <p className="text-[10px] text-muted-foreground">
          IVA de {fmtVat(effectiveVatPct)} (definições financeiras).
          {data.agencyInvoiceVatPct == null
            ? ' Alterar a taxa nas definições aplica-se só a faturas futuras.'
            : ' Taxa com que esta fatura foi emitida.'}
        </p>
      </Section>

      {/* Moloni — emissão da factura fiscal */}
      <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-tight flex items-center gap-1.5">
            <Receipt className="h-3 w-3" />
            Moloni
          </p>
          {moloni.status === 2 ? (
            <Badge variant="outline" className="rounded-full text-[10px] text-rose-700 border-rose-500/30">
              {moloni.creditnoteNumber ? 'Creditada' : 'Anulada'}
            </Badge>
          ) : moloni.status === 1 ? (
            <Badge className="rounded-full text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              Emitida · AT
            </Badge>
          ) : moloni.status === 0 ? (
            <Badge variant="outline" className="rounded-full text-[10px] text-amber-700 border-amber-500/30">
              Rascunho
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">
              Por emitir
            </Badge>
          )}
        </div>

        {moloni.number && (
          <p className="text-[11px] text-muted-foreground">Documento {moloni.number}</p>
        )}

        {data.moloniError && moloni.status !== 1 && (
          <p className="text-[11px] text-red-600 flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            {data.moloniError}
          </p>
        )}

        {/* Por emitir → criar rascunho */}
        {moloni.status === null && (
          <>
            <Button
              size="sm"
              onClick={handleIssueMoloniDraft}
              disabled={moloniBusy !== null || !agencyInvRecipient.trim()}
              className="rounded-full h-8 text-[11px] gap-1.5 w-full"
            >
              {moloniBusy === 'draft' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Emitir rascunho no Moloni
            </Button>
            <p className="text-[10px] text-muted-foreground">
              {agencyInvRecipient.trim()
                ? 'Cria um rascunho eliminável no Moloni. Reportar à AT é um segundo passo, irreversível.'
                : 'Preenche o cliente da factura acima antes de emitir.'}
            </p>
          </>
        )}

        {/* Rascunho → ver, finalizar ou eliminar */}
        {moloni.status === 0 && (
          <div className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setPreviewDirectDoc(null); setPreviewView('invoice'); setPreviewOpen(true) }}
              disabled={moloniBusy !== null}
              className="rounded-full h-8 text-[11px] gap-1.5 w-full"
            >
              <Eye className="h-3 w-3" />
              Ver rascunho
            </Button>
            {confirmFinalize ? (
              <div className="rounded-xl bg-amber-50 ring-1 ring-amber-500/30 p-3 space-y-2">
                <p className="text-[11px] text-amber-800">
                  Vai reportar a factura à Autoridade Tributária. Esta acção é{' '}
                  <strong>irreversível</strong> (só pode ser revertida por nota de crédito).
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleFinalizeMoloni}
                    disabled={moloniBusy !== null}
                    className="rounded-full h-7 text-[11px] gap-1.5 bg-amber-600 hover:bg-amber-700"
                  >
                    {moloniBusy === 'finalize' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                    Confirmar e reportar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmFinalize(false)}
                    disabled={moloniBusy !== null}
                    className="rounded-full h-7 text-[11px]"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => setConfirmFinalize(true)}
                disabled={moloniBusy !== null}
                className="rounded-full h-8 text-[11px] gap-1.5 w-full"
              >
                <ShieldCheck className="h-3 w-3" />
                Finalizar e reportar à AT
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeleteMoloniDraft}
              disabled={moloniBusy !== null}
              className="rounded-full h-7 text-[11px] gap-1.5 w-full text-muted-foreground hover:text-red-600"
            >
              {moloniBusy === 'delete' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Eliminar rascunho
            </Button>
          </div>
        )}

        {/* Emitida (1) ou Creditada/Anulada (2) → ver + acções */}
        {(moloni.status === 1 || moloni.status === 2) && (
          <div className="space-y-2.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setPreviewDirectDoc(null); setPreviewView('invoice'); setPreviewOpen(true) }}
              disabled={moloniBusy !== null}
              className="rounded-full h-8 text-[11px] gap-1.5 w-full"
            >
              <Eye className="h-3 w-3" />
              Ver fatura
            </Button>

            {moloni.status === 2 && (
              <>
                <p className="text-[11px] text-rose-600 flex items-center gap-1.5">
                  <Ban className="h-3 w-3 shrink-0" />
                  {moloni.creditnoteNumber ? `Creditada — nota de crédito ${moloni.creditnoteNumber}` : 'Documento anulado'}
                </p>
                <Button
                  size="sm"
                  onClick={handleReissue}
                  disabled={moloniBusy !== null}
                  className="rounded-full h-8 text-[11px] gap-1.5 w-full"
                >
                  {moloniBusy === 'reissue' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Emitir nova fatura
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Abre um novo ciclo (rascunho → finalizar). A fatura e a nota de crédito anteriores ficam no histórico.
                </p>
              </>
            )}

            {/* Recibo (só para fatura emitida) */}
            {moloni.status === 1 &&
              (moloni.receiptId ? (
                <p className="text-[11px] text-emerald-600 flex items-center gap-1.5">
                  <Coins className="h-3 w-3 shrink-0" />
                  Recibo emitido (paga)
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleIssueReceipt}
                  disabled={moloniBusy !== null}
                  className="rounded-full h-8 text-[11px] gap-1.5 w-full"
                >
                  {moloniBusy === 'receipt' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Coins className="h-3 w-3" />}
                  Emitir recibo (marcar paga)
                </Button>
              ))}

            {/* Enviar por email */}
            <div className="space-y-1.5">
              {moloni.emailedTo && (
                <p className="text-[10px] text-muted-foreground">Enviada para {moloni.emailedTo}</p>
              )}
              {emailOpen ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="email@cliente.pt"
                    className="h-8 rounded-full text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleSendEmail}
                    disabled={moloniBusy !== null || !emailTo.trim()}
                    className="rounded-full h-8 text-[11px] gap-1.5"
                  >
                    {moloniBusy === 'email' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Enviar
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEmailOpen(true)}
                  disabled={moloniBusy !== null}
                  className="rounded-full h-8 text-[11px] gap-1.5 w-full"
                >
                  <Mail className="h-3 w-3" />
                  {moloni.emailedTo ? 'Reenviar por email' : 'Enviar por email'}
                </Button>
              )}
            </div>

            {/* Reverter (só para fatura emitida não revertida) */}
            {moloni.status === 1 && (
              <div className="space-y-2 pt-1 border-t border-border/30">
                {confirmCredit ? (
                  <div className="rounded-xl bg-rose-50 ring-1 ring-rose-500/30 p-3 space-y-2">
                    <p className="text-[11px] text-rose-800">
                      Emitir nota de crédito reverte a fatura na AT (contabilisticamente correcto). Confirmar?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleIssueCreditNote}
                        disabled={moloniBusy !== null}
                        className="rounded-full h-7 text-[11px] gap-1.5 bg-rose-600 hover:bg-rose-700"
                      >
                        {moloniBusy === 'creditnote' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileMinus2 className="h-3 w-3" />}
                        Confirmar nota de crédito
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmCredit(false)}
                        disabled={moloniBusy !== null}
                        className="rounded-full h-7 text-[11px]"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmCredit(true)}
                    disabled={moloniBusy !== null}
                    className="rounded-full h-7 text-[11px] gap-1.5 w-full text-muted-foreground hover:text-rose-600"
                  >
                    <FileMinus2 className="h-3 w-3" />
                    Emitir nota de crédito
                  </Button>
                )}

                {confirmCancel ? (
                  <div className="rounded-xl bg-rose-50 ring-1 ring-rose-500/30 p-3 space-y-2">
                    <p className="text-[11px] text-rose-800">
                      Anular mantém o documento no SAF-T marcado como anulado. Prefira a nota de crédito. Confirmar?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleCancelMoloni}
                        disabled={moloniBusy !== null}
                        className="rounded-full h-7 text-[11px] gap-1.5 bg-rose-600 hover:bg-rose-700"
                      >
                        {moloniBusy === 'cancel' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                        Confirmar anulação
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmCancel(false)}
                        disabled={moloniBusy !== null}
                        className="rounded-full h-7 text-[11px]"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmCancel(true)}
                    disabled={moloniBusy !== null}
                    className="rounded-full h-7 text-[10px] gap-1.5 w-full text-muted-foreground/70 hover:text-rose-600"
                  >
                    <Ban className="h-3 w-3" />
                    Anular documento (sem nota de crédito)
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Histórico Moloni — todos os documentos emitidos para este pagamento */}
        <div className="pt-1">
          <button
            onClick={handleToggleHistory}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <History className="h-3 w-3" />
            Histórico Moloni{!historyOpen && history ? ` (${history.length})` : ''}
          </button>
          {historyOpen && (
            <div className="mt-2 space-y-1.5">
              {historyLoading && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> A carregar…
                </p>
              )}
              {!historyLoading && history && history.length === 0 && (
                <p className="text-[11px] text-muted-foreground">Sem documentos emitidos.</p>
              )}
              {!historyLoading &&
                history?.map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">
                        {h.kind === 'creditnote' ? 'Nota de crédito' : h.kind === 'receipt' ? 'Recibo' : 'Fatura'}
                        {h.number ? ` ${h.number}` : ''}
                      </span>
                      <span className="text-muted-foreground"> · {fmtDate(h.created_at)}</span>
                      {h.moloni_status === 2 && <span className="text-rose-600"> · anulada</span>}
                    </span>
                    <button onClick={() => openHistoryDoc(h)} className="text-primary hover:underline shrink-0">
                      Ver
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Pré-visualização do documento Moloni (rascunho ou fatura) — em sheet */}
      <MoloniDocumentSheet
        paymentId={previewOpen ? paymentId : null}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        initialView={previewView}
        directDocId={previewDirectDoc?.id ?? null}
        directLabel={previewDirectDoc?.label}
      />
    </>
  )
}

// ─── Sub-components (copiados de mapa-row-sheet para manter o painel auto-contido) ──

function Section({
  icon: Icon, title, onSave, saving, children,
}: {
  icon: React.ElementType
  title: string
  onSave: () => void
  saving: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-tight flex items-center gap-1.5">
          <Icon className="h-3 w-3" />
          {title}
        </p>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saving}
          className="rounded-full h-7 text-[11px] gap-1.5"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Guardar
        </Button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function ReadonlyMoney({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </Label>
      <div
        className={cn(
          'h-9 rounded-xl border border-input bg-muted/40 px-3 flex items-center text-sm tabular-nums',
          strong && 'font-semibold',
        )}
      >
        {fmtMoney(value)}
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </Label>
      {type === 'currency' ? (
        <CurrencyInput
          value={value ? Number(value) : null}
          onChange={(v) => onChange(v != null ? String(v) : '')}
          className="h-9 rounded-xl text-sm"
        />
      ) : (
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 rounded-xl text-sm"
        />
      )}
    </div>
  )
}
