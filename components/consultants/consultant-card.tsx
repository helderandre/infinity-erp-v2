'use client'

import { Card } from '@/components/ui/card'
import { Phone, Mail, MessageSquare } from 'lucide-react'
import type { ConsultantWithProfile } from '@/types/consultant'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 0 0 .611.611l4.458-1.495A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.222 0-4.313-.617-6.103-1.69l-.262-.156-3.146 1.054 1.054-3.146-.156-.262A9.713 9.713 0 0 1 2.25 12c0-5.376 4.374-9.75 9.75-9.75S21.75 6.624 21.75 12s-4.374 9.75-9.75 9.75z"/>
    </svg>
  )
}

interface ConsultantCardProps {
  consultant: ConsultantWithProfile
  onClick?: () => void
}

export function ConsultantCard({ consultant, onClick }: ConsultantCardProps) {
  const profile = consultant.dev_consultant_profiles
  const initials = consultant.commercial_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const photoUrl = profile?.profile_photo_url
  const phone = profile?.phone_commercial
  const email = consultant.professional_email

  return (
    <Card
      className="overflow-hidden transition-all hover:shadow-xl rounded-xl cursor-pointer group pt-0"
      onClick={onClick}
    >
      {/* Photo with name overlay */}
      <div className="relative aspect-[3/4] bg-muted">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={consultant.commercial_name}
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-muted to-muted-foreground/10">
            <span className="text-4xl font-semibold text-muted-foreground/40">
              {initials}
            </span>
          </div>
        )}
        {/* Gradient for readability */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
        {/* Name tag bottom-left */}
        <div className="absolute bottom-3 left-3">
          <span className="inline-flex items-center bg-black/50 backdrop-blur-md text-white text-sm font-semibold px-3 py-1.5 rounded-full shadow-lg">
            {consultant.commercial_name}
          </span>
        </div>
      </div>

      {/* Info + actions */}
      <div className="px-4 pt-3 pb-3 space-y-2.5">
        <div className="space-y-1 text-sm text-muted-foreground">
          {email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              <span className="truncate">{email}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              <span>{phone}</span>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-2">
          {phone ? (
            <a
              href={`tel:${phone}`}
              onClick={(e) => e.stopPropagation()}
              title="Ligar"
              className="h-9 w-9 rounded-full bg-muted/40 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
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
              onClick={(e) => e.stopPropagation()}
              title="SMS"
              className="h-9 w-9 rounded-full bg-muted/40 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
            >
              <MessageSquare className="h-4 w-4" />
            </a>
          ) : (
            <div className="h-9 w-9 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground/30" title="Sem telefone">
              <MessageSquare className="h-4 w-4" />
            </div>
          )}
          {phone ? (
            <a
              href={`https://wa.me/351${phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="WhatsApp"
              className="h-9 w-9 rounded-full bg-muted/40 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
            >
              <WhatsAppIcon className="h-4 w-4" />
            </a>
          ) : (
            <div className="h-9 w-9 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground/30" title="Sem telefone">
              <WhatsAppIcon className="h-4 w-4" />
            </div>
          )}
          {email ? (
            <a
              href={`mailto:${email}`}
              onClick={(e) => e.stopPropagation()}
              title="Email"
              className="h-9 w-9 rounded-full bg-muted/40 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
            >
              <Mail className="h-4 w-4" />
            </a>
          ) : (
            <div className="h-9 w-9 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground/30" title="Sem email">
              <Mail className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
