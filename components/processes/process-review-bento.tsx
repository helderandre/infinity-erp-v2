'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Building2,
  MapPin,
  Users,
  FileText,
  BedDouble,
  Bath,
  Maximize,
  Car,
  Calendar,
  Layers,
  Euro,
  Shield,
  Phone,
  Mail,
  Building,
} from 'lucide-react'
import {
  formatCurrency,
  formatArea,
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES,
  CONTRACT_REGIMES,
} from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { ProcessInstance, ProcessOwner, ProcessDocument, PropertyInternal } from '@/types/process'

interface ProcessReviewBentoProps {
  process: ProcessInstance
  property: NonNullable<ProcessInstance['property']>
  owners: ProcessOwner[]
  documents: ProcessDocument[]
}

export function ProcessReviewBento({
  process,
  property,
  owners,
  documents,
}: ProcessReviewBentoProps) {
  const specs = property.specs
  const internal = property.internal

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Imóvel Hero ── */}
      <PropertyHeroCard property={property} />

      {/* ── Localização + Mapa (row-span-2) ── */}
      <LocationMapCard property={property} className="lg:row-span-2" />

      {/* ── Preço + Specs side by side ── */}
      <div className="grid grid-cols-2 gap-4">
        <PriceCard property={property} />
        <SpecsCard specs={specs} />
      </div>

      {/* ── Proprietários ── */}
      <OwnersCard owners={owners} />

      {/* ── Dados Internos ── */}
      {internal && <InternalDataCard internal={internal} />}

      {/* ── Documentos ── */}
      <DocumentsCard documents={documents} />
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// PropertyHeroCard
// ────────────────────────────────────────────────────────────
function PropertyHeroCard({ property }: { property: NonNullable<ProcessInstance['property']> }) {
  const propertyType = PROPERTY_TYPES[property.property_type as keyof typeof PROPERTY_TYPES] || property.property_type
  const businessType = BUSINESS_TYPES[property.business_type as keyof typeof BUSINESS_TYPES] || property.business_type
  const condition = PROPERTY_CONDITIONS[property.property_condition as keyof typeof PROPERTY_CONDITIONS] || property.property_condition
  const energy = ENERGY_CERTIFICATES[property.energy_certificate as keyof typeof ENERGY_CERTIFICATES] || property.energy_certificate

  return (
    <Card className="overflow-hidden">
      {/* Cover image */}
      {property.cover_url ? (
        <div className="relative h-48 w-full overflow-hidden">
          <img
            src={property.cover_url}
            alt={property.title || 'Imóvel'}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <h3 className="text-lg font-semibold text-white line-clamp-1">
              {property.title}
            </h3>
            {property.external_ref && (
              <p className="text-xs text-white/70">Ref. {property.external_ref}</p>
            )}
          </div>
          <div className="absolute top-3 right-3">
            <StatusBadge status={property.status || 'pending_approval'} type="property" />
          </div>
        </div>
      ) : (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {property.title || 'Imóvel'}
            </CardTitle>
            <StatusBadge status={property.status || 'pending_approval'} type="property" />
          </div>
          {property.external_ref && (
            <p className="text-xs text-muted-foreground">Ref. {property.external_ref}</p>
          )}
        </CardHeader>
      )}

      <CardContent className={property.cover_url ? 'pt-4' : 'pt-0'}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <DetailRow label="Tipo" value={propertyType} />
          <DetailRow label="Negócio" value={businessType} />
          <DetailRow label="Condição" value={condition} />
          <DetailRow
            label="Certificado"
            value={
              energy ? (
                <Badge variant="outline" className="text-xs font-medium">
                  {energy}
                </Badge>
              ) : null
            }
          />
        </div>
        {property.description && (
          typeof property.description === 'string' && property.description.startsWith('<') ? (
            <div
              className="mt-3 text-xs text-muted-foreground line-clamp-3 border-t pt-3 prose prose-sm max-w-none [&_p]:my-0 [&_ul]:my-0 [&_ol]:my-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0"
              dangerouslySetInnerHTML={{ __html: property.description }}
            />
          ) : (
            <p className="mt-3 text-xs text-muted-foreground line-clamp-3 border-t pt-3">
              {property.description}
            </p>
          )
        )}
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// LocationMapCard
// ────────────────────────────────────────────────────────────
function LocationMapCard({
  property,
  className,
}: {
  property: NonNullable<ProcessInstance['property']>
  className?: string
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const hasCoords = property.latitude != null && property.longitude != null

  useEffect(() => {
    if (!hasCoords || !mapContainerRef.current) return

    let map: any = null

    const initMap = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!

      map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [property.longitude!, property.latitude!],
        zoom: 15,
        interactive: false,
      })

      new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat([property.longitude!, property.latitude!])
        .addTo(map)

      mapRef.current = map
    }

    initMap()
    return () => {
      map?.remove()
      mapRef.current = null
    }
  }, [hasCoords, property.latitude, property.longitude])

  return (
    <Card className={`overflow-hidden ${className || ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Localização
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mapa */}
        {hasCoords ? (
          <div
            ref={mapContainerRef}
            className="h-[220px] rounded-lg overflow-hidden border"
          />
        ) : (
          <div className="h-[220px] rounded-lg border bg-muted/30 flex flex-col items-center justify-center text-muted-foreground">
            <MapPin className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Sem coordenadas</p>
          </div>
        )}

        {/* Detalhes de morada */}
        <div className="space-y-2 text-sm">
          {property.address_street && (
            <DetailRow label="Morada" value={property.address_street} />
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <DetailRow label="Código Postal" value={property.postal_code} />
            <DetailRow label="Cidade" value={property.city} />
            <DetailRow label="Zona" value={property.zone} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// PriceCard
// ────────────────────────────────────────────────────────────
function PriceCard({ property }: { property: NonNullable<ProcessInstance['property']> }) {
  const businessType = BUSINESS_TYPES[property.business_type as keyof typeof BUSINESS_TYPES] || property.business_type

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center h-full py-6 text-center">
        <Euro className="h-5 w-5 text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Preço</p>
        <p className="text-2xl font-bold tabular-nums">
          {property.listing_price ? formatCurrency(property.listing_price) : '—'}
        </p>
        {businessType && (
          <Badge variant="secondary" className="mt-2 text-xs">
            {businessType}
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// SpecsCard
// ────────────────────────────────────────────────────────────
function SpecsCard({ specs }: { specs: NonNullable<ProcessInstance['property']>['specs'] }) {
  if (!specs) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-full py-6 text-center text-muted-foreground">
          <Layers className="h-5 w-5 mb-2 opacity-40" />
          <p className="text-sm">Sem especificações</p>
        </CardContent>
      </Card>
    )
  }

  const items = [
    { icon: Layers, label: 'Tipologia', value: specs.typology },
    { icon: BedDouble, label: 'Quartos', value: specs.bedrooms },
    { icon: Bath, label: 'WC', value: specs.bathrooms },
    { icon: Maximize, label: 'Área', value: specs.area_gross ? formatArea(specs.area_gross) : null },
    { icon: Car, label: 'Parking', value: specs.parking_spaces },
    { icon: Calendar, label: 'Ano', value: specs.construction_year },
  ].filter(item => item.value != null)

  return (
    <Card>
      <CardContent className="py-4">
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
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// OwnersCard
// ────────────────────────────────────────────────────────────
function OwnersCard({ owners }: { owners: ProcessOwner[] }) {
  if (!owners || owners.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Proprietários
          <Badge variant="secondary" className="ml-auto text-xs">{owners.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {owners.map((owner) => (
            <div
              key={owner.id}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {owner.person_type === 'coletiva' ? (
                    <Building className="h-4 w-4" />
                  ) : (
                    owner.name?.slice(0, 2).toUpperCase()
                  )}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{owner.name}</p>
                  {owner.is_main_contact && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0">
                      Principal
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                  {owner.nif && <span>NIF: {owner.nif}</span>}
                  <span>
                    {owner.person_type === 'singular' ? 'Pessoa Singular' : 'Pessoa Colectiva'}
                  </span>
                  <span className="font-medium text-foreground">
                    {owner.ownership_percentage}%
                  </span>
                </div>
                {(owner.email || owner.phone) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                    {owner.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {owner.email}
                      </span>
                    )}
                    {owner.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {owner.phone}
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
// InternalDataCard
// ────────────────────────────────────────────────────────────
function InternalDataCard({ internal }: { internal: PropertyInternal }) {

  const regime = CONTRACT_REGIMES[internal.contract_regime as keyof typeof CONTRACT_REGIMES] || internal.contract_regime
  const hasData = internal.commission_agreed || internal.imi_value || internal.condominium_fee || internal.contract_regime

  if (!hasData) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          Dados Internos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {internal.commission_agreed != null && (
            <DetailRow
              label="Comissão"
              value={
                internal.commission_type === 'percentage'
                  ? `${internal.commission_agreed}%`
                  : formatCurrency(internal.commission_agreed)
              }
            />
          )}
          {regime && <DetailRow label="Regime" value={regime} />}
          {internal.contract_term && <DetailRow label="Prazo" value={internal.contract_term} />}
          {internal.contract_expiry && (
            <DetailRow label="Validade" value={formatDate(internal.contract_expiry)} />
          )}
          {internal.imi_value != null && (
            <DetailRow label="IMI" value={formatCurrency(internal.imi_value)} />
          )}
          {internal.condominium_fee != null && (
            <DetailRow label="Condomínio" value={formatCurrency(internal.condominium_fee)} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// DocumentsCard
// ────────────────────────────────────────────────────────────
function DocumentsCard({ documents }: { documents: ProcessDocument[] }) {
  // Agrupar por categoria
  const categories = documents.reduce<Record<string, number>>((acc, doc) => {
    const cat = doc.doc_type?.category || 'Outros'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})

  return (
    <Card>
      <CardHeader className="pb-3">
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
            {/* Badges por categoria */}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(categories).map(([cat, count]) => (
                <Badge key={cat} variant="outline" className="text-xs">
                  {cat} ({count})
                </Badge>
              ))}
            </div>
            {/* Lista resumida */}
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
