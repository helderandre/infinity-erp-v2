'use client'

import { MoreHorizontal, Eye, Download, FileText, Image } from 'lucide-react'
import { TableRow, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FILE_TYPE_ICONS } from '@/lib/constants'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
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

interface DocumentFileRowProps {
  file: DocumentFile
  onPreview: (file: DocumentFile) => void
  onDownload: (file: DocumentFile) => void
}

export function DocumentFileRow({ file, onPreview, onDownload }: DocumentFileRowProps) {
  const mimetype = file.metadata?.mimetype || ''
  const typeInfo = FILE_TYPE_ICONS[mimetype]
  const IconComponent = typeInfo ? (ICON_MAP[typeInfo.icon] || FileText) : FileText
  const iconColor = typeInfo?.color || 'text-muted-foreground'

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50">
      <TableCell className="w-10">
        <IconComponent className={`h-4 w-4 ${iconColor}`} />
      </TableCell>
      <TableCell className="font-medium max-w-[200px] truncate" title={file.file_name}>
        {file.file_name}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {file.doc_type?.name || 'Sem tipo'}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatFileSize(file.metadata?.size)}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: pt })}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onPreview(file)}>
              <Eye className="h-4 w-4 mr-2" />
              Ver
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(file)}>
              <Download className="h-4 w-4 mr-2" />
              Descarregar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
