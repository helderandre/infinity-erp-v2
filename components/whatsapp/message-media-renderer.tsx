'use client'

import { useState } from 'react'
import { Download, MapPin, User, Loader2 } from 'lucide-react'
import { DocIcon } from '@/components/icons/doc-icon'
import { AudioPlayer } from './audio-player'
import { MediaPreviewModal } from './media-preview-modal'
import { useMediaUrl } from '@/hooks/use-media-url'
import type { WppMessage } from '@/lib/types/whatsapp-web'

interface MessageMediaRendererProps {
  message: WppMessage
  instanceId?: string
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

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'text/html': 'html',
  'application/json': 'json',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

function getFileExtension(fileName: string | null, mimeType: string | null): string {
  if (fileName) {
    const decoded = decodeURIComponent(fileName)
    const ext = decoded.split('.').pop()?.toLowerCase()
    if (ext && ext.length <= 10) return ext
  }
  if (mimeType && MIME_TO_EXT[mimeType]) return MIME_TO_EXT[mimeType]
  return ''
}

function getFileDisplayName(fileName: string | null, mediaUrl: string | null): string {
  // Try fileName first
  if (fileName) {
    try {
      let name = decodeURIComponent(fileName)
      // Strip timestamp prefix from R2 uploads (e.g. "1773871823738-Notas_para_...")
      name = name.replace(/^\d{13}-/, '')
      // Replace underscores with spaces
      name = name.replace(/_/g, ' ')
      return name
    } catch {
      return fileName
    }
  }
  // Fallback: extract from URL
  if (mediaUrl) {
    try {
      const urlPath = new URL(mediaUrl).pathname
      let name = decodeURIComponent(urlPath.split('/').pop() || 'Documento')
      name = name.replace(/^\d{13}-/, '')
      name = name.replace(/_/g, ' ')
      return name
    } catch {
      // ignore
    }
  }
  return 'Documento'
}

function getMimeLabel(mimeType: string | null): string {
  if (!mimeType) return ''
  // Friendly labels for common MIME types
  const friendly: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/zip': 'ZIP',
    'application/x-rar-compressed': 'RAR',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.ms-powerpoint': 'PPT',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'text/html': 'HTML',
    'application/json': 'JSON',
    'video/mp4': 'MP4',
    'audio/mpeg': 'MP3',
    'audio/ogg': 'OGG',
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/webp': 'WEBP',
    'application/x-iwork-pages-sffpages': 'PAGES',
    'application/x-iwork-keynote-sffkey': 'KEY',
    'application/x-iwork-numbers-sffnumbers': 'NUMBERS',
  }
  if (friendly[mimeType]) return friendly[mimeType]
  // Fallback: last segment uppercase, max 6 chars
  const last = mimeType.split('/').pop() || ''
  const short = last.split('.').pop() || last
  return short.toUpperCase().slice(0, 6)
}

function MediaLoading() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 px-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>A carregar média...</span>
    </div>
  )
}

export function MessageMediaRenderer({ message, instanceId }: MessageMediaRendererProps) {
  const [previewOpen, setPreviewOpen] = useState(false)

  // Resolver media URL via UAZAPI se necessário (CDN encriptado)
  const { mediaUrl, loading: mediaLoading } = useMediaUrl(
    instanceId,
    message.wa_message_id,
    message.message_type,
    message.media_url
  )

  switch (message.message_type) {
    case 'image':
      if (mediaLoading) return <MediaLoading />
      if (!mediaUrl) return null
      return (
        <>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="block mb-1 rounded overflow-hidden"
          >
            <img
              src={mediaUrl}
              alt={message.text || 'Imagem'}
              className="max-h-[300px] w-auto rounded object-cover"
              loading="lazy"
            />
          </button>
          {previewOpen && (
            <MediaPreviewModal
              url={mediaUrl}
              type="image"
              onClose={() => setPreviewOpen(false)}
            />
          )}
        </>
      )

    case 'video':
      if (mediaLoading) return <MediaLoading />
      if (!mediaUrl) return null
      return (
        <div className="mb-1 rounded overflow-hidden relative">
          <video
            src={mediaUrl}
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
      if (mediaLoading) return <MediaLoading />
      return (
        <div className="mb-1 min-w-[240px]">
          {mediaUrl ? (
            <AudioPlayer
              src={mediaUrl}
              duration={message.media_duration || 0}
            />
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <span className="animate-pulse">A processar áudio...</span>
            </div>
          )}
        </div>
      )

    case 'document': {
      if (mediaLoading) return <MediaLoading />
      const ext = getFileExtension(message.media_file_name, message.media_mime_type)
      const displayName = getFileDisplayName(message.media_file_name, mediaUrl)
      const fileSize = formatFileSize(message.media_file_size)
      const mimeLabel = getMimeLabel(message.media_mime_type)

      return (
        <a
          href={mediaUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          download={displayName}
          className="flex items-center gap-3 p-2.5 mb-1 rounded-lg bg-muted/50 hover:bg-muted transition-colors min-w-[220px] max-w-[320px] group"
        >
          <DocIcon className="h-10 w-10" extension={ext} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate leading-tight">
              {displayName}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {[mimeLabel, fileSize].filter(Boolean).join(' · ')}
            </div>
          </div>
          <Download className="h-4 w-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      )
    }

    case 'sticker':
      if (mediaLoading) return <MediaLoading />
      if (!mediaUrl) return null
      return (
        <img
          src={mediaUrl}
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
