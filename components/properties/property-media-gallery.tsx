'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import { PropertyMediaUpload } from './property-media-upload'
import { usePropertyMedia } from '@/hooks/use-property-media'
import { Star, Trash2, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import type { PropertyMedia } from '@/types/property'

interface PropertyMediaGalleryProps {
  propertyId: string
  media: PropertyMedia[]
  onMediaChange: () => void
}

function SortableImageItem({
  item,
  onSetCover,
  onDelete,
}: {
  item: PropertyMedia
  onSetCover: (id: string) => void
  onDelete: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group aspect-[16/10] rounded-lg overflow-hidden bg-muted border"
    >
      <Image
        src={item.url}
        alt={`Imagem ${(item.order_index ?? 0) + 1}`}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 50vw, 25vw"
      />

      {item.is_cover && (
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
            <Star className="h-3 w-3 fill-current" />
            Capa
          </span>
        </div>
      )}

      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute top-2 right-2 flex gap-1">
          {!item.is_cover && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={() => onSetCover(item.id)}
              title="Definir como capa"
            >
              <Star className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white hover:bg-white/20"
            onClick={() => onDelete(item.id)}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div
          className="absolute bottom-2 left-2 cursor-grab active:cursor-grabbing text-white"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

export function PropertyMediaGallery({
  propertyId,
  media: initialMedia,
  onMediaChange,
}: PropertyMediaGalleryProps) {
  const {
    media,
    setCover,
    deleteImage,
    reorderImages,
    refetch,
  } = usePropertyMedia(propertyId)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const currentMedia = media.length > 0 ? media : initialMedia

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = currentMedia.findIndex((m) => m.id === active.id)
    const newIndex = currentMedia.findIndex((m) => m.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...currentMedia]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    try {
      await reorderImages(reordered)
    } catch {
      toast.error('Erro ao reordenar imagens')
    }
  }

  const handleSetCover = async (mediaId: string) => {
    try {
      await setCover(mediaId)
      toast.success('Capa actualizada')
      onMediaChange()
    } catch {
      toast.error('Erro ao definir capa')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteImage(deleteId)
      toast.success('Imagem eliminada')
      onMediaChange()
    } catch {
      toast.error('Erro ao eliminar imagem')
    } finally {
      setDeleteId(null)
    }
  }

  const handleUploadComplete = () => {
    refetch()
    onMediaChange()
  }

  return (
    <div className="space-y-4">
      {currentMedia.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={currentMedia.map((m) => m.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {currentMedia.map((item) => (
                <SortableImageItem
                  key={item.id}
                  item={item}
                  onSetCover={handleSetCover}
                  onDelete={setDeleteId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <PropertyMediaUpload
        propertyId={propertyId}
        onUploadComplete={handleUploadComplete}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar imagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar esta imagem? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
