'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  DEAL_SCENARIOS,
  DEAL_STATUSES,
  PAYMENT_STRUCTURES,
  HOUSING_REGIMES,
} from '@/types/deal'
import type { Deal, DealClient, DealScenario, DealStatus, HousingRegime, PaymentStructure } from '@/types/deal'
import { BUSINESS_TYPES } from '@/lib/constants'

function DisplayField({
  label,
  value,
  fullWidth,
  suffix,
}: {
  label: string
  value?: string | number | boolean | null
  fullWidth?: boolean
  suffix?: string
}) {
  let display: string
  if (typeof value === 'boolean') {
    display = value ? 'Sim' : 'Nao'
  } else if (value != null && value !== '' && value !== 0) {
    display = suffix ? `${value} ${suffix}` : String(value)
  } else {
    display = '\u2014'
  }
  return (
    <div className={`rounded-xl border px-4 py-3 ${fullWidth ? 'col-span-full' : ''}`}>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium">{display}</p>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="col-span-full text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pt-2">
      {children}
    </p>
  )
}

interface ProcessDealTabProps {
  deal: Deal
  dealClients: DealClient[]
}

export function ProcessDealTab({ deal, dealClients }: ProcessDealTabProps) {
  const scenarioLabel = DEAL_SCENARIOS[deal.deal_type as DealScenario]?.label ?? deal.deal_type
  const statusInfo = DEAL_STATUSES[deal.status as DealStatus]
  const businessLabel = deal.business_type ? (BUSINESS_TYPES as Record<string, string>)[deal.business_type] ?? deal.business_type : null
  const paymentLabel = PAYMENT_STRUCTURES[deal.payment_structure as PaymentStructure] ?? deal.payment_structure
  const housingLabel = deal.housing_regime ? (HOUSING_REGIMES as Record<string, string>)[deal.housing_regime as HousingRegime] ?? deal.housing_regime : null

  return (
    <Card>
      <CardContent className="pt-4">
        <Tabs defaultValue="geral">
          <div className="overflow-x-auto scrollbar-none -mx-1">
            <TabsList className="bg-muted/50 rounded-full p-1 h-auto gap-0 w-max justify-start">
              <TabsTrigger value="geral" className="rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Info. Geral
              </TabsTrigger>
              <TabsTrigger value="comissao" className="rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Comissao
              </TabsTrigger>
              <TabsTrigger value="condicoes" className="rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Condicoes
              </TabsTrigger>
              {(deal.has_share || deal.partner_agency_name) && (
                <TabsTrigger value="partilha" className="rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Partilha
                </TabsTrigger>
              )}
              {dealClients.length > 0 && (
                <TabsTrigger value="compradores" className="rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Compradores ({dealClients.length})
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* Informacao Geral */}
          <TabsContent value="geral" className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              <DisplayField label="Cenario" value={scenarioLabel} />
              <div className="rounded-xl border px-4 py-3">
                <p className="text-xs text-muted-foreground mb-0.5">Estado</p>
                {statusInfo ? (
                  <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
                ) : (
                  <p className="text-sm font-medium">{deal.status}</p>
                )}
              </div>
              <DisplayField label="Tipo de Negocio" value={businessLabel} />
              <DisplayField label="Valor do Negocio" value={deal.deal_value ? formatCurrency(Number(deal.deal_value)) : null} />
              <DisplayField label="Data do Negocio" value={deal.deal_date ? formatDate(deal.deal_date) : null} />
              <DisplayField label="Referencia" value={deal.reference} />
              <DisplayField label="N.o PV" value={deal.pv_number} />
              <DisplayField label="N.o Minuta RE/MAX" value={deal.remax_draft_number} />
              {deal.consultant && (
                <DisplayField label="Consultor" value={deal.consultant.commercial_name} />
              )}
              {deal.notes && (
                <DisplayField label="Notas" value={deal.notes} fullWidth />
              )}
            </div>
          </TabsContent>

          {/* Comissao */}
          <TabsContent value="comissao" className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              <DisplayField
                label="Comissao"
                value={
                  deal.commission_type === 'percentage'
                    ? `${deal.commission_pct}%`
                    : deal.commission_total ? formatCurrency(Number(deal.commission_total)) : null
                }
              />
              <DisplayField label="Comissao Total" value={deal.commission_total ? formatCurrency(Number(deal.commission_total)) : null} />
              <DisplayField label="Estrutura de Pagamento" value={paymentLabel} />
              {deal.payment_structure === 'split' && (
                <>
                  <DisplayField label="CPCV" value={deal.cpcv_pct} suffix="%" />
                  <DisplayField label="Escritura" value={deal.escritura_pct} suffix="%" />
                </>
              )}

              <SectionHeader>Distribuicao</SectionHeader>
              {deal.consultant_pct != null && <DisplayField label="Consultor (%)" value={deal.consultant_pct} suffix="%" />}
              {deal.consultant_amount != null && <DisplayField label="Consultor (valor)" value={formatCurrency(Number(deal.consultant_amount))} />}
              {deal.network_pct != null && <DisplayField label="Rede (%)" value={deal.network_pct} suffix="%" />}
              {deal.network_amount != null && <DisplayField label="Rede (valor)" value={formatCurrency(Number(deal.network_amount))} />}
              {deal.agency_margin != null && <DisplayField label="Margem Agencia" value={formatCurrency(Number(deal.agency_margin))} />}
              {deal.agency_net != null && <DisplayField label="Agencia Liquido" value={formatCurrency(Number(deal.agency_net))} />}
            </div>
          </TabsContent>

          {/* Condicoes */}
          <TabsContent value="condicoes" className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              <DisplayField label="Sinal / Deposito" value={deal.deposit_value} suffix="\u20AC" />
              <DisplayField label="Data Assinatura Contrato" value={deal.contract_signing_date ? formatDate(deal.contract_signing_date) : null} />
              <DisplayField label="Prazo Maximo" value={deal.max_deadline} suffix="dias" />
              <DisplayField label="Regime Habitacao" value={housingLabel} />
              <DisplayField label="Financiamento" value={deal.has_financing} />
              <DisplayField label="Condicao Financiamento" value={deal.has_financing_condition} />
              <DisplayField label="Fiador" value={deal.has_guarantor} />
              <DisplayField label="Mobilia" value={deal.has_furniture} />
              <DisplayField label="Bilingue" value={deal.is_bilingual} />
              <DisplayField label="Reconhecimento Assinaturas" value={deal.has_signature_recognition} />
              {deal.conditions_notes && (
                <DisplayField label="Notas Condicoes" value={deal.conditions_notes} fullWidth />
              )}
              {deal.extra_info && (
                <DisplayField label="Info Extra" value={deal.extra_info} fullWidth />
              )}
            </div>
          </TabsContent>

          {/* Partilha */}
          {(deal.has_share || deal.partner_agency_name) && (
            <TabsContent value="partilha" className="mt-4">
              <div className="grid grid-cols-2 gap-3">
                <DisplayField label="Tipo de Partilha" value={deal.share_type} />
                <DisplayField label="Percentagem Partilha" value={deal.share_pct} suffix="%" />
                <DisplayField label="Valor Partilha" value={deal.share_amount ? formatCurrency(Number(deal.share_amount)) : null} />
                <DisplayField label="Agencia Parceira" value={deal.partner_agency_name} />
                <DisplayField label="Contacto Parceiro" value={deal.partner_contact} />
                <DisplayField label="Valor Parceiro" value={deal.partner_amount ? formatCurrency(Number(deal.partner_amount)) : null} />
                {deal.share_notes && (
                  <DisplayField label="Notas Partilha" value={deal.share_notes} fullWidth />
                )}

                {/* Consultor externo */}
                {deal.external_consultant_name && (
                  <>
                    <SectionHeader>Consultor Externo</SectionHeader>
                    <DisplayField label="Nome" value={deal.external_consultant_name} />
                    <DisplayField label="Telefone" value={deal.external_consultant_phone} />
                    <DisplayField label="Email" value={deal.external_consultant_email} />
                  </>
                )}
              </div>
            </TabsContent>
          )}

          {/* Compradores */}
          {dealClients.length > 0 && (
            <TabsContent value="compradores" className="mt-4">
              <div className="space-y-3">
                {dealClients.map((client, idx) => (
                  <div key={client.id || idx} className="rounded-xl border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {client.person_type === 'singular' ? 'Pessoa Singular' : 'Pessoa Colectiva'}
                      </Badge>
                      {idx === 0 && (
                        <Badge variant="default" className="text-[10px]">Principal</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <DisplayField label="Nome" value={client.name} />
                      <DisplayField label="Email" value={client.email} />
                      <DisplayField label="Telefone" value={client.phone} />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  )
}
