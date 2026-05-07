'use client'

import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Video } from 'lucide-react'

interface VideoMedia {
  id: string
  url: string
  media_type: string | null
  order_index: number | null
}

interface PropertyVideosSectionProps {
  propertyId: string
  videos: VideoMedia[]
  onMediaChange: () => void
}

export function PropertyVideosSection({
  propertyId,
  videos,
  onMediaChange,
}: PropertyVideosSectionProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setIsUploading(true)
      let uploaded = 0

      for (const file of Array.from(files)) {
        const allowed = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
        if (!allowed.includes(file.type)) {
          toast.error(`"${file.name}" não suportado. Use MP4, MOV ou WebM.`)
          continue
        }
        try {
          const formData = new FormData()
          formData.append('file', file)
          const res = await fetch(`/api/properties/${propertyId}/videos`, {
            method: 'POST',
            body: formData,
          })
          if (res.ok) {
            uploaded++
          } else {
            const err = await res.json().catch(() => ({}))
            toast.error(`Erro ao carregar "${file.name}": ${err.error || 'desconhecido'}`)
          }
        } catch {
          toast.error(`Erro ao carregar "${file.name}"`)
        }
      }

      if (uploaded > 0) {
        toast.success(`${uploaded} vídeo${uploaded > 1 ? 's' : ''} carregado${uploaded > 1 ? 's' : ''}`)
        onMediaChange()
      }
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    },
    [propertyId, onMediaChange]
  )

  const handleDelete = useCallback(
    async (mediaId: string) => {
      setDeletingId(mediaId)
      try {
        const res = await fetch(`/api/properties/${propertyId}/media/${mediaId}`, {
          method: 'DELETE',
        })
        if (res.ok) {
          toast.success('Vídeo eliminado')
          onMediaChange()
        } else {
          toast.error('Erro ao eliminar')
        }
      } catch {
        toast.error('Erro ao eliminar')
      } finally {
        setDeletingId(null)
        setConfirmDeleteId(null)
      }
    },
    [propertyId, onMediaChange]
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          Vídeos do imóvel
          <span className="text-xs font-normal text-muted-foreground">
            {videos.length === 0 ? 'sem vídeos' : `${videos.length} carregado${videos.length > 1 ? 's' : ''}`}
          </span>
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs rounded-full"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Adicionar
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {videos.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="w-full rounded-2xl border-2 border-dashed border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-border transition-colors p-10 flex flex-col items-center justify-center gap-2 text-muted-foreground"
        >
          <Video className="h-8 w-8" />
          <p className="text-sm font-medium">Carregar primeiro vídeo</p>
          <p className="text-[11px]">MP4, MOV ou WebM · até 200MB</p>
        </button>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {videos
            .slice()
            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
            .map((v) => (
              <div
                key={v.id}
                className="group relative rounded-2xl overflow-hidden border bg-black aspect-video"
              >
                <video
                  src={v.url}
                  controls
                  preload="metadata"
                  className="w-full h-full object-contain"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  onClick={() => setConfirmDeleteId(v.id)}
                  disabled={deletingId === v.id}
                  aria-label="Eliminar vídeo"
                >
                  {deletingId === v.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
        </div>
      )}

      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar vídeo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acção é irreversível. O vídeo será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
