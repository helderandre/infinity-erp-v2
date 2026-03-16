'use client'

import { useEffect, useState, useTransition, useMemo, useCallback } from 'react'
import Image from 'next/image'
import {
  Building2, Search, Heart, MapPin, BedDouble, Maximize2,
  CalendarClock, Loader2, Eye, Users,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { toast } from 'sonner'
import { getPortalProperties, requestVisit, toggleFavorite } from '../actions'
import type { PortalProperty } from '../actions'

const fmt = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: 'Activo', className: 'bg-emerald-500/15 text-emerald-600' },
  pending_approval: { label: 'Pendente', className: 'bg-amber-500/15 text-amber-600' },
  sold: { label: 'Vendido', className: 'bg-blue-500/15 text-blue-600' },
  rented: { label: 'Arrendado', className: 'bg-indigo-500/15 text-indigo-600' },
}

export default function PortalImoveisPage() {
  const [properties, setProperties] = useState<PortalProperty[]>([])
  const [userRole, setUserRole] = useState<'buyer' | 'seller' | 'both'>('buyer')
  const [loading, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<PortalProperty | null>(null)
  const [showVisitForm, setShowVisitForm] = useState(false)
  const [visitLoading, setVisitLoading] = useState(false)

  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await getPortalProperties()
        setProperties(result.properties)
        setUserRole(result.user_role)
      } catch { /* empty state */ }
    })
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return properties
    const q = search.toLowerCase()
    return properties.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.zone?.toLowerCase().includes(q) ||
      p.property_type?.toLowerCase().includes(q)
    )
  }, [properties, search])

  const handleToggleFavorite = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      const result = await toggleFavorite(id)
      setProperties(prev => prev.map(p =>
        p.id === id ? { ...p, is_favorite: result.is_favorite } : p
      ))
    } catch { /* silent */ }
  }, [])

  const handleRequestVisit = useCallback(async (form: FormData) => {
    if (!selected) return
    setVisitLoading(true)
    try {
      const preferredDate = form.get('preferred_date') as string
      const preferredTime = form.get('preferred_time') as string
      if (!preferredDate || !preferredTime) {
        toast.error('Preencha a data e hora pretendidas.')
        return
      }
      await requestVisit({
        property_id: selected.id,
        preferred_date: preferredDate,
        preferred_time: preferredTime,
        alternative_date: (form.get('alternative_date') as string) || undefined,
        message: (form.get('message') as string) || undefined,
      })
      toast.success('Pedido de visita enviado com sucesso!')
      setShowVisitForm(false)
      setSelected(null)
    } catch {
      toast.error('Erro ao enviar pedido. Tente novamente.')
    } finally {
      setVisitLoading(false)
    }
  }, [selected])

  if (!properties.length && !search) {
    return loading ? <PropertiesSkeleton /> : (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Imoveis</h1>
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-6 text-center space-y-2">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Nenhum imovel disponivel de momento.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isSeller = userRole === 'seller' || userRole === 'both'

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Imoveis</h1>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por titulo, cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      {/* Property list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            isSeller={isSeller}
            onSelect={() => setSelected(property)}
            onToggleFavorite={handleToggleFavorite}
          />
        ))}
      </div>

      {filtered.length === 0 && search && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum resultado para &ldquo;{search}&rdquo;
        </p>
      )}

      {/* Property detail sheet */}
      <Sheet open={!!selected && !showVisitForm} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="text-base">{selected.title}</SheetTitle>
                <SheetDescription className="text-sm">
                  {[selected.city, selected.zone].filter(Boolean).join(', ') || 'Portugal'}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* Image */}
                <div className="aspect-video relative bg-muted rounded-xl overflow-hidden">
                  {selected.cover_url ? (
                    <Image src={selected.cover_url} alt={selected.title} fill className="object-cover" sizes="100vw" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Building2 className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Price */}
                {selected.listing_price != null && (
                  <p className="text-xl font-bold text-primary">{fmt.format(selected.listing_price)}</p>
                )}

                {/* Specs */}
                <div className="flex flex-wrap gap-3">
                  {selected.typology && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <BedDouble className="h-4 w-4" /> {selected.typology}
                    </div>
                  )}
                  {selected.area_util != null && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Maximize2 className="h-4 w-4" /> {selected.area_util} m2
                    </div>
                  )}
                  {selected.property_type && (
                    <div className="text-sm text-muted-foreground capitalize">
                      {selected.property_type}
                    </div>
                  )}
                </div>

                {/* CTA */}
                <Button
                  className="w-full rounded-xl"
                  size="lg"
                  onClick={() => setShowVisitForm(true)}
                >
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Pedir Visita
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Visit request sheet */}
      <Sheet open={showVisitForm} onOpenChange={setShowVisitForm}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="text-base">Pedir Visita</SheetTitle>
            <SheetDescription className="text-sm">
              {selected?.title}
            </SheetDescription>
          </SheetHeader>

          <form
            className="mt-4 space-y-4"
            action={(formData) => handleRequestVisit(formData)}
          >
            <div className="space-y-2">
              <Label htmlFor="preferred_date">Data pretendida *</Label>
              <Input id="preferred_date" name="preferred_date" type="date" required className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferred_time">Hora pretendida *</Label>
              <Input id="preferred_time" name="preferred_time" type="time" required className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alternative_date">Data alternativa</Label>
              <Input id="alternative_date" name="alternative_date" type="date" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Mensagem (opcional)</Label>
              <Textarea
                id="message"
                name="message"
                placeholder="Alguma preferencia ou nota..."
                rows={3}
                className="rounded-xl resize-none"
              />
            </div>
            <Button type="submit" className="w-full rounded-xl" size="lg" disabled={visitLoading}>
              {visitLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A enviar...</>
              ) : (
                'Enviar Pedido'
              )}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function PropertyCard({
  property, isSeller, onSelect, onToggleFavorite,
}: {
  property: PortalProperty
  isSeller: boolean
  onSelect: () => void
  onToggleFavorite: (e: React.MouseEvent, id: string) => void
}) {
  const status = STATUS_LABELS[property.status]
  return (
    <Card
      className="rounded-xl shadow-sm overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
      onClick={onSelect}
    >
      <div className="aspect-video relative bg-muted">
        {property.cover_url ? (
          <Image src={property.cover_url} alt={property.title} fill className="object-cover" sizes="(max-width:640px) 100vw, 50vw" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Building2 className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}

        {/* Favorite button */}
        {!isSeller && (
          <button
            onClick={(e) => onToggleFavorite(e, property.id)}
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
          >
            <Heart className={`h-4 w-4 ${property.is_favorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
          </button>
        )}

        {/* Status badge */}
        {status && (
          <div className="absolute bottom-2 left-2">
            <Badge className={`text-[10px] ${status.className}`}>{status.label}</Badge>
          </div>
        )}
      </div>

      <CardContent className="p-3 space-y-1.5">
        <p className="text-sm font-medium truncate">{property.title}</p>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{[property.city, property.zone].filter(Boolean).join(', ') || 'Portugal'}</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {property.typology && (
            <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> {property.typology}</span>
          )}
          {property.area_util != null && (
            <span className="flex items-center gap-1"><Maximize2 className="h-3 w-3" /> {property.area_util} m2</span>
          )}
        </div>

        {property.listing_price != null && (
          <p className="text-sm font-semibold text-primary">{fmt.format(property.listing_price)}</p>
        )}

        {/* Seller stats */}
        {isSeller && (
          <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground border-t">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {property.visits_count} visitas</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {property.interested_count} interessados</span>
            <span>{property.days_on_market}d no mercado</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PropertiesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
