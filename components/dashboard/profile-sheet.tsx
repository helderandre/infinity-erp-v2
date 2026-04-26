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
  Mail, Phone, MessageSquare, Users, UserPen, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import PerfilPage from '@/app/dashboard/perfil/page'

interface TeamMember {
  id: string
  commercial_name: string
  professional_email: string | null
  profile_photo_url: string | null
  phone_commercial: string | null
  role_name: string | null
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

        <SheetHeader className={cn('shrink-0 px-6 gap-0', isMobile ? 'pt-8 pb-3' : 'pt-6 pb-3')}>
          <div className="flex items-center justify-between gap-3 pr-8">
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight">
              Perfil
            </SheetTitle>
            <Button asChild variant="outline" size="sm" className="rounded-full gap-1.5">
              <Link href="/dashboard/consultores" onClick={() => onOpenChange(false)}>
                Ver equipa
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <SheetDescription className="sr-only">
            Editar perfil e ver equipa
          </SheetDescription>
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
            <PerfilPage />
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

  return (
    <div className="space-y-2 px-2 pt-2">
      {members.map((m) => (
        <TeamMemberCard key={m.id} member={m} />
      ))}
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

  // wa.me requires digits only — strip everything else and any leading zeros.
  const phoneDigits = member.phone_commercial?.replace(/\D/g, '').replace(/^0+/, '') ?? ''

  return (
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

          <div className="flex items-center gap-1.5 flex-wrap">
            <ContactButton
              available={!!member.phone_commercial}
              href={member.phone_commercial ? `tel:${member.phone_commercial}` : undefined}
              icon={Phone}
              label="Ligar"
            />
            <ContactButton
              available={!!member.phone_commercial}
              href={member.phone_commercial ? `sms:${member.phone_commercial}` : undefined}
              icon={MessageSquare}
              label="SMS"
            />
            <ContactButton
              available={!!phoneDigits}
              href={phoneDigits ? `https://wa.me/${phoneDigits}` : undefined}
              external
              icon={WhatsAppIcon}
              label="WhatsApp"
            />
            <ContactButton
              available={!!member.professional_email}
              href={member.professional_email ? `mailto:${member.professional_email}` : undefined}
              icon={Mail}
              label="Email"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactButton({
  icon: Icon, label, href, external, available,
}: {
  icon: React.ElementType
  label: string
  href?: string
  external?: boolean
  available: boolean
}) {
  const baseClass = cn(
    'h-8 w-8 rounded-full flex items-center justify-center transition-all border',
    available
      ? 'bg-muted/40 backdrop-blur-sm border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/70'
      : 'bg-muted/40 border-border/50 text-muted-foreground/30 pointer-events-none',
  )

  if (!available || !href) {
    return (
      <div className={baseClass} title={`Sem ${label.toLowerCase()}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
    )
  }

  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      onClick={(e) => e.stopPropagation()}
      title={label}
      className={baseClass}
    >
      <Icon className="h-3.5 w-3.5" />
    </a>
  )
}
