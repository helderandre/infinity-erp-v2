'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
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
import { GripVertical, Loader2, Plus, Trash2, Video } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

function SortableVideo({
  v,
  onDelete,
  isDeleting,
}: {
  v: VideoMedia
  onDelete: () => void
  isDeleting: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: v.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded-2xl overflow-hidden border bg-black aspect-video"
    >
      <video
        src={v.url}
        controls
        preload="metadata"
        className="w-full h-full object-contain"
      />
      {/* Drag handle — bottom-left, always visible to be discoverable */}
      <div
        className="absolute bottom-2 left-2 z-10 flex h-8 w-8 items-center justify-center rounded-md bg-black/50 text-white shadow-sm cursor-grab active:cursor-grabbing touch-none backdrop-blur-sm"
        title="Arrastar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label="Eliminar vídeo"
      >
        {isDeleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const sortedVideos = useMemo(
    () => videos.slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [videos],
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sortedVideos.findIndex((v) => v.id === active.id)
    const newIndex = sortedVideos.findIndex((v) => v.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = [...sortedVideos]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    try {
      const res = await fetch(`/api/properties/${propertyId}/media/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: reordered.map((v, i) => ({ id: v.id, order_index: i })),
        }),
      })
      if (!res.ok) throw new Error()
      onMediaChange()
    } catch {
      toast.error('Erro ao reordenar vídeos')
    }
  }

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
        // Surface a friendly size hint — > 200MB is rejected server-side; > 80MB
        // gets a soft warning so users know uploads on slow connections may be
        // long. Compressão verdadeira lossless é feita server-side (codec
        // re-encode com bitrate alvo) — não aplicada client-side neste flow.
        if (file.size > 80 * 1024 * 1024) {
          toast.info(`"${file.name}" tem ${Math.round(file.size / (1024 * 1024))}MB — o upload pode demorar.`)
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedVideos.map((v) => v.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sortedVideos.map((v) => (
                <SortableVideo
                  key={v.id}
                  v={v}
                  isDeleting={deletingId === v.id}
                  onDelete={() => setConfirmDeleteId(v.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
