'use client'

/**
 * Dashboard profile sheet — opens from the DashboardHero.
 *
 * Two tabs:
 *   - Perfil  : the existing PerfilPage edit form (unchanged behaviour).
 *   - Equipa  : list of colleagues (basic contact info — name, role,
 *               photo, professional email, phone) fetched from
 *               /api/team/members. Each card mirrors the DashboardHero
 *               layout (square photo flush left) and exposes the same
 *               contact buttons used by /dashboard/consultores
 *               (tel / sms / WhatsApp / mailto). A "Ver equipa" link
 *               sits in the sheet header for the full page.
 *
 * Width matches PropertiesSheet / PipelineSheet (sm:max-w-[520px]) so
 * all three side-sheets opened from the dashboard hero feel uniform.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Mail, Phone, MessageSquare, MessagesSquare, Users, UserPen, ArrowRight,
  Pencil, ChevronLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import PerfilPage from '@/app/dashboard/perfil/page'
import { WhatsappChatSheet } from '@/components/whatsapp/whatsapp-chat-sheet'
import { EmailComposeSheet } from '@/components/email/email-compose-sheet'
import { InternalChatSheet } from '@/components/consultants/internal-chat-sheet'

interface TeamMember {
  id: string
  commercial_name: string
  professional_email: string | null
  profile_photo_url: string | null
  phone_commercial: string | null
  role_name: string | null
  classification: 'consultor' | 'staff' | 'other'
}

interface ProfileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Inline WhatsApp glyph — same one used in components/consultants/consultant-card.tsx.
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 0 0 .611.611l4.458-1.495A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.222 0-4.313-.617-6.103-1.69l-.262-.156-3.146 1.054 1.054-3.146-.156-.262A9.713 9.713 0 0 1 2.25 12c0-5.376 4.374-9.75 9.75-9.75S21.75 6.624 21.75 12s-4.374 9.75-9.75 9.75z"/>
    </svg>
  )
}

export function ProfileSheet({ open, onOpenChange }: ProfileSheetProps) {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<'perfil' | 'equipa'>('perfil')
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Perfil tab has two sub-views: presentation (default) + edit form.
  const [editing, setEditing] = useState(false)

  // Reset Perfil sub-view to presentation whenever the sheet closes,
  // so re-opening always starts on the read-only card.
  useEffect(() => {
    if (!open) setEditing(false)
  }, [open])

  // Lazy-load the team list when the user picks that tab
  useEffect(() => {
    if (tab !== 'equipa' || members !== null) return
    let cancelled = false
    fetch('/api/team/members', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((body: { members: TeamMember[] }) => {
        if (!cancelled) setMembers(body.members ?? [])
      })
      .catch(async (r) => {
        if (cancelled) return
        const msg = (await r?.json?.().catch(() => ({})))?.error ?? 'Falha a carregar equipa'
        setError(msg)
        setMembers([])
      })
    return () => { cancelled = true }
  }, [tab, members])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] data-[side=bottom]:max-h-[85dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[520px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        <SheetHeader
          className={cn(
            'shrink-0 px-6 gap-0 flex-row items-center justify-between',
            isMobile ? 'pt-8 pb-3' : 'pt-6 pb-3',
          )}
        >
          <div>
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight">
              Equipa
            </SheetTitle>
            <SheetDescription className="sr-only">
              Editar perfil e ver equipa
            </SheetDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-full gap-1.5">
            <Link href="/dashboard/consultores" onClick={() => onOpenChange(false)}>
              Ver equipa
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as 'perfil' | 'equipa')}
          className="flex-1 min-h-0 flex flex-col"
        >
          <div className="px-6 pb-3 shrink-0 flex justify-center">
            <TabsList className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 border border-border/30 h-auto">
              <TabsTrigger
                value="perfil"
                className={cn(
                  'group/tab inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  'data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm',
                  'data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground',
                  'dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900',
                  'border-0',
                )}
              >
                <UserPen className="h-3.5 w-3.5" />
                <span className="hidden group-data-[state=active]/tab:inline">Perfil</span>
              </TabsTrigger>
              <TabsTrigger
                value="equipa"
                className={cn(
                  'group/tab inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  'data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm',
                  'data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground',
                  'dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900',
                  'border-0',
                )}
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden group-data-[state=active]/tab:inline">Equipa</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="perfil" className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 mt-0">
            <PerfilTab editing={editing} onEditingChange={setEditing} />
          </TabsContent>

          <TabsContent value="equipa" className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 mt-0">
            <TeamList members={members} error={error} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function TeamList({
  members, error,
}: { members: TeamMember[] | null; error: string | null }) {
  if (members === null) {
    return (
      <div className="space-y-2 px-2 pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400 mx-2 mt-2">
        Erro a carregar equipa: {error}
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Users className="h-8 w-8 mb-3 opacity-40" />
        <p className="text-sm">Sem colegas para mostrar</p>
      </div>
    )
  }

  const consultores = members.filter((m) => m.classification === 'consultor')
  const staff = members.filter((m) => m.classification === 'staff')

  return (
    <div className="space-y-5 px-2 pt-2">
      {consultores.length > 0 && (
        <TeamSection title="Consultores" count={consultores.length} members={consultores} />
      )}
      {staff.length > 0 && (
        <TeamSection title="Staff" count={staff.length} members={staff} />
      )}
    </div>
  )
}

function TeamSection({
  title, count, members,
}: { title: string; count: number; members: TeamMember[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2 px-1">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
        <span className="text-[11px] text-muted-foreground/70 tabular-nums">{count}</span>
      </div>
      <div className="space-y-2">
        {members.map((m) => (
          <TeamMemberCard key={m.id} member={m} />
        ))}
      </div>
    </div>
  )
}

function TeamMemberCard({ member }: { member: TeamMember }) {
  const initials = member.commercial_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const phone = member.phone_commercial
  const email = member.professional_email

  // Per-card sheet state — same pattern as components/consultants/consultant-card.tsx
  const [waOpen, setWaOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const buttonBase =
    'h-9 w-9 rounded-full bg-muted/40 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all'
  const buttonDisabled =
    'h-9 w-9 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground/30'

  return (
    <>
      <div className="overflow-hidden rounded-2xl ring-1 ring-border/40 bg-background/60 hover:ring-border/70 transition-all">
        <div className="flex items-stretch">
          {/* Square photo flush with edges */}
          <div className="w-24 shrink-0 relative bg-muted">
            {member.profile_photo_url ? (
              <img
                src={member.profile_photo_url}
                alt={member.commercial_name}
                className="absolute inset-0 h-full w-full object-cover [object-position:center_10%]"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
                <span className="text-lg font-semibold text-muted-foreground/60">
                  {initials}
                </span>
              </div>
            )}
          </div>

          {/* Right: identity + action buttons */}
          <div className="flex-1 min-w-0 p-3 flex flex-col justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{member.commercial_name}</p>
              {member.role_name && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {member.role_name}
                </p>
              )}
            </div>

            {/* 5 contact buttons — same set + style as components/consultants/consultant-card.tsx */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  onClick={(e) => e.stopPropagation()}
                  title="Ligar"
                  className={buttonBase}
                >
                  <Phone className="h-4 w-4" />
                </a>
              ) : (
                <div className={buttonDisabled} title="Sem telefone">
                  <Phone className="h-4 w-4" />
                </div>
              )}
              {phone ? (
                <a
                  href={`sms:${phone}`}
                  onClick={(e) => e.stopPropagation()}
                  title="SMS"
                  className={buttonBase}
                >
                  <MessageSquare className="h-4 w-4" />
                </a>
              ) : (
                <div className={buttonDisabled} title="Sem telefone">
                  <MessageSquare className="h-4 w-4" />
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setChatOpen(true)
                }}
                title="Chat interno"
                className={buttonBase}
              >
                <MessagesSquare className="h-4 w-4" />
              </button>
              {phone ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setWaOpen(true)
                  }}
                  title="WhatsApp"
                  className={buttonBase}
                >
                  <WhatsAppIcon className="h-4 w-4" />
                </button>
              ) : (
                <div className={buttonDisabled} title="Sem telefone">
                  <WhatsAppIcon className="h-4 w-4" />
                </div>
              )}
              {email ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEmailOpen(true)
                  }}
                  title="Email"
                  className={buttonBase}
                >
                  <Mail className="h-4 w-4" />
                </button>
              ) : (
                <div className={buttonDisabled} title="Sem email">
                  <Mail className="h-4 w-4" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {phone && (
        <WhatsappChatSheet
          open={waOpen}
          onOpenChange={setWaOpen}
          phone={phone}
          contactName={member.commercial_name}
        />
      )}
      {email && (
        <EmailComposeSheet
          open={emailOpen}
          onOpenChange={setEmailOpen}
          recipientEmail={email}
          recipientName={member.commercial_name}
        />
      )}
      <InternalChatSheet
        open={chatOpen}
        onOpenChange={setChatOpen}
        recipientId={member.id}
        recipientName={member.commercial_name}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Perfil tab — presentation card (read-only) + click-to-edit form
// ─────────────────────────────────────────────────────────────────────────────

interface SelfProfile {
  id: string
  commercial_name: string | null
  professional_email: string | null
  dev_consultant_profiles: {
    profile_photo_url: string | null
    phone_commercial: string | null
  } | null
  user_roles: Array<{ roles: { name: string | null } | null }> | null
}

function PerfilTab({
  editing, onEditingChange,
}: {
  editing: boolean
  onEditingChange: (editing: boolean) => void
}) {
  if (editing) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onEditingChange(false)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-muted/40 ring-1 ring-border/40 text-muted-foreground hover:text-foreground hover:ring-border/70 hover:bg-muted/60 transition-all text-[11px] font-medium"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar à apresentação
        </button>
        <PerfilPage />
      </div>
    )
  }

  return <PerfilPresentation onEdit={() => onEditingChange(true)} />
}

function PerfilPresentation({ onEdit }: { onEdit: () => void }) {
  const [profile, setProfile] = useState<SelfProfile | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/perfil', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((data: SelfProfile) => { if (!cancelled) setProfile(data) })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [])

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400 mx-2 mt-2">
        Erro a carregar o perfil.
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="px-2 pt-2">
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    )
  }

  const consultantProfile = Array.isArray(profile.dev_consultant_profiles)
    ? profile.dev_consultant_profiles[0]
    : profile.dev_consultant_profiles
  const photoUrl = consultantProfile?.profile_photo_url ?? null
  const phone = consultantProfile?.phone_commercial ?? null
  const email = profile.professional_email ?? null
  const name = profile.commercial_name ?? 'Utilizador'
  const roleName = profile.user_roles?.[0]?.roles?.name ?? null
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full text-left rounded-2xl bg-background border border-border/50 shadow-sm overflow-hidden hover:shadow-md hover:border-border/80 transition-all group"
    >
      <div className="relative h-[44dvh] sm:h-[48dvh] max-h-[460px] bg-muted">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover [object-position:center_10%]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-muted to-muted-foreground/10">
            <span className="text-5xl font-semibold text-muted-foreground/40">{initials}</span>
          </div>
        )}
        {/* Edit pencil pill, top-right of the photo */}
        <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-black/55 backdrop-blur-md text-white text-[11px] font-medium shadow-sm group-hover:bg-black/70 transition-colors">
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </div>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <h2 className="text-white text-xl font-semibold drop-shadow-sm truncate">
            {name}
          </h2>
          {roleName && (
            <span className="inline-flex items-center rounded-full text-[10px] bg-black/60 text-white border border-white/20 backdrop-blur-md shadow-sm px-2 py-0.5 shrink-0">
              {roleName}
            </span>
          )}
        </div>
      </div>

      {(email || phone) && (
        <div className="px-4 py-3 space-y-1.5">
          {email && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-[12px] text-foreground/80 flex-1">{email}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40">
              <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-[12px] text-foreground/80 flex-1">{phone}</span>
            </div>
          )}
        </div>
      )}
    </button>
  )
}
