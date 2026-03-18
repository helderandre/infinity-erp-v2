'use client'

import {
  Star,
  Phone,
  Mail,
  MapPin,
  Globe,
  Award,
  Lock,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
} from 'lucide-react'
import {
  PARTNER_CATEGORY_LABELS,
  PARTNER_CATEGORY_COLORS,
} from '@/lib/constants'
import type { Partner } from '@/types/partner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface PartnerCardProps {
  partner: Partner
  canEdit?: boolean
  onView?: (partner: Partner) => void
  onEdit?: (partner: Partner) => void
  onDelete?: (partner: Partner) => void
  onRate?: (partner: Partner) => void
}

export function PartnerCard({
  partner,
  canEdit,
  onView,
  onEdit,
  onDelete,
  onRate,
}: PartnerCardProps) {
  const catColor = PARTNER_CATEGORY_COLORS[partner.category] || PARTNER_CATEGORY_COLORS.other
  const catLabel = PARTNER_CATEGORY_LABELS[partner.category] || 'Outro'

  return (
    <div
      className="group relative flex flex-col rounded-2xl border bg-background p-5 transition-all duration-300 hover:shadow-lg hover:bg-card/80 cursor-pointer"
      onClick={() => onView?.(partner)}
    >
      {/* Top row: category + visibility + actions */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="secondary"
            className={`${catColor.bg} ${catColor.text} border-0 rounded-full text-[11px] font-medium px-2.5 py-0.5`}
          >
            <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${catColor.dot} inline-block`} />
            {catLabel}
          </Badge>
          {partner.visibility === 'private' && (
            <Badge variant="outline" className="rounded-full text-[10px] gap-1">
              <Lock className="h-3 w-3" />
              Privado
            </Badge>
          )}
          {partner.is_recommended && (
            <Badge className="rounded-full text-[10px] gap-1 bg-amber-500/15 text-amber-600 border-0">
              <Award className="h-3 w-3" />
              Recomendado
            </Badge>
          )}
          {!partner.is_active && (
            <Badge variant="secondary" className="rounded-full text-[10px] bg-red-500/15 text-red-600 border-0">
              Inactivo
            </Badge>
          )}
        </div>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onView?.(partner)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver Detalhe
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(partner)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(partner)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Name */}
      <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-1">{partner.name}</h3>

      {/* Contact person */}
      {partner.contact_person && (
        <p className="text-[11px] text-muted-foreground mb-2">
          Contacto: {partner.contact_person}
        </p>
      )}

      {/* Contact row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
        {partner.phone && (
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {partner.phone}
          </span>
        )}
        {partner.email && (
          <span className="flex items-center gap-1 truncate">
            <Mail className="h-3 w-3" />
            {partner.email}
          </span>
        )}
      </div>

      {/* Location */}
      {partner.city && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <MapPin className="h-3 w-3 shrink-0" />
          {partner.city}
        </div>
      )}

      {/* Service areas */}
      {partner.service_areas && partner.service_areas.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {partner.service_areas.slice(0, 3).map((area) => (
            <span
              key={area}
              className="inline-flex items-center text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
            >
              {area}
            </span>
          ))}
          {partner.service_areas.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{partner.service_areas.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Rating + website */}
      <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={`h-3.5 w-3.5 ${
                s <= Math.round(partner.rating_avg)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground/20'
              }`}
            />
          ))}
          {partner.rating_count > 0 && (
            <span className="text-[10px] text-muted-foreground ml-1">
              ({partner.rating_count})
            </span>
          )}
        </div>
        {partner.website && (
          <a
            href={partner.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Globe className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}
