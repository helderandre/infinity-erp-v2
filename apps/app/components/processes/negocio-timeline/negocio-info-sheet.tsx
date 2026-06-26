'use client'

import { Wallet, Percent, Coins, FileSignature, Banknote, Handshake, Network, Building2 } from 'lucide-react'
import { FinanceiroSheet } from '@/components/financial/sheets/financeiro-sheet'
import { cn } from '@/lib/utils'
import { DEAL_SCENARIOS, BUSINESS_TYPES, PAYMENT_MOMENTS } from '@/types/deal'

/* eslint-disable @typescript-eslint/no-explicit-any */

const fmtEUR = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null

interface Payment {
  id?: string
  payment_moment: string
  payment_pct?: number | null
  amount?: number | null
  network_amount?: number | null
  agency_amount?: number | null
  partner_amount?: number | null
  is_signed?: boolean | null
  signed_date?: string | null
  is_received?: boolean | null
  received_date?: string | null
}

interface DealLike {
  id: string
  reference?: string | null
  pv_number?: string | null
  status?: string | null
  deal_type?: string | null
  business_type?: string | null
  deal_value?: number | null
  commission_pct?: number | null
  commission_total?: number | null
  cpcv_pct?: number | null
  escritura_pct?: number | null
  partner_agency_name?: string | null
  partner_agency_nif?: string | null
  payments?: Payment[]
}

const MOMENT_ORDER: Record<string, number> = { cpcv: 0, escritura: 1, single: 2 }

/**
 * Sheet read-only com a informação de fecho do negócio (comissão de fecho,
 * cenário, tranches e cronograma de pagamentos com estado assinado/recebido).
 * Aberto a partir da página do imóvel — espelha os dados que o consultor vê na
 * página de Fecho de Negócio, sem sair do imóvel. Recebe o `deal` já carregado
 * (de `/api/deals?property_id=`), por isso abre instantâneo (sem fetch).
 */
export function NegocioInfoSheet({
  deal,
  open,
  onClose,
}: {
  deal: DealLike | null
  open: boolean
  onClose: () => void
}) {
  if (!deal) {
    return (
      <FinanceiroSheet open={false} onOpenChange={() => {}} title="">
        <div />
      </FinanceiroSheet>
    )
  }

  const scenario = deal.deal_type ? DEAL_SCENARIOS[deal.deal_type as keyof typeof DEAL_SCENARIOS] : undefined
  const businessLabel = deal.business_type
    ? BUSINESS_TYPES[deal.business_type as keyof typeof BUSINESS_TYPES] ?? deal.business_type
    : null
  const commissionTotal =
    deal.commission_total ??
    (deal.deal_value != null && deal.commission_pct != null
      ? (Number(deal.deal_value) * Number(deal.commission_pct)) / 100
      : null)

  const payments = [...(deal.payments ?? [])].sort(
    (a, b) => (MOMENT_ORDER[a.payment_moment] ?? 9) - (MOMENT_ORDER[b.payment_moment] ?? 9),
  )

  const reference = deal.reference || deal.pv_number || `Negócio ${deal.id.slice(0, 8)}`

  return (
    <FinanceiroSheet
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Informação do negócio"
      accent={<Banknote className="h-4 w-4 text-emerald-600" />}
      subtitle={
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span>{reference}</span>
          {scenario && (
            <>
              <span className="text-muted-foreground/60">·</span>
              <span>{scenario.label}</span>
            </>
          )}
          {businessLabel && (
            <>
              <span className="text-muted-foreground/60">·</span>
              <span>{businessLabel}</span>
            </>
          )}
        </span>
      }
      footer={null}
    >
      {/* Comissão de fecho — o headline */}
      <div className="grid gap-3 grid-cols-3">
        <Tile label="Valor do negócio" value={fmtEUR(deal.deal_value)} tone="slate" icon={Wallet} />
        <Tile
          label="% comissão"
          value={deal.commission_pct != null ? `${Number(deal.commission_pct)}%` : '—'}
          tone="indigo"
          icon={Percent}
        />
        <Tile label="Comissão de fecho" value={fmtEUR(commissionTotal)} tone="emerald" icon={Coins} />
      </div>

      {/* Tranches */}
      {(deal.cpcv_pct != null || deal.escritura_pct != null) && (
        <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Tranches</p>
          <div className="flex items-center gap-4 text-sm">
            <span>CPCV <strong className="tabular-nums">{deal.cpcv_pct != null ? `${Number(deal.cpcv_pct)}%` : '—'}</strong></span>
            <span className="text-muted-foreground/40">·</span>
            <span>Escritura <strong className="tabular-nums">{deal.escritura_pct != null ? `${Number(deal.escritura_pct)}%` : '—'}</strong></span>
          </div>
        </div>
      )}

      {/* Cronograma de pagamentos */}
      {payments.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1">
            Pagamentos
          </p>
          {payments.map((p, i) => {
            const momentLabel = PAYMENT_MOMENTS[p.payment_moment as keyof typeof PAYMENT_MOMENTS] ?? p.payment_moment
            const signedDate = fmtDate(p.signed_date)
            const receivedDate = fmtDate(p.received_date)
            return (
              <div key={p.id ?? i} className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4 space-y-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold tracking-tight">
                    {momentLabel}
                    {p.payment_pct != null && (
                      <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{Number(p.payment_pct)}%</span>
                    )}
                  </p>
                  <span className="text-base font-semibold tabular-nums">{fmtEUR(p.amount)}</span>
                </div>

                {/* Estado assinado/recebido */}
                <div className="flex items-center gap-2 flex-wrap">
                  <StateChip on={!!p.is_signed} icon={FileSignature} label="Assinado" date={signedDate} />
                  <StateChip on={!!p.is_received} icon={Banknote} label="Recebido" date={receivedDate} />
                </div>

                {/* Repartição deal-level (quando definida) */}
                {((p.network_amount ?? 0) > 0 || (p.agency_amount ?? 0) > 0 || (p.partner_amount ?? 0) > 0) && (
                  <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-border/30 text-[11px] text-muted-foreground">
                    {(p.network_amount ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1"><Network className="h-3 w-3" />Rede {fmtEUR(p.network_amount)}</span>
                    )}
                    {(p.agency_amount ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3" />Agência {fmtEUR(p.agency_amount)}</span>
                    )}
                    {(p.partner_amount ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1"><Handshake className="h-3 w-3" />Parceira {fmtEUR(p.partner_amount)}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Agência parceira */}
      {deal.partner_agency_name && (
        <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
            <Building2 className="h-3 w-3" />
            Agência parceira
          </p>
          <p className="text-sm font-medium">{deal.partner_agency_name}</p>
          {deal.partner_agency_nif && (
            <p className="text-[11px] text-muted-foreground mt-0.5">NIF {deal.partner_agency_nif}</p>
          )}
        </div>
      )}
    </FinanceiroSheet>
  )
}

function StateChip({
  on, icon: Icon, label, date,
}: {
  on: boolean
  icon: React.ElementType
  label: string
  date: string | null
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium',
        on
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
          : 'bg-muted text-muted-foreground',
      )}
    >
      <Icon className="h-3 w-3" />
      {label}{on && date ? ` · ${date}` : on ? '' : ' · —'}
    </span>
  )
}

function Tile({
  label, value, tone, icon: Icon,
}: {
  label: string
  value: string
  tone: 'slate' | 'indigo' | 'emerald'
  icon: React.ElementType
}) {
  const map = {
    slate: { from: 'from-slate-500/10', accent: 'bg-slate-400/40', text: 'text-slate-600' },
    indigo: { from: 'from-indigo-500/15', accent: 'bg-indigo-500/60', text: 'text-indigo-600' },
    emerald: { from: 'from-emerald-500/15', accent: 'bg-emerald-500/60', text: 'text-emerald-600' },
  }[tone]
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-br to-transparent ring-1 ring-border/40 p-3', map.from)}>
      <span className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full', map.accent)} />
      <p className="text-[10px] text-muted-foreground font-medium leading-tight flex items-center gap-1">
        <Icon className={cn('h-3 w-3 shrink-0', map.text)} />
        <span className="truncate">{label}</span>
      </p>
      <p className="text-sm font-semibold tracking-tight tabular-nums truncate mt-1">{value}</p>
    </div>
  )
}
