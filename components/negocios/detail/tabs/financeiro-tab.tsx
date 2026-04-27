'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DealComplianceTab } from '@/components/financial/deal-compliance-tab'
import { SurveyInviteCard } from '@/components/financial/survey-invite-card'
import { Euro, ExternalLink, Briefcase } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface DealLite {
  id: string
  reference: string | null
  status: string | null
  deal_type: string | null
  deal_value: number | null
  deal_date: string | null
  commission_pct: number | null
  commission_total: number | null
  payment_structure: string | null
  contract_signing_date: string | null
  max_deadline: string | null
}

interface PaymentLite {
  id: string
  payment_moment: string | null
  payment_pct: number | null
  amount: number | null
  network_amount: number | null
  agency_amount: number | null
  consultant_amount: number | null
  is_signed: boolean | null
  is_received: boolean | null
  signed_date: string | null
  received_date: string | null
}

interface FinanceiroTabProps {
  deal: DealLite | null
  payments: PaymentLite[]
}

const MOMENT_LABELS: Record<string, string> = {
  cpcv: 'CPCV',
  escritura: 'Escritura',
  contrato_arrendamento: 'Contrato Arrendamento',
  single: 'Pagamento único',
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return `${Number(n).toLocaleString('pt-PT', { maximumFractionDigits: 2 })} €`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), "d MMM yyyy", { locale: pt })
  } catch {
    return '—'
  }
}

export function FinanceiroTab({ deal, payments }: FinanceiroTabProps) {
  if (!deal) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-8 flex items-start gap-3 animate-in fade-in duration-200">
        <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
          <Euro className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">Sem deal financeiro</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            O lado financeiro aparece quando o negócio é submetido para fecho. Cria um deal e
            submete-o para iniciar a contabilização de pagamentos, splits e compliance.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Deal header */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold">{deal.reference ?? deal.id.slice(0, 8)}</h3>
              {deal.status && (
                <Badge variant="outline" className="text-[10px]">{deal.status}</Badge>
              )}
              {deal.deal_type && (
                <Badge variant="outline" className="text-[10px]">{deal.deal_type}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {fmtMoney(deal.deal_value)} · Comissão {deal.commission_pct ?? 0}% = {fmtMoney(deal.commission_total)}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href={`/dashboard/financeiro/deals/${deal.id}`}>
              <Briefcase className="h-3.5 w-3.5" />
              Página completa do deal
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Payments list */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Cronograma de Pagamentos</h3>
          {payments.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {payments.length} momento{payments.length === 1 ? '' : 's'}
            </Badge>
          )}
        </div>
        {payments.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Sem pagamentos registados.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'rounded-lg border p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs',
                  p.is_received ? 'bg-emerald-50/50 border-emerald-200' :
                  p.is_signed ? 'bg-amber-50/50 border-amber-200' :
                  'bg-card'
                )}
              >
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Momento</p>
                  <p className="font-medium">
                    {MOMENT_LABELS[p.payment_moment ?? ''] ?? p.payment_moment}
                    {p.payment_pct != null && ` · ${Number(p.payment_pct)}%`}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Valor</p>
                  <p className="font-semibold">{fmtMoney(p.amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Assinado</p>
                  <p>{p.is_signed ? `Sim · ${fmtDate(p.signed_date)}` : 'Não'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Recebido</p>
                  <p>{p.is_received ? `Sim · ${fmtDate(p.received_date)}` : 'Não'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compliance + Survey embedded */}
      <DealComplianceTab dealId={deal.id} dealValue={deal.deal_value ?? 0} dealDate={deal.deal_date} />
      <SurveyInviteCard dealId={deal.id} dealStatus={deal.status} />
    </div>
  )
}
