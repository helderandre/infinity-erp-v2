'use client'

import { useState } from 'react'
import {
  Star,
  Phone,
  Mail,
  MapPin,
  Globe,
  Award,
  Lock,
  User,
  Building2,
  Pencil,
  Loader2,
} from 'lucide-react'
import {
  PARTNER_CATEGORY_LABELS,
  PARTNER_CATEGORY_COLORS,
  PARTNER_PAYMENT_OPTIONS,
} from '@/lib/constants'
import type { Partner, PartnerRating } from '@/types/partner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'

interface PartnerDetailSheetProps {
  partner: Partner | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (partner: Partner) => void
  onRate?: (id: string, rating: number, comment?: string) => Promise<boolean>
  canEdit?: boolean
  canSeePrivate?: boolean
}

export function PartnerDetailSheet({
  partner,
  open,
  onOpenChange,
  onEdit,
  onRate,
  canEdit,
  canSeePrivate,
}: PartnerDetailSheetProps) {
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingHover, setRatingHover] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [isRating, setIsRating] = useState(false)

  if (!partner) return null

  const catColor = PARTNER_CATEGORY_COLORS[partner.category] || PARTNER_CATEGORY_COLORS.other
  const catLabel = PARTNER_CATEGORY_LABELS[partner.category] || 'Outro'
  const paymentLabel = partner.payment_method
    ? PARTNER_PAYMENT_OPTIONS.find((o) => o.value === partner.payment_method)?.label
    : null

  const handleRate = async () => {
    if (!onRate || ratingValue === 0) return
    setIsRating(true)
    const success = await onRate(partner.id, ratingValue, ratingComment || undefined)
    if (success) {
      setRatingValue(0)
      setRatingComment('')
    }
    setIsRating(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px] overflow-y-auto">
        {/* Dark header */}
        <div className="-mx-6 -mt-6 mb-5 bg-neutral-900 rounded-t-2xl px-6 py-6">
          <SheetHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-white text-lg truncate">{partner.name}</SheetTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="secondary"
                    className={`${catColor.bg} ${catColor.text} border-0 rounded-full text-[10px]`}
                  >
                    {catLabel}
                  </Badge>
                  {partner.visibility === 'private' && (
                    <Badge variant="outline" className="rounded-full text-[10px] border-white/20 text-white/60">
                      <Lock className="mr-1 h-3 w-3" />
                      Privado
                    </Badge>
                  )}
                  {partner.is_recommended && (
                    <Badge className="rounded-full text-[10px] bg-amber-500/20 text-amber-400 border-0">
                      <Award className="mr-1 h-3 w-3" />
                      Recomendado
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="space-y-5">
          {/* Rating summary */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-5 w-5 ${
                    s <= Math.round(partner.rating_avg)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground/20'
                  }`}
                />
              ))}
              <span className="text-sm font-medium ml-1">
                {partner.rating_avg > 0 ? partner.rating_avg.toFixed(1) : '—'}
              </span>
              <span className="text-xs text-muted-foreground">
                ({partner.rating_count} {partner.rating_count === 1 ? 'avaliação' : 'avaliações'})
              </span>
            </div>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => onEdit?.(partner)}
              >
                <Pencil className="mr-1 h-3 w-3" />
                Editar
              </Button>
            )}
          </div>

          <Separator />

          {/* Contacto */}
          <div className="rounded-xl border bg-card/50 p-4 space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Contacto
            </h4>
            {partner.contact_person && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                {partner.contact_person}
              </div>
            )}
            {partner.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`tel:${partner.phone}`} className="hover:underline">{partner.phone}</a>
                {partner.phone_secondary && (
                  <span className="text-muted-foreground">/ {partner.phone_secondary}</span>
                )}
              </div>
            )}
            {partner.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${partner.email}`} className="hover:underline truncate">{partner.email}</a>
              </div>
            )}
            {partner.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={partner.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate text-blue-600">
                  {partner.website}
                </a>
              </div>
            )}
            {(partner.address || partner.city) && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                {[partner.address, partner.city, partner.postal_code].filter(Boolean).join(', ')}
              </div>
            )}
            {partner.nif && (
              <div className="text-xs text-muted-foreground">NIF: {partner.nif}</div>
            )}
          </div>

          {/* Profissional */}
          {(partner.specialties?.length || partner.service_areas?.length || paymentLabel) && (
            <div className="rounded-xl border bg-card/50 p-4 space-y-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Informação Profissional
              </h4>
              {partner.specialties && partner.specialties.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">Especialidades</p>
                  <div className="flex flex-wrap gap-1.5">
                    {partner.specialties.map((s) => (
                      <Badge key={s} variant="secondary" className="rounded-full text-[10px]">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {partner.service_areas && partner.service_areas.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">Zonas de Actuação</p>
                  <div className="flex flex-wrap gap-1.5">
                    {partner.service_areas.map((a) => (
                      <Badge key={a} variant="outline" className="rounded-full text-[10px]">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {paymentLabel && (
                <div className="text-sm">
                  <span className="text-muted-foreground text-[11px]">Pagamento:</span>{' '}
                  {paymentLabel}
                </div>
              )}
            </div>
          )}

          {/* Condições comerciais (admin only) */}
          {canSeePrivate && partner.commercial_conditions && (
            <div className="rounded-xl border bg-card/50 p-4 space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Condições Comerciais
              </h4>
              <p className="text-sm whitespace-pre-wrap">{partner.commercial_conditions}</p>
            </div>
          )}

          {/* Notas internas (admin only) */}
          {canSeePrivate && partner.internal_notes && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
                Notas Internas
              </h4>
              <p className="text-sm whitespace-pre-wrap">{partner.internal_notes}</p>
            </div>
          )}

          {/* Rate partner */}
          {onRate && (
            <div className="rounded-xl border bg-card/50 p-4 space-y-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Avaliar Parceiro
              </h4>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="p-0.5 transition-transform hover:scale-110"
                    onMouseEnter={() => setRatingHover(s)}
                    onMouseLeave={() => setRatingHover(0)}
                    onClick={() => setRatingValue(s)}
                  >
                    <Star
                      className={`h-6 w-6 ${
                        s <= (ratingHover || ratingValue)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground/20'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                className="rounded-xl"
                rows={2}
                placeholder="Comentário (opcional)..."
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
              />
              <Button
                className="rounded-full"
                size="sm"
                disabled={ratingValue === 0 || isRating}
                onClick={handleRate}
              >
                {isRating && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Avaliar
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
