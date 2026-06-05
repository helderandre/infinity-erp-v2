import { Image, Music, FileText, MapPin, User } from 'lucide-react'
import type { WppMessageType } from '@/lib/types/whatsapp-web'

interface QuotedData {
  text: string | null
  message_type: WppMessageType | string
  sender_name: string | null
  from_me: boolean
  media_url: string | null
}

interface MessageQuotedProps {
  quoted: QuotedData
}

const TYPE_ICONS: Record<string, typeof Image> = {
  image: Image,
  video: Image,
  audio: Music,
  document: FileText,
  location: MapPin,
  contact: User,
}

export function MessageQuoted({ quoted }: MessageQuotedProps) {
  const Icon = TYPE_ICONS[quoted.message_type]
  const senderLabel = quoted.from_me ? 'Você' : quoted.sender_name || 'Contacto'
  const hasMediaThumb = (quoted.message_type === 'image' || quoted.message_type === 'video') && quoted.media_url

  return (
    <div className="border-l-4 border-primary/50 bg-muted/50 rounded-r px-2 py-1.5 mb-1 flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-primary">{senderLabel}</div>
        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
          {Icon && <Icon className="h-3 w-3 flex-shrink-0" />}
          {quoted.text || quoted.message_type}
        </div>
      </div>
      {hasMediaThumb && (
        <img
          src={quoted.media_url!}
          alt=""
          className="h-10 w-10 rounded object-cover flex-shrink-0"
        />
      )}
    </div>
  )
}
