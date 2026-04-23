// @ts-nocheck
'use client'

import { useEffect, useState, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale/pt'
import { cn } from '@/lib/utils'
import {
  PARTNER_CATEGORY_LABELS,
  PARTNER_CATEGORY_COLORS,
  PARTNER_PAYMENT_OPTIONS,
} from '@/lib/constants'
import type { Partner, PartnerRating } from '@/types/partner'

import {
  ArrowLeft, Star, Phone, Mail, Globe, MapPin, Building2,
  User, Award, Lock, FileText, CreditCard, Pencil, Loader2,
  Calendar, Hash, Briefcase, Shield, CheckCircle2, XCircle,
  ExternalLink, Info, Receipt, MessageSquare, Activity,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { PartnerForm } from '@/components/partners/partner-form'

// ─── Tab config ────────────────────────────────────────────────
type TabKey = 'sobre' | 'morada' | 'fiscal' | 'avaliacoes' | 'estado'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'sobre', label: 'Sobre', icon: Info },
  { key: 'avaliacoes', label: 'Avaliações', icon: Star },
  { key: 'morada', label: 'Morada', icon: MapPin },
  { key: 'fiscal', label: 'Dados Fiscais', icon: Receipt },
  { key: 'estado', label: 'Estado', icon: Activity },
]

export default function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const isMobile = useIsMobile()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  const [partner, setPartner] = useState<(Partner & { ratings?: PartnerRating[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [canSeePrivate, setCanSeePrivate] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('sobre')

  // Rating state
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingHover, setRatingHover] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [isRating, setIsRating] = useState(false)

  const fetchPartner = useCallback(async () => {
    try {
      const res = await fetch(`/api/partners/${id}`)
      if (!res.ok) throw new Error('Erro ao carregar')
      const json = await res.json()
      setPartner(json.data)

      const listRes = await fetch('/api/partners?limit=1')
      if (listRes.ok) {
        const listJson = await listRes.json()
        setCanSeePrivate(listJson.canSeePrivate || false)
      }
    } catch {
      toast.error('Erro ao carregar parceiro')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchPartner() }, [fetchPartner])

  // Initialize map when morada tab is active
  useEffect(() => {
    if (activeTab !== 'morada') return
    if (!partner?.city || !mapContainerRef.current) return
    if (mapRef.current) return

    const initMap = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!

      // Geocode the address
      const addressQuery = [partner.address, partner.city, partner.postal_code, 'Portugal'].filter(Boolean).join(', ')
      let center: [number, number] = [-9.15, 38.72] // Default: Lisboa
      let zoom = 10

      try {
        const geoRes = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressQuery)}.json?access_token=${mapboxgl.accessToken}&language=pt&limit=1&country=PT`
        )
        if (geoRes.ok) {
          const geoData = await geoRes.json()
          if (geoData.features?.length > 0) {
            center = geoData.features[0].center as [number, number]
            zoom = 15
          }
        }
      } catch {}

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom,
        interactive: true,
      })

      new mapboxgl.Marker({ color: '#171717' })
        .setLngLat(center)
        .addTo(map)

      map.addControl(new mapboxgl.NavigationControl(), 'top-right')

      mapRef.current = map
    }

    initMap()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [activeTab, partner?.address, partner?.city, partner?.postal_code])

  const handleRate = async () => {
    if (ratingValue === 0) return
    setIsRating(true)
    try {
      const res = await fetch(`/api/partners/${id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: ratingValue, comment: ratingComment || undefined }),
      })
      if (!res.ok) throw new Error()
      toast.success('Avaliação registada')
      setRatingValue(0)
      setRatingComment('')
      fetchPartner()
    } catch {
      toast.error('Erro ao avaliar')
    } finally {
      setIsRating(false)
    }
  }

  const handleUpdate = async (data: any) => {
    try {
      const res = await fetch(`/api/partners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast.success('Parceiro actualizado')
      setShowEditDialog(false)
      fetchPartner()
    } catch {
      toast.error('Erro ao actualizar')
    }
  }

  const openInMaps = () => {
    if (!partner) return
    const q = [partner.address, partner.city, partner.postal_code, 'Portugal'].filter(Boolean).join(', ')
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-28 rounded-full" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!partner) return (
    <div className="flex flex-col items-center justify-center py-20">
      <XCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <p className="text-muted-foreground">Parceiro não encontrado.</p>
      <Button variant="outline" className="mt-4 rounded-full" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />Voltar
      </Button>
    </div>
  )

  const catColor = PARTNER_CATEGORY_COLORS[partner.category] || PARTNER_CATEGORY_COLORS.other
  const catLabel = PARTNER_CATEGORY_LABELS[partner.category] || 'Outro'
  const paymentLabel = partner.payment_method
    ? PARTNER_PAYMENT_OPTIONS.find((o) => o.value === partner.payment_method)?.label
    : null
  const ratings = partner.ratings || []
  const initials = partner.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  return (
    <div className="space-y-6 pb-12">
      {/* ═══ HERO ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/95 via-neutral-900/60 to-neutral-900/30" />

        <div className="relative z-10 px-6 sm:px-8 pt-5 pb-5">
          {/* Top row */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => router.push('/dashboard/parceiros')} className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>
            <div className="flex items-center gap-2">
              {partner.visibility === 'private' && (
                <Badge variant="outline" className="rounded-full text-[10px] border-white/20 text-white/60 gap-1">
                  <Lock className="h-3 w-3" />Privado
                </Badge>
              )}
              {!partner.is_active && (
                <Badge className="rounded-full text-[10px] bg-red-500/20 text-red-400 border-0">Inactivo</Badge>
              )}
              {canSeePrivate && (
                <button
                  onClick={() => setShowEditDialog(true)}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white hover:bg-white/25 transition-all"
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Profile section */}
          <div>
            <div className="flex items-end gap-5">
              {/* Avatar */}
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0">
                <span className="text-2xl sm:text-3xl font-bold text-white">{initials}</span>
              </div>

              <div className="flex-1 min-w-0 pb-1">
                {/* Category + recommended */}
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={cn(catColor.bg, catColor.text, 'border-0 rounded-full text-[11px] font-medium px-2.5 py-0.5')}
                  >
                    <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full inline-block', catColor.dot)} />
                    {catLabel}
                  </Badge>
                  {partner.is_recommended && (
                    <Badge className="rounded-full text-[10px] bg-amber-500/20 text-amber-400 border-0 gap-1">
                      <Award className="h-3 w-3" />Recomendado
                    </Badge>
                  )}
                </div>

                {/* Name */}
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight truncate">{partner.name}</h1>

                {/* Stars + contact person */}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={cn(
                          'h-4 w-4',
                          s <= Math.round(partner.rating_avg)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-white/20'
                        )}
                      />
                    ))}
                    <span className="text-sm font-bold text-white ml-1">
                      {partner.rating_avg > 0 ? partner.rating_avg.toFixed(1) : '—'}
                    </span>
                    <span className="text-xs text-neutral-400">
                      ({partner.rating_count} {partner.rating_count === 1 ? 'avaliação' : 'avaliações'})
                    </span>
                  </div>
                  {partner.contact_person && (
                    <span className="text-sm text-neutral-400">
                      · Contacto: {partner.contact_person}
                    </span>
                  )}
                </div>

                {/* Quick contact chips */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {partner.phone && (
                    <a href={`tel:${partner.phone}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors backdrop-blur-sm border border-white/10 px-3 py-1 text-xs text-white">
                      <Phone className="h-3 w-3" />{partner.phone}
                    </a>
                  )}
                  {partner.email && (
                    <a href={`mailto:${partner.email}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors backdrop-blur-sm border border-white/10 px-3 py-1 text-xs text-white truncate max-w-[220px]">
                      <Mail className="h-3 w-3 shrink-0" />{partner.email}
                    </a>
                  )}
                  {partner.website && (
                    <a href={partner.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors backdrop-blur-sm border border-white/10 px-3 py-1 text-xs text-white">
                      <Globe className="h-3 w-3" />Website
                      <ExternalLink className="h-2.5 w-2.5 text-white/50" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Tab selector — inside hero, responsive: icon-only on mobile, icon+text on sm+ */}
            <div className="flex items-center gap-0.5 sm:gap-1 p-1 mt-5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 w-full sm:w-fit">
              {TABS.map((t) => {
                const Icon = t.icon
                const isActive = activeTab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={cn(
                      'inline-flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300',
                      'flex-1 sm:flex-none px-2 sm:px-4',
                      isActive
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-300 hover:text-white hover:bg-white/10'
                    )}
                    title={t.label}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TAB CONTENT ═══ */}

      {/* ─── Sobre ─── */}
      {activeTab === 'sobre' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* O que fazem */}
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-4">
            <SectionHeader icon={Briefcase} title="O que fazem" color="violet" />
            {partner.specialties && partner.specialties.length > 0 ? (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Especialidades</p>
                <div className="flex flex-wrap gap-1.5">
                  {partner.specialties.map((s) => (
                    <Badge key={s} variant="secondary" className="rounded-full text-[11px]">{s}</Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem especialidades definidas</p>
            )}
            {partner.service_areas && partner.service_areas.length > 0 && (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Zonas de Actuação</p>
                <div className="flex flex-wrap gap-1.5">
                  {partner.service_areas.map((a) => (
                    <Badge key={a} variant="outline" className="rounded-full text-[11px]">{a}</Badge>
                  ))}
                </div>
              </div>
            )}
            {partner.average_delivery_days && (
              <InfoRow icon={Calendar} label="Prazo Médio de Entrega" value={`${partner.average_delivery_days} dias`} />
            )}
            {partner.payment_terms && (
              <InfoRow icon={CreditCard} label="Condições de Pagamento" value={partner.payment_terms} />
            )}
          </div>

          {/* Contacto */}
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-4">
            <SectionHeader icon={Phone} title="Contacto" color="blue" />
            <div className="space-y-3">
              {partner.contact_person && (
                <InfoRow icon={User} label="Pessoa de Contacto" value={partner.contact_person} />
              )}
              {partner.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Telemóvel</p>
                    <a href={`tel:${partner.phone}`} className="text-sm font-medium hover:underline">{partner.phone}</a>
                  </div>
                </div>
              )}
              {partner.phone_secondary && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Telefone Secundário</p>
                    <a href={`tel:${partner.phone_secondary}`} className="text-sm font-medium hover:underline">{partner.phone_secondary}</a>
                  </div>
                </div>
              )}
              {partner.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Email</p>
                    <a href={`mailto:${partner.email}`} className="text-sm font-medium hover:underline">{partner.email}</a>
                  </div>
                </div>
              )}
              {partner.website && (
                <div className="flex items-start gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Website</p>
                    <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
                      {partner.website.replace(/^https?:\/\//, '')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Condições Comerciais (admin) */}
          {canSeePrivate && partner.commercial_conditions && (
            <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-3">
              <SectionHeader icon={CreditCard} title="Condições Comerciais" color="teal" />
              <p className="text-sm whitespace-pre-wrap">{partner.commercial_conditions}</p>
            </div>
          )}

          {/* Notas Internas (admin) */}
          {canSeePrivate && partner.internal_notes && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
              <SectionHeader icon={FileText} title="Notas Internas" color="amber" />
              <p className="text-sm whitespace-pre-wrap">{partner.internal_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Morada ─── */}
      {activeTab === 'morada' && (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-4">
            <SectionHeader icon={MapPin} title="Morada" color="emerald" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={MapPin} label="Morada" value={partner.address || 'Não definida'} />
              <InfoRow icon={Building2} label="Cidade" value={partner.city || 'Não definida'} />
              <InfoRow icon={Hash} label="Código Postal" value={partner.postal_code || 'Não definido'} />
              {partner.phone_secondary && (
                <InfoRow icon={Phone} label="Telefone Secundário" value={partner.phone_secondary} />
              )}
            </div>

            {/* Open in Google Maps button */}
            {(partner.address || partner.city) && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5 text-xs"
                onClick={openInMaps}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir no Google Maps
              </Button>
            )}
          </div>

          {/* Map */}
          {(partner.address || partner.city) && (
            <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
              <div ref={mapContainerRef} className="h-80 w-full" />
            </div>
          )}
        </div>
      )}

      {/* ─── Dados Fiscais ─── */}
      {activeTab === 'fiscal' && (
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-4">
          <SectionHeader icon={Receipt} title="Dados Fiscais" color="blue" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow icon={Building2} label="Tipo de Pessoa" value={partner.person_type === 'coletiva' ? 'Pessoa Colectiva (Empresa)' : 'Pessoa Singular'} />
            <InfoRow icon={Hash} label="NIF / NIPC" value={partner.nif || 'Não definido'} />
            <InfoRow icon={CreditCard} label="Método de Pagamento" value={paymentLabel || 'Não definido'} />
            <InfoRow icon={Calendar} label="Registado em" value={format(new Date(partner.created_at), "dd 'de' MMMM 'de' yyyy", { locale: pt })} />
          </div>
          {partner.payment_terms && (
            <div className="pt-2">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Condições de Pagamento</p>
              <p className="text-sm font-medium">{partner.payment_terms}</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Avaliações ─── */}
      {activeTab === 'avaliacoes' && (
        <div className="space-y-4">
          {/* Summary card */}
          <div className="rounded-2xl border bg-card p-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="text-center shrink-0">
                <p className="text-5xl font-bold">{partner.rating_avg > 0 ? partner.rating_avg.toFixed(1) : '—'}</p>
                <div className="flex items-center gap-0.5 mt-2 justify-center">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={cn(
                        'h-5 w-5',
                        s <= Math.round(partner.rating_avg) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'
                      )}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {partner.rating_count} {partner.rating_count === 1 ? 'avaliação' : 'avaliações'}
                </p>
              </div>

              <Separator orientation="vertical" className="h-20 hidden sm:block" />
              <Separator className="sm:hidden" />

              {/* Rating breakdown */}
              <div className="flex-1 w-full space-y-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = ratings.filter(r => r.rating === star).length
                  const pct = ratings.length > 0 ? (count / ratings.length) * 100 : 0
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-3 text-right">{star}</span>
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* New rating */}
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-4">
            <h4 className="text-sm font-semibold">Avaliar este parceiro</h4>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="p-1 transition-transform hover:scale-110"
                  onMouseEnter={() => setRatingHover(s)}
                  onMouseLeave={() => setRatingHover(0)}
                  onClick={() => setRatingValue(s)}
                >
                  <Star
                    className={cn(
                      'h-7 w-7',
                      s <= (ratingHover || ratingValue)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground/20'
                    )}
                  />
                </button>
              ))}
              {ratingValue > 0 && (
                <span className="text-sm font-medium ml-2">
                  {['', 'Mau', 'Razoável', 'Bom', 'Muito Bom', 'Excelente'][ratingValue]}
                </span>
              )}
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
              Submeter Avaliação
            </Button>
          </div>

          {/* Existing ratings */}
          {ratings.length > 0 ? (
            <div className="space-y-3">
              {ratings.map((r: PartnerRating) => (
                <div key={r.id} className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{r.user?.commercial_name || 'Anónimo'}</span>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={cn(
                                'h-3.5 w-3.5',
                                s <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(r.created_at), 'dd/MM/yyyy', { locale: pt })}
                        </span>
                      </div>
                      {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border bg-card/50 p-8 text-center">
              <Star className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Ainda sem avaliações. Seja o primeiro a avaliar!</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Estado ─── */}
      {activeTab === 'estado' && (
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-4">
          <SectionHeader icon={Shield} title="Estado & Configuração" color="amber" />
          <div className="space-y-4">
            <StatusRow
              label="Activo"
              active={partner.is_active}
              activeText="Sim"
              inactiveText="Não"
              activeIcon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              inactiveIcon={<XCircle className="h-4 w-4 text-red-500" />}
            />
            <Separator />
            <StatusRow
              label="Recomendado"
              active={partner.is_recommended}
              activeText="Sim"
              inactiveText="Não"
              activeIcon={<Award className="h-4 w-4 text-amber-500" />}
              inactiveIcon={<span className="text-sm text-muted-foreground">—</span>}
            />
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Visibilidade</span>
              <Badge variant="outline" className="rounded-full text-[11px]">
                {partner.visibility === 'public' ? 'Público' : 'Privado'}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Categoria</span>
              <Badge
                variant="secondary"
                className={cn(catColor.bg, catColor.text, 'border-0 rounded-full text-[11px]')}
              >
                <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full inline-block', catColor.dot)} />
                {catLabel}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Criado em</span>
              <span className="text-sm font-medium">
                {format(new Date(partner.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
              </span>
            </div>
            {partner.updated_at && partner.updated_at !== partner.created_at && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Última actualização</span>
                  <span className="text-sm font-medium">
                    {format(new Date(partner.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ EDIT SHEET ═══ */}
      <Sheet open={showEditDialog} onOpenChange={setShowEditDialog}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
            'bg-background',
            isMobile
              ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
              : 'w-full data-[side=right]:sm:max-w-[640px] sm:rounded-l-3xl',
          )}
        >
          {isMobile && (
            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
          )}
          <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
            <SheetHeader className="p-0 gap-0">
              <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
                Editar parceiro
              </SheetTitle>
              <SheetDescription className="sr-only">
                Edita os detalhes do parceiro.
              </SheetDescription>
            </SheetHeader>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6">
            <PartnerForm
              partner={partner}
              canSeePrivate={canSeePrivate}
              onSubmit={handleUpdate}
              onCancel={() => setShowEditDialog(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Helper Components ────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, color }: { icon: any; title: string; color: string }) {
  const colorMap: Record<string, string> = {
    violet: 'bg-violet-500/10 text-violet-600',
    blue: 'bg-blue-500/10 text-blue-600',
    emerald: 'bg-emerald-500/10 text-emerald-600',
    teal: 'bg-teal-500/10 text-teal-600',
    amber: 'bg-amber-500/10 text-amber-600',
  }
  const classes = colorMap[color] || colorMap.blue
  return (
    <div className="flex items-center gap-2">
      <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center', classes.split(' ')[0])}>
        <Icon className={cn('h-4 w-4', classes.split(' ')[1])} />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function StatusRow({ label, active, activeText, inactiveText, activeIcon, inactiveIcon }: {
  label: string; active: boolean; activeText: string; inactiveText: string; activeIcon: React.ReactNode; inactiveIcon: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {active ? activeIcon : inactiveIcon}
        {active
          ? <span className="text-sm font-medium text-emerald-600">{activeText}</span>
          : <span className="text-sm font-medium text-muted-foreground">{inactiveText}</span>
        }
      </div>
    </div>
  )
}
