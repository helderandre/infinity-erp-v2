'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { DocumentsSection } from '@/components/documents/DocumentsSection'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES,
  CONTRACT_REGIMES,
} from '@/lib/constants'
import { toast } from 'sonner'
import type { ProcessDocument } from '@/types/process'
import type { DocType } from '@/types/document'

/* ─── Display Field (matches lead-data-card pattern) ─── */
function DisplayField({
  label,
  value,
  fullWidth,
  suffix,
}: {
  label: string
  value?: string | number | null
  fullWidth?: boolean
  suffix?: string
}) {
  const display = value != null && value !== '' && value !== 0
    ? suffix ? `${value} ${suffix}` : String(value)
    : '—'
  return (
    <div className={`rounded-xl border px-4 py-3 ${fullWidth ? 'col-span-full' : ''}`}>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium">{display}</p>
    </div>
  )
}

/* ─── Section Header ─── */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="col-span-full text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pt-2">
      {children}
    </p>
  )
}

/* ─── Static Mapbox Map (read-only) ─── */
function PropertyLocationMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!mapContainerRef.current) return

    let map: any
    const initMap = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!

      map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [longitude, latitude],
        zoom: 15,
        interactive: true,
      })

      map.addControl(new mapboxgl.NavigationControl(), 'top-right')

      new mapboxgl.Marker()
        .setLngLat([longitude, latitude])
        .addTo(map)

      mapRef.current = map
    }

    initMap()

    return () => {
      map?.remove()
    }
  }, [latitude, longitude])

  return (
    <div
      ref={mapContainerRef}
      className="col-span-full h-[300px] rounded-xl border overflow-hidden"
    />
  )
}

// Property-level doc categories (exclude owner categories)
const PROPERTY_DOC_CATEGORIES = ['Contratual', 'Imóvel', 'Jurídico', 'Jurídico Especial']

/* ─── Label helpers ─── */
function getPropertyTypeLabel(value?: string | null): string | null {
  if (!value) return null
  return (PROPERTY_TYPES as Record<string, string>)[value] || value
}

function getBusinessTypeLabel(value?: string | null): string | null {
  if (!value) return null
  return (BUSINESS_TYPES as Record<string, string>)[value] || value
}

function getConditionLabel(value?: string | null): string | null {
  if (!value) return null
  return (PROPERTY_CONDITIONS as Record<string, string>)[value] || value
}

function getEnergyLabel(value?: string | null): string | null {
  if (!value) return null
  return (ENERGY_CERTIFICATES as Record<string, string>)[value] || value
}

function getContractRegimeLabel(value?: string | null): string | null {
  if (!value) return null
  return (CONTRACT_REGIMES as Record<string, string>)[value] || value
}

interface ProcessPropertyTabProps {
  property: any
  documents: ProcessDocument[]
  onDocumentUploaded?: () => void
  /** Which sub-section to show: 'dados' (default) or 'documentos' */
  view?: 'dados' | 'documentos'
}

export function ProcessPropertyTab({ property, documents, onDocumentUploaded, view = 'dados' }: ProcessPropertyTabProps) {
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [docTypesLoading, setDocTypesLoading] = useState(true)

  // Fetch doc_types on mount
  useEffect(() => {
    fetch('/api/libraries/doc-types')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDocTypes(data.filter((dt: DocType) => PROPERTY_DOC_CATEGORIES.includes(dt.category)))
        }
      })
      .catch((err) => console.error('Erro ao carregar tipos de documento:', err))
      .finally(() => setDocTypesLoading(false))
  }, [])

  // Group doc_types by category for DocumentsSection
  const byCategory = useMemo(() => {
    return docTypes.reduce<Record<string, DocType[]>>((acc, dt) => {
      if (!acc[dt.category]) acc[dt.category] = []
      acc[dt.category].push(dt)
      return acc
    }, {})
  }, [docTypes])

  // Map uploaded documents to the format expected by DocumentsSection
  const uploadedDocs = useMemo(() => {
    return documents
      .filter((d) => PROPERTY_DOC_CATEGORIES.includes(d.doc_type?.category || ''))
      .map((d) => ({
        doc_type_id: d.doc_type?.id || '',
        file_url: d.file_url,
        file_name: d.file_name,
      }))
  }, [documents])

  const handleDocUploaded = useCallback((result: any, docTypeId: string) => {
    toast.success('Documento carregado com sucesso')
    onDocumentUploaded?.()
  }, [onDocumentUploaded])

  if (!property) return null

  const specs = property.specifications || property.specs || {}
  const internal = property.internal || {}
  const featuresList = specs.features || []

  /* ── Documentos view ── */
  if (view === 'documentos') {
    return (
      <Card>
        <CardContent className="pt-4">
          {docTypesLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <DocumentsSection
              byCategory={byCategory}
              uploadedDocs={uploadedDocs}
              propertyId={property.id}
              onUploaded={handleDocUploaded}
            />
          )}
        </CardContent>
      </Card>
    )
  }

  /* ── Dados view (default) ── */
  return (
    <Card>
      <CardContent className="pt-4">
        <Tabs defaultValue="geral">
          <TabsList className="bg-muted/50 rounded-full p-1 h-auto gap-0 w-full justify-start flex-wrap">
            <TabsTrigger value="geral" className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Informação Geral
            </TabsTrigger>
            <TabsTrigger value="especificacoes" className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Especificações
            </TabsTrigger>
            <TabsTrigger value="localizacao" className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Localização
            </TabsTrigger>
            <TabsTrigger value="negocio" className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Negócio
            </TabsTrigger>
          </TabsList>

          {/* Informação Geral */}
          <TabsContent value="geral" className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              <DisplayField label="Título" value={property.title} fullWidth />
              <DisplayField label="Tipo de Imóvel" value={getPropertyTypeLabel(property.property_type)} />
              <DisplayField label="Tipo de Negócio" value={getBusinessTypeLabel(property.business_type)} />
              <DisplayField label="Preço" value={property.listing_price ? formatCurrency(property.listing_price) : null} />
              <DisplayField label="Estado do Imóvel" value={getConditionLabel(property.property_condition)} />
              <DisplayField label="Certificado Energético" value={getEnergyLabel(property.energy_certificate)} />
              <div className="rounded-xl border px-4 py-3">
                <p className="text-xs text-muted-foreground mb-0.5">Estado</p>
                <StatusBadge status={property.status} type="property" showDot={false} />
              </div>
              {property.description && (
                typeof property.description === 'string' && property.description.startsWith('<') ? (
                  <div className="col-span-full rounded-xl border px-4 py-3">
                    <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                    <div
                      className="text-sm prose prose-sm max-w-none [&_p]:my-0.5 [&_ul]:my-0.5 [&_ol]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0"
                      dangerouslySetInnerHTML={{ __html: property.description }}
                    />
                  </div>
                ) : (
                  <DisplayField label="Descrição" value={property.description} fullWidth />
                )
              )}
            </div>
          </TabsContent>

          {/* Especificações */}
          <TabsContent value="especificacoes" className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              <DisplayField label="Tipologia" value={specs.typology} />
              <DisplayField label="Quartos" value={specs.bedrooms} />
              <DisplayField label="Casas de Banho" value={specs.bathrooms} />
              <DisplayField label="Área Bruta" value={specs.area_gross} suffix="m²" />
              <DisplayField label="Área Útil" value={specs.area_util} suffix="m²" />
              <DisplayField label="Ano de Construção" value={specs.construction_year} />
              <DisplayField label="Estacionamentos" value={specs.parking_spaces} />
              <DisplayField label="Garagens" value={specs.garage_spaces} />
              <DisplayField label="Elevador" value={specs.has_elevator ? 'Sim' : specs.has_elevator === false ? 'Não' : null} />

              {featuresList.length > 0 && (
                <>
                  <SectionHeader>Características</SectionHeader>
                  <div className="col-span-full flex flex-wrap gap-1.5">
                    {featuresList.map((f: string) => (
                      <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                    ))}
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* Localização */}
          <TabsContent value="localizacao" className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              <DisplayField label="Morada" value={property.address_street} fullWidth />
              <DisplayField label="Cidade" value={property.city} />
              <DisplayField label="Zona" value={property.zone} />
              <DisplayField label="Freguesia" value={property.address_parish} />
              <DisplayField label="Código Postal" value={property.postal_code} />
              {(property.latitude || property.longitude) && (
                <>
                  <DisplayField label="Latitude" value={property.latitude?.toFixed(6)} />
                  <DisplayField label="Longitude" value={property.longitude?.toFixed(6)} />
                </>
              )}
              {property.latitude && property.longitude && (
                <PropertyLocationMap latitude={property.latitude} longitude={property.longitude} />
              )}
            </div>
          </TabsContent>

          {/* Negócio (Dados Internos) */}
          <TabsContent value="negocio" className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              <DisplayField label="Comissão" value={internal.commission_agreed} suffix={internal.commission_type === 'percentage' ? '%' : '€'} />
              <DisplayField label="Regime de Contrato" value={getContractRegimeLabel(internal.contract_regime)} />
              <DisplayField label="Prazo" value={internal.contract_term} />
              <DisplayField label="Expiração" value={internal.contract_expiry ? formatDate(internal.contract_expiry) : null} />
              <DisplayField label="IMI" value={internal.imi_value} suffix="€" />
              <DisplayField label="Condomínio" value={internal.condominium_fee} suffix="€/mês" />
              <DisplayField label="CPCV" value={internal.cpcv_percentage} suffix="%" />
              {internal.internal_notes && (
                <DisplayField label="Notas Internas" value={internal.internal_notes} fullWidth />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
