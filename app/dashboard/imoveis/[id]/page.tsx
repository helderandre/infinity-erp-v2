'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProperty } from '@/hooks/use-property'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { PropertyMediaGallery } from '@/components/properties/property-media-gallery'
import {
  ArrowLeft,
  Pencil,
  MapPin,
  BedDouble,
  Bath,
  Maximize,
  Car,
  Calendar,
  Building2,
  User,
  FileText,
  Layers,
} from 'lucide-react'
import {
  formatCurrency,
  formatArea,
  formatDate,
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES,
  CONTRACT_REGIMES,
} from '@/lib/constants'

export default function ImovelDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { property, isLoading, refetch } = useProperty(id)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [processData, setProcessData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('geral')

  // Load process data
  useEffect(() => {
    if (!id) return
    fetch(`/api/processes?property_id=${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.length) setProcessData(data.data[0])
      })
      .catch(() => {})
  }, [id])

  // Init map for location tab
  useEffect(() => {
    if (!property?.latitude || !property?.longitude || !mapContainerRef.current) return
    if (mapRef.current) return

    const initMap = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [property.longitude!, property.latitude!],
        zoom: 15,
        interactive: false,
      })

      new mapboxgl.Marker()
        .setLngLat([property.longitude!, property.latitude!])
        .addTo(map)

      mapRef.current = map
    }

    initMap()
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [property?.latitude, property?.longitude])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold">Imóvel não encontrado</h2>
          <p className="text-muted-foreground">O imóvel que procura não existe ou foi eliminado.</p>
        </div>
      </div>
    )
  }

  const specs = property.dev_property_specifications
  const internal = property.dev_property_internal

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/imoveis')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{property.title}</h1>
              <StatusBadge status={property.status || 'pending_approval'} type="property" />
            </div>
            <p className="text-sm text-muted-foreground">
              {property.slug || property.external_ref || property.id.slice(0, 8)}
            </p>
          </div>
        </div>
        <Button onClick={() => router.push(`/dashboard/imoveis/${id}/editar`)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="especificacoes">Especificações</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="proprietarios">Proprietários</TabsTrigger>
          <TabsTrigger value="processo">Processo</TabsTrigger>
        </TabsList>

        {/* Tab: Geral */}
        <TabsContent value="geral" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações Gerais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DetailRow label="Tipo de Imóvel" value={PROPERTY_TYPES[property.property_type as keyof typeof PROPERTY_TYPES] || property.property_type} />
                <DetailRow label="Tipo de Negócio" value={BUSINESS_TYPES[property.business_type as keyof typeof BUSINESS_TYPES] || property.business_type} />
                <DetailRow label="Condição" value={PROPERTY_CONDITIONS[property.property_condition as keyof typeof PROPERTY_CONDITIONS] || property.property_condition} />
                <DetailRow label="Certificado Energético" value={ENERGY_CERTIFICATES[property.energy_certificate as keyof typeof ENERGY_CERTIFICATES] || property.energy_certificate} />
                <DetailRow label="Referência" value={property.external_ref} />
                <DetailRow label="Consultor" value={property.consultant?.commercial_name} />
                <DetailRow label="Criado em" value={formatDate(property.created_at)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preço</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(property.listing_price)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Description */}
          {property.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Descrição</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{property.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Localização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow label="Morada" value={property.address_street} />
              <DetailRow label="Código Postal" value={property.postal_code} />
              <DetailRow label="Cidade" value={property.city} />
              <DetailRow label="Zona" value={property.zone} />

              {property.latitude && property.longitude && (
                <div
                  ref={mapContainerRef}
                  className="h-[300px] rounded-md overflow-hidden mt-4"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Especificacoes */}
        <TabsContent value="especificacoes" className="space-y-6">
          {specs ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dados Principais</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatItem icon={Layers} label="Tipologia" value={specs.typology} />
                    <StatItem icon={BedDouble} label="Quartos" value={specs.bedrooms} />
                    <StatItem icon={Bath} label="Casas de banho" value={specs.bathrooms} />
                    <StatItem icon={Maximize} label="Área bruta" value={specs.area_gross ? formatArea(specs.area_gross) : undefined} />
                    <StatItem icon={Maximize} label="Área útil" value={specs.area_util ? formatArea(specs.area_util) : undefined} />
                    <StatItem icon={Calendar} label="Ano de construção" value={specs.construction_year} />
                    <StatItem icon={Car} label="Estacionamentos" value={specs.parking_spaces} />
                    <StatItem icon={Car} label="Garagens" value={specs.garage_spaces} />
                  </div>
                </CardContent>
              </Card>

              {(specs.features?.length || specs.equipment?.length || specs.solar_orientation?.length || specs.views?.length) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Detalhes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {specs.solar_orientation?.length ? (
                      <TagList label="Orientação Solar" items={specs.solar_orientation} />
                    ) : null}
                    {specs.views?.length ? (
                      <TagList label="Vistas" items={specs.views} />
                    ) : null}
                    {specs.equipment?.length ? (
                      <TagList label="Equipamento" items={specs.equipment} />
                    ) : null}
                    {specs.features?.length ? (
                      <TagList label="Características" items={specs.features} />
                    ) : null}
                    {specs.has_elevator && (
                      <p className="text-sm">Elevador: <span className="font-medium">Sim</span></p>
                    )}
                    {specs.fronts_count ? (
                      <p className="text-sm">Frentes: <span className="font-medium">{specs.fronts_count}</span></p>
                    ) : null}
                  </CardContent>
                </Card>
              )}

              {(specs.storage_area || specs.balcony_area || specs.pool_area || specs.attic_area || specs.pantry_area || specs.gym_area) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Áreas Extra</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {specs.storage_area ? <DetailRow label="Arrecadação" value={formatArea(specs.storage_area)} /> : null}
                      {specs.balcony_area ? <DetailRow label="Varanda" value={formatArea(specs.balcony_area)} /> : null}
                      {specs.pool_area ? <DetailRow label="Piscina" value={formatArea(specs.pool_area)} /> : null}
                      {specs.attic_area ? <DetailRow label="Sótão" value={formatArea(specs.attic_area)} /> : null}
                      {specs.pantry_area ? <DetailRow label="Despensa" value={formatArea(specs.pantry_area)} /> : null}
                      {specs.gym_area ? <DetailRow label="Ginásio" value={formatArea(specs.gym_area)} /> : null}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Sem especificações registadas.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Media */}
        <TabsContent value="media">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Galeria de Imagens</CardTitle>
            </CardHeader>
            <CardContent>
              <PropertyMediaGallery
                propertyId={property.id}
                media={property.dev_property_media || []}
                onMediaChange={refetch}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Documentos */}
        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Os documentos deste imóvel podem ser geridos na secção de processos ou via upload directo.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Proprietarios */}
        <TabsContent value="proprietarios">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Proprietários
              </CardTitle>
            </CardHeader>
            <CardContent>
              {property.property_owners?.length ? (
                <div className="space-y-3">
                  {property.property_owners.map((po, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{po.owners?.name || 'Proprietário'}</p>
                          {po.is_main_contact && (
                            <Badge variant="secondary" className="text-xs">Contacto Principal</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {po.owners?.nif && <span>NIF: {po.owners.nif}</span>}
                          {po.owners?.email && <span>{po.owners.email}</span>}
                          {po.owners?.phone && <span>{po.owners.phone}</span>}
                        </div>
                      </div>
                      <span className="text-sm font-medium">{po.ownership_percentage}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum proprietário associado a este imóvel.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Processo */}
        <TabsContent value="processo">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Processo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {processData ? (
                <div className="space-y-3">
                  <DetailRow label="Referência" value={processData.external_ref} />
                  <DetailRow label="Estado" value={processData.current_status} />
                  <DetailRow label="Progresso" value={`${processData.percent_complete || 0}%`} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/dashboard/processos/${processData.id}`)}
                  >
                    Ver Processo
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum processo associado a este imóvel.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  )
}

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value || '—'}</p>
      </div>
    </div>
  )
}

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="text-xs">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  )
}
