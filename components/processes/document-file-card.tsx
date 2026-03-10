'use client'

import { Eye, Download, FileText, Image } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FILE_TYPE_ICONS } from '@/lib/constants'
import type { DocumentFile } from '@/types/process'

function formatFileSize(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Image,
}

interface DocumentFileCardProps {
  file: DocumentFile
  onPreview: (file: DocumentFile) => void
  onDownload: (file: DocumentFile) => void
}

export function DocumentFileCard({ file, onPreview, onDownload }: DocumentFileCardProps) {
  const mimetype = file.metadata?.mimetype || ''
  const typeInfo = FILE_TYPE_ICONS[mimetype]
  const IconComponent = typeInfo ? (ICON_MAP[typeInfo.icon] || FileText) : FileText
  const iconColor = typeInfo?.color || 'text-muted-foreground'
  const abbr = typeInfo?.abbr || file.file_name.split('.').pop()?.toUpperCase() || 'FILE'

  return (
    <Card className="overflow-hidden cursor-pointer transition-all hover:shadow-md group">
      <div className="aspect-[4/3] bg-muted flex flex-col items-center justify-center relative">
        <IconComponent className={`h-12 w-12 ${iconColor}`} />
        <span className={`text-xs font-bold mt-1 ${iconColor}`}>{abbr}</span>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="h-9 w-9"
            onClick={(e) => { e.stopPropagation(); onPreview(file) }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-9 w-9"
            onClick={(e) => { e.stopPropagation(); onDownload(file) }}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CardContent className="p-3">
        <p className="text-sm font-medium truncate" title={file.file_name}>
          {file.file_name}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground truncate">
            {file.doc_type?.name || 'Sem tipo'}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(file.metadata?.size)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
