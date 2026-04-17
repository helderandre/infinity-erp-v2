'use client'

import { Download } from 'lucide-react'
import { DocIcon } from '@/components/icons/doc-icon'
import { Button } from '@/components/ui/button'
import { VoiceMessagePlayer } from './voice-recorder'
import type { ChatAttachment as ChatAttachmentType } from '@/types/process'

interface ChatAttachmentProps {
  attachment: ChatAttachmentType
  isOwn?: boolean
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isVoiceMessage(attachment: ChatAttachmentType): boolean {
  return (
    attachment.attachment_type === 'audio' &&
    (attachment.file_name.startsWith('voice-message') ||
      attachment.file_name.includes('voice'))
  )
}

export function ChatAttachment({ attachment, isOwn = true }: ChatAttachmentProps) {
  const sizeLabel = formatFileSize(attachment.file_size)

  if (attachment.attachment_type === 'image') {
    return (
      <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
        <img
          src={attachment.file_url}
          alt={attachment.file_name}
          className="max-w-xs rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
        />
      </a>
    )
  }

  if (attachment.attachment_type === 'audio') {
    // Voice messages get the WhatsApp-style player
    if (isVoiceMessage(attachment)) {
      return (
        <VoiceMessagePlayer
          src={attachment.file_url}
          variant={isOwn ? 'own' : 'other'}
        />
      )
    }

    // Regular audio files keep the native player
    return (
      <div className="mt-1">
        <audio controls className="max-w-xs">
          <source src={attachment.file_url} type={attachment.mime_type || undefined} />
        </audio>
        <p className="text-xs text-muted-foreground mt-0.5">{attachment.file_name}</p>
      </div>
    )
  }

  if (attachment.attachment_type === 'video') {
    return (
      <div className="mt-1">
        <video controls className="max-w-xs rounded-lg border">
          <source src={attachment.file_url} type={attachment.mime_type || undefined} />
        </video>
        <p className="text-xs text-muted-foreground mt-0.5">{attachment.file_name}</p>
      </div>
    )
  }

  const ext = attachment.file_name.split('.').pop()

  return (
    <div className="flex items-center gap-2 rounded-lg border px-3 py-2 mt-1 max-w-xs bg-muted/50">
      <DocIcon className="h-8 w-8 shrink-0" extension={ext} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
        {sizeLabel && (
          <p className="text-xs text-muted-foreground">{sizeLabel}</p>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild>
        <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" download>
          <Download className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  )
}
