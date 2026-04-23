'use client'

import { Card } from '@/components/ui/card'
import type { UserWithRole } from '@/hooks/use-user'

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

  return (
    <Card className="overflow-hidden rounded-2xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.18),0_4px_10px_-6px_rgba(0,0,0,0.12)] pt-0 gap-0 h-[calc(100dvh-11rem)] min-h-[30rem] flex flex-col">
      <div className="relative flex-1 min-h-0 bg-muted">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-muted to-muted-foreground/10">
            <span className="text-7xl font-semibold text-muted-foreground/40">
              {initials}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
        <div className="absolute bottom-5 left-5 right-5">
          <span className="inline-flex items-center bg-black/60 backdrop-blur-md text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg">
            Bem-vindo de volta, {firstName}
          </span>
        </div>
      </div>
      <div className="px-5 py-4 shrink-0">
        <p className="text-lg font-semibold leading-tight truncate">{name}</p>
        {roleName && (
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {roleName}
          </p>
        )}
      </div>
    </Card>
  )
}
