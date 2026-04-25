// @ts-nocheck
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Star, Phone, Mail, MapPin, Globe, Award, Lock, User, Building2, Pencil,
  Loader2, Info, Receipt, Activity, CheckCircle2, XCircle, Hash, Clock,
  CreditCard, Briefcase, FileText, Calendar, Trash2,
} from 'lucide-react'
import { PARTNER_PAYMENT_OPTIONS } from '@/lib/constants'
import {
  usePartnerCategories,
  resolvePartnerCategoryColor,
} from '@/hooks/use-partner-categories'
import type { Partner, PartnerRating } from '@/types/partner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn, normalizeWebsiteUrl } from '@/lib/utils'

type TabKey = 'perfil' | 'sobre' | 'avaliacoes' | 'morada' | 'fiscal' | 'estado'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'perfil', label: 'Perfil', icon: User },
  { key: 'sobre', label: 'Sobre', icon: Info },
  { key: 'avaliacoes', label: 'Avaliações', icon: Star },
  { key: 'morada', label: 'Morada', icon: MapPin },
  { key: 'fiscal', label: 'Fiscal', icon: Receipt },
  { key: 'estado', label: 'Estado', icon: Activity },
]

interface PartnerDetailSheetProps {
  partnerId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRate?: (id: string, rating: number, comment?: string) => Promise<boolean>
  onApprove?: (id: string) => Promise<boolean>
  onReject?: (id: string, reason: string) => Promise<boolean>
  onDelete?: (id: string) => Promise<boolean>
  onUpdated?: () => void
}

export function PartnerDetailSheet({
  partnerId,
  open,
  onOpenChange,
  onRate,
  onApprove,
  onReject,
  onDelete,
  onUpdated,
}: PartnerDetailSheetProps) {
  const isMobile = useIsMobile()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  const [partner, setPartner] = useState<(Partner & { ratings?: PartnerRating[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [isStaff, setIsStaff] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('perfil')
  const [editing, setEditing] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)

  const [ratingValue, setRatingValue] = useState(0)
  const [ratingHover, setRatingHover] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [isRating, setIsRating] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const { categories } = usePartnerCategories()
  const categoryRow = partner ? categories.find((c) => c.slug === partner.category) : null

  const fetchPartner = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/partners/${id}`)
      if (!res.ok) throw new Error('Erro ao carregar')
      const json = await res.json()
      setPartner(json.data)
      setIsStaff(!!json.isStaff)
      setCanEdit(!!json.canEdit)
    } catch {
      toast.error('Erro ao carregar parceiro')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && partnerId) {
      setActiveTab('perfil')
      setEditing(false)
      setRatingValue(0)
      setRatingComment('')
      fetchPartner(partnerId)
    }
    if (!open) {
      setPartner(null)
    }
  }, [open, partnerId, fetchPartner])

  // Init map on morada tab
  useEffect(() => {
    if (activeTab !== 'morada') return
    if (!partner?.city || !mapContainerRef.current) return
    if (mapRef.current) return

    const initMap = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!

      const addressQuery = [partner.address, partner.city, partner.postal_code, 'Portugal'].filter(Boolean).join(', ')
      let center: [number, number] = [-9.15, 38.72]
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

      new mapboxgl.Marker({ color: '#171717' }).setLngLat(center).addTo(map)
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
    if (!onRate || !partner || ratingValue === 0) return
    setIsRating(true)
    const ok = await onRate(partner.id, ratingValue, ratingComment || undefined)
    if (ok) {
      setRatingValue(0)
      setRatingComment('')
      fetchPartner(partner.id)
    }
    setIsRating(false)
  }

  const handleApprove = async () => {
    if (!onApprove || !partner) return
    setIsReviewing(true)
    const ok = await onApprove(partner.id)
    setIsReviewing(false)
    if (ok) {
      fetchPartner(partner.id)
      onUpdated?.()
    }
  }

  const handleReject = async () => {
    if (!onReject || !partner || !rejectReason.trim()) return
    setIsReviewing(true)
    const ok = await onReject(partner.id, rejectReason.trim())
    setIsReviewing(false)
    if (ok) {
      setRejectOpen(false)
      setRejectReason('')
      fetchPartner(partner.id)
      onUpdated?.()
    }
  }

  const handleDelete = async () => {
    if (!partner) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/partners/${partner.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao eliminar')
      }
      toast.success(isStaff ? 'Parceiro eliminado' : 'Proposta retirada')
      setDeleteOpen(false)
      onOpenChange(false)
      onUpdated?.()
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao eliminar')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleUpdate = async (data: any) => {
    if (!partner) return
    try {
      const res = await fetch(`/api/partners/${partner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao actualizar')
      }
      toast.success('Parceiro actualizado')
      setEditing(false)
      fetchPartner(partner.id)
      onUpdated?.()
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao actualizar')
    }
  }

  const catColor = partner ? resolvePartnerCategoryColor(categoryRow?.color || 'slate') : null
  const catLabel = partner ? (categoryRow?.label || partner.category || 'Outro') : ''
  const paymentLabel = partner?.payment_method
    ? PARTNER_PAYMENT_OPTIONS.find((o) => o.value === partner.payment_method)?.label
    : null
  const initials = partner?.name
    ? partner.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
    : ''
  const isPending = partner?.status === 'pending'
  const isRejected = partner?.status === 'rejected'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl bg-muted',
          isMobile
            ? 'data-[side=bottom]:h-[75dvh] rounded-t-3xl'
            : 'h-full w-full data-[side=right]:sm:max-w-[760px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-10" />
        )}

        <SheetHeader className="shrink-0 px-6 pt-8 pb-3 sm:pt-10 gap-0 flex-row items-start justify-between">
          <div>
            <SheetTitle className="text-[20px] font-semibold leading-tight tracking-tight">
              {editing ? 'Editar parceiro' : 'Parceiro'}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Detalhes do parceiro.
            </SheetDescription>
          </div>
          {!editing && canEdit && partner && (
            <div className="flex items-center gap-2 mr-10">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full h-8 text-xs"
                onClick={() => setEditing(true)}
              >
                <Pencil className="mr-1.5 h-3 w-3" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-1.5 h-3 w-3" />
                {isStaff ? 'Eliminar' : 'Retirar'}
              </Button>
            </div>
          )}
        </SheetHeader>

        {loading ? (
          <div className="flex-1 px-6 py-4 space-y-4">
            <Skeleton className="h-52 rounded-2xl" />
            <Skeleton className="h-12 rounded-full" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : !partner ? (
          <div className="flex-1 flex items-center justify-center px-6 py-8">
            <p className="text-sm text-muted-foreground">Parceiro não encontrado.</p>
          </div>
        ) : editing ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <PartnerForm
              partner={partner}
              canSeePrivate={isStaff}
              isProposal={!isStaff && isPending}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="px-6 space-y-4 pb-8">

              {/* Status banner for proposals */}
              {isPending && (
                <div className="rounded-2xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Proposta pendente</p>
                      <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                        {isStaff ? 'Aprova ou rejeita para tornar visível.' : 'A staff está a rever a tua proposta.'}
                      </p>
                    </div>
                  </div>
                  {isStaff && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full h-7 px-2.5 text-[11px] border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40"
                        disabled={isReviewing}
                        onClick={() => setRejectOpen(true)}
                      >
                        Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-full h-7 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={isReviewing}
                        onClick={handleApprove}
                      >
                        Aprovar
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {isRejected && (
                <div className="rounded-2xl border border-red-400/40 bg-red-50 dark:bg-red-950/30 px-4 py-3 flex items-start gap-2.5">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-900 dark:text-red-200">Proposta rejeitada</p>
                    {partner.rejection_reason && (
                      <p className="text-[11px] text-red-800/80 dark:text-red-300/80 mt-0.5">
                        {partner.rejection_reason}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Tab selector */}
              <div className="flex items-center gap-1 p-1 rounded-full bg-background border border-border/50 w-fit max-w-full mx-auto overflow-x-auto">
                {TABS.map((t) => {
                  const Icon = t.icon
                  const isActive = activeTab === t.key
                  return (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      className={cn(
                        'inline-flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 shrink-0',
                        isActive ? 'bg-foreground text-background px-3.5' : 'text-muted-foreground hover:text-foreground h-8 w-8',
                      )}
                      title={t.label}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {isActive && <span>{t.label}</span>}
                    </button>
                  )
                })}
              </div>

              {/* Tab content */}
              {activeTab === 'perfil' && (
                <div className="space-y-4">
                  {/* Profile card (with optional cover hero) */}
                  <div className="rounded-2xl bg-background border border-border/50 shadow-sm overflow-hidden">
                    {partner.cover_image_url ? (
                      <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={partner.cover_image_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover object-top"
                        />
                      </div>
                    ) : null}

                    <div
                      className={cn(
                        'px-6 pb-8 flex flex-col items-center text-center',
                        partner.cover_image_url ? 'pt-6' : 'pt-10',
                      )}
                    >
                      {!partner.cover_image_url && (
                        <div
                          className={cn(
                            'h-28 w-28 rounded-full flex items-center justify-center shrink-0 ring-4 ring-background shadow-sm',
                            catColor?.bg ?? 'bg-muted',
                          )}
                        >
                          <span className={cn('text-3xl font-bold', catColor?.text ?? 'text-foreground')}>
                            {initials || <Building2 className="h-10 w-10" />}
                          </span>
                        </div>
                      )}
                      <h2 className={cn('text-xl font-semibold tracking-tight leading-tight', partner.cover_image_url ? 'mt-0' : 'mt-4')}>
                        {partner.name}
                      </h2>
                      {partner.email ? (
                        <a href={`mailto:${partner.email}`} className="text-sm text-muted-foreground hover:text-foreground truncate max-w-full">
                          {partner.email}
                        </a>
                      ) : partner.phone ? (
                        <a href={`tel:${partner.phone}`} className="text-sm text-muted-foreground hover:text-foreground">
                          {partner.phone}
                        </a>
                      ) : null}

                      <div className="mt-3 flex items-center gap-1.5 flex-wrap justify-center">
                        {catColor && (
                          <Badge variant="secondary" className={cn(catColor.bg, catColor.text, 'border-0 rounded-full text-[11px] px-2.5 py-0.5')}>
                            <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full inline-block', catColor.dot)} />
                            {catLabel}
                          </Badge>
                        )}
                        {partner.is_recommended && !isPending && !isRejected && (
                          <Badge className="rounded-full text-[10px] gap-1 bg-black/80 text-white border border-white/15 backdrop-blur-md shadow-sm">
                            <Award className="h-3 w-3" />
                            Recomendado
                          </Badge>
                        )}
                        {partner.visibility === 'private' && (
                          <Badge variant="outline" className="rounded-full text-[10px] gap-1">
                            <Lock className="h-3 w-3" />
                            Privado
                          </Badge>
                        )}
                        {!partner.is_active && (
                          <Badge variant="secondary" className="rounded-full text-[10px] bg-red-500/15 text-red-700 dark:text-red-400 border-0">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {partner.description && (
                    <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-5">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                        {partner.description}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'sobre' && (
                <SectionCard title="Dados Gerais" subtitle="Informação básica do parceiro.">
                  <DetailRow icon={Briefcase} label="Categoria" value={catLabel} />
                  {partner.contact_person && (
                    <DetailRow icon={User} label="Pessoa de contacto" value={partner.contact_person} />
                  )}
                  {partner.phone && (
                    <DetailRow icon={Phone} label="Telemóvel" value={partner.phone} href={`tel:${partner.phone}`} />
                  )}
                  {partner.phone_secondary && (
                    <DetailRow icon={Phone} label="Telefone secundário" value={partner.phone_secondary} href={`tel:${partner.phone_secondary}`} />
                  )}
                  {partner.email && (
                    <DetailRow icon={Mail} label="Email" value={partner.email} href={`mailto:${partner.email}`} />
                  )}
                  {partner.website && (
                    <DetailRow icon={Globe} label="Website" value={partner.website} href={normalizeWebsiteUrl(partner.website)} external />
                  )}

                  {partner.specialties && partner.specialties.length > 0 && (
                    <div className="pt-2 space-y-1.5">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Especialidades</p>
                      <div className="flex flex-wrap gap-1.5">
                        {partner.specialties.map((s) => (
                          <Badge key={s} variant="secondary" className="rounded-full text-[10px]">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {partner.service_areas && partner.service_areas.length > 0 && (
                    <div className="pt-1 space-y-1.5">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Zonas de actuação</p>
                      <div className="flex flex-wrap gap-1.5">
                        {partner.service_areas.map((a) => (
                          <Badge key={a} variant="outline" className="rounded-full text-[10px]">{a}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {paymentLabel && (
                    <DetailRow icon={CreditCard} label="Método de pagamento" value={paymentLabel} />
                  )}

                  {isStaff && partner.commercial_conditions && (
                    <div className="pt-2">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Condições comerciais</p>
                      <p className="text-sm whitespace-pre-wrap">{partner.commercial_conditions}</p>
                    </div>
                  )}

                  {isStaff && partner.internal_notes && (
                    <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                        Notas internas
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{partner.internal_notes}</p>
                    </div>
                  )}
                </SectionCard>
              )}

              {activeTab === 'avaliacoes' && (
                <div className="space-y-4">
                  <SectionCard title="Avaliações" subtitle="Feedback de outros utilizadores.">
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={cn(
                            'h-5 w-5',
                            s <= Math.round(partner.rating_avg)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-muted-foreground/20',
                          )}
                        />
                      ))}
                      <span className="text-sm font-semibold ml-1">
                        {partner.rating_avg > 0 ? partner.rating_avg.toFixed(1) : '—'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({partner.rating_count} {partner.rating_count === 1 ? 'avaliação' : 'avaliações'})
                      </span>
                    </div>

                    {partner.ratings && partner.ratings.length > 0 ? (
                      <div className="pt-3 space-y-3">
                        {partner.ratings.map((r) => (
                          <div key={r.id} className="rounded-xl bg-muted/40 px-3 py-2.5 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <span className="text-xs font-medium">
                                  {r.user?.commercial_name || 'Utilizador'}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={cn(
                                      'h-3 w-3',
                                      s <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20',
                                    )}
                                  />
                                ))}
                              </div>
                            </div>
                            {r.comment && (
                              <p className="text-xs text-muted-foreground">{r.comment}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground pt-2">Sem avaliações ainda.</p>
                    )}
                  </SectionCard>

                  {onRate && !isPending && !isRejected && (
                    <SectionCard title="Avaliar Parceiro" subtitle="Partilha a tua experiência.">
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
                              className={cn(
                                'h-6 w-6',
                                s <= (ratingHover || ratingValue)
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-muted-foreground/20',
                              )}
                            />
                          </button>
                        ))}
                      </div>
                      <Textarea
                        className="rounded-xl mt-2"
                        rows={3}
                        placeholder="Comentário (opcional)..."
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                      />
                      <div className="flex justify-end pt-1">
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
                    </SectionCard>
                  )}
                </div>
              )}

              {activeTab === 'morada' && (
                <SectionCard title="Morada" subtitle="Localização do parceiro.">
                  {partner.address && (
                    <DetailRow icon={MapPin} label="Morada" value={partner.address} />
                  )}
                  {partner.postal_code && (
                    <DetailRow icon={Hash} label="Código postal" value={partner.postal_code} />
                  )}
                  {partner.city && (
                    <DetailRow icon={Building2} label="Cidade" value={partner.city} />
                  )}
                  {(partner.address || partner.city || partner.postal_code) ? (
                    <div
                      ref={mapContainerRef}
                      className="h-56 w-full rounded-xl bg-muted mt-3 overflow-hidden"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem morada definida.</p>
                  )}
                </SectionCard>
              )}

              {activeTab === 'fiscal' && (
                <SectionCard title="Dados Fiscais" subtitle="Identificação e pagamentos.">
                  <DetailRow icon={User} label="Tipo de pessoa" value={partner.person_type === 'singular' ? 'Singular' : 'Colectiva'} />
                  {partner.nif && (
                    <DetailRow icon={Hash} label="NIF / NIPC" value={partner.nif} />
                  )}
                  {paymentLabel && (
                    <DetailRow icon={CreditCard} label="Método de pagamento" value={paymentLabel} />
                  )}
                  {partner.payment_terms && (
                    <DetailRow icon={FileText} label="Condições de pagamento" value={partner.payment_terms} />
                  )}
                  {typeof partner.average_delivery_days === 'number' && (
                    <DetailRow icon={Clock} label="Prazo médio de entrega" value={`${partner.average_delivery_days} dias`} />
                  )}
                </SectionCard>
              )}

              {activeTab === 'estado' && (
                <SectionCard title="Estado" subtitle="Aprovação, visibilidade e auditoria.">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-muted-foreground">Estado</span>
                    <StatusPill status={partner.status} />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-muted-foreground">Activo</span>
                    {partner.is_active ? (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Sim
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" /> Não
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-muted-foreground">Visibilidade</span>
                    <span className="text-sm font-medium">
                      {partner.visibility === 'public' ? 'Pública' : 'Privada'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-muted-foreground">Recomendado</span>
                    <span className="text-sm font-medium">{partner.is_recommended ? 'Sim' : 'Não'}</span>
                  </div>
                  {partner.created_at && (
                    <DetailRow icon={Calendar} label="Criado em" value={formatDate(partner.created_at)} />
                  )}
                  {partner.reviewed_at && (
                    <DetailRow icon={Calendar} label="Revisto em" value={formatDate(partner.reviewed_at)} />
                  )}
                  {isRejected && partner.rejection_reason && (
                    <div className="mt-3 rounded-xl border border-red-400/30 bg-red-50 dark:bg-red-950/20 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-400 mb-1">
                        Motivo da rejeição
                      </p>
                      <p className="text-sm">{partner.rejection_reason}</p>
                    </div>
                  )}
                </SectionCard>
              )}
            </div>
          </div>
        )}

        {/* Reject nested sheet — staff only */}
        <Sheet open={rejectOpen} onOpenChange={(o) => { setRejectOpen(o); if (!o) setRejectReason('') }}>
          <SheetContent
            side={isMobile ? 'bottom' : 'right'}
            className={cn(
              'p-0 flex flex-col border-border/40 shadow-2xl bg-background',
              isMobile ? 'data-[side=bottom]:h-[55dvh] rounded-t-3xl' : 'w-full data-[side=right]:sm:max-w-[480px] sm:rounded-l-3xl',
            )}
          >
            <div className="px-6 pt-8 pb-4 sm:pt-10">
              <SheetHeader className="p-0 gap-0">
                <SheetTitle className="text-[20px] font-semibold leading-tight tracking-tight">
                  Rejeitar proposta
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-1">
                  Indica o motivo — será visível para o consultor.
                </SheetDescription>
              </SheetHeader>
            </div>
            <div className="flex-1 px-6 space-y-3">
              <Textarea
                rows={5}
                className="rounded-xl"
                placeholder="Ex: parceiro duplicado, dados incompletos..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="px-6 py-4 flex justify-end gap-2 border-t border-border/40">
              <Button variant="outline" className="rounded-full" onClick={() => { setRejectOpen(false); setRejectReason('') }}>
                Cancelar
              </Button>
              <Button
                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleReject}
                disabled={!rejectReason.trim() || isReviewing}
              >
                {isReviewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Rejeitar
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Delete / Withdraw confirmation */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isStaff ? 'Eliminar parceiro' : 'Retirar proposta'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isStaff
                  ? 'Tem a certeza de que pretende eliminar este parceiro? Esta acção é irreversível.'
                  : 'Tem a certeza de que pretende retirar esta proposta?'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isStaff ? 'Eliminar' : 'Retirar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}

// ─── helpers ───────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-5">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5 mb-3">{subtitle}</p>}
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
}

function DetailRow({
  icon: Icon, label, value, href, external,
}: {
  icon: React.ElementType; label: string; value: string; href?: string | null; external?: boolean
}) {
  const content = (
    <>
      <div className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </>
  )
  if (href) {
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="flex items-center gap-3 py-1 -mx-1 px-1 rounded-lg hover:bg-muted/40 transition-colors"
      >
        {content}
      </a>
    )
  }
  return <div className="flex items-center gap-3 py-1">{content}</div>
}

function StatusPill({ status }: { status: Partner['status'] }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium px-2.5 py-0.5">
        <CheckCircle2 className="h-3 w-3" /> Aprovado
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[11px] font-medium px-2.5 py-0.5">
        <Clock className="h-3 w-3" /> Pendente
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-700 dark:text-red-400 text-[11px] font-medium px-2.5 py-0.5">
      <XCircle className="h-3 w-3" /> Rejeitado
    </span>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-PT', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return iso
  }
}
