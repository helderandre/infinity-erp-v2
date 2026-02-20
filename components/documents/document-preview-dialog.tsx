'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, ExternalLink } from 'lucide-react'
import type { Document } from '@/types/document'

interface DocumentPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: Document | null
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  document,
}: DocumentPreviewDialogProps) {
  if (!document) return null

  const isPdf =
    document.file_name.toLowerCase().endsWith('.pdf') ||
    document.metadata?.mimetype === 'application/pdf'
  const isImage =
    document.metadata?.mimetype?.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp)$/i.test(document.file_name)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate">{document.file_name}</span>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <Button variant="outline" size="sm" asChild>
                <a href={document.file_url} download={document.file_name}>
                  <Download className="mr-2 h-4 w-4" />
                  Descarregar
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={document.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir
                </a>
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 overflow-auto max-h-[70vh]">
          {isPdf ? (
            <iframe
              src={document.file_url}
              className="w-full h-[70vh] rounded border"
              title={document.file_name}
            />
          ) : isImage ? (
            <img
              src={document.file_url}
              alt={document.file_name}
              className="max-w-full rounded"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">
                Pre-visualizacao nao disponivel para este formato.
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <a href={document.file_url} download={document.file_name}>
                  <Download className="mr-2 h-4 w-4" />
                  Descarregar ficheiro
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
