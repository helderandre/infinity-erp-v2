'use client'

import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency } from '@/lib/constants'
import { PROPERTY_TYPES, BUSINESS_TYPES } from '@/lib/constants'
import { MapPin, BedDouble, Bath, Maximize } from 'lucide-react'
import type { PropertyWithRelations } from '@/types/property'

interface PropertyCardProps {
  property: PropertyWithRelations
  onClick?: () => void
}

export function PropertyCard({ property, onClick }: PropertyCardProps) {
  const coverImage = property.dev_property_media?.find((m) => m.is_cover)
    || property.dev_property_media?.[0]

  const specs = property.dev_property_specifications
  const propertyTypeLabel = PROPERTY_TYPES[property.property_type as keyof typeof PROPERTY_TYPES] || property.property_type
  const businessTypeLabel = BUSINESS_TYPES[property.business_type as keyof typeof BUSINESS_TYPES] || property.business_type

  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] py-0"
      onClick={onClick}
    >
      <div className="relative aspect-[16/10] bg-muted">
        {coverImage ? (
          <Image
            src={coverImage.url}
            alt={property.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Maximize className="h-8 w-8" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <StatusBadge status={property.status || 'pending_approval'} type="property" />
        </div>
        {businessTypeLabel && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center rounded-md bg-background/80 backdrop-blur-sm px-2 py-1 text-xs font-medium">
              {businessTypeLabel}
            </span>
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm line-clamp-1">{property.title}</h3>
          {property.external_ref && (
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              {property.external_ref}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {[property.city, property.zone].filter(Boolean).join(', ') || 'Sem localização'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-primary">
            {formatCurrency(property.listing_price)}
          </span>
          <span className="text-xs text-muted-foreground">{propertyTypeLabel}</span>
        </div>

        {specs && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
            {specs.bedrooms != null && (
              <span className="flex items-center gap-1">
                <BedDouble className="h-3 w-3" />
                {specs.bedrooms}
              </span>
            )}
            {specs.bathrooms != null && (
              <span className="flex items-center gap-1">
                <Bath className="h-3 w-3" />
                {specs.bathrooms}
              </span>
            )}
            {specs.area_util != null && (
              <span className="flex items-center gap-1">
                <Maximize className="h-3 w-3" />
                {specs.area_util} m²
              </span>
            )}
          </div>
        )}

        {property.consultant && (
          <p className="text-xs text-muted-foreground truncate">
            {property.consultant.commercial_name}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
