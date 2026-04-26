'use client'

import { useState, useRef } from 'react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PropertyMediaUpload } from './property-media-upload'
import { usePropertyMedia } from '@/hooks/use-property-media'
import { Star, Trash2, GripVertical, LayoutGrid, List, CheckSquare, X, Sparkles, Loader2, Brain, Sofa, Presentation, ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ImageCompareSlider } from '@/components/shared/image-compare-slider'
import { BorderBeam } from 'border-beam'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAiBatchStore } from '@/stores/ai-batch-store'
import type { PropertyMedia } from '@/types/property'

type ViewMode = 'grid' | 'list'

const GRID_COLUMNS = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'

const ROOM_TYPES = [
  'arrecadação',
  'casa de banho',
  'cave',
  'corredor',
  'cozinha',
  'escritório',
  'fachada exterior',
  'garagem',
  'hall de entrada',
  'jardim',
  'lavandaria',
  'piscina',
  'planta',
  'quarto',
  'sala de estar',
  'sala de jantar',
  'sótão',
  'suite',
  'terraço',
  'varanda',
  'vista aérea',
  'outro',
] as const

interface PropertyMediaGalleryProps {
  propertyId: string
  media: PropertyMedia[]
  onMediaChange: () => void
  hideRoomLabels?: boolean
}

function RoomLabelBadge({
  label,
  confidence,
  mediaId,
  onSetLabel,
  onClassify,
}: {
  label: string
  confidence: number
  mediaId: string
  onSetLabel: (id: string, label: string) => void
  onClassify: (id: string) => void
}) {
  const [customMode, setCustomMode] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const pct = Math.round(confidence * 100)
  const isEmpty = !label
  const isPlanta = label === 'planta'
  const color = isEmpty
    ? 'bg-slate-500/70'
    : isPlanta
      ? 'bg-blue-600/85'
      : pct >= 80 ? 'bg-emerald-600/85' : pct >= 60 ? 'bg-amber-600/85' : 'bg-slate-600/85'

  const handleOutroClick = () => {
    setCustomMode(true)
    setCustomValue('')
    // Focus after the dropdown content re-renders
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleCustomSubmit = () => {
    const trimmed = customValue.trim()
    if (trimmed) {
      onSetLabel(mediaId, trimmed.toLowerCase())
    }
    setCustomMode(false)
    setCustomValue('')
  }

  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) { setCustomMode(false); setCustomValue('') } }}>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-md px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs font-medium text-white ${color} backdrop-blur-sm cursor-pointer hover:brightness-110 transition-all max-w-full`}
          onClick={(e) => e.stopPropagation()}
        >
          <Brain className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
          {isEmpty ? (
            <span>Classificar</span>
          ) : (
            <>
              <span className="capitalize truncate">{label}</span>
              <span className="opacity-75 hidden sm:inline">{pct}%</span>
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-64 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem onClick={() => onClassify(mediaId)}>
          <Sparkles className="h-3.5 w-3.5 mr-2 text-violet-500" />
          {isEmpty ? 'Classificar com IA' : 'Reclassificar com IA'}
        </DropdownMenuItem>
        <div className="h-px bg-border my-1" />
        {ROOM_TYPES.filter((t) => t !== 'outro').map((type) => (
          <DropdownMenuItem
            key={type}
            onClick={() => onSetLabel(mediaId, type)}
            className={cn(type === label && 'bg-accent font-medium')}
          >
            <span className="capitalize">{type}</span>
          </DropdownMenuItem>
        ))}
        <div className="h-px bg-border my-1" />
        {customMode ? (
          <div className="px-2 py-1.5" onKeyDown={(e) => e.stopPropagation()}>
            <form
              onSubmit={(e) => { e.preventDefault(); handleCustomSubmit() }}
              className="flex gap-1.5"
            >
              <input
                ref={inputRef}
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder="Ex: despensa, closet…"
                className="flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
              <Button
                type="submit"
                size="sm"
                className="h-7 text-xs px-2"
                disabled={!customValue.trim()}
              >
                OK
              </Button>
            </form>
          </div>
        ) : (
          <DropdownMenuItem
            onClick={(e) => { e.preventDefault(); handleOutroClick() }}
            className={cn(!ROOM_TYPES.slice(0, -1).some((t) => t === label) && label !== '' && 'bg-accent font-medium')}
          >
            <span>Outro…</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SortableGridItem({
  item,
  displayUrl,
  onSetCover,
  onDelete,
  onClassify,
  onSetLabel,
  onImageClick,
  isClassifyingThis,
  selectMode,
  isSelected,
  onToggleSelect,
  hideRoomLabels,
}: {
  item: PropertyMedia
  displayUrl: string
  onSetCover: (id: string) => void
  onDelete: (id: string) => void
  onClassify: (id: string) => void
  onSetLabel: (id: string, label: string) => void
  onImageClick: (item: PropertyMedia) => void
  isClassifyingThis: boolean
  selectMode: boolean
  isSelected: boolean
  onToggleSelect: (id: string) => void
  hideRoomLabels?: boolean
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
      className={cn(
        'relative group aspect-[16/10] rounded-lg overflow-hidden bg-muted border transition-all',
        selectMode && isSelected && 'ring-2 ring-primary border-primary',
      )}
      onClick={selectMode ? () => onToggleSelect(item.id) : () => onImageClick(item)}
    >
      <Image
        src={displayUrl}
        alt={`Imagem ${(item.order_index ?? 0) + 1}`}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 50vw, 25vw"
      />
      {/* AI version indicator: shown when viewing AI version OR when on originals tab and staged version exists */}
      {(displayUrl !== item.url || (displayUrl === item.url && item.ai_staged_url)) && (
        <div className="absolute bottom-2 right-2 z-10">
          <span className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm',
            displayUrl !== item.url ? 'bg-violet-600/85' : 'bg-violet-600/50'
          )}>
            <Sparkles className="h-2.5 w-2.5" />
            IA
          </span>
        </div>
      )}

      {/* Top-left badges: cover + AI label */}
      {!hideRoomLabels && (
        <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-10 flex flex-col gap-1 max-w-[calc(100%-1rem)]">
          {item.is_cover && (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs font-medium text-primary-foreground w-fit">
              <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-current" />
              Capa
            </span>
          )}
          {item.ai_room_label && !isClassifyingThis && (
            <RoomLabelBadge
              label={item.ai_room_label!}
              confidence={item.ai_room_confidence ?? 0}
              mediaId={item.id}
              onSetLabel={onSetLabel}
              onClassify={onClassify}
            />
          )}
          {!item.ai_room_label && !isClassifyingThis && (
            <RoomLabelBadge
              label=""
              confidence={0}
              mediaId={item.id}
              onSetLabel={onSetLabel}
              onClassify={onClassify}
            />
          )}
          {isClassifyingThis && (
            <span className="inline-flex items-center gap-1 sm:gap-1.5 rounded-md bg-violet-600/85 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs font-medium text-white backdrop-blur-sm w-fit">
              <Loader2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 animate-spin" />
              <span className="hidden sm:inline">A classificar…</span>
              <span className="sm:hidden">…</span>
            </span>
          )}
        </div>
      )}

      {/* Select mode checkbox */}
      {selectMode && (
        <div className="absolute top-2 right-2 z-10">
          <div className={cn(
            'flex items-center justify-center h-6 w-6 rounded-md border-2 transition-colors',
            isSelected
              ? 'bg-primary border-primary text-primary-foreground'
              : 'bg-white/80 border-white/60 backdrop-blur-sm'
          )}>
            {isSelected && <CheckSquare className="h-4 w-4" />}
          </div>
        </div>
      )}

      {/* Normal mode hover overlay */}
      {!selectMode && (
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute top-2 right-2 flex gap-1">
            {!isClassifyingThis && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/20"
                onClick={(e) => { e.stopPropagation(); onClassify(item.id) }}
                title={item.ai_room_label ? 'Reclassificar com IA' : 'Classificar com IA'}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            )}
            {!item.is_cover && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/20"
                onClick={(e) => { e.stopPropagation(); onSetCover(item.id) }}
                title="Definir como capa"
              >
                <Star className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div
            className="absolute bottom-2 left-2 cursor-grab active:cursor-grabbing text-white"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </div>
        </div>
      )}
    </div>
  )
}

function SortableListItem({
  item,
  index,
  onSetCover,
  onDelete,
  onClassify,
  onSetLabel,
  isClassifyingThis,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  item: PropertyMedia
  index: number
  onSetCover: (id: string) => void
  onDelete: (id: string) => void
  onClassify: (id: string) => void
  onSetLabel: (id: string, label: string) => void
  isClassifyingThis: boolean
  selectMode: boolean
  isSelected: boolean
  onToggleSelect: (id: string) => void
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
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-2 hover:bg-accent/50 transition-colors',
        selectMode && isSelected && 'ring-2 ring-primary border-primary bg-primary/5',
      )}
      onClick={selectMode ? () => onToggleSelect(item.id) : undefined}
    >
      {selectMode ? (
        <div className={cn(
          'flex items-center justify-center h-6 w-6 rounded-md border-2 shrink-0 cursor-pointer transition-colors',
          isSelected
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-border'
        )}>
          {isSelected && <CheckSquare className="h-4 w-4" />}
        </div>
      ) : (
        <div
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </div>
      )}

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
          {item.ai_room_label && !isClassifyingThis && (
            <RoomLabelBadge
              label={item.ai_room_label!}
              confidence={item.ai_room_confidence ?? 0}
              mediaId={item.id}
              onSetLabel={onSetLabel}
              onClassify={onClassify}
            />
          )}
          {!item.ai_room_label && !isClassifyingThis && (
            <RoomLabelBadge
              label=""
              confidence={0}
              mediaId={item.id}
              onSetLabel={onSetLabel}
              onClassify={onClassify}
            />
          )}
          {isClassifyingThis && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              A classificar…
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          Posição {index + 1}
        </span>
      </div>

      {!selectMode && (
        <div className="flex items-center gap-1 shrink-0">
          {!isClassifyingThis && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onClassify(item.id)}
              title={item.ai_room_label ? 'Reclassificar com IA' : 'Classificar com IA'}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          )}
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
      )}
    </div>
  )
}

export function PropertyMediaGallery({
  propertyId,
  media: initialMedia,
  onMediaChange,
  hideRoomLabels,
}: PropertyMediaGalleryProps) {
  const {
    media,
    setCover,
    deleteImage,
    reorderImages,
    classifyImage,
    classifyAll,
    stageImage,
    stageImageWithPrompt,
    refineImage,
    clearStagedVersion,
    clearAllStagedVersions,
    isClassifying,
    refetch,
  } = usePropertyMedia(propertyId)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [classifyingIds, setClassifyingIds] = useState<Set<string>>(new Set())
  const [aiDialogMedia, setAiDialogMedia] = useState<PropertyMedia | null>(null)
  const [aiProcessing, setAiProcessing] = useState<string | null>(null)
  const [compareView, setCompareView] = useState<{ original: string; modified: string; label: string } | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [refineInput, setRefineInput] = useState('')
  const [presentationMode, setPresentationMode] = useState(false)
  const [presentationIndex, setPresentationIndex] = useState(0)
  type DisplayMode = 'original' | 'staged'
  const [displayMode, setDisplayMode] = useState<DisplayMode>('original')
  const [showClearAiConfirm, setShowClearAiConfirm] = useState<boolean>(false)
  const [isClearingAi, setIsClearingAi] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const rawMedia = media.length > 0 ? media : initialMedia
  // Hide plantas (both regular floor plans and 3D renders) from the gallery —
  // they live in the Plantas section. Check both media_type (how uploads are
  // categorized) and ai_room_label (how AI classification tags them).
  const allMedia = [...rawMedia]
    .filter((m) => m.media_type !== 'planta' && m.media_type !== 'planta_3d' && m.ai_room_label !== 'planta')
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  const currentMedia = displayMode === 'original'
    ? allMedia
    : allMedia.filter((m) => m.ai_staged_url)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: selectMode ? Infinity : 5 },
    })
  )

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(currentMedia.map((m) => m.id)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setBulkDeleting(true)

    const results = await Promise.allSettled(
      Array.from(selectedIds).map((id) => deleteImage(id))
    )

    const deleted = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    if (deleted > 0) {
      toast.success(`${deleted} ${deleted === 1 ? 'imagem eliminada' : 'imagens eliminadas'}`)
      onMediaChange()
    }
    if (failed > 0) {
      toast.error(`Falha ao eliminar ${failed} ${failed === 1 ? 'imagem' : 'imagens'}`)
    }

    setBulkDeleting(false)
    setShowBulkDelete(false)
    exitSelectMode()
  }

  const handleSetLabel = async (mediaId: string, label: string) => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/media/${mediaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_room_label: label, ai_room_confidence: 1, ai_classified_at: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Classificação alterada para: ${label}`)
      refetch()
    } catch {
      toast.error('Erro ao alterar classificação')
    }
  }

  const handleClassifySingle = async (mediaId: string) => {
    setClassifyingIds((prev) => new Set(prev).add(mediaId))
    try {
      const result = await classifyImage(mediaId)
      toast.success(`Classificado: ${result.room_type} (${Math.round(result.confidence * 100)}%)`)
    } catch {
      toast.error('Erro ao classificar imagem')
    } finally {
      setClassifyingIds((prev) => {
        const next = new Set(prev)
        next.delete(mediaId)
        return next
      })
    }
  }

  const handleClassifyAll = async (force = false) => {
    try {
      const result = await classifyAll(force)
      if (result.classified > 0) {
        toast.success(`${result.classified} de ${result.total} imagens classificadas`)
      } else {
        toast.info('Todas as imagens já estão classificadas')
      }
    } catch {
      toast.error('Erro ao classificar imagens')
    }
  }

  const getDisplayUrl = (item: PropertyMedia | undefined) => {
    if (!item) return ''
    if (displayMode === 'staged' && item.ai_staged_url) return item.ai_staged_url
    return item.url
  }

  const stagedCount = () => allMedia.filter((m) => m.ai_staged_url).length

  const handleClearStagedSingle = async (mediaId: string) => {
    try {
      await clearStagedVersion(mediaId)
      toast.success('Versão decorada eliminada')
      if (aiDialogMedia?.id === mediaId) {
        const updated = media.find((m) => m.id === mediaId)
        if (updated) setAiDialogMedia({ ...updated, ai_staged_url: null, ai_staged_style: null })
      }
    } catch {
      toast.error('Erro ao eliminar versão decorada')
    }
  }

  const { job: batchJob, startJob, updateJob, finishJob } = useAiBatchStore()
  const batchProcessing = batchJob && !batchJob.finished ? batchJob.type : null
  const batchProgress = batchJob ? { done: batchJob.done, total: batchJob.total } : { done: 0, total: 0 }

  const BATCH_CONCURRENCY = 3

  const runBatchStage = async (ids: string[], style: string) => {
    startJob(propertyId, 'stage', ids.length, style)
    exitSelectMode()

    let succeeded = 0
    let failed = 0
    const completedUrls: string[] = []

    const processOne = async (mediaId: string) => {
      try {
        const r = await stageImage(mediaId, style)
        succeeded++
        if (r.url) completedUrls.push(r.url)
      } catch {
        failed++
      }
      updateJob({ done: succeeded + failed, succeeded, failed, completedUrls: [...completedUrls] })
    }

    for (let i = 0; i < ids.length; i += BATCH_CONCURRENCY) {
      const batch = ids.slice(i, i + BATCH_CONCURRENCY)
      await Promise.all(batch.map(processOne))
    }

    finishJob()
  }

  const handleBatchStage = (style: string) => {
    if (selectedIds.size === 0) return
    runBatchStage(Array.from(selectedIds), style)
  }

  const handleClearSelectedStaged = async () => {
    if (selectedIds.size === 0) return
    try {
      await clearAllStagedVersions(Array.from(selectedIds))
      toast.success(`Versões decoradas eliminadas de ${selectedIds.size} imagens`)
      exitSelectMode()
      if (displayMode === 'staged') setDisplayMode('original')
    } catch {
      toast.error('Erro ao eliminar versões decoradas')
    }
  }

  const handleClearAllStaged = async () => {
    if (!showClearAiConfirm) return
    setIsClearingAi(true)
    try {
      await clearAllStagedVersions()
      toast.success('Versões decoradas eliminadas')
      if (displayMode === 'staged') setDisplayMode('original')
    } catch {
      toast.error('Erro ao eliminar versões decoradas')
    } finally {
      setIsClearingAi(false)
      setShowClearAiConfirm(false)
    }
  }

  // Helper to refresh dialog media after AI action
  const refreshDialogMedia = (mediaId: string, updates: Partial<PropertyMedia>) => {
    setAiDialogMedia((prev) => prev && prev.id === mediaId ? { ...prev, ...updates } : prev)
  }

  const handleStage = async (item: PropertyMedia, style: string) => {
    setAiProcessing('stage')
    try {
      const result = customPrompt.trim()
        ? await stageImageWithPrompt(item.id, style, customPrompt)
        : await stageImage(item.id, style)
      refreshDialogMedia(item.id, { ai_staged_url: result.url, ai_staged_style: style })
      setCompareView({ original: item.url, modified: result.url, label: `Decoração ${style}` })
      setCustomPrompt('')
      toast.success('Decoração virtual aplicada')
    } catch {
      toast.error('Erro ao aplicar decoração virtual')
    } finally {
      setAiProcessing(null)
    }
  }

  const handleRefine = async (item: PropertyMedia) => {
    if (!refineInput.trim()) return
    setAiProcessing('refine')
    try {
      const result = await refineImage(item.id, refineInput)
      refreshDialogMedia(item.id, { ai_staged_url: result.url })
      setCompareView({ original: item.url, modified: result.url, label: 'Refinada' })
      setRefineInput('')
      toast.success('Imagem refinada com sucesso')
    } catch {
      toast.error('Erro ao refinar imagem')
    } finally {
      setAiProcessing(null)
    }
  }

  const openAiDialog = (item: PropertyMedia) => {
    if (selectMode) return
    setAiDialogMedia(item)
    setCustomPrompt('')
    setRefineInput('')
    if (item.ai_staged_url) {
      setCompareView({ original: item.url, modified: item.ai_staged_url, label: `Decoração ${item.ai_staged_style ?? ''}` })
    } else {
      setCompareView(null)
    }
  }

  const handleUploadComplete = () => {
    refetch()
    onMediaChange()
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold">Galeria de Imagens</h3>
          {currentMedia.length === 0 && !selectMode && (
            <PropertyMediaUpload
              propertyId={propertyId}
              onUploadComplete={handleUploadComplete}
              variant="icon"
            />
          )}
          {currentMedia.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">
                {displayMode !== 'original'
                  ? `${currentMedia.length} de ${allMedia.length}`
                  : `${allMedia.length}`
                } {allMedia.length === 1 ? 'imagem' : 'imagens'}
              </span>

              {/* Display mode toggle */}
              <ToggleGroup
                type="single"
                variant="outline"
                value={displayMode}
                onValueChange={(v) => v && setDisplayMode(v as DisplayMode)}
                size="sm"
              >
                <ToggleGroupItem value="original" aria-label="Originais" className="text-xs h-7 px-2">
                  Originais
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="staged"
                  aria-label="Decoradas"
                  className="text-xs h-7 px-2"
                  disabled={stagedCount() === 0}
                >
                  Decoradas {stagedCount() > 0 && `(${stagedCount()})`}
                </ToggleGroupItem>
              </ToggleGroup>

              {/* Classify images dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs rounded-full gap-1.5"
                    disabled={isClassifying}
                  >
                    {isClassifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                    Classificar imagens
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => handleClassifyAll(false)}>
                    <Brain className="h-3.5 w-3.5 mr-2" />
                    Classificar novas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleClassifyAll(true)}>
                    <Brain className="h-3.5 w-3.5 mr-2" />
                    Reclassificar todas
                  </DropdownMenuItem>
                  {stagedCount() > 0 && (
                    <>
                      <div className="h-px bg-border my-1" />
                      <DropdownMenuItem
                        onClick={() => setShowClearAiConfirm(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Eliminar decoradas ({stagedCount()})
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        {currentMedia.length > 0 && (
          <div className="flex items-center gap-2">
            {/* Select mode toggle */}
            {selectMode ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs rounded-full"
                  onClick={selectedIds.size === currentMedia.length ? deselectAll : selectAll}
                >
                  {selectedIds.size === currentMedia.length ? 'Desmarcar tudo' : 'Seleccionar tudo'}
                </Button>

                {/* Batch decorar */}
                {!batchProcessing && displayMode === 'original' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs rounded-full gap-1"
                        disabled={selectedIds.size === 0}
                      >
                        <Sofa className="h-3 w-3" />
                        Decorar ({selectedIds.size})
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {['moderno', 'classico', 'minimalista', 'escandinavo', 'industrial'].map((style) => (
                        <DropdownMenuItem key={style} onClick={() => handleBatchStage(style)}>
                          <span className="capitalize">{style}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {batchProcessing && (
                  <BorderBeam active colorVariant="colorful" size="sm" strength={1} brightness={1.8}>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground rounded-full border px-3 py-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {batchProgress.done}/{batchProgress.total} decoradas
                    </span>
                  </BorderBeam>
                )}

                {displayMode === 'staged' ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs rounded-full gap-1"
                    disabled={selectedIds.size === 0}
                    onClick={handleClearSelectedStaged}
                  >
                    <Trash2 className="h-3 w-3" />
                    Eliminar decoradas ({selectedIds.size})
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs rounded-full gap-1"
                        disabled={selectedIds.size === 0}
                      >
                        <Trash2 className="h-3 w-3" />
                        Eliminar ({selectedIds.size})
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowBulkDelete(true)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Eliminar imagens originais
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleClearSelectedStaged}>
                        <Sofa className="h-3.5 w-3.5 mr-2" />
                        Eliminar versões decoradas
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={exitSelectMode}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-full gap-1.5"
                onClick={() => setSelectMode(true)}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Seleccionar
              </Button>
            )}

            {!selectMode && (
              <>
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

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => { setPresentationIndex(0); setPresentationMode(true) }}
                  title="Modo apresentação"
                >
                  <Presentation className="h-4 w-4" />
                </Button>

                <PropertyMediaUpload
                  propertyId={propertyId}
                  onUploadComplete={handleUploadComplete}
                  variant="icon"
                />
              </>
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
              <div className={`grid gap-3 ${GRID_COLUMNS}`}>
                {currentMedia.map((item) => (
                  <SortableGridItem
                    key={item.id}
                    item={item}
                    displayUrl={getDisplayUrl(item)}
                    onSetCover={handleSetCover}
                    onDelete={setDeleteId}
                    onClassify={handleClassifySingle}
                    onSetLabel={handleSetLabel}
                    onImageClick={openAiDialog}
                    isClassifyingThis={classifyingIds.has(item.id) || isClassifying}
                    selectMode={selectMode}
                    isSelected={selectedIds.has(item.id)}
                    onToggleSelect={toggleSelect}
                    hideRoomLabels={hideRoomLabels}
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
                    onClassify={handleClassifySingle}
                    onSetLabel={handleSetLabel}
                    isClassifyingThis={classifyingIds.has(item.id) || isClassifying}
                    selectMode={selectMode}
                    isSelected={selectedIds.has(item.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            )}
          </SortableContext>
        </DndContext>
      )}

      {/* Single delete dialog */}
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

      {/* Bulk delete dialog */}
      <AlertDialog open={showBulkDelete} onOpenChange={() => setShowBulkDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {selectedIds.size} {selectedIds.size === 1 ? 'imagem' : 'imagens'}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar {selectedIds.size === 1 ? 'esta imagem' : `estas ${selectedIds.size} imagens`}? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? 'A eliminar...' : `Eliminar ${selectedIds.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm clear staged versions dialog */}
      <AlertDialog open={showClearAiConfirm} onOpenChange={setShowClearAiConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar versões decoradas</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar as {stagedCount()} versões decoradas? As imagens originais não serão afectadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingAi}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllStaged}
              disabled={isClearingAi}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearingAi ? 'A eliminar…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Image Dialog */}
      <Dialog open={!!aiDialogMedia} onOpenChange={() => { setAiDialogMedia(null); setCompareView(null) }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Ferramentas IA
              {aiDialogMedia?.ai_room_label && (
                <span className="text-sm font-normal text-muted-foreground capitalize">
                  — {aiDialogMedia.ai_room_label}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Melhore a resolução, iluminação ou adicione decoração virtual a esta imagem.
            </DialogDescription>
          </DialogHeader>

          {aiDialogMedia && (
            <div className="space-y-4">
              {/* Compare slider or original image */}
              <BorderBeam active={!!aiProcessing} colorVariant="colorful" size="md" strength={1} brightness={1.8}>
              {compareView ? (
                <ImageCompareSlider
                  originalUrl={compareView.original}
                  modifiedUrl={compareView.modified}
                  originalLabel="Original"
                  modifiedLabel={compareView.label}
                />
              ) : (
                <div className="relative w-full aspect-[16/10] rounded-lg overflow-hidden bg-muted">
                  <Image
                    src={aiDialogMedia.url}
                    alt="Imagem original"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 800px"
                  />
                </div>
              )}
              </BorderBeam>

              {/* View toggle + existing AI versions */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={!compareView ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => setCompareView(null)}
                >
                  Original
                </Button>
                {aiDialogMedia.ai_staged_url && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setCompareView({
                        original: aiDialogMedia.url,
                        modified: aiDialogMedia.ai_staged_url!,
                        label: `Decoração ${aiDialogMedia.ai_staged_style ?? ''}`,
                      })}
                    >
                      <Sofa className="h-3 w-3 mr-1.5" />
                      Comparar decorada
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleClearStagedSingle(aiDialogMedia.id)}
                      disabled={!!aiProcessing}
                    >
                      <Trash2 className="h-3 w-3 mr-1.5" />
                      Eliminar decoração
                    </Button>
                  </>
                )}
              </div>

              {/* Custom prompt for staging */}
              <BorderBeam active={!!customPrompt.trim()} colorVariant="ocean" size="sm" strength={0.8} brightness={1.6}>
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Instruções extra para decoração (opcional): ex. sofá azul, tapete grande…"
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                  disabled={!!aiProcessing}
                />
              </BorderBeam>

              {/* Virtual staging */}
              <BorderBeam active={aiProcessing === 'stage'} colorVariant="colorful" size="sm" strength={1} brightness={1.8}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-auto w-full py-3 flex flex-col items-center gap-1.5 rounded-2xl"
                      disabled={!!aiProcessing}
                    >
                      {aiProcessing === 'stage' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Sofa className="h-5 w-5" />
                      )}
                      <span className="text-xs font-medium">
                        {aiProcessing === 'stage' ? 'A decorar…' : aiDialogMedia.ai_staged_url ? 'Regenerar Decoração' : 'Decoração Virtual'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Escolher estilo</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center">
                    {['moderno', 'classico', 'minimalista', 'escandinavo', 'industrial'].map((style) => (
                      <DropdownMenuItem
                        key={style}
                        onClick={() => handleStage(aiDialogMedia, style)}
                      >
                        <span className="capitalize">{style}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </BorderBeam>

              {/* Refine existing AI image */}
              {aiDialogMedia.ai_staged_url && !aiProcessing && (
                <div>
                  <p className="text-xs font-medium mb-1.5 text-muted-foreground">Refinar imagem IA</p>
                  <BorderBeam active={!!refineInput.trim()} colorVariant="ocean" size="sm" strength={0.8} brightness={1.6}>
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleRefine(aiDialogMedia) }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={refineInput}
                        onChange={(e) => setRefineInput(e.target.value)}
                        placeholder="Ex: remove a planta, muda o sofá para cinzento, adiciona um espelho…"
                        className="flex-1 rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="h-8 text-xs px-3"
                        disabled={!refineInput.trim()}
                      >
                        Refinar
                      </Button>
                    </form>
                  </BorderBeam>
                </div>
              )}

              {aiProcessing && (
                <p className="text-xs text-center text-muted-foreground">
                  {aiProcessing === 'refine' ? 'A refinar imagem…' : 'O processamento pode demorar 10-30 segundos.'} Não feche esta janela.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Presentation / slideshow mode */}
      <Dialog open={presentationMode} onOpenChange={setPresentationMode}>
        <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 overflow-hidden bg-black/95 border-none rounded-none [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Apresentação</DialogTitle>
            <DialogDescription>Modo de apresentação de imagens</DialogDescription>
          </DialogHeader>
          {currentMedia.length > 0 && (() => {
            const safeIndex = Math.min(presentationIndex, currentMedia.length - 1)
            const currentItem = currentMedia[safeIndex]
            if (!currentItem) return null
            const aiUrl = getDisplayUrl(currentItem)
            const isAiView = aiUrl !== currentItem.url

            return (
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Compare slider for AI versions, normal image for originals */}
                {isAiView ? (
                  <ImageCompareSlider
                    originalUrl={currentItem.url}
                    modifiedUrl={aiUrl}
                    originalLabel="Original"
                    modifiedLabel="Decorada"
                    className="w-full h-full !aspect-auto !rounded-none"
                  />
                ) : (
                  <Image
                    src={currentItem.url}
                    alt={`Imagem ${safeIndex + 1}`}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    priority
                  />
                )}

                {/* Top bar — glassmorphism */}
                <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
                  <div className="flex items-center justify-between px-6 py-4">
                    {/* Left: room label + AI badge */}
                    <div className="flex items-center gap-2 pointer-events-auto">
                      {currentItem.ai_room_label && (
                        <span className={cn(
                          'rounded-full backdrop-blur-xl border px-3.5 py-1.5 text-sm font-medium text-white capitalize shadow-lg',
                          currentItem.ai_room_label === 'planta'
                            ? 'bg-blue-500/30 border-blue-400/40'
                            : 'bg-white/10 border-white/20'
                        )}>
                          {currentItem.ai_room_label}
                        </span>
                      )}
                      {isAiView && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/20 backdrop-blur-xl border border-violet-400/30 px-3 py-1.5 text-sm font-medium text-violet-200 shadow-lg">
                          <Sparkles className="h-3.5 w-3.5" />
                          IA
                        </span>
                      )}
                    </div>

                    {/* Right: counter + close */}
                    <div className="flex items-center gap-3 pointer-events-auto">
                      <span className="rounded-full bg-white/10 backdrop-blur-xl border border-white/20 px-3.5 py-1.5 text-sm font-medium text-white tabular-nums shadow-lg">
                        {safeIndex + 1} / {currentMedia.length}
                      </span>
                      <button
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all shadow-lg"
                        onClick={() => setPresentationMode(false)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Navigation arrows — glassmorphism pill buttons */}
                {safeIndex > 0 && (
                  <button
                    className="absolute left-6 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all shadow-lg"
                    onClick={(e) => { e.stopPropagation(); setPresentationIndex((i) => Math.max(0, i - 1)) }}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                )}
                {safeIndex < currentMedia.length - 1 && (
                  <button
                    className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all shadow-lg"
                    onClick={(e) => { e.stopPropagation(); setPresentationIndex((i) => Math.min(currentMedia.length - 1, i + 1)) }}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                )}

                {/* Bottom thumbnail strip — glassmorphism */}
                <div className="absolute bottom-0 left-0 right-0 z-20">
                  <div className="flex items-center justify-center gap-1.5 px-6 py-4 bg-gradient-to-t from-black/60 to-transparent">
                    {currentMedia.map((m, i) => (
                      <button
                        key={m.id}
                        className={cn(
                          'relative h-12 w-16 rounded-lg overflow-hidden border-2 transition-all shrink-0',
                          i === safeIndex
                            ? 'border-white scale-110 shadow-lg shadow-white/20'
                            : 'border-transparent opacity-50 hover:opacity-80 hover:border-white/30'
                        )}
                        onClick={(e) => { e.stopPropagation(); setPresentationIndex(i) }}
                      >
                        <Image
                          src={getDisplayUrl(m)}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Batch notification and preview are rendered globally in dashboard layout via AiBatchNotification */}
    </div>
  )
}
