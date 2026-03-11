'use client'

import { Eye, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DocIcon } from '@/components/icons/doc-icon'
import type { DocumentFile } from '@/types/process'

function formatFileSize(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getExtension(fileName: string): string | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ext && ext !== fileName.toLowerCase() ? ext : undefined
}

interface DocumentFileCardProps {
  file: DocumentFile
  onPreview: (file: DocumentFile) => void
  onDownload: (file: DocumentFile) => void
}

export function DocumentFileCard({ file, onPreview, onDownload }: DocumentFileCardProps) {
  const ext = getExtension(file.file_name)

  return (
    <Card className="overflow-hidden gap-0 cursor-pointer transition-all hover:shadow-sm hover:scale-[1.01] py-0 group">
      <div className="aspect-[16/10] m-2 rounded-lg bg-muted/30 flex items-center justify-center relative">
        <DocIcon className="h-32 w-32" extension={ext} />

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
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
      <CardContent className="p-4">
        <p className="font-semibold text-sm truncate" title={file.doc_type?.name || 'Sem tipo'}>
          {file.doc_type?.name || 'Sem tipo'}
        </p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-muted-foreground truncate" title={file.file_name}>
            {file.file_name}
          </span>
          <span className="text-xs text-muted-foreground shrink-0 ml-1">
            {formatFileSize(file.metadata?.size)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
