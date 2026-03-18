'use client'

import { User, UserPlus, MessageCircle, Link2, Briefcase } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { WppContact } from '@/lib/types/whatsapp-web'

interface ContactCardProps {
  contact: WppContact
  onLink: () => void
  onViewChat: () => void
}

export function ContactCard({ contact, onLink, onViewChat }: ContactCardProps) {
  const displayName = contact.name || contact.push_name || contact.phone || 'Sem nome'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
      {/* Avatar */}
      <Avatar className="h-10 w-10 flex-shrink-0">
        {contact.profile_pic_url && (
          <AvatarImage src={contact.profile_pic_url} alt={displayName} />
        )}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{displayName}</span>
          {contact.is_business && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              <Briefcase className="h-2.5 w-2.5 mr-0.5" />
              Empresa
            </Badge>
          )}
        </div>
        {contact.phone && (
          <p className="text-xs text-muted-foreground">{contact.phone}</p>
        )}
        {/* Vinculacao badge */}
        <div className="mt-1">
          {contact.owner ? (
            <Badge variant="secondary" className="text-[11px]">
              <User className="h-3 w-3 mr-1 text-blue-600" />
              Proprietario: {contact.owner.name}
            </Badge>
          ) : contact.lead ? (
            <Badge variant="secondary" className="text-[11px]">
              <UserPlus className="h-3 w-3 mr-1 text-amber-600" />
              Lead: {contact.lead.nome}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px] text-muted-foreground">
              Sem vinculacao
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onLink} title="Vincular">
          <Link2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onViewChat} title="Ver conversa">
          <MessageCircle className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
