'use client'

import { Download } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { PersonalDesign } from '@/hooks/use-personal-designs'

interface PersonalDesignPreviewDialogProps {
  design: PersonalDesign | null
  onOpenChange: (open: boolean) => void
}

function isPdf(d: PersonalDesign): boolean {
  return d.mime_type === 'application/pdf' || !!d.file_name?.toLowerCase().endsWith('.pdf')
}

function isImage(d: PersonalDesign): boolean {
  if (d.mime_type?.startsWith('image/')) return true
  const name = d.file_name?.toLowerCase() || ''
  return (
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp')
  )
}

async function download(url: string, name: string) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}

export function PersonalDesignPreviewDialog({
  design,
  onOpenChange,
}: PersonalDesignPreviewDialogProps) {
  return (
    <Dialog open={!!design} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="max-w-4xl rounded-2xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">{design?.name ?? 'Pré-visualização'}</DialogTitle>
        {design && (
          <>
            <div className="bg-muted/30">
              {design.file_url && isPdf(design) ? (
                <iframe
                  src={design.file_url}
                  className="w-full h-[75vh]"
                  title={design.name}
                />
              ) : design.file_url && isImage(design) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={design.file_url}
                  alt={design.name}
                  className="w-full h-auto max-h-[75vh] object-contain"
                />
              ) : design.canva_url ? (
                <div className="flex items-center justify-center h-[60vh] p-8">
                  <a
                    className="underline text-primary"
                    href={design.canva_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir no Canva →
                  </a>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[60vh] p-8 text-muted-foreground text-sm">
                  Sem pré-visualização disponível.
                </div>
              )}
            </div>
            <div className="p-4 border-t flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{design.name}</p>
                {design.category?.label && (
                  <p className="text-xs text-muted-foreground">{design.category.label}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {design.canva_url && (
                  <a href={design.canva_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="rounded-full text-xs">
                      Abrir no Canva
                    </Button>
                  </a>
                )}
                {design.file_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-2 text-xs"
                    onClick={() =>
                      download(design.file_url!, design.file_name || design.name)
                    }
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descarregar
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
