'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Plus, Trash2, Loader2, FileText, Download, Maximize2, X, Layers,
} from 'lucide-react'
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface PlantaMedia {
  id: string
  url: string
  media_type: string
  order_index: number
}

interface PropertyPlantasSectionProps {
  propertyId: string
  plantas: PlantaMedia[]
  onMediaChange: () => void
}

export function PropertyPlantasSection({ propertyId, plantas, onMediaChange }: PropertyPlantasSectionProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setIsUploading(true)
    let uploaded = 0

    for (const file of Array.from(files)) {
      const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
      if (!allowed.includes(file.type)) {
        toast.error(`Ficheiro "${file.name}" não suportado. Use PDF, PNG ou JPG.`)
        continue
      }

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('propertyId', propertyId)
        formData.append('media_type', 'planta')

        const res = await fetch(`/api/properties/${propertyId}/media`, {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          uploaded++
        } else {
          const err = await res.json()
          toast.error(`Erro ao carregar "${file.name}": ${err.error || 'desconhecido'}`)
        }
      } catch {
        toast.error(`Erro ao carregar "${file.name}"`)
      }
    }

    if (uploaded > 0) {
      toast.success(`${uploaded} planta${uploaded > 1 ? 's' : ''} carregada${uploaded > 1 ? 's' : ''}`)
      onMediaChange()
    }
    setIsUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }, [propertyId, onMediaChange])

  const handleDelete = useCallback(async (mediaId: string) => {
    setDeletingId(mediaId)
    try {
      const res = await fetch(`/api/properties/${propertyId}/media/${mediaId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Planta eliminada')
        onMediaChange()
      } else {
        toast.error('Erro ao eliminar planta')
      }
    } catch {
      toast.error('Erro ao eliminar planta')
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }, [propertyId, onMediaChange])

  const isPdf = (url: string) => url.toLowerCase().endsWith('.pdf')

  return (
    <div className="space-y-3 pt-4 border-t">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-base font-semibold">Plantas</h3>
          {plantas.length > 0 && (
            <span className="text-xs text-muted-foreground">({plantas.length})</span>
          )}
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full text-xs"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            {isUploading ? 'A carregar...' : 'Adicionar'}
          </Button>
        </div>
      </div>

      {plantas.length === 0 ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 cursor-pointer hover:bg-muted/30 transition-colors"
        >
          <Layers className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma planta adicionada</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Clique para adicionar PDF ou imagem</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {plantas.map((planta, idx) => (
            <div
              key={planta.id}
              className="group relative rounded-xl border bg-card overflow-hidden transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-1"
              style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'backwards' }}
            >
              {isPdf(planta.url) ? (
                <div
                  className="aspect-[3/4] bg-muted/30 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => window.open(planta.url, '_blank')}
                >
                  <FileText className="h-10 w-10 text-red-400 mb-2" />
                  <span className="text-[10px] text-muted-foreground font-medium">PDF</span>
                </div>
              ) : (
                <div
                  className="aspect-[3/4] bg-muted/30 cursor-pointer"
                  onClick={() => setPreviewUrl(planta.url)}
                >
                  <img
                    src={planta.url}
                    alt={`Planta ${idx + 1}`}
                    className="w-full h-full object-contain p-2"
                  />
                </div>
              )}

              {/* Actions overlay */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isPdf(planta.url) ? (
                  <a
                    href={planta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <button
                    onClick={() => setPreviewUrl(planta.url)}
                    className="h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setConfirmDeleteId(planta.id)}
                  className="h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-red-500/80 transition-colors"
                >
                  {deletingId === planta.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Label */}
              <div className="px-2.5 py-2 text-center">
                <span className="text-[11px] text-muted-foreground">Planta {idx + 1}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95">
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/25 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Planta"
              className="w-full h-auto max-h-[85vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar planta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar esta planta? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
