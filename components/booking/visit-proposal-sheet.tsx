'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  CalendarDays, Check, Clock, ExternalLink, Loader2, Mail,
  MapPin, Phone, User, X, MessageSquare, ShieldCheck, Building2,
} from 'lucide-react'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

interface PropertyMedia {
  url: string
  is_cover: boolean | null
  order_index: number | null
}

interface VisitDetail {
  id: string
  visit_date: string
  visit_time: string
  duration_minutes: number | null
  status: string
  notes: string | null
  rejected_reason: string | null
  proposal_responded_at: string | null
  created_at: string
  client_name: string | null
  client_type?: string | null
  client_agency?: string | null
  booking_source?: string | null
  property: {
    id: string
    title: string | null
    external_ref: string | null
    city: string | null
    zone: string | null
    address_street: string | null
    slug: string | null
    listing_price: number | null
    property_type: string | null
    dev_property_media: PropertyMedia[]
  } | null
  consultant: { id: string; commercial_name: string } | null
  lead: { id: string; full_name: string | null; telemovel: string | null; email: string | null } | null
}

function pickCoverImage(media: PropertyMedia[] | undefined | null): string | null {
  if (!media || media.length === 0) return null
  const cover = media.find((m) => m.is_cover)
  if (cover) return cover.url
  const sorted = [...media].sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999))
  return sorted[0]?.url ?? null
}

function formatPrice(price: number | null): string | null {
  if (!price) return null
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(price)
}

// ─── Shared content ─────────────────────────────────────────────────────────

interface VisitProposalContentProps {
  visitId: string | null
  variant?: 'sheet' | 'inline'
  onRefresh?: () => void
  onClose?: () => void
}

export function VisitProposalContent({
  visitId,
  variant = 'sheet',
  onRefresh,
  onClose,
}: VisitProposalContentProps) {
  const [visit, setVisit] = useState<VisitDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const fetchVisit = useCallback(async () => {
    if (!visitId) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/visits/${visitId}`)
      if (!res.ok) throw new Error()
      const payload = await res.json()
      setVisit(payload.data)
    } catch {
      toast.error('Erro ao carregar proposta de visita')
    } finally {
      setIsLoading(false)
    }
  }, [visitId])

  useEffect(() => {
    if (visitId) {
      fetchVisit()
    } else {
      setVisit(null)
      setRejectReason('')
      setRejectOpen(false)
    }
  }, [visitId, fetchVisit])

  const respond = async (decision: 'confirm' | 'reject', reason?: string) => {
    if (!visitId) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/visits/${visitId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision === 'confirm' ? { decision } : { decision, reason }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao responder à proposta')
      }
      toast.success(decision === 'confirm' ? 'Visita confirmada' : 'Proposta rejeitada')
      setRejectOpen(false)
      setRejectReason('')
      onRefresh?.()
      onClose?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isPending = visit?.status === 'proposal' && !visit?.proposal_responded_at
  const wasRejected = visit?.status === 'rejected'
  const wasConfirmed = !!visit?.proposal_responded_at && !wasRejected

  const visitWhenLong = visit?.visit_date && visit?.visit_time
    ? format(new Date(`${visit.visit_date}T${visit.visit_time}`), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: pt })
    : null

  const addressLine = [visit?.property?.address_street, visit?.property?.zone, visit?.property?.city]
    .filter(Boolean)
    .join(', ')

  const clientName = visit?.lead?.full_name || visit?.client_name || 'Cliente'
  const isConsultantRequest = visit?.client_type === 'consultant'
  const coverImage = pickCoverImage(visit?.property?.dev_property_media)
  const price = formatPrice(visit?.property?.listing_price ?? null)

  const header = (
    <div className="flex items-center justify-between px-6 py-4 border-b">
      <h3 className="text-base font-semibold tracking-tight">Proposta de visita</h3>
      {variant === 'inline' && onClose && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )

  const body = isLoading ? (
    <div className="p-6 space-y-4">
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
    </div>
  ) : visit ? (
    <div className="p-6 space-y-4">
      {/* Status pill */}
      <div>
        {isPending && (
          <Badge variant="outline" className="border-0 bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-full h-6 px-2.5">
            <span className="size-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
            Pendente de resposta
          </Badge>
        )}
        {wasConfirmed && (
          <Badge variant="outline" className="border-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-full h-6 px-2.5">
            <Check className="size-3 mr-1" />
            Confirmada
          </Badge>
        )}
        {wasRejected && (
          <Badge variant="outline" className="border-0 bg-red-500/10 text-red-700 dark:text-red-300 rounded-full h-6 px-2.5">
            <X className="size-3 mr-1" />
            Rejeitada
          </Badge>
        )}
      </div>

      {/* Imóvel — card com imagem hero */}
      <div className={cn(
        'group relative rounded-2xl overflow-hidden bg-card',
        'shadow-[0_2px_10px_-2px_rgba(15,23,42,0.08),0_1px_3px_-1px_rgba(15,23,42,0.05)]',
      )}>
        {coverImage ? (
          <div className="relative aspect-[16/9] bg-muted">
            <Image
              src={coverImage}
              alt={visit.property?.title || 'Imóvel'}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 500px"
            />
            {/* Gradient overlay para legibilidade do texto */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            {/* Info overlay */}
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-semibold leading-tight tracking-tight truncate">
                    {visit.property?.title || 'Imóvel'}
                  </h4>
                  {addressLine && (
                    <p className="text-xs text-white/85 mt-0.5 flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {addressLine}
                    </p>
                  )}
                </div>
                {price && (
                  <div className="text-sm font-semibold tabular-nums shrink-0">{price}</div>
                )}
              </div>
            </div>
            {visit.property?.id && (
              <Link
                href={`/dashboard/imoveis/${visit.property.id}`}
                className="absolute top-3 right-3 size-8 rounded-full bg-white/90 backdrop-blur-md text-neutral-900 flex items-center justify-center shadow-sm hover:bg-white transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        ) : (
          // Fallback sem imagem — mantém padrão pillow
          <div className="flex items-start gap-3 p-4">
            <div className="size-11 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Building2 className="size-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold tracking-tight truncate">
                {visit.property?.title || 'Imóvel'}
              </h4>
              {addressLine && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {addressLine}
                </p>
              )}
              {price && (
                <p className="text-xs font-medium mt-1 tabular-nums">{price}</p>
              )}
            </div>
            {visit.property?.id && (
              <Link href={`/dashboard/imoveis/${visit.property.id}`} className="shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Card unificado: Agendamento + Cliente */}
      <div className={cn(
        'rounded-2xl bg-card overflow-hidden',
        'shadow-[0_2px_10px_-2px_rgba(15,23,42,0.06),0_1px_3px_-1px_rgba(15,23,42,0.04)]',
      )}>
        {/* Agendamento */}
        <div className="p-4 space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Agendamento
          </div>
          {visitWhenLong && (
            <div className="flex items-center gap-2.5">
              <CalendarDays className="size-4 text-foreground/70 shrink-0" />
              <span className="text-sm font-medium capitalize">{visitWhenLong}</span>
            </div>
          )}
          {visit.duration_minutes && (
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <Clock className="size-3.5 shrink-0" />
              {visit.duration_minutes} minutos
            </div>
          )}
        </div>

        {/* Divider interno — fino */}
        <div className="border-t border-border/40 mx-4" />

        {/* Cliente */}
        <div className="p-4 space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cliente
          </div>
          <div className="flex items-center gap-2.5">
            <User className="size-4 text-foreground/70 shrink-0" />
            <span className="text-sm font-medium">{clientName}</span>
            {isConsultantRequest && (
              <Badge variant="outline" className="text-[9px] font-medium h-4 px-1.5 rounded-full border-violet-500/30 text-violet-700 dark:text-violet-300 bg-violet-500/5">
                <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />
                Consultor
              </Badge>
            )}
          </div>
          {visit.client_agency && (
            <div className="text-xs text-muted-foreground pl-6">
              {visit.client_agency}
            </div>
          )}
          {visit.lead?.email && (
            <a href={`mailto:${visit.lead.email}`} className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="size-3.5 shrink-0" />
              <span className="truncate">{visit.lead.email}</span>
            </a>
          )}
          {visit.lead?.telemovel && (
            <a href={`tel:${visit.lead.telemovel}`} className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Phone className="size-3.5 shrink-0" />
              {visit.lead.telemovel}
            </a>
          )}
          {visit.consultant && (
            <div className="text-[11px] text-muted-foreground pt-1 mt-1 border-t border-border/40">
              Proposta enviada por <span className="font-medium text-foreground/80">{visit.consultant.commercial_name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Mensagem (só se houver) */}
      {visit.notes && (
        <div className={cn(
          'rounded-2xl bg-muted/30 p-4',
        )}>
          <div className="flex items-start gap-2.5">
            <MessageSquare className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{visit.notes}</p>
          </div>
        </div>
      )}

      {/* Histórico */}
      {!isPending && visit.proposal_responded_at && (
        <div className="rounded-2xl bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
          <div>
            Respondida em{' '}
            <strong className="text-foreground/80">
              {format(new Date(visit.proposal_responded_at), "d 'de' MMM 'às' HH:mm", { locale: pt })}
            </strong>
          </div>
          {wasRejected && visit.rejected_reason && (
            <div>
              <span className="text-muted-foreground">Motivo:</span>{' '}
              <span className="text-foreground">{visit.rejected_reason}</span>
            </div>
          )}
        </div>
      )}

      {/* Acções — botões glassmorphic pill */}
      {isPending && (
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => respond('confirm')}
            disabled={isSubmitting}
            className={cn(
              'flex-1 rounded-full px-4 py-3 flex items-center justify-center gap-2',
              'bg-emerald-600 text-white',
              'shadow-[0_8px_24px_-6px_rgba(5,150,105,0.5),0_2px_6px_-2px_rgba(5,150,105,0.3)]',
              'hover:bg-emerald-700 hover:shadow-[0_12px_32px_-8px_rgba(5,150,105,0.6)]',
              'hover:-translate-y-[1px] transition-all duration-200',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            )}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span className="text-sm font-semibold tracking-tight">Confirmar</span>
          </button>
          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            disabled={isSubmitting}
            className={cn(
              'flex-1 rounded-full px-4 py-3 flex items-center justify-center gap-2',
              'bg-card/70 backdrop-blur-md border border-red-500/30 text-red-600 dark:text-red-400',
              'shadow-[0_2px_10px_-2px_rgba(220,38,38,0.12)]',
              'hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-500/50',
              'hover:shadow-[0_6px_20px_-4px_rgba(220,38,38,0.18)]',
              'hover:-translate-y-[1px] transition-all duration-200',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            )}
          >
            <X className="h-4 w-4" />
            <span className="text-sm font-semibold tracking-tight">Rejeitar</span>
          </button>
        </div>
      )}
    </div>
  ) : (
    <div className="p-6 text-sm text-muted-foreground">
      Proposta não encontrada.
    </div>
  )

  const rejectDialog = (
    <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rejeitar proposta de visita</AlertDialogTitle>
          <AlertDialogDescription>
            Indica o motivo pelo qual estás a rejeitar esta proposta. O consultor
            do comprador vai receber esta mensagem.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Ex: Imóvel com visita já marcada nesse horário"
          rows={3}
          autoFocus
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!rejectReason.trim() || isSubmitting}
            onClick={(e) => {
              e.preventDefault()
              respond('reject', rejectReason.trim())
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            {isSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Rejeitar proposta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  if (variant === 'inline') {
    return (
      <div className="flex flex-col h-full">
        {header}
        <div className="flex-1 overflow-y-auto">{body}</div>
        {rejectDialog}
      </div>
    )
  }

  return (
    <>
      {header}
      <ScrollArea className="flex-1">{body}</ScrollArea>
      {rejectDialog}
    </>
  )
}

// ─── Sheet wrapper ──────────────────────────────────────────────────────────

interface VisitProposalSheetProps {
  visitId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh?: () => void
}

export function VisitProposalSheet({ visitId, open, onOpenChange, onRefresh }: VisitProposalSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="sr-only">
          <SheetTitle>Proposta de visita</SheetTitle>
        </SheetHeader>
        <VisitProposalContent
          visitId={open ? visitId : null}
          variant="sheet"
          onRefresh={onRefresh}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
