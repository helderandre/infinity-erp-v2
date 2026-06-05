'use client'

import {
  Star,
  Phone,
  Mail,
  MapPin,
  Globe,
  Award,
  Lock,
  Navigation,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  Check,
  GitCompareArrows,
} from 'lucide-react'
import { resolvePartnerCategoryIcon } from '@/lib/partners/category-icons'
import {
  resolvePartnerCategoryColor,
  type PartnerCategoryRow,
} from '@/hooks/use-partner-categories'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn, normalizeWebsiteUrl, buildGoogleMapsUrl } from '@/lib/utils'

interface PartnerCardProps {
  partner: Partner
  canEdit?: boolean
  isStaff?: boolean
  currentUserId?: string
  isSelected?: boolean
  selectionMode?: boolean
  categoryMap?: Record<string, PartnerCategoryRow>
  onToggleSelect?: (partner: Partner) => void
  onView?: (partner: Partner) => void
  onEdit?: (partner: Partner) => void
  onDelete?: (partner: Partner) => void
  onRate?: (partner: Partner) => void
  onApprove?: (partner: Partner) => void
  onReject?: (partner: Partner) => void
}

export function PartnerCard({
  partner,
  canEdit,
  isStaff,
  currentUserId,
  isSelected,
  selectionMode,
  categoryMap,
  onToggleSelect,
  onView,
  onEdit,
  onDelete,
  onApprove,
  onReject,
}: PartnerCardProps) {
  const cat = categoryMap?.[partner.category]
  const catColor = resolvePartnerCategoryColor(cat?.color || 'slate')
  const catLabel = cat?.label || partner.category || 'Outro'
  const CategoryIcon = resolvePartnerCategoryIcon(cat?.icon || 'Briefcase')

  const isPending = partner.status === 'pending'
  const isRejected = partner.status === 'rejected'
  const isOwnProposal = !!currentUserId && partner.submitted_by === currentUserId

  const canMutate = canEdit || (isOwnProposal && isPending)
  const canWithdraw = isStaff || (isOwnProposal && isPending)

  const subtitle = partner.contact_person || partner.email || partner.phone || null
  const hasCover = !!partner.cover_image_url

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl border bg-background overflow-hidden transition-all duration-200 hover:shadow-md hover:border-border cursor-pointer',
        isPending && 'border-amber-400/40',
        isRejected && 'border-red-400/40 opacity-85',
        isSelected && 'border-primary/60 ring-2 ring-primary/20',
      )}
      onClick={() => {
        if (selectionMode && onToggleSelect) {
          onToggleSelect(partner)
        } else {
          onView?.(partner)
        }
      }}
    >
      {/* Cover / icon hero — taller on mobile, 16/9 on larger screens */}
      <div className={cn('relative aspect-[4/3] sm:aspect-[16/9]', hasCover ? 'bg-muted' : catColor.bg)}>
        {hasCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={partner.cover_image_url!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <CategoryIcon className={cn('h-14 w-14 opacity-80', catColor.text)} />
          </div>
        )}

        {/* Overlay badges top-left */}
        <div className="absolute top-2 left-2 flex items-center gap-1 flex-wrap">
          {isPending && (
            <Badge className="rounded-full text-[10px] gap-1 bg-amber-500/90 text-white border-0 px-2 h-5 shrink-0 backdrop-blur-sm">
              <Clock className="h-2.5 w-2.5" />
              Pendente
            </Badge>
          )}
          {isRejected && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="rounded-full text-[10px] gap-1 bg-red-500/90 text-white border-0 px-2 h-5 cursor-help shrink-0 backdrop-blur-sm">
                    <XCircle className="h-2.5 w-2.5" />
                    Rejeitada
                  </Badge>
                </TooltipTrigger>
                {partner.rejection_reason && (
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs font-medium mb-1">Motivo da rejeição</p>
                    <p className="text-xs text-muted-foreground">{partner.rejection_reason}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
          {partner.is_recommended && !isPending && !isRejected && (
            <Badge className="rounded-full text-[10px] gap-1 bg-black/40 text-white border border-white/15 backdrop-blur-md px-2 h-5 shrink-0 shadow-sm">
              <Award className="h-2.5 w-2.5" />
              Recomendado
            </Badge>
          )}
          {partner.visibility === 'private' && (
            <Badge className="rounded-full text-[10px] gap-1 bg-background/80 text-foreground border border-border/50 px-2 h-5 shrink-0 backdrop-blur-sm">
              <Lock className="h-2.5 w-2.5" />
              Privado
            </Badge>
          )}
        </div>

        {/* Selection checkbox top-right */}
        {onToggleSelect && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSelect(partner) }}
            aria-label={isSelected ? 'Desseleccionar' : 'Seleccionar para comparar'}
            className={cn(
              'absolute top-2 right-2 h-6 w-6 inline-flex items-center justify-center rounded-md border transition-all duration-200 backdrop-blur-sm',
              isSelected
                ? 'bg-primary border-primary text-primary-foreground opacity-100'
                : selectionMode
                  ? 'border-background/80 bg-background/80 text-transparent opacity-100 hover:border-foreground'
                  : 'border-background/60 bg-background/70 text-transparent opacity-0 group-hover:opacity-100 hover:border-foreground',
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Dropdown (more actions) bottom-right when image present OR everywhere */}
        {canMutate && (
          <div className="absolute bottom-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background border border-border/50"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onView?.(partner)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver Detalhe
                </DropdownMenuItem>
                {onToggleSelect && !isSelected && (
                  <DropdownMenuItem onClick={() => onToggleSelect(partner)}>
                    <GitCompareArrows className="mr-2 h-4 w-4" />
                    Comparar
                  </DropdownMenuItem>
                )}
                {onToggleSelect && isSelected && (
                  <DropdownMenuItem onClick={() => onToggleSelect(partner)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Retirar da comparação
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onEdit?.(partner)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                {isStaff && isPending && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onApprove?.(partner)}>
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                      Aprovar proposta
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onReject?.(partner)}>
                      <XCircle className="mr-2 h-4 w-4 text-red-600" />
                      Rejeitar proposta
                    </DropdownMenuItem>
                  </>
                )}
                {canWithdraw && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(partner)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {isOwnProposal && isPending && !isStaff ? 'Retirar proposta' : 'Eliminar'}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col px-4 py-3">
        <h3 className="font-semibold text-[14px] tracking-tight truncate">{partner.name}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
        )}

        <div className="mt-2 flex items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', catColor.dot)} />
            {catLabel}
          </span>
          {partner.city && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {partner.city}
              </span>
            </>
          )}
        </div>

        {/* Footer: rating (left) + contact shortcuts (right) */}
        <div className="mt-auto pt-2.5 flex items-center justify-between gap-2 border-t border-border/50 -mx-0.5 pl-0.5 pt-3">
          {/* Rating bottom-left — always shown, renders "—" when unrated */}
          {!isPending && !isRejected ? (
            partner.rating_count > 0 ? (
              <div className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
                <span className="text-sm font-semibold leading-none">{partner.rating_avg.toFixed(1)}</span>
                <span className="text-[11px] text-muted-foreground leading-none">
                  · {partner.rating_count} {partner.rating_count === 1 ? 'avaliação' : 'avaliações'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Star className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] leading-none">Sem avaliações</span>
              </div>
            )
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}

          {(() => {
            const mapsUrl = buildGoogleMapsUrl({
              address: partner.address,
              city: partner.city,
              postalCode: partner.postal_code,
            })
            const hasAny = partner.phone || partner.email || partner.website || mapsUrl
            if (!hasAny) return null
            return (
              <div className="flex items-center gap-0.5 shrink-0">
                {partner.phone && (
                  <a
                    href={`tel:${partner.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={partner.phone}
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
                {partner.email && (
                  <a
                    href={`mailto:${partner.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={partner.email}
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </a>
                )}
                {partner.website && (
                  <a
                    href={normalizeWebsiteUrl(partner.website) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={partner.website}
                  >
                    <Globe className="h-3.5 w-3.5" />
                  </a>
                )}
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Abrir no Google Maps"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
