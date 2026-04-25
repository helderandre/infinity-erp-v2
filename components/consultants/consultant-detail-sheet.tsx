'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowUpRight,
  Building2,
  Copy,
  Home,
  Info,
  Instagram,
  Linkedin,
  Mail,
  MessageSquare,
  MessagesSquare,
  Phone,
  User as UserIcon,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import { cn, normalizeWebsiteUrl } from '@/lib/utils'
import { ADMIN_ROLES, classifyMember } from '@/lib/auth/roles'
import { WhatsappChatSheet } from '@/components/whatsapp/whatsapp-chat-sheet'
import { EmailComposeSheet } from '@/components/email/email-compose-sheet'
import { InternalChatSheet } from '@/components/consultants/internal-chat-sheet'
import { PropertyListItem, type PropertyListItemData } from '@/components/properties/property-list-item'
import { PropertyDetailSheet } from '@/components/properties/property-detail-sheet'
import type { ConsultantDetail } from '@/types/consultant'

interface ConsultantDetailSheetProps {
  consultantId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type TabKey = 'contactos' | 'perfil' | 'imoveis'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 0 0 .611.611l4.458-1.495A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.222 0-4.313-.617-6.103-1.69l-.262-.156-3.146 1.054 1.054-3.146-.156-.262A9.713 9.713 0 0 1 2.25 12c0-5.376 4.374-9.75 9.75-9.75S21.75 6.624 21.75 12s-4.374 9.75-9.75 9.75z" />
    </svg>
  )
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copiado')
  } catch {
    toast.error('Não foi possível copiar')
  }
}

export function ConsultantDetailSheet({ consultantId, open, onOpenChange }: ConsultantDetailSheetProps) {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const [consultant, setConsultant] = useState<ConsultantDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('contactos')
  const [waOpen, setWaOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    if (!open || !consultantId) {
      setConsultant(null)
      setActiveTab('contactos')
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/consultants/${consultantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setConsultant(data)
      })
      .catch(() => {
        if (!cancelled) setConsultant(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, consultantId])

  const roleName = user?.role?.name
  const isStaffLike =
    classifyMember(roleName) === 'staff' ||
    ADMIN_ROLES.some((r) => r.toLowerCase() === roleName?.toLowerCase())
  const isSelf = !!consultantId && consultantId === user?.id
  const canSeeFullPage = isSelf || isStaffLike

  const profile = consultant?.dev_consultant_profiles
  const photoUrl = profile?.profile_photo_url
  const phone = profile?.phone_commercial
  const email = consultant?.professional_email
  const initials = (consultant?.commercial_name || '')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[75dvh] rounded-t-3xl'
            : 'h-full w-full data-[side=right]:sm:max-w-[760px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className="shrink-0 px-6 pt-8 pb-3 sm:pt-10 gap-0 flex-row items-start justify-between">
          <div className="min-w-0">
            <SheetTitle className="text-[20px] font-semibold leading-tight tracking-tight truncate">
              {consultant?.commercial_name || 'Consultor'}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Detalhes do consultor.
            </SheetDescription>
          </div>
          {canSeeFullPage && consultantId && (
            <div className="flex items-center gap-2 mr-10 shrink-0">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="rounded-full h-8 text-xs gap-1.5"
              >
                <Link href={`/dashboard/consultores/${consultantId}`} onClick={() => onOpenChange(false)}>
                  Ver tudo
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </SheetHeader>

        {loading || !consultant ? (
          <div className="flex-1 px-6 py-4 space-y-4">
            <Skeleton className="aspect-[3/4] max-w-[260px] rounded-2xl" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="px-6 space-y-4 pb-8">
              {/* Tab selector */}
              <div className="flex items-center gap-1 p-1 rounded-full bg-background border border-border/50 w-fit mx-auto">
                <TabButton
                  active={activeTab === 'contactos'}
                  icon={UserIcon}
                  label="Contactos"
                  onClick={() => setActiveTab('contactos')}
                />
                <TabButton
                  active={activeTab === 'perfil'}
                  icon={Info}
                  label="Perfil"
                  onClick={() => setActiveTab('perfil')}
                />
                <TabButton
                  active={activeTab === 'imoveis'}
                  icon={Home}
                  label="Imóveis"
                  badge={consultant.properties_count}
                  onClick={() => setActiveTab('imoveis')}
                />
              </div>

              {activeTab === 'contactos' && (
                <div className="rounded-2xl bg-background border border-border/50 shadow-sm overflow-hidden">
                  <div className="relative aspect-[4/5] sm:aspect-[3/4] bg-muted">
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoUrl}
                        alt={consultant.commercial_name}
                        className="absolute inset-0 h-full w-full object-cover object-top"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-muted to-muted-foreground/10">
                        <span className="text-5xl font-semibold text-muted-foreground/40">{initials}</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                      <h2 className="text-white text-xl font-semibold drop-shadow-sm truncate">
                        {consultant.commercial_name}
                      </h2>
                      {consultant.user_roles?.[0]?.roles?.name && (
                        <Badge className="rounded-full text-[10px] bg-black/60 text-white border border-white/20 backdrop-blur-md shadow-sm shrink-0">
                          {consultant.user_roles[0].roles.name}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Contact rows */}
                  {(email || phone) && (
                    <div className="px-4 py-3 space-y-1.5">
                      {email && (
                        <button
                          type="button"
                          onClick={() => void copyToClipboard(email)}
                          className="group/row w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                          title="Clique para copiar"
                        >
                          <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-[12px] text-foreground/80 flex-1">{email}</span>
                          <Copy className="h-3 w-3 shrink-0 text-muted-foreground/0 group-hover/row:text-muted-foreground transition-colors" />
                        </button>
                      )}
                      {phone && (
                        <button
                          type="button"
                          onClick={() => void copyToClipboard(phone)}
                          className="group/row w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                          title="Clique para copiar"
                        >
                          <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-[12px] text-foreground/80 flex-1">{phone}</span>
                          <Copy className="h-3 w-3 shrink-0 text-muted-foreground/0 group-hover/row:text-muted-foreground transition-colors" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="px-4 pb-4 flex justify-center gap-2">
                    {phone ? (
                      <a
                        href={`tel:${phone}`}
                        title="Ligar"
                        className="h-9 w-9 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground/30" title="Sem telefone">
                        <Phone className="h-4 w-4" />
                      </div>
                    )}
                    {phone ? (
                      <a
                        href={`sms:${phone}`}
                        title="SMS"
                        className="h-9 w-9 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </a>
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground/30" title="Sem telefone">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!consultantId) return
                        setChatOpen(true)
                      }}
                      title="Chat interno"
                      className="h-9 w-9 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
                    >
                      <MessagesSquare className="h-4 w-4" />
                    </button>
                    {phone ? (
                      <button
                        type="button"
                        onClick={() => setWaOpen(true)}
                        title="WhatsApp"
                        className="h-9 w-9 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground/30" title="Sem telefone">
                        <WhatsAppIcon className="h-4 w-4" />
                      </div>
                    )}
                    {email ? (
                      <button
                        type="button"
                        onClick={() => setEmailOpen(true)}
                        title="Email"
                        className="h-9 w-9 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
                      >
                        <Mail className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground/30" title="Sem email">
                        <Mail className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'perfil' && (
                <ProfileSection consultant={consultant} />
              )}

              {activeTab === 'imoveis' && consultantId && (
                <ConsultantPropertiesSection consultantId={consultantId} />
              )}
            </div>
          </div>
        )}

        {phone && consultant && (
          <WhatsappChatSheet
            open={waOpen}
            onOpenChange={setWaOpen}
            phone={phone}
            contactName={consultant.commercial_name}
          />
        )}
        {email && consultant && (
          <EmailComposeSheet
            open={emailOpen}
            onOpenChange={setEmailOpen}
            recipientEmail={email}
            recipientName={consultant.commercial_name}
          />
        )}
        {consultantId && consultant && (
          <InternalChatSheet
            open={chatOpen}
            onOpenChange={setChatOpen}
            recipientId={consultantId}
            recipientName={consultant.commercial_name}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function TabButton({
  active,
  icon: Icon,
  label,
  badge,
  onClick,
}: {
  active: boolean
  icon: React.ElementType
  label: string
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200',
        active
          ? 'bg-foreground text-background px-3.5'
          : 'text-muted-foreground hover:text-foreground px-3',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold tabular-nums',
            active ? 'bg-background/20 text-background' : 'bg-foreground/10 text-foreground/70',
          )}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function ProfileSection({ consultant }: { consultant: ConsultantDetail }) {
  const profile = consultant.dev_consultant_profiles
  const hasAny =
    profile?.bio ||
    profile?.instagram_handle ||
    profile?.linkedin_url ||
    (profile?.specializations && profile.specializations.length > 0) ||
    (profile?.languages && profile.languages.length > 0)

  if (!hasAny) {
    return (
      <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-5 text-center">
        <UserIcon className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">Sem perfil público disponível.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {profile?.bio && (
        <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Sobre
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {profile.bio}
          </p>
        </div>
      )}

      {(profile?.instagram_handle || profile?.linkedin_url) && (
        <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-5 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Redes
          </p>
          {profile.instagram_handle && (
            <a
              href={`https://instagram.com/${profile.instagram_handle.replace(/^@/, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 py-1 -mx-1 px-1 rounded-lg hover:bg-muted/40 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
                <Instagram className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Instagram</p>
                <p className="text-sm font-medium truncate">@{profile.instagram_handle.replace(/^@/, '')}</p>
              </div>
            </a>
          )}
          {profile.linkedin_url && (
            <a
              href={normalizeWebsiteUrl(profile.linkedin_url) || profile.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 py-1 -mx-1 px-1 rounded-lg hover:bg-muted/40 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
                <Linkedin className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">LinkedIn</p>
                <p className="text-sm font-medium truncate">{profile.linkedin_url}</p>
              </div>
            </a>
          )}
        </div>
      )}

      {profile?.specializations && profile.specializations.length > 0 && (
        <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Especialidades
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.specializations.map((s) => (
              <Badge key={s} variant="secondary" className="rounded-full text-[11px]">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {profile?.languages && profile.languages.length > 0 && (
        <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Idiomas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.languages.map((l) => (
              <Badge key={l} variant="outline" className="rounded-full text-[11px]">
                {l}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ConsultantPropertiesSection({ consultantId }: { consultantId: string }) {
  const [items, setItems] = useState<PropertyListItemData[]>([])
  const [loading, setLoading] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams()
    params.set('consultant_id', consultantId)
    params.set('per_page', '50')
    params.set('sort_by', 'created_at')
    params.set('sort_dir', 'desc')
    fetch(`/api/properties?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        if (cancelled) return
        const data = Array.isArray(json) ? json : json.data ?? []
        setItems(data)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [consultantId])

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      )
    }
    if (items.length === 0) {
      return (
        <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-8 flex flex-col items-center text-muted-foreground">
          <Building2 className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Sem imóveis associados.</p>
        </div>
      )
    }
    return (
      <div className="space-y-2">
        {items.map((p) => (
          <PropertyListItem
            key={p.id}
            property={p}
            onSelect={() => setPreviewId(p.id)}
            showConsultant={false}
          />
        ))}
      </div>
    )
  }, [loading, items])

  return (
    <>
      {content}
      <PropertyDetailSheet
        propertyId={previewId}
        open={previewId !== null}
        onOpenChange={(o) => !o && setPreviewId(null)}
      />
    </>
  )
}
