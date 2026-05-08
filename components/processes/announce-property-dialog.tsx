'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/kibo-ui/spinner'
import {
  Send, MapPin, Building2, X, ChevronsUpDown, User as UserIcon,
  Hash, Check,
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'

interface PreviewProperty {
  id: string
  slug: string | null
  title: string | null
  external_ref: string | null
  listing_price: number | null
  property_type: string | null
  business_type: string | null
  city: string | null
  zone: string | null
  address_parish: string | null
  cover_url: string | null
  typology: string | null
  bedrooms: number | null
  bathrooms: number | null
  area_util: number | null
}

interface PreviewConsultant {
  id: string
  name: string | null
  photo: string | null
}

interface AnnouncePropertyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  processId: string
  /** Texto pré-preenchido por defeito quando abre. Se omitido, gera-se um a
   *  partir do nome do consultor após carregar o preview. */
  defaultMessage?: string
  /** Callback após o envio bem-sucedido. */
  onSent?: () => void
}

const eur = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/**
 * Preview + envio do anúncio "nova angariação" para o canal Geral.
 *
 * Carrega os dados (imóvel + consultor) via GET /api/processes/[id]/announce-property,
 * mostra um card-preview no estilo da referência (foto top, badge top-right
 * com avatar do consultor, info row com tipologia/quartos/WC/área), e uma
 * textarea editável com a mensagem que será publicada por cima do card.
 *
 * Click "Enviar" → POST mesmo endpoint com `{ message }`. O servidor insere
 * a mensagem + anexa a foto de capa.
 */
export function AnnouncePropertyDialog({
  open,
  onOpenChange,
  processId,
  defaultMessage,
  onSent,
}: AnnouncePropertyDialogProps) {
  const isMobile = useIsMobile()
  const [isLoading, setIsLoading] = useState(false)
  const [property, setProperty] = useState<PreviewProperty | null>(null)
  const [consultant, setConsultant] = useState<PreviewConsultant | null>(null)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  // Recipient selector — default = canal Geral
  type Target = { kind: 'general' } | { kind: 'dm'; userId: string; name: string }
  const [target, setTarget] = useState<Target>({ kind: 'general' })
  const [recipients, setRecipients] = useState<{ id: string; commercial_name: string }[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const targetLabel = target.kind === 'general' ? 'Canal Geral' : `DM · ${target.name}`

  // Carregar lista de consultores (uma vez por sessão)
  useEffect(() => {
    if (!open || recipients.length > 0) return
    fetch('/api/users/consultants')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const list = (data.data || data || []) as Array<{
          id: string
          commercial_name?: string | null
        }>
        setRecipients(
          list
            .filter((u) => !!u.commercial_name)
            .map((u) => ({ id: u.id, commercial_name: u.commercial_name as string })),
        )
      })
      .catch(() => {})
  }, [open, recipients.length])

  // Reset state quando abre/fecha
  useEffect(() => {
    if (!open) {
      setProperty(null)
      setConsultant(null)
      setMessage('')
      setTarget({ kind: 'general' })
      setPickerOpen(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    fetch(`/api/processes/${processId}/announce-property`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setProperty(data.property)
        setConsultant(data.consultant)
        // Default copy: "Parabéns {Consultor} pela publicação de uma nova angariação 🎉🥳!!!".
        // O nome vem directo, sem "ao" (frase natural com o primeiro nome
        // do consultor, ex.: "Parabéns João pela…"). Editável depois.
        const name = data.consultant?.name ?? ''
        const seed =
          defaultMessage ??
          `Parabéns ${name} pela publicação de uma nova angariação 🎉🥳!!!`.replace(
            /\s+/g,
            ' ',
          )
        setMessage(seed)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, processId, defaultMessage])

  const handleSend = useCallback(async () => {
    const trimmed = message.trim()
    if (!trimmed) {
      toast.error('Mensagem vazia.')
      return
    }
    setIsSending(true)
    try {
      const payload: Record<string, unknown> = { message: trimmed }
      if (target.kind === 'dm') {
        payload.target = 'dm'
        payload.recipientId = target.userId
      } else {
        payload.target = 'general'
      }
      const res = await fetch(`/api/processes/${processId}/announce-property`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao enviar')
      }
      toast.success(
        target.kind === 'dm'
          ? `Anúncio enviado a ${target.name}`
          : 'Anúncio publicado no canal Geral'
      )
      onSent?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar')
    } finally {
      setIsSending(false)
    }
  }, [message, processId, onOpenChange, onSent, target])

  const locationLabel = property
    ? [property.address_parish, property.city, property.zone]
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .join(', ') || '—'
    : '—'

  const specBits: string[] = []
  if (property?.typology) specBits.push(property.typology)
  if (property?.bedrooms) specBits.push(`${property.bedrooms} quartos`)
  if (property?.bathrooms) specBits.push(`${property.bathrooms} WC`)
  if (property?.area_util) specBits.push(`${property.area_util} m²`)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        showCloseButton={false}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[88dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[480px] sm:rounded-l-3xl',
        )}
      >
        <VisuallyHidden>
          <SheetTitle>Anunciar no Geral</SheetTitle>
          <SheetDescription>Edita a mensagem antes de publicar no canal Geral.</SheetDescription>
        </VisuallyHidden>
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className="shrink-0 px-5 pt-8 pb-3 sm:pt-6 gap-0 flex-row items-start justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold leading-tight">Anunciar no Geral</h2>
            <p className="text-xs text-muted-foreground">
              Edita a mensagem que vai acompanhar a publicação. Pré-visualização abaixo.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-full shrink-0"
            aria-label="Fechar"
            disabled={isSending}
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-3">
          {/* Recipient selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Para
            </label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between rounded-full h-9 text-xs px-3 font-medium"
                  disabled={isSending}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    {target.kind === 'general' ? (
                      <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <UserIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{targetLabel}</span>
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl"
                align="start"
                sideOffset={4}
              >
                <Command>
                  <CommandInput placeholder="Pesquisar consultor…" />
                  <CommandList>
                    <CommandEmpty>Sem resultados.</CommandEmpty>
                    <CommandGroup heading="Canal">
                      <CommandItem
                        value="canal geral"
                        onSelect={() => {
                          setTarget({ kind: 'general' })
                          setPickerOpen(false)
                        }}
                      >
                        <Hash className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="flex-1">Canal Geral</span>
                        {target.kind === 'general' && <Check className="ml-2 h-3.5 w-3.5" />}
                      </CommandItem>
                    </CommandGroup>
                    {recipients.length > 0 && (
                      <CommandGroup heading="DM (consultor)">
                        {recipients.map((r) => {
                          const selected =
                            target.kind === 'dm' && target.userId === r.id
                          return (
                            <CommandItem
                              key={r.id}
                              value={r.commercial_name}
                              onSelect={() => {
                                setTarget({
                                  kind: 'dm',
                                  userId: r.id,
                                  name: r.commercial_name,
                                })
                                setPickerOpen(false)
                              }}
                            >
                              <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span className="flex-1 truncate">{r.commercial_name}</span>
                              {selected && <Check className="ml-2 h-3.5 w-3.5" />}
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {target.kind === 'dm' && (
              <p className="text-[10px] text-muted-foreground/70">
                Apenas {target.name} verá esta mensagem (chat privado).
              </p>
            )}
          </div>

          {/* Editable message */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mensagem
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Parabéns ao consultor…"
              className="text-sm resize-none"
              disabled={isSending}
            />
          </div>

          {/* Card preview */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pré-visualização
            </label>
            <div
              className={cn(
                'rounded-2xl border bg-card overflow-hidden shadow-sm',
                'border-border/60',
              )}
            >
              {/* Photo + consultant badge */}
              <div className="relative aspect-[16/10] bg-muted">
                {isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Spinner className="h-4 w-4 text-muted-foreground" />
                  </div>
                ) : property?.cover_url ? (
                  <Image
                    src={property.cover_url}
                    alt={property.title || 'Imóvel'}
                    fill
                    sizes="460px"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Building2 className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}

                {/* Consultant badge — top-left, LinkedIn-style avatar + name */}
                {consultant && (
                  <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/95 backdrop-blur-sm pl-1 pr-3 py-1 shadow-sm border border-border/40">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center overflow-hidden shrink-0">
                      {consultant.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={consultant.photo}
                          alt={consultant.name || 'Consultor'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] font-semibold">
                          {(consultant.name || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold truncate max-w-[140px]">
                      {consultant.name || 'Consultor'}
                    </span>
                  </div>
                )}
              </div>

              {/* Body — title + location + price + specs */}
              <div className="p-3 space-y-1.5">
                <h3 className="text-sm font-semibold truncate">
                  {isLoading ? 'A carregar…' : property?.title || property?.external_ref || 'Imóvel'}
                </h3>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{locationLabel}</span>
                </div>
                {property?.listing_price ? (
                  <div className="text-sm font-semibold text-foreground">
                    {eur.format(Number(property.listing_price))}
                  </div>
                ) : null}
                {specBits.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {specBits.map((b) => (
                      <span
                        key={b}
                        className="inline-flex items-center rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] text-foreground/80"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70 leading-snug">
              A mensagem aparece no canal Geral seguida da foto de capa do imóvel.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-border/40 px-5 py-3 bg-background/60 backdrop-blur-xl">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full h-8 text-xs"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="rounded-full h-8 text-xs gap-1.5 bg-neutral-900 text-white hover:bg-neutral-800"
            onClick={handleSend}
            disabled={isLoading || isSending || !property || !message.trim()}
          >
            {isSending ? (
              <>
                <Spinner className="h-3 w-3" />
                A enviar…
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                {target.kind === 'dm' ? `Enviar a ${target.name.split(' ')[0]}` : 'Enviar para Geral'}
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
