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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
import { Star, Trash2, GripVertical, LayoutGrid, List, Columns3 } from 'lucide-react'
import { toast } from 'sonner'
import type { PropertyMedia } from '@/types/property'

type ViewMode = 'grid' | 'list'
type ColumnCount = '4' | '8' | '12'

const COLUMN_CLASSES: Record<ColumnCount, string> = {
  '4': 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  '8': 'grid-cols-3 md:grid-cols-5 lg:grid-cols-8',
  '12': 'grid-cols-4 md:grid-cols-8 lg:grid-cols-12',
}

interface PropertyMediaGalleryProps {
  propertyId: string
  media: PropertyMedia[]
  onMediaChange: () => void
}

function SortableGridItem({
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

function SortableListItem({
  item,
  index,
  onSetCover,
  onDelete,
}: {
  item: PropertyMedia
  index: number
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
      className="flex items-center gap-3 rounded-lg border bg-card p-2 hover:bg-accent/50 transition-colors"
    >
      <div
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </div>

      <div className="relative h-16 w-24 shrink-0 rounded-md overflow-hidden bg-muted">
        <Image
          src={item.url}
          alt={`Imagem ${index + 1}`}
          fill
          className="object-cover"
          sizes="96px"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Imagem {index + 1}</span>
          {item.is_cover && (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
              <Star className="h-2.5 w-2.5 fill-current" />
              Capa
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          Posição {index + 1}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!item.is_cover && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onSetCover(item.id)}
            title="Definir como capa"
          >
            <Star className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(item.id)}
          title="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [columns, setColumns] = useState<ColumnCount>('8')

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
      {/* Toolbar: título + upload | toggles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold">Galeria de Imagens</h3>
          <PropertyMediaUpload
            propertyId={propertyId}
            onUploadComplete={handleUploadComplete}
          />
          {currentMedia.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {currentMedia.length} {currentMedia.length === 1 ? 'imagem' : 'imagens'}
            </span>
          )}
        </div>

        {currentMedia.length > 0 && (
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as ViewMode)}
              size="sm"
            >
              <ToggleGroupItem value="grid" aria-label="Vista em grelha">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Vista em lista">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>

            {viewMode === 'grid' && (
              <ToggleGroup
                type="single"
                variant="outline"
                value={columns}
                onValueChange={(v) => v && setColumns(v as ColumnCount)}
                size="sm"
              >
                <ToggleGroupItem value="4" aria-label="4 colunas">
                  4
                </ToggleGroupItem>
                <ToggleGroupItem value="8" aria-label="8 colunas">
                  8
                </ToggleGroupItem>
                <ToggleGroupItem value="12" aria-label="12 colunas">
                  12
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
        )}
      </div>

      {currentMedia.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={currentMedia.map((m) => m.id)}
            strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
          >
            {viewMode === 'grid' ? (
              <div className={`grid gap-3 ${COLUMN_CLASSES[columns]}`}>
                {currentMedia.map((item) => (
                  <SortableGridItem
                    key={item.id}
                    item={item}
                    onSetCover={handleSetCover}
                    onDelete={setDeleteId}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {currentMedia.map((item, index) => (
                  <SortableListItem
                    key={item.id}
                    item={item}
                    index={index}
                    onSetCover={handleSetCover}
                    onDelete={setDeleteId}
                  />
                ))}
              </div>
            )}
          </SortableContext>
        </DndContext>
      )}

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
