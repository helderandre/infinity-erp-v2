'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PropertyImageCropper } from './property-image-cropper'
import { useImageCompress } from '@/hooks/use-image-compress'
import { useBackgroundUpload } from '@/hooks/use-background-upload'
import { ImagePlus, X, Crop, Upload, Plus, GripVertical } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PropertyMediaUploadProps {
  propertyId: string
  onUploadComplete: () => void
  variant?: 'default' | 'icon'
}

interface PendingImage {
  id: string
  file: File
  preview: string
  croppedFile?: File
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function PropertyMediaUpload({
  propertyId,
  onUploadComplete,
  variant = 'default',
}: PropertyMediaUploadProps) {
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [cropImage, setCropImage] = useState<PendingImage | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { compressImages, isCompressing, progress: compressProgress } = useImageCompress()
  const bgUpload = useBackgroundUpload()

  // ─── Cleanup any object URLs still alive when the component unmounts ─────
  useEffect(() => {
    return () => {
      setPendingImages((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.preview))
        return []
      })
    }
  }, [])

  // ─── Add files to the staging area (preserves the order they arrive in) ──
  const stageFiles = useCallback((rawFiles: FileList | File[] | null) => {
    if (!rawFiles) return
    const files = Array.from(rawFiles).filter((f) => ALLOWED_TYPES.includes(f.type))
    if (files.length === 0) {
      toast.error('Apenas JPEG, PNG ou WebP são suportados.')
      return
    }
    const newPending: PendingImage[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }))
    // Append at the end so a second drop adds to the existing list.
    setPendingImages((prev) => [...prev, ...newPending])
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    stageFiles(e.target.files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Drag-and-drop handlers (file dropzone) ──────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) setIsDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    stageFiles(e.dataTransfer.files)
  }

  const removePending = (id: string) => {
    setPendingImages((prev) => {
      const item = prev.find((p) => p.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter((p) => p.id !== id)
    })
  }

  const clearAll = () => {
    setPendingImages((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.preview))
      return []
    })
  }

  const handleCropDone = useCallback(
    (blob: Blob) => {
      if (!cropImage) return
      const file = new File([blob], cropImage.file.name.replace(/\.[^.]+$/, '.webp'), {
        type: 'image/webp',
      })
      const newPreview = URL.createObjectURL(file)
      setPendingImages((prev) =>
        prev.map((p) => {
          if (p.id === cropImage.id) {
            URL.revokeObjectURL(p.preview)
            return { ...p, croppedFile: file, preview: newPreview }
          }
          return p
        })
      )
      setCropImage(null)
    },
    [cropImage]
  )

  // ─── Sortable thumbnails ─────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setPendingImages((prev) => {
      const from = prev.findIndex((p) => p.id === active.id)
      const to = prev.findIndex((p) => p.id === over.id)
      if (from < 0 || to < 0) return prev
      return arrayMove(prev, from, to)
    })
  }

  // ─── Upload (manual — only fires when the user clicks the button) ────────
  const handleUpload = async () => {
    if (!pendingImages.length) return
    setIsUploading(true)
    setUploadProgress(0)

    // Capture the current order BEFORE clearing the staging — files leave the
    // array as they're sent, but we want the API order to mirror the staged
    // sequence. Map index → preview for the bg-upload thumbnail.
    const snapshot = pendingImages.slice()

    try {
      const filesToCompress = snapshot.map((p) => p.croppedFile || p.file)
      const compressed = await compressImages(filesToCompress)
      const count = compressed.length

      // Pin the gallery position deterministically — fetch the current
      // max(order_index) ONCE before the batch and send the absolute target
      // index per file. With parallel uploads (concurrency 7) reading max
      // server-side races: two uploads can read the same max and either
      // collide or drift, scrambling the gallery order. Computing client-side
      // upfront eliminates that entirely.
      let baseOrderIndex = 0
      try {
        const res = await fetch(`/api/properties/${propertyId}/media`)
        if (res.ok) {
          const list = (await res.json()) as Array<{ order_index?: number | null }>
          const max = list.reduce(
            (m, it) => Math.max(m, it.order_index ?? -1),
            -1,
          )
          baseOrderIndex = max + 1
        }
      } catch {
        // Fall back to server's max+1+position logic if the prefetch fails.
      }

      // Cleanup previews + clear staging so the user can continue working.
      snapshot.forEach((p) => URL.revokeObjectURL(p.preview))
      setPendingImages([])
      setIsUploading(false)
      setUploadProgress(0)

      let completedCount = 0
      await bgUpload.uploadMultiple(
        compressed.map((file, i) => ({
          url: `/api/properties/${propertyId}/media`,
          file,
          fileName: file.name || `imagem-${i + 1}.webp`,
          context: `Imóvel — imagem ${i + 1}/${count}`,
          thumbnailUrl: snapshot[i]?.preview,
          extraFormData: {
            // Absolute target index — survives parallel uploads and racy reads.
            order_index: String(baseOrderIndex + i),
            // Position kept as a fallback in case the server's prefetch path
            // fails and the legacy logic kicks in.
            position: String(i),
          },
          onSuccess: () => {
            completedCount++
            if (completedCount === count) {
              onUploadComplete()
            }
          },
        }))
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao comprimir imagens')
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const isBusy = isUploading || isCompressing
  const hasPending = pendingImages.length > 0

  return (
    <div className={variant === 'icon' ? 'contents' : 'space-y-4'}>
      {variant === 'icon' ? (
        // Icon variant — compact + button only (no dropzone, used in toolbars).
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          title="Adicionar imagens"
        >
          {isBusy ? <Spinner variant="infinite" size={16} /> : <Plus className="h-4 w-4" />}
        </Button>
      ) : (
        // Default variant — dropzone with click-to-pick fallback.
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center cursor-pointer transition-colors',
            isDragOver
              ? 'border-primary/60 bg-primary/5 text-foreground'
              : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50',
            isBusy && 'pointer-events-none opacity-60',
          )}
        >
          {isBusy ? (
            <Spinner variant="infinite" size={20} />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
          <div className="text-xs">
            <span className="font-medium text-foreground">Arraste as imagens</span>{' '}
            ou clique para escolher
          </div>
          <p className="text-[10px] text-muted-foreground/80">
            JPEG, PNG ou WebP — a ordem do drop é mantida na galeria.
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {isBusy && (
        <div className="space-y-1">
          <Progress value={isCompressing ? compressProgress : uploadProgress} />
          <p className="text-xs text-muted-foreground">
            {isCompressing ? 'A comprimir imagens...' : 'A enviar imagens...'}
          </p>
        </div>
      )}

      {hasPending && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{pendingImages.length}</span>{' '}
              imagem{pendingImages.length === 1 ? '' : 'ens'} em staging.{' '}
              <span className="text-muted-foreground/70">Arraste para reordenar.</span>
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full text-xs"
                onClick={clearAll}
                disabled={isBusy}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Limpar
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-full text-xs"
                onClick={handleUpload}
                disabled={isBusy}
              >
                <Upload className="mr-1 h-3.5 w-3.5" />
                Carregar {pendingImages.length}
              </Button>
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pendingImages.map((p) => p.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {pendingImages.map((img, idx) => (
                  <SortableThumb
                    key={img.id}
                    image={img}
                    index={idx}
                    onCrop={() => setCropImage(img)}
                    onRemove={() => removePending(img.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {cropImage && (
        <PropertyImageCropper
          imageSrc={cropImage.preview}
          open={!!cropImage}
          onOpenChange={(open) => !open && setCropImage(null)}
          onCropDone={handleCropDone}
        />
      )}
    </div>
  )
}

/* ───────── Thumbnail (sortable) ───────── */

function SortableThumb({
  image, index, onCrop, onRemove,
}: {
  image: PendingImage
  index: number
  onCrop: () => void
  onRemove: () => void
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: image.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group aspect-square rounded-md overflow-hidden bg-muted ring-1 ring-border/40',
        isDragging && 'ring-primary/60 shadow-lg',
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.preview} alt="Preview" className="w-full h-full object-cover" />

      {/* Order badge (top-left) */}
      <div className="absolute top-1 left-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-background/90 backdrop-blur-sm text-[10px] font-semibold tabular-nums shadow-sm">
        {index + 1}
      </div>

      {/* Drag handle (top-right, always visible so users learn they can reorder) */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-1 right-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-background/90 backdrop-blur-sm text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shadow-sm"
        aria-label="Arrastar para reordenar"
        title="Arrastar para reordenar"
      >
        <GripVertical className="h-3 w-3" />
      </button>

      {/* Hover actions (bottom centre) */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-white hover:bg-white/20"
          onClick={onCrop}
          aria-label="Recortar"
        >
          <Crop className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-white hover:bg-white/20"
          onClick={onRemove}
          aria-label="Remover"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
