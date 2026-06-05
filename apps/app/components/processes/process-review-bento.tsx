'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel'
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
import { DetailRow } from '@/components/shared/detail-row'

interface ProcessReviewBentoProps {
  process: ProcessInstance
  property: NonNullable<ProcessInstance['property']>
  owners: ProcessOwner[]
  documents: ProcessDocument[]
}

export function ProcessReviewBento({
  property,
}: ProcessReviewBentoProps) {
  const specs = property.specs
  const internal = property.internal
  const propertyType = PROPERTY_TYPES[property.property_type as keyof typeof PROPERTY_TYPES] || property.property_type
  const businessType = BUSINESS_TYPES[property.business_type as keyof typeof BUSINESS_TYPES] || property.business_type
  const condition = PROPERTY_CONDITIONS[property.property_condition as keyof typeof PROPERTY_CONDITIONS] || property.property_condition
  const energy = ENERGY_CERTIFICATES[property.energy_certificate as keyof typeof ENERGY_CERTIFICATES] || property.energy_certificate
  const regime = internal ? (CONTRACT_REGIMES[internal.contract_regime as keyof typeof CONTRACT_REGIMES] || internal.contract_regime) : null

  const specItems = specs ? [
    { icon: Layers, label: 'Tipologia', value: specs.typology },
    { icon: BedDouble, label: 'Quartos', value: specs.bedrooms },
    { icon: Bath, label: 'WC', value: specs.bathrooms },
    { icon: Maximize, label: 'Área', value: specs.area_gross ? formatArea(specs.area_gross) : null },
    { icon: Car, label: 'Parking', value: specs.parking_spaces },
    { icon: Calendar, label: 'Ano', value: specs.construction_year },
  ].filter(item => item.value != null) : []

  // Images sorted: cover first
  const images = (property.media || [])
    .filter((m) => m.media_type === 'image')
    .sort((a, b) => {
      if (a.is_cover && !b.is_cover) return -1
      if (!a.is_cover && b.is_cover) return 1
      return a.order_index - b.order_index
    })
  const coverUrl = images[0]?.url

  return (
    <Card className="overflow-hidden py-0 gap-0">
      {/* Hero image + overlay */}
      {coverUrl ? (
        <div className="relative h-48 w-full">
          <img src={coverUrl} alt={property.title} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white text-lg font-bold leading-tight">{property.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              {propertyType && <Badge className="bg-white/20 text-white border-0 text-[10px]">{propertyType}</Badge>}
              {businessType && <Badge className="bg-white/20 text-white border-0 text-[10px]">{businessType}</Badge>}
              {property.listing_price && (
                <span className="text-white/90 text-sm font-bold ml-auto">{formatCurrency(property.listing_price)}</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-lg font-bold">{property.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            {propertyType && <Badge variant="secondary" className="text-[10px]">{propertyType}</Badge>}
            {businessType && <Badge variant="secondary" className="text-[10px]">{businessType}</Badge>}
            {property.listing_price && (
              <span className="text-sm font-bold ml-auto">{formatCurrency(property.listing_price)}</span>
            )}
          </div>
        </div>
      )}

      <div className="divide-y">
        {/* Location */}
        {(property.address_street || property.city) && (
          <div className="px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Localização</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {property.address_street && <DetailRow label="Morada" value={property.address_street} />}
              {property.postal_code && <DetailRow label="Código Postal" value={property.postal_code} />}
              {property.city && <DetailRow label="Cidade" value={property.city} />}
              {property.zone && <DetailRow label="Zona" value={property.zone} />}
            </div>
          </div>
        )}

        {/* Specs */}
        {specItems.length > 0 && (
          <div className="px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Especificações</p>
            <div className="grid grid-cols-3 gap-3">
              {specItems.map((item) => (
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
          </div>
        )}

        {/* Details row */}
        {(condition || energy) && (
          <div className="px-5 py-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {condition && <DetailRow label="Condição" value={condition} />}
              {energy && <DetailRow label="Certificado" value={energy} />}
            </div>
          </div>
        )}

        {/* Contract / Internal */}
        {internal && (internal.commission_agreed != null || regime || internal.imi_value != null) && (
          <div className="px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contrato</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {internal.commission_agreed != null && (
                <DetailRow
                  label="Comissão"
                  value={internal.commission_type === 'percentage' ? `${internal.commission_agreed}%` : formatCurrency(internal.commission_agreed)}
                />
              )}
              {regime && <DetailRow label="Regime" value={regime} />}
              {internal.contract_term && <DetailRow label="Prazo" value={internal.contract_term} />}
              {internal.contract_expiry && <DetailRow label="Validade" value={formatDate(internal.contract_expiry)} />}
              {internal.imi_value != null && <DetailRow label="IMI" value={formatCurrency(internal.imi_value)} />}
              {internal.condominium_fee != null && <DetailRow label="Condomínio" value={formatCurrency(internal.condominium_fee)} />}
            </div>
          </div>
        )}
      </div>
    </Card>
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

  // Ordenar imagens por order_index, cover primeiro
  const images = (property.media || [])
    .filter((m) => m.media_type === 'image')
    .sort((a, b) => {
      if (a.is_cover && !b.is_cover) return -1
      if (!a.is_cover && b.is_cover) return 1
      return a.order_index - b.order_index
    })

  const hasImages = images.length > 0
  const hasMultipleImages = images.length > 1

  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0)

  const onSelect = useCallback(() => {
    if (!carouselApi) return
    setCurrentSlide(carouselApi.selectedScrollSnap())
  }, [carouselApi])

  useEffect(() => {
    if (!carouselApi) return
    onSelect()
    carouselApi.on('select', onSelect)
    return () => { carouselApi.off('select', onSelect) }
  }, [carouselApi, onSelect])

  return (
    <Card className="overflow-hidden py-0 gap-0">
      {/* Imagens — carousel quando >1, imagem simples quando =1, fallback header quando 0 */}
      {hasImages ? (
        <div className="relative w-full">
          {hasMultipleImages ? (
            <Carousel
              opts={{ loop: true }}
              setApi={setCarouselApi}
              className="w-full"
            >
              <CarouselContent className="ml-0">
                {images.map((img, idx) => (
                  <CarouselItem key={img.id} className="pl-0">
                    <div className="relative h-48 w-full">
                      <img
                        src={img.url}
                        alt={`${property.title || 'Imóvel'} — foto ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>

              {/* Dot indicators */}
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => carouselApi?.scrollTo(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentSlide
                        ? 'w-4 bg-white'
                        : 'w-1.5 bg-white/50 hover:bg-white/70'
                    }`}
                    aria-label={`Ir para imagem ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Counter badge */}
              <div className="absolute top-3 left-3 z-10">
                <Badge variant="secondary" className="bg-black/50 text-white border-0 text-[10px] backdrop-blur-sm">
                  {currentSlide + 1} / {images.length}
                </Badge>
              </div>
            </Carousel>
          ) : (
            <div className="relative h-48 w-full">
              <img
                src={images[0].url}
                alt={property.title || 'Imóvel'}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {/* Overlay gradient para a cor do card */}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent pointer-events-none" />
          <div className="absolute bottom-3 left-4 right-4 z-10">
            <h3 className="text-lg font-semibold text-foreground line-clamp-1">
              {property.title}
            </h3>
            {property.external_ref && (
              <p className="text-xs text-muted-foreground">Ref. {property.external_ref}</p>
            )}
          </div>
          <div className="absolute top-3 right-3 z-10">
            <StatusBadge status={property.status || 'pending_approval'} type="property" />
          </div>
        </div>
      ) : (
        <div className="px-4 pt-4 pb-1">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {property.title || 'Imóvel'}
            </h3>
            <StatusBadge status={property.status || 'pending_approval'} type="property" />
          </div>
          {property.external_ref && (
            <p className="text-xs text-muted-foreground mt-1">Ref. {property.external_ref}</p>
          )}
        </div>
      )}

      <div className="p-4 space-y-3">
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
              className="text-xs text-muted-foreground line-clamp-3 border-t pt-3 prose prose-sm max-w-none [&_p]:my-0 [&_ul]:my-0 [&_ol]:my-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0"
              dangerouslySetInnerHTML={{ __html: property.description }}
            />
          ) : (
            <p className="text-xs text-muted-foreground line-clamp-3 border-t pt-3">
              {property.description}
            </p>
          )
        )}
      </div>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────
// LocationMapCard
// ────────────────────────────────────────────────────────────
function LocationMapCard({
  property,
}: {
  property: NonNullable<ProcessInstance['property']>
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
    <Card className="overflow-hidden py-0 gap-0">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h3 className="text-base font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Localização
        </h3>
      </div>

      {/* Mapa — com padding lateral e border radius */}
      {hasCoords ? (
        <div className="px-4">
          <div
            ref={mapContainerRef}
            className="h-[200px] w-full rounded-lg overflow-hidden border"
          />
        </div>
      ) : (
        <div className="px-4">
          <div className="h-[200px] rounded-lg border bg-muted/30 flex flex-col items-center justify-center text-muted-foreground">
            <MapPin className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Sem coordenadas</p>
          </div>
        </div>
      )}

      {/* Detalhes de morada */}
      <div className="p-4 space-y-2 text-sm">
        {property.address_street && (
          <DetailRow label="Morada" value={property.address_street} />
        )}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <DetailRow label="Código Postal" value={property.postal_code} />
          <DetailRow label="Cidade" value={property.city} />
          <DetailRow label="Zona" value={property.zone} />
        </div>
      </div>
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
      <CardContent className="flex flex-col items-center justify-center text-center">
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
        <CardContent className="flex flex-col items-center justify-center text-center text-muted-foreground">
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
      <CardHeader className="pb-0">
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
      <CardHeader className="pb-0">
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

