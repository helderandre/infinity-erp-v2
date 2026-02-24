'use client'

import { FileText, File, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChatAttachment as ChatAttachmentType } from '@/types/process'

interface ChatAttachmentProps {
  attachment: ChatAttachmentType
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ChatAttachment({ attachment }: ChatAttachmentProps) {
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

  const Icon = attachment.attachment_type === 'document' ? FileText : File

  return (
    <div className="flex items-center gap-2 rounded-lg border px-3 py-2 mt-1 max-w-xs bg-muted/50">
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
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
