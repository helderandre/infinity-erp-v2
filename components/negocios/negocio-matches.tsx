'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
import {
  Home,
  MapPin,
  Phone,
  Mail,
  Bed,
  Bath,
  Maximize,
  Car,
  Calendar,
  Zap,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  User,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/constants'
import type { PropertyMatch } from '@/types/lead'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

/* ─── Image Gallery ─── */
function ImageGallery({ media }: { media: { url: string; is_cover: boolean }[] }) {
  const [current, setCurrent] = useState(0)

  if (media.length === 0) {
    return (
      <div className="aspect-[16/10] bg-muted rounded-xl flex items-center justify-center">
        <Home className="h-12 w-12 text-muted-foreground/30" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted">
        <img
          src={media[current].url}
          alt={`Foto ${current + 1}`}
          className="w-full h-full object-cover transition-opacity duration-300"
        />
        {media.length > 1 && (
          <>
            <button
              onClick={() => setCurrent((c) => (c - 1 + media.length) % media.length)}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm text-foreground rounded-full p-1.5 hover:bg-white transition-colors shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrent((c) => (c + 1) % media.length)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm text-foreground rounded-full p-1.5 hover:bg-white transition-colors shadow-sm"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm text-foreground text-[11px] font-medium rounded-full px-2.5 py-0.5 shadow-sm">
              {current + 1} / {media.length}
            </div>
          </>
        )}
      </div>
      {/* Thumbnails */}
      {media.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {media.slice(0, 6).map((m, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`shrink-0 w-16 h-11 rounded-lg overflow-hidden ring-2 transition-all ${
                i === current ? 'ring-primary' : 'ring-transparent hover:ring-muted-foreground/30'
              }`}
            >
              <img src={m.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
          {media.length > 6 && (
            <button
              onClick={() => setCurrent(6)}
              className="shrink-0 w-16 h-11 rounded-lg bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground"
            >
              +{media.length - 6}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Info Field (matches app's rounded bordered box pattern) ─── */
function InfoField({ label, value, icon: Icon }: { label: string; value: string | number | null; icon?: React.ElementType }) {
  if (value == null) return null
  return (
    <div className="rounded-xl border px-4 py-3">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {value}
      </p>
    </div>
  )
}

/* ─── Section Header (matches app pattern) ─── */
function SectionLabel({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider col-span-full pt-1">
      {title}
    </p>
  )
}

/* ─── Contact Circle Button (matches lead-sidebar pattern) ─── */
function ContactCircle({
  href,
  icon: Icon,
  label,
  bgColor,
  disabled,
}: {
  href: string
  icon: React.ElementType
  label: string
  bgColor: string
  disabled?: boolean
}) {
  if (disabled) {
    return (
      <div className="flex flex-col items-center gap-1 opacity-40">
        <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
    )
  }
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="flex flex-col items-center gap-1"
    >
      <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${bgColor}`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </a>
  )
}

/* ─── Property Detail Sheet ─── */
function PropertyDetailSheet({
  property,
  open,
  onClose,
}: {
  property: PropertyMatch | null
  open: boolean
  onClose: () => void
}) {
  if (!property) return null

  const { specs, consultant, media } = property

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        <div className="p-6 space-y-6">
          {/* Photos */}
          <ImageGallery media={media || []} />

          {/* Title + Location + Price */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold leading-tight">{property.title}</h3>
              <span className="text-lg font-bold whitespace-nowrap">
                {formatCurrency(property.listing_price)}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {property.city && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {property.city}
                  {property.zone && `, ${property.zone}`}
                </span>
              )}
              {property.property_type && (
                <Badge variant="secondary" className="text-xs">{property.property_type}</Badge>
              )}
              {property.property_condition && (
                <Badge variant="outline" className="text-xs">{property.property_condition}</Badge>
              )}
            </div>
            {property.badges && property.badges.length > 0 && (
              <div className="pt-1">
                <MatchBadgesRow badges={property.badges} />
              </div>
            )}
          </div>

          {/* Specs in bordered fields (matching the app pattern) */}
          {specs && (
            <div className="grid grid-cols-2 gap-2">
              <SectionLabel title="Características" />
              {specs.bedrooms != null && (
                <InfoField label="Quartos" value={specs.bedrooms} icon={Bed} />
              )}
              {specs.bathrooms != null && (
                <InfoField label="Casas de banho" value={specs.bathrooms} icon={Bath} />
              )}
              {specs.area_util != null && (
                <InfoField label="Área útil" value={`${specs.area_util} m²`} icon={Maximize} />
              )}
              {specs.area_gross != null && (
                <InfoField label="Área bruta" value={`${specs.area_gross} m²`} icon={Maximize} />
              )}
              {specs.parking_spaces != null && specs.parking_spaces > 0 && (
                <InfoField label="Estacionamento" value={`${specs.parking_spaces} lugar${specs.parking_spaces > 1 ? 'es' : ''}`} icon={Car} />
              )}
              {specs.construction_year != null && (
                <InfoField label="Ano de construção" value={specs.construction_year} icon={Calendar} />
              )}
              {property.energy_certificate && (
                <InfoField label="Certificado energético" value={property.energy_certificate} icon={Zap} />
              )}
            </div>
          )}

          {/* Features */}
          {specs?.features && specs.features.length > 0 && (
            <div className="space-y-2">
              <SectionLabel title="Extras" />
              <div className="flex flex-wrap gap-1.5">
                {specs.features.map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {property.description && (
            <div className="space-y-2">
              <SectionLabel title="Descrição" />
              <div className="rounded-xl border px-4 py-3">
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">
                  {property.description}
                </p>
              </div>
            </div>
          )}

          {/* Consultant */}
          {consultant && (
            <div className="border-t pt-5 space-y-4">
              <SectionLabel title="Consultor responsável" />
              <div className="text-center space-y-3">
                <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-semibold">{consultant.commercial_name}</p>
                <div className="flex justify-center gap-5">
                  <ContactCircle
                    href={`tel:${consultant.phone}`}
                    icon={Phone}
                    label="Ligar"
                    bgColor="bg-green-50 text-green-600 hover:bg-green-100"
                    disabled={!consultant.phone}
                  />
                  <ContactCircle
                    href={`https://wa.me/${(consultant.phone || '').replace(/\D/g, '')}`}
                    icon={WhatsAppIcon}
                    label="WhatsApp"
                    bgColor="bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    disabled={!consultant.phone}
                  />
                  <ContactCircle
                    href={`mailto:${consultant.email}`}
                    icon={Mail}
                    label="Email"
                    bgColor="bg-orange-50 text-orange-600 hover:bg-orange-100"
                    disabled={!consultant.email}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Full page link */}
          <Button variant="outline" className="w-full" asChild>
            <a href={`/dashboard/imoveis/${property.slug || property.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Ver ficha completa
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ─── Match Badges Row (shared between card + sheet) ─── */
function MatchBadgesRow({
  badges,
  compact = false,
}: {
  badges: PropertyMatch['badges']
  compact?: boolean
}) {
  if (!badges || badges.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) => {
        const Icon =
          b.type === 'positive' ? CheckCircle2 : b.type === 'warning' ? AlertTriangle : Info
        const cls =
          b.type === 'positive'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900'
            : b.type === 'warning'
              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900'
              : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
        return (
          <span
            key={b.key}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
              compact ? 'text-[10px]' : 'text-xs'
            } font-medium ${cls}`}
          >
            <Icon className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
            {b.label}
          </span>
        )
      })}
    </div>
  )
}

/* ─── Main Component ─── */
interface NegocioMatchesProps {
  negocioId: string
  refreshKey?: number
}

export function NegocioMatches({ negocioId, refreshKey }: NegocioMatchesProps) {
  const [matches, setMatches] = useState<PropertyMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selected, setSelected] = useState<PropertyMatch | null>(null)
  const [strict, setStrict] = useState(false)

  useEffect(() => {
    async function loadMatches() {
      setIsLoading(true)
      try {
        const qs = strict ? '?strict=true' : ''
        const res = await fetch(`/api/negocios/${negocioId}/matches${qs}`)
        if (res.ok) {
          const data = await res.json()
          setMatches(data.data || [])
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false)
      }
    }
    loadMatches()
  }, [negocioId, refreshKey, strict])

  // Header com toggle estrito
  const Header = (
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm text-muted-foreground">
        {isLoading ? 'A pesquisar...' : `${matches.length} ${matches.length === 1 ? 'imóvel' : 'imóveis'}`}
      </p>
      <div className="flex items-center gap-2">
        <Label htmlFor="strict-mode" className="text-xs text-muted-foreground cursor-pointer">
          Match estrito
        </Label>
        <Switch
          id="strict-mode"
          checked={strict}
          onCheckedChange={setStrict}
          aria-label="Modo estrito (esconder imóveis com avisos)"
        />
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <>
        {Header}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      </>
    )
  }

  if (matches.length === 0) {
    return (
      <>
        {Header}
        <EmptyState
          icon={Home}
          title={strict ? 'Nenhum match perfeito' : 'Nenhum imóvel correspondente'}
          description={
            strict
              ? 'Desligue o modo estrito para ver imóveis com avisos.'
              : 'Não foram encontrados imóveis que correspondam aos critérios deste negócio.'
          }
        />
      </>
    )
  }

  const getPriceBadge = (flag: PropertyMatch['price_flag']) => {
    if (!flag) return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-medium">
        No orçamento
      </span>
    )
    if (flag === 'yellow') return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 px-2 py-0.5 text-[10px] font-medium">
        0-10% acima
      </span>
    )
    return (
      <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 px-2 py-0.5 text-[10px] font-medium">
        10-15% acima
      </span>
    )
  }

  return (
    <>
      {Header}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {matches.map((match) => (
          <button
            key={match.id}
            type="button"
            onClick={() => setSelected(match)}
            className="text-left group"
          >
            <div className="rounded-xl border overflow-hidden transition-all hover:shadow-md hover:border-primary/30">
              {match.cover_url ? (
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  <img
                    src={match.cover_url}
                    alt={match.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
              ) : (
                <div className="aspect-[16/10] bg-muted flex items-center justify-center">
                  <Home className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="px-3.5 py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm line-clamp-1">{match.title}</h4>
                  {getPriceBadge(match.price_flag)}
                </div>
                {match.city && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {match.city}
                    {match.zone && `, ${match.zone}`}
                  </p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="font-bold text-sm">{formatCurrency(match.listing_price)}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {match.specs?.bedrooms != null && (
                      <span className="flex items-center gap-0.5">
                        <Bed className="h-3 w-3" /> {match.specs.bedrooms}
                      </span>
                    )}
                    {match.specs?.area_util != null && (
                      <span className="flex items-center gap-0.5">
                        <Maximize className="h-3 w-3" /> {match.specs.area_util}m²
                      </span>
                    )}
                  </div>
                </div>
                {match.badges && match.badges.length > 0 && (
                  <div className="pt-1.5">
                    <MatchBadgesRow badges={match.badges} compact />
                  </div>
                )}
                {match.consultant && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-0.5">
                    <User className="h-3 w-3" />
                    {match.consultant.commercial_name}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <PropertyDetailSheet
        property={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </>
  )
}
