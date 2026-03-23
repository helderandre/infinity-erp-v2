'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Handshake,
  Euro,
  Users,
  FileText,
  Phone,
  Mail,
  CalendarDays,
  CreditCard,
  Building,
  Percent,
} from 'lucide-react'
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

interface ProcessDealBentoProps {
  deal: Deal
  dealClients: DealClient[]
  documents: ProcessDocument[]
}

export function ProcessDealBento({ deal }: ProcessDealBentoProps) {
  return (
    <div className="columns-1 lg:columns-2 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
      <DealHeroCard deal={deal} />
      <DealValuesCard deal={deal} />
      <DealConditionsCard deal={deal} />
      {deal.has_share && <DealShareCard deal={deal} />}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// DealHeroCard
// ────────────────────────────────────────────────────────────
function DealHeroCard({ deal }: { deal: Deal }) {
  const scenarioInfo = DEAL_SCENARIOS[deal.deal_type as DealScenario]
  const statusInfo = DEAL_STATUSES[deal.status as DealStatus]
  const businessLabel = deal.business_type ? (BUSINESS_TYPES as Record<string, string>)[deal.business_type] ?? deal.business_type : null

  return (
    <Card className="overflow-hidden py-0 gap-0">
      <div className="px-4 pt-4 pb-1">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium flex items-center gap-2">
            <Handshake className="h-4 w-4 text-muted-foreground" />
            Negocio
          </h3>
          {statusInfo && (
            <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
          )}
        </div>
        {deal.reference && (
          <p className="text-xs text-muted-foreground mt-1">Ref. {deal.reference}</p>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <DetailRow label="Cenario" value={scenarioInfo?.label ?? deal.deal_type} />
          {businessLabel && <DetailRow label="Tipo" value={businessLabel} />}
          <DetailRow label="Data" value={deal.deal_date ? formatDate(deal.deal_date) : null} />
          {deal.consultant && <DetailRow label="Consultor" value={deal.consultant.commercial_name} />}
          {deal.pv_number && <DetailRow label="N.o PV" value={deal.pv_number} />}
          {deal.remax_draft_number && <DetailRow label="Minuta" value={deal.remax_draft_number} />}
        </div>
        {deal.notes && (
          <p className="text-xs text-muted-foreground line-clamp-3 border-t pt-3">
            {deal.notes}
          </p>
        )}
      </div>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// DealValuesCard
// ────────────────────────────────────────────────────────────
function DealValuesCard({ deal }: { deal: Deal }) {
  const paymentLabel = PAYMENT_STRUCTURES[deal.payment_structure as PaymentStructure] ?? deal.payment_structure

  const items = [
    { icon: Euro, label: 'Valor', value: deal.deal_value ? formatCurrency(Number(deal.deal_value)) : null },
    { icon: Percent, label: 'Comissao', value: deal.commission_type === 'percentage' ? `${deal.commission_pct}%` : null },
    { icon: CreditCard, label: 'Total Comissao', value: deal.commission_total ? formatCurrency(Number(deal.commission_total)) : null },
    { icon: CalendarDays, label: 'Pagamento', value: paymentLabel },
  ].filter(item => item.value != null)

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="rounded-md bg-muted/50 p-1.5">
                <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">{item.label}</p>
                <p className="text-sm font-semibold">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        {deal.payment_structure === 'split' && (
          <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <DetailRow label="CPCV" value={`${deal.cpcv_pct}%`} />
            <DetailRow label="Escritura" value={`${deal.escritura_pct}%`} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// DealClientsCard (Compradores)
// ────────────────────────────────────────────────────────────
function DealClientsCard({ clients }: { clients: DealClient[] }) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Compradores
          <Badge variant="secondary" className="ml-auto text-xs">{clients.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {clients.map((client, idx) => (
            <div
              key={client.id || idx}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {client.person_type === 'coletiva' ? (
                    <Building className="h-4 w-4" />
                  ) : (
                    client.name?.slice(0, 2).toUpperCase()
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{client.name}</p>
                  {idx === 0 && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0">
                      Principal
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                  <span>
                    {client.person_type === 'singular' ? 'Pessoa Singular' : 'Pessoa Colectiva'}
                  </span>
                </div>
                {(client.email || client.phone) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                    {client.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </span>
                    )}
                    {client.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// DealConditionsCard
// ────────────────────────────────────────────────────────────
function DealConditionsCard({ deal }: { deal: Deal }) {
  const housingLabel = deal.housing_regime ? (HOUSING_REGIMES as Record<string, string>)[deal.housing_regime as HousingRegime] ?? deal.housing_regime : null

  const boolItems = [
    { label: 'Financiamento', value: deal.has_financing },
    { label: 'Fiador', value: deal.has_guarantor },
    { label: 'Mobilia', value: deal.has_furniture },
    { label: 'Bilingue', value: deal.is_bilingual },
    { label: 'Reconhecimento Assinaturas', value: deal.has_signature_recognition },
  ].filter(item => item.value === true)

  const hasAny = deal.deposit_value || deal.contract_signing_date || deal.max_deadline || housingLabel || boolItems.length > 0

  if (!hasAny) return null

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Condicoes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {deal.deposit_value && <DetailRow label="Sinal" value={`${deal.deposit_value}\u20AC`} />}
          {deal.contract_signing_date && <DetailRow label="Assinatura" value={formatDate(deal.contract_signing_date)} />}
          {deal.max_deadline && <DetailRow label="Prazo" value={`${deal.max_deadline} dias`} />}
          {housingLabel && <DetailRow label="Regime" value={housingLabel} />}
        </div>
        {boolItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t">
            {boolItems.map((item) => (
              <Badge key={item.label} variant="secondary" className="text-xs">
                {item.label}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// DealShareCard
// ────────────────────────────────────────────────────────────
function DealShareCard({ deal }: { deal: Deal }) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Handshake className="h-4 w-4 text-muted-foreground" />
          Partilha
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {deal.share_type && <DetailRow label="Tipo" value={deal.share_type} />}
          {deal.share_pct != null && <DetailRow label="Percentagem" value={`${deal.share_pct}%`} />}
          {deal.share_amount != null && <DetailRow label="Valor" value={formatCurrency(Number(deal.share_amount))} />}
          {deal.partner_agency_name && <DetailRow label="Agencia" value={deal.partner_agency_name} />}
          {deal.partner_contact && <DetailRow label="Contacto" value={deal.partner_contact} />}
          {deal.partner_amount != null && <DetailRow label="Valor Parceiro" value={formatCurrency(Number(deal.partner_amount))} />}
        </div>
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// DocumentsCard
// ────────────────────────────────────────────────────────────
function DocumentsCard({ documents }: { documents: ProcessDocument[] }) {
  const categories = documents.reduce<Record<string, number>>((acc, doc) => {
    const cat = doc.doc_type?.category || 'Outros'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Documentos
          <Badge variant="secondary" className="ml-auto text-xs">{documents.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum documento anexado
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(categories).map(([cat, count]) => (
                <Badge key={cat} variant="outline" className="text-xs">
                  {cat} ({count})
                </Badge>
              ))}
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 text-xs py-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate">{doc.file_name}</span>
                  <span className="ml-auto shrink-0 text-[10px]">
                    {doc.doc_type?.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode | string | number | null | undefined
}) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
