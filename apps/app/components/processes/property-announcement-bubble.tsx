'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Building2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PropertyAnnouncementMetadata {
  kind: 'property_announcement'
  custom_message: string
  property: {
    id: string
    slug: string | null
    title: string | null
    external_ref: string | null
    listing_price: number | null
    property_type: string | null
    business_type: string | null
    city: string | null
    zone: string | null
    address_parish: string | null
    cover_url: string | null
    typology: string | null
    bedrooms: number | null
    bathrooms: number | null
    area_util: number | null
  }
  consultant: {
    id: string
    name: string | null
    photo: string | null
  } | null
}

interface Props {
  metadata: PropertyAnnouncementMetadata
  isOwn?: boolean
}

const eur = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/**
 * Render custom para mensagens com `metadata.kind === 'property_announcement'`.
 * Mantém o mesmo visual da pré-visualização do sheet — foto top, badge no
 * canto top-left com avatar do consultor (LinkedIn-style), info row com
 * tipologia/quartos/WC/m².
 *
 * O texto editável (custom_message) aparece por cima do card.
 */
export function PropertyAnnouncementBubble({ metadata, isOwn }: Props) {
  const { property, consultant, custom_message } = metadata
  const locationLabel =
    [property.address_parish, property.city, property.zone]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join(', ') || ''
  // Abre a Sheet de detalhe sobre a listagem (?property=…) em vez da página
  // dedicada — UX mais leve e mantém o contexto da lista por trás.
  const propertyHref = `/dashboard/imoveis?property=${encodeURIComponent(property.slug || property.id)}`
  const specBits: string[] = []
  if (property.typology) specBits.push(property.typology)
  if (property.bedrooms) specBits.push(`${property.bedrooms} quartos`)
  if (property.bathrooms) specBits.push(`${property.bathrooms} WC`)
  if (property.area_util) specBits.push(`${property.area_util} m²`)

  return (
    <div className={cn('w-full max-w-[420px]', isOwn && 'ml-auto')}>
      {/* Mensagem custom em texto */}
      {custom_message?.trim() && (
        <p className="text-sm whitespace-pre-wrap break-words mb-2 leading-relaxed">
          {custom_message}
        </p>
      )}

      {/* Card */}
      <Link
        href={propertyHref}
        className={cn(
          'block rounded-2xl border bg-card overflow-hidden shadow-sm transition-all',
          'hover:shadow-md hover:border-foreground/20',
          'border-border/60',
        )}
      >
        {/* Photo + consultant badge */}
        <div className="relative aspect-[16/10] bg-muted">
          {property.cover_url ? (
            <Image
              src={property.cover_url}
              alt={property.title || 'Imóvel'}
              fill
              sizes="420px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Building2 className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}

          {/* Consultant badge — top-left, avatar + nome */}
          {consultant && (
            <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/95 backdrop-blur-sm pl-1 pr-3 py-1 shadow-sm border border-border/40">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center overflow-hidden shrink-0">
                {consultant.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={consultant.photo}
                    alt={consultant.name || 'Consultor'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] font-semibold">
                    {(consultant.name || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold truncate max-w-[140px]">
                {consultant.name || 'Consultor'}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-3 space-y-1.5">
          <h3 className="text-sm font-semibold truncate">
            {property.title || property.external_ref || 'Imóvel'}
          </h3>
          {locationLabel && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{locationLabel}</span>
            </div>
          )}
          {property.listing_price ? (
            <div className="text-sm font-semibold text-foreground">
              {eur.format(Number(property.listing_price))}
            </div>
          ) : null}
          {specBits.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {specBits.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] text-foreground/80"
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}
