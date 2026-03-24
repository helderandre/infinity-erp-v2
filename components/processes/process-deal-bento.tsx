'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Handshake } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  DEAL_SCENARIOS,
  DEAL_STATUSES,
  PAYMENT_STRUCTURES,
  HOUSING_REGIMES,
} from '@/types/deal'
import type { Deal, DealClient, DealScenario, DealStatus, HousingRegime, PaymentStructure } from '@/types/deal'
import { BUSINESS_TYPES } from '@/lib/constants'
import type { ProcessDocument } from '@/types/process'
import { DetailRow } from '@/components/shared/detail-row'

interface ProcessDealBentoProps {
  deal: Deal
  dealClients: DealClient[]
  documents: ProcessDocument[]
}

export function ProcessDealBento({ deal }: ProcessDealBentoProps) {
  const scenarioInfo = DEAL_SCENARIOS[deal.deal_type as DealScenario]
  const statusInfo = DEAL_STATUSES[deal.status as DealStatus]
  const businessLabel = deal.business_type ? (BUSINESS_TYPES as Record<string, string>)[deal.business_type] ?? deal.business_type : null
  const paymentLabel = PAYMENT_STRUCTURES[deal.payment_structure as PaymentStructure] ?? deal.payment_structure
  const housingLabel = deal.housing_regime ? (HOUSING_REGIMES as Record<string, string>)[deal.housing_regime as HousingRegime] ?? deal.housing_regime : null

  const boolItems = [
    { label: 'Financiamento', value: deal.has_financing },
    { label: 'Fiador', value: deal.has_guarantor },
    { label: 'Mobília', value: deal.has_furniture },
    { label: 'Bilingue', value: deal.is_bilingual },
    { label: 'Reconhecimento Assinaturas', value: deal.has_signature_recognition },
  ].filter(item => item.value === true)

  return (
    <Card className="overflow-hidden py-0 gap-0">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Handshake className="h-5 w-5 text-muted-foreground" />
            Negócio
          </h3>
          {statusInfo && (
            <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {deal.reference && <span className="text-xs text-muted-foreground">Ref. {deal.reference}</span>}
          {scenarioInfo && <Badge variant="secondary" className="text-[10px]">{scenarioInfo.label}</Badge>}
          {businessLabel && <Badge variant="secondary" className="text-[10px]">{businessLabel}</Badge>}
        </div>
      </div>

      <div className="divide-y">
        {/* Values */}
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Valores</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {deal.deal_value && <DetailRow label="Valor" value={formatCurrency(Number(deal.deal_value))} />}
            {deal.commission_pct != null && (
              <DetailRow label="Comissão" value={deal.commission_type === 'percentage' ? `${deal.commission_pct}%` : formatCurrency(Number(deal.commission_pct))} />
            )}
            {deal.commission_total != null && <DetailRow label="Total Comissão" value={formatCurrency(Number(deal.commission_total))} />}
            {paymentLabel && <DetailRow label="Pagamento" value={paymentLabel} />}
          </div>
          {deal.payment_structure === 'split' && (
            <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <DetailRow label="CPCV" value={`${deal.cpcv_pct}%`} />
              <DetailRow label="Escritura" value={`${deal.escritura_pct}%`} />
            </div>
          )}
        </div>

        {/* Conditions */}
        {(deal.deposit_value || deal.contract_signing_date || deal.max_deadline || housingLabel || boolItems.length > 0) && (
          <div className="px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Condições</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {deal.deposit_value && <DetailRow label="Sinal" value={`${deal.deposit_value}€`} />}
              {deal.contract_signing_date && <DetailRow label="Assinatura" value={formatDate(deal.contract_signing_date)} />}
              {deal.max_deadline && <DetailRow label="Prazo" value={`${deal.max_deadline} dias`} />}
              {housingLabel && <DetailRow label="Regime" value={housingLabel} />}
            </div>
            {boolItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t">
                {boolItems.map((item) => (
                  <Badge key={item.label} variant="secondary" className="text-xs">{item.label}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Share */}
        {deal.has_share && (
          <div className="px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Partilha</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {deal.share_type && <DetailRow label="Tipo" value={deal.share_type} />}
              {deal.share_pct != null && <DetailRow label="Percentagem" value={`${deal.share_pct}%`} />}
              {deal.share_amount != null && <DetailRow label="Valor" value={formatCurrency(Number(deal.share_amount))} />}
              {deal.partner_agency_name && <DetailRow label="Agência" value={deal.partner_agency_name} />}
              {deal.partner_contact && <DetailRow label="Contacto" value={deal.partner_contact} />}
              {deal.partner_amount != null && <DetailRow label="Valor Parceiro" value={formatCurrency(Number(deal.partner_amount))} />}
            </div>
          </div>
        )}

        {/* Notes */}
        {deal.notes && (
          <div className="px-5 py-3">
            <p className="text-xs text-muted-foreground">{deal.notes}</p>
          </div>
        )}
      </div>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
