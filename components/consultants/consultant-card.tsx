'use client'

import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Phone, Mail, Globe } from 'lucide-react'
import type { ConsultantWithProfile } from '@/types/consultant'

interface ConsultantCardProps {
  consultant: ConsultantWithProfile
  onClick?: () => void
}

export function ConsultantCard({ consultant, onClick }: ConsultantCardProps) {
  const profile = consultant.dev_consultant_profiles
  const roleName = consultant.user_roles?.[0]?.roles?.name || null
  const initials = consultant.commercial_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]"
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <Avatar className="h-20 w-20">
            <AvatarImage
              src={profile?.profile_photo_url || undefined}
              alt={consultant.commercial_name}
            />
            <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <h3 className="font-semibold text-sm line-clamp-1">{consultant.commercial_name}</h3>
            {roleName && (
              <Badge variant="secondary" className="text-xs font-normal">
                {roleName}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Badge
              variant={consultant.is_active ? 'default' : 'outline'}
              className={
                consultant.is_active
                  ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-0'
                  : 'text-muted-foreground'
              }
            >
              {consultant.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
            {consultant.display_website && (
              <Badge variant="outline" className="text-xs gap-1">
                <Globe className="h-3 w-3" />
                Website
              </Badge>
            )}
          </div>

          {/* Contact info */}
          <div className="w-full space-y-1.5 pt-2 border-t text-xs text-muted-foreground">
            {profile?.phone_commercial && (
              <div className="flex items-center gap-1.5 justify-center">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{profile.phone_commercial}</span>
              </div>
            )}
            {consultant.professional_email && (
              <div className="flex items-center gap-1.5 justify-center">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{consultant.professional_email}</span>
              </div>
            )}
          </div>

          {/* Specializations */}
          {profile?.specializations && profile.specializations.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1 pt-1">
              {profile.specializations.slice(0, 3).map((spec) => (
                <Badge key={spec} variant="outline" className="text-[10px] px-1.5 py-0">
                  {spec}
                </Badge>
              ))}
              {profile.specializations.length > 3 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  +{profile.specializations.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
