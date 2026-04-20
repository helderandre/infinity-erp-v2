'use client'

import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency } from '@/lib/constants'
import { PROPERTY_TYPES, BUSINESS_TYPES } from '@/lib/constants'
import { MapPin, Maximize, User } from 'lucide-react'
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
          <StatusBadge status={property.status || 'pending_approval'} type="property" className="!bg-background/80 backdrop-blur-sm" />
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
        <h3 className="font-semibold text-sm line-clamp-1">{property.title}</h3>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{[property.city, property.zone].filter(Boolean).join(', ') || 'Sem localização'}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-primary">
            {formatCurrency(property.listing_price)}
          </span>
          <span className="text-xs text-muted-foreground">{propertyTypeLabel}</span>
        </div>

        {property.consultant?.commercial_name && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-1.5 border-t">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{property.consultant.commercial_name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
