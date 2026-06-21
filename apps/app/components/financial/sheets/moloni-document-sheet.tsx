'use client'

import { useEffect, useState } from 'react'
import { Loader2, Download, AlertTriangle, Building2, Coins, Mail } from 'lucide-react'
import { FinanceiroSheet } from './financeiro-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

interface MoloniDocData {
  document_id: number
  number: string | null
  status: number | null
  date: string | null
  our_reference: string | null
  entity: { name: string | null; vat: string | null; address: string | null }
  net: number
  taxes: number
  gross: number
  products: Array<{ name: string; qty: number; price: number }>
  pdf_available: boolean
  creditnote_number: string | null
  receipt_id: number | null
  emailed_to: string | null
}

type View = 'invoice' | 'creditnote'

export function MoloniDocumentSheet({
  paymentId,
  open,
  onClose,
  initialView = 'invoice',
  directDocId = null,
  directLabel,
}: {
  paymentId: string | null
  open: boolean
  onClose: () => void
  initialView?: View
  /** Preview a specific historical document by Moloni id (skips the data fetch). */
  directDocId?: number | null
  directLabel?: string
}) {
  const [data, setData] = useState<MoloniDocData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>(initialView)

  const isDirect = !!directDocId

  useEffect(() => {
    if (!open || !paymentId || isDirect) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    setView(initialView)
    fetch(`/api/financial/moloni/deal-payments/${paymentId}/document`)
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j?.error || 'Erro ao carregar o documento')
        return j as MoloniDocData
      })
      .then((j) => !cancelled && setData(j))
      .catch((e) => !cancelled && setError(e?.message ?? 'Erro'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, paymentId, initialView, isDirect])

  const hasCreditNote = !!data?.creditnote_number
  const effectiveView: View = view === 'creditnote' && hasCreditNote ? 'creditnote' : 'invoice'
  const invoicePdfAvailable = !!data?.pdf_available
  const pdfKind = effectiveView === 'creditnote' ? 'creditnote' : 'invoice'
  const pdfSrc = paymentId
    ? `/api/financial/moloni/deal-payments/${paymentId}/pdf?kind=${pdfKind}#toolbar=1&navpanes=0`
    : ''
  // Invoice has a PDF only once finalized; the credit note always does.
  const showPdf = effectiveView === 'creditnote' || invoicePdfAvailable

  const statusLabel =
    data?.status === 2 ? (data.creditnote_number ? 'Creditada' : 'Anulada')
      : data?.status === 1 ? 'Emitida · AT'
      : data?.status === 0 ? 'Rascunho'
      : '—'

  return (
    <FinanceiroSheet
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Documento Moloni"
      size="wide"
      accent={
        <span
          className={cn(
            'inline-flex h-2 w-2 rounded-full',
            data?.status === 1 ? 'bg-emerald-500' : data?.status === 2 ? 'bg-rose-500' : 'bg-amber-500',
          )}
        />
      }
      subtitle={isDirect ? (directLabel ?? `Documento ${directDocId}`) : data?.number ? `Nº ${data.number}` : 'Rascunho (sem número fiscal)'}
    >
      {/* Pré-visualização directa de um documento do histórico */}
      {isDirect && (
        <div className="space-y-2">
          <iframe
            key={directDocId}
            src={`/api/financial/moloni/deal-payments/${paymentId}/pdf?moloni_doc_id=${directDocId}#toolbar=1&navpanes=0`}
            title={directLabel ?? 'Documento'}
            className="w-full h-[62vh] rounded-xl ring-1 ring-border/40 bg-white"
          />
          <a
            href={`/api/financial/moloni/deal-payments/${paymentId}/pdf?moloni_doc_id=${directDocId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-full h-8 text-[11px] w-full ring-1 ring-border/50 hover:bg-muted/50 transition-colors"
          >
            <Download className="h-3 w-3" />
            Descarregar PDF
          </a>
        </div>
      )}

      {!isDirect && loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-2xl ring-1 ring-rose-500/30 bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Estado + toggle Fatura/Nota de crédito */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Badge
              className={cn(
                'rounded-full text-[10px]',
                data.status === 1 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : '',
              )}
              variant={data.status === 1 ? 'default' : 'outline'}
            >
              {statusLabel}
            </Badge>
            {hasCreditNote && (
              <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 border border-border/30">
                <button
                  onClick={() => setView('invoice')}
                  className={cn(
                    'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
                    effectiveView === 'invoice' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-muted-foreground',
                  )}
                >
                  Fatura
                </button>
                <button
                  onClick={() => setView('creditnote')}
                  className={cn(
                    'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
                    effectiveView === 'creditnote' ? 'bg-rose-600 text-white' : 'text-muted-foreground',
                  )}
                >
                  Nota de crédito
                </button>
              </div>
            )}
          </div>

          {/* PDF inline quando existe; senão (rascunho) → dados */}
          {showPdf ? (
            <div className="space-y-2">
              <iframe
                key={pdfKind}
                src={pdfSrc}
                title={effectiveView === 'creditnote' ? 'Nota de crédito' : 'Fatura'}
                className="w-full h-[62vh] rounded-xl ring-1 ring-border/40 bg-white"
              />
              <a
                href={`/api/financial/moloni/deal-payments/${paymentId}/pdf?kind=${pdfKind}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-full h-8 text-[11px] w-full ring-1 ring-border/50 hover:bg-muted/50 transition-colors"
              >
                <Download className="h-3 w-3" />
                Descarregar {effectiveView === 'creditnote' ? 'nota de crédito' : 'fatura'} (PDF)
              </a>
            </div>
          ) : (
            <>
              {/* Rascunho: sem PDF no Moloni → pré-visualização dos dados */}
              <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full p-2 bg-slate-500/10 shrink-0">
                    <Building2 className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium tracking-tight">{data.entity.name ?? '—'}</p>
                    {data.entity.vat && <p className="text-[11px] text-muted-foreground mt-0.5">NIF {data.entity.vat}</p>}
                    {data.entity.address && <p className="text-[11px] text-muted-foreground">{data.entity.address}</p>}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{fmtDate(data.date)}</span>
                </div>
              </div>

              <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4 space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Linhas</p>
                {data.products.length === 0 && <p className="text-sm text-muted-foreground">Sem linhas.</p>}
                {data.products.map((p, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      {p.name}
                      {p.qty !== 1 && <span className="text-muted-foreground"> × {p.qty}</span>}
                    </span>
                    <span className="font-medium tabular-nums shrink-0">{fmt(p.price * p.qty)}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl ring-1 ring-border/40 bg-gradient-to-br from-background/80 to-muted/20 p-4 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Líquido (s/ IVA)</span>
                  <span className="font-medium tabular-nums">{fmt(data.net)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">IVA</span>
                  <span className="font-medium tabular-nums">{fmt(data.taxes)}</span>
                </div>
                <div className="flex items-center justify-between text-base pt-1.5 border-t border-border/40">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold tabular-nums">{fmt(data.gross)}</span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                Os rascunhos não têm PDF no Moloni — finalize para gerar a fatura.
              </p>
            </>
          )}

          {/* Estado adicional */}
          {(data.receipt_id || data.emailed_to) && (
            <div className="space-y-1.5">
              {data.receipt_id != null && (
                <p className="text-[11px] text-emerald-600 flex items-center gap-1.5"><Coins className="h-3 w-3" /> Recibo emitido (paga)</p>
              )}
              {data.emailed_to && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" /> Enviada para {data.emailed_to}</p>
              )}
            </div>
          )}

          {data.our_reference && (
            <p className="text-[10px] text-muted-foreground text-center">Ref. {data.our_reference}</p>
          )}
        </>
      )}
    </FinanceiroSheet>
  )
}
