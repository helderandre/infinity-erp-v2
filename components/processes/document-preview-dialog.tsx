'use client'

import { FileText, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { DocumentFile } from '@/types/process'

interface DocumentPreviewDialogProps {
  file: DocumentFile | null
  onClose: () => void
}

export function DocumentPreviewDialog({ file, onClose }: DocumentPreviewDialogProps) {
  if (!file) return null

  const mimetype = file.metadata?.mimetype || ''
  const isPdf = mimetype === 'application/pdf'
  const isImage = mimetype.startsWith('image/')

  return (
    <Dialog open={!!file} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">{file.file_name}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {isPdf && (
            <iframe
              src={file.file_url}
              className="w-full h-full rounded-md border"
              title={file.file_name}
            />
          )}
          {isImage && (
            <img
              src={file.file_url}
              alt={file.file_name}
              className="w-full h-full object-contain rounded-md"
            />
          )}
          {!isPdf && !isImage && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <FileText className="h-16 w-16" />
              <p className="text-sm">Pré-visualização não disponível para este tipo de ficheiro.</p>
              <Button
                variant="outline"
                onClick={() => window.open(file.file_url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir ficheiro
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
