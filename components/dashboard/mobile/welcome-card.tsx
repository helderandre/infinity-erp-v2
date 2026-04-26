'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { UserPen, Building2, Kanban } from 'lucide-react'
import type { UserWithRole } from '@/hooks/use-user'
import { ProfileSheet } from '@/components/dashboard/profile-sheet'
import { PropertiesSheet } from './properties-sheet'
import { PipelineSheet } from './pipeline-sheet'

interface WelcomeCardProps {
  user: UserWithRole
}

export function WelcomeCard({ user }: WelcomeCardProps) {
  const name = user.commercial_name || 'Consultor'
  const firstName = name.split(' ')[0]
  const roleName = user.role?.name || ''
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const photoUrl = user.profile_photo_url
  const [profileOpen, setProfileOpen] = useState(false)
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [pipelineOpen, setPipelineOpen] = useState(false)

  return (
    <>
      <Card className="overflow-hidden rounded-2xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.18),0_4px_10px_-6px_rgba(0,0,0,0.12)] pt-0 gap-0 h-[calc(100dvh-env(safe-area-inset-top,0px)-var(--mobile-nav-height,5rem)-6rem)] min-h-[24rem] flex flex-col border-0 bg-black">
        <div className="relative flex-1 min-h-0 bg-muted">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              className="absolute inset-0 h-full w-full object-cover [object-position:center_10%]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-muted to-muted-foreground/10">
              <span className="text-7xl font-semibold text-muted-foreground/40">
                {initials}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/55 to-transparent" />
          {/* Brand logo above the welcome pill */}
          <div className="absolute inset-x-4 bottom-24 flex justify-center pointer-events-none">
            <img
              src="/icon-512.png"
              alt="Infinity Group"
              className="h-20 w-20 rounded-2xl mix-blend-screen select-none"
              draggable={false}
            />
          </div>
          {/* Welcome pill at the bottom-center of the photo */}
          <div className="absolute inset-x-4 bottom-6 flex justify-center pointer-events-none">
            <span className="pointer-events-auto inline-flex max-w-full items-center bg-white/15 supports-[backdrop-filter]:bg-white/10 backdrop-blur-xl border border-white/25 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.5)]">
              <span className="truncate">Bem-vindo de volta, {firstName}</span>
            </span>
          </div>
          {/* Shadow at photo-to-footer transition */}
          <div className="pointer-events-none absolute inset-x-0 -bottom-px h-8 bg-gradient-to-b from-transparent to-black" />
        </div>
        <div className="relative px-5 py-5 shrink-0 bg-black text-white shadow-[inset_0_10px_16px_-8px_rgba(0,0,0,0.95)] flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
            <p className="text-lg font-semibold leading-tight truncate">
              {name}
            </p>
            {roleName && (
              <span className="inline-flex self-start max-w-full items-center bg-white/10 supports-[backdrop-filter]:bg-white/5 backdrop-blur-md border border-white/20 text-white/80 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                <span className="truncate">{roleName}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              title="Editar perfil"
              aria-label="Editar perfil"
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-colors"
            >
              <UserPen className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPropertiesOpen(true)}
              title="Imóveis"
              aria-label="Imóveis"
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-colors"
            >
              <Building2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPipelineOpen(true)}
              title="Pipeline"
              aria-label="Pipeline"
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-colors"
            >
              <Kanban className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      <PropertiesSheet open={propertiesOpen} onOpenChange={setPropertiesOpen} />

      <PipelineSheet
        userId={user.id}
        open={pipelineOpen}
        onOpenChange={setPipelineOpen}
      />

      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  )
}
