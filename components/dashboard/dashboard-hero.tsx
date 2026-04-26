'use client'

/**
 * Dashboard hero — used as the top card on both the consultor PC dashboard
 * and the gestor PC dashboard. Layout:
 *
 *   ┌───────────────────────────────────────────────────────┐
 *   │ [photo]   BEM-VINDO DE VOLTA          [⚙][🏢][📋]    │
 *   │ [photo]   Filipe                                      │
 *   │ [photo]   Filipe Consultor  [role-pill]               │
 *   └───────────────────────────────────────────────────────┘
 *
 * The photo is a square that runs flush with the card's top, bottom and
 * left edges (no gap, no rounding on the inside). On the right, the
 * profile / properties / pipeline buttons open the same sheets the
 * mobile WelcomeCard uses, so the action surface is identical.
 */

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Users, Building2, Kanban, UserPen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserWithRole } from '@/hooks/use-user'
import { PropertiesSheet } from '@/components/dashboard/mobile/properties-sheet'
import { PipelineSheet } from '@/components/dashboard/mobile/pipeline-sheet'
import { ProfileSheet } from './profile-sheet'

interface DashboardHeroProps {
  user: UserWithRole
}

export function DashboardHero({ user }: DashboardHeroProps) {
  const name = user.commercial_name || 'Consultor'
  const firstName = name.split(' ')[0]
  const roleName = user.role?.name || ''
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const [profileOpen, setProfileOpen] = useState(false)
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [pipelineOpen, setPipelineOpen] = useState(false)

  return (
    <>
      <Card className="overflow-hidden p-0 rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
        <div className="flex items-stretch">
          {/* Square photo — flush with card's top/bottom/left edges */}
          <div className="w-28 sm:w-32 shrink-0 relative bg-muted">
            {user.profile_photo_url ? (
              <img
                src={user.profile_photo_url}
                alt={name}
                className="absolute inset-0 h-full w-full object-cover [object-position:center_10%]"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
                <span className="text-2xl font-semibold text-muted-foreground/60">
                  {initials}
                </span>
              </div>
            )}
          </div>

          {/* Right content */}
          <div className="flex-1 min-w-0 p-6 flex items-center gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">
                Bem-vindo de volta
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">
                {firstName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground truncate">{name}</p>
                {roleName && (
                  <span className="inline-flex items-center bg-muted/40 border border-border/40 text-muted-foreground text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0">
                    {roleName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <HeroButton
                icon={Users}
                label="Equipa"
                onClick={() => setProfileOpen(true)}
              />
              <HeroButton
                icon={Building2}
                label="Imóveis"
                onClick={() => setPropertiesOpen(true)}
              />
              <HeroButton
                icon={Kanban}
                label="Pipeline"
                onClick={() => setPipelineOpen(true)}
              />
            </div>
          </div>
        </div>
      </Card>

      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
      <PropertiesSheet open={propertiesOpen} onOpenChange={setPropertiesOpen} />
      <PipelineSheet
        userId={user.id}
        open={pipelineOpen}
        onOpenChange={setPipelineOpen}
      />
    </>
  )
}

function HeroButton({
  icon: Icon, label, onClick,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-2 h-10 px-3.5 rounded-full',
        'bg-background/60 ring-1 ring-border/40 text-foreground',
        'hover:ring-border/70 hover:bg-background/80 transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="text-xs font-medium hidden lg:inline">{label}</span>
    </button>
  )
}
