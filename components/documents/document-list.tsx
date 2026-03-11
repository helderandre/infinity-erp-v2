'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreHorizontal,
  Eye,
  Archive,
  Download,
  ExternalLink,
} from 'lucide-react'
import { DocIcon } from '@/components/icons/doc-icon'
import { formatDate } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'
import type { Document } from '@/types/document'

interface DocumentListProps {
  documents: Document[]
  onPreview?: (doc: Document) => void
  onArchive?: (docId: string) => void
  emptyMessage?: string
}

export function DocumentList({
  documents,
  onPreview,
  onArchive,
  emptyMessage = 'Nenhum documento encontrado',
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <DocIcon className="h-12 w-12 mb-4" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Documento</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Validade</TableHead>
          <TableHead>Data</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => {
          const statusConfig =
            STATUS_COLORS[doc.status as keyof typeof STATUS_COLORS]
          const isExpired =
            doc.valid_until && new Date(doc.valid_until) < new Date()

          return (
            <TableRow key={doc.id}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <DocIcon className="h-8 w-8" extension={doc.file_name.split('.').pop()} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate max-w-[200px]">{doc.doc_type?.name || doc.file_name}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{doc.file_name}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {statusConfig ? (
                  <Badge
                    variant="outline"
                    className={`${statusConfig.bg} ${statusConfig.text} border-0`}
                  >
                    {statusConfig.label}
                  </Badge>
                ) : (
                  <Badge variant="outline">{doc.status}</Badge>
                )}
              </TableCell>
              <TableCell>
                {doc.valid_until ? (
                  <span
                    className={
                      isExpired ? 'text-red-600 font-medium' : 'text-sm'
                    }
                  >
                    {formatDate(doc.valid_until)}
                    {isExpired && ' (expirado)'}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(doc.created_at)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onPreview && (
                      <DropdownMenuItem onClick={() => onPreview(doc)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Visualizar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={doc.file_url} download={doc.file_name}>
                        <Download className="mr-2 h-4 w-4" />
                        Descarregar
                      </a>
                    </DropdownMenuItem>
                    {onArchive && doc.status === 'active' && (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onArchive(doc.id)}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Arquivar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
