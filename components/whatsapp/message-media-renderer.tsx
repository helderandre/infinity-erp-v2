'use client'

import { useState } from 'react'
import { FileText, Download, MapPin, User } from 'lucide-react'
import { AudioPlayer } from './audio-player'
import { MediaPreviewModal } from './media-preview-modal'
import type { WppMessage } from '@/lib/types/whatsapp-web'

interface MessageMediaRendererProps {
  message: WppMessage
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MessageMediaRenderer({ message }: MessageMediaRendererProps) {
  const [previewOpen, setPreviewOpen] = useState(false)

  switch (message.message_type) {
    case 'image':
      return (
        <>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="block mb-1 rounded overflow-hidden"
          >
            <img
              src={message.media_url || ''}
              alt={message.text || 'Imagem'}
              className="max-h-[300px] w-auto rounded object-cover"
              loading="lazy"
            />
          </button>
          {previewOpen && message.media_url && (
            <MediaPreviewModal
              url={message.media_url}
              type="image"
              onClose={() => setPreviewOpen(false)}
            />
          )}
        </>
      )

    case 'video':
      return (
        <div className="mb-1 rounded overflow-hidden relative">
          <video
            src={message.media_url || ''}
            controls
            className="max-h-[300px] w-auto rounded"
            preload="metadata"
          />
          {message.media_duration && (
            <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
              {formatDuration(message.media_duration)}
            </span>
          )}
        </div>
      )

    case 'audio':
      return (
        <div className="mb-1 min-w-[240px]">
          <AudioPlayer
            src={message.media_url || ''}
            duration={message.media_duration || 0}
          />
        </div>
      )

    case 'document':
      return (
        <a
          href={message.media_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 p-2.5 mb-1 rounded bg-muted/50 hover:bg-muted transition-colors min-w-[200px]"
        >
          <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {message.media_file_name || 'Documento'}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatFileSize(message.media_file_size)}
            </div>
          </div>
          <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </a>
      )

    case 'sticker':
      return (
        <img
          src={message.media_url || ''}
          alt="Sticker"
          className="max-w-[180px] max-h-[180px] mb-1"
          loading="lazy"
        />
      )

    case 'location':
      return (
        <a
          href={`https://www.google.com/maps?q=${message.location_latitude},${message.location_longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 mb-1 rounded bg-muted/50 hover:bg-muted transition-colors"
        >
          <MapPin className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div className="text-sm">
            {message.location_name || `${message.location_latitude?.toFixed(6)}, ${message.location_longitude?.toFixed(6)}`}
          </div>
        </a>
      )

    case 'contact':
      return (
        <div className="flex items-center gap-2 p-2 mb-1 rounded bg-muted/50">
          <User className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm">{message.text || 'Contacto'}</span>
        </div>
      )

    default:
      return null
  }
}
