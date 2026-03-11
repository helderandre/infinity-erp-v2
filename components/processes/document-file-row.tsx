'use client'

import { MoreHorizontal, Eye, Download } from 'lucide-react'
import { TableRow, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DocIcon } from '@/components/icons/doc-icon'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
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

interface DocumentFileRowProps {
  file: DocumentFile
  onPreview: (file: DocumentFile) => void
  onDownload: (file: DocumentFile) => void
}

export function DocumentFileRow({ file, onPreview, onDownload }: DocumentFileRowProps) {
  const ext = getExtension(file.file_name)

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50">
      <TableCell className="w-10">
        <DocIcon className="h-8 w-8" extension={ext} />
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
