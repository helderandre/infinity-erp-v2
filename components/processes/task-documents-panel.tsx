'use client'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  FileText,
  ExternalLink,
  Download,
  FolderOpen,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { ProcessDocument } from '@/types/process'

interface TaskDocumentsPanelProps {
  documents: ProcessDocument[]
  taskTitle?: string
}

export function TaskDocumentsPanel({ documents }: TaskDocumentsPanelProps) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FolderOpen className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Sem documentos associados.</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Documentos ({documents.length})
        </h4>
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{doc.doc_type?.name}</span>
                    <span>·</span>
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" asChild>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a href={doc.file_url} download={doc.file_name}>
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}
