'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import {
  Building2, Check, Clock, ExternalLink, FileText, Images,
  ImageIcon, Layers, Video, X,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { format, formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { PropertyMediaGallery } from '@/components/properties/property-media-gallery'
import { PropertyVideosSection } from '@/components/properties/property-videos-section'
import { PropertyPlantasSection } from '@/components/properties/property-plantas-section'
import { DescriptionEditorCanvas } from '@/components/properties/description-editor/description-editor-canvas'

export interface MediaTaskSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Task id (tasks.id com category='media_capture'). */
  taskId: string | null
  /** Callback após concluir a tarefa — usar para refrescar a list. */
  onCompleted?: () => void
}

interface MediaTaskData {
  task: {
    id: string
    title: string
    description: string | null
    due_date: string | null
    is_completed: boolean
    completed_at: string | null
    assigned_to: string | null
    entity_type: string | null
    entity_id: string | null
    category: string | null
  }
  property: {
    id: string
    slug: string | null
    title: string | null
    external_ref: string | null
    consultant_id: string | null
    description: string | null
    description_per_language: Record<string, string> | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dev_property_media: any[] | null
    dev_property_internal: {
      media_completed_at: string | null
      media_completed_by: string | null
    } | null
  } | null
}

type Section = 'fotos' | 'videos' | 'plantas' | 'descricao'

/**
 * Sheet dedicada à tarefa "Media" (category='media_capture').
 *
 * Carrega o task pelo `taskId` e o imóvel associado em conjunto, e
 * apresenta 4 sub-tabs (Fotos / Vídeos / Plantas / Descrição) que escrevem
 * directamente nos campos do imóvel (mesmos endpoints usados na página do
 * imóvel). Cabeçalho mostra o link para o imóvel + estado da tarefa.
 *
 * Footer tem o botão "Marcar como concluída". Ao concluir, o backend
 * carimba `dev_property_internal.media_completed_at` + notifica gestão.
 */
export function MediaTaskSheet({
  open, onOpenChange, taskId, onCompleted,
}: MediaTaskSheetProps) {
  const isMobile = useIsMobile()
  const [data, setData] = useState<MediaTaskData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [section, setSection] = useState<Section>('fotos')
  const [completing, setCompleting] = useState(false)

  // Reset section quando abrir
  useEffect(() => {
    if (open) setSection('fotos')
  }, [open])

  const fetchData = useCallback(async () => {
    if (!taskId) return
    setIsLoading(true)
    try {
      // 1) Task
      const taskRes = await fetch(`/api/tasks/${taskId}`)
      if (!taskRes.ok) throw new Error('Tarefa não encontrada')
      const taskJson = await taskRes.json()
      const task = taskJson.task ?? taskJson
      // 2) Imóvel — entity_id quando entity_type='property'
      let property: MediaTaskData['property'] = null
      if (task?.entity_type === 'property' && task?.entity_id) {
        const propRes = await fetch(`/api/properties/${task.entity_id}`)
        if (propRes.ok) {
          property = await propRes.json()
        }
      }
      setData({ task, property })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar tarefa')
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    if (open && taskId) fetchData()
    if (!open) setData(null)
  }, [open, taskId, fetchData])

  const refetch = useCallback(() => {
    if (open && taskId) fetchData()
  }, [open, taskId, fetchData])

  const handleComplete = useCallback(async () => {
    if (!taskId || !data?.task) return
    setCompleting(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao concluir tarefa')
      }
      toast.success('Tarefa Media concluída — gestão notificada')
      onCompleted?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao concluir tarefa')
    } finally {
      setCompleting(false)
    }
  }, [taskId, data?.task, onOpenChange, onCompleted])

  const property = data?.property
  const task = data?.task

  // Filter media by type for each sub-tab
  const allMedia = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (property?.dev_property_media || []) as any[],
    [property?.dev_property_media]
  )
  const photos = useMemo(
    () => allMedia.filter(
      (m) => m.media_type !== 'planta' && m.media_type !== 'planta_3d' && m.media_type !== 'video'
    ),
    [allMedia]
  )
  const videos = useMemo(
    () => allMedia.filter((m) => m.media_type === 'video'),
    [allMedia]
  )
  const plantas = useMemo(
    () => allMedia.filter((m) => m.media_type === 'planta'),
    [allMedia]
  )
  const renders3d = useMemo(
    () => allMedia.filter((m) => m.media_type === 'planta_3d'),
    [allMedia]
  )

  // Status meta
  const isCompleted = !!task?.is_completed
  const isOverdue = !isCompleted && task?.due_date && new Date(task.due_date) < new Date()
  const dueLabel = task?.due_date
    ? formatDistanceToNow(new Date(task.due_date), { locale: pt, addSuffix: true })
    : null
  const completedLabel = task?.completed_at
    ? format(new Date(task.completed_at), "d 'de' MMM, HH:mm", { locale: pt })
    : null

  const propertyHref = property
    ? `/dashboard/imoveis/${property.slug || property.id}`
    : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[92dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[760px] sm:rounded-l-3xl',
        )}
      >
        <VisuallyHidden>
          <SheetTitle>Tarefa Media</SheetTitle>
          <SheetDescription>Recolha de fotos, vídeos, plantas e descrição.</SheetDescription>
        </VisuallyHidden>
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className="shrink-0 px-4 sm:px-6 pt-8 pb-3 sm:pt-10 gap-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-7 w-7 rounded-xl bg-violet-500/15 ring-1 ring-violet-300/40 dark:ring-violet-700/40 flex items-center justify-center shrink-0">
                  <Images className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">
                  Tarefa Media
                </span>
              </div>
              <h2 className="text-[18px] font-semibold leading-tight tracking-tight">
                {isLoading ? 'A carregar…' : task?.title || 'Media'}
              </h2>
              {/* Property link */}
              {property && propertyHref && (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span>Associada a</span>
                  <Link
                    href={propertyHref}
                    onClick={() => onOpenChange(false)}
                    className="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                  >
                    {property.title || property.external_ref || 'Imóvel'}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
              {/* Status row */}
              <div className="mt-2 flex items-center gap-2 text-[11px] flex-wrap">
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 font-semibold">
                    <Check className="h-3 w-3" />
                    Concluída {completedLabel ? `· ${completedLabel}` : ''}
                  </span>
                ) : isOverdue ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 px-2 py-0.5 font-semibold">
                    <Clock className="h-3 w-3" />
                    Atrasada {dueLabel ? `· ${dueLabel}` : ''}
                  </span>
                ) : dueLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 text-muted-foreground px-2 py-0.5">
                    <Clock className="h-3 w-3" />
                    {dueLabel}
                  </span>
                ) : null}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-full shrink-0"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Sub-tabs pill row */}
        <div className="shrink-0 px-4 sm:px-6 pb-3">
          <div className="flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/30 w-full overflow-x-auto scrollbar-hide">
            {[
              { key: 'fotos' as Section, label: 'Fotos', icon: ImageIcon },
              { key: 'videos' as Section, label: 'Vídeos', icon: Video },
              { key: 'plantas' as Section, label: 'Plantas', icon: Layers },
              { key: 'descricao' as Section, label: 'Descrição', icon: FileText },
            ].map(({ key, label, icon: Icon }) => {
              const active = section === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSection(key)}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap',
                    active
                      ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-3">
          {isLoading || !property ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Spinner className="h-4 w-4" />
              <span className="text-xs">A carregar imóvel…</span>
            </div>
          ) : (
            <>
              {section === 'fotos' && (
                <PropertyMediaGallery
                  propertyId={property.id}
                  media={photos}
                  onMediaChange={refetch}
                />
              )}
              {section === 'videos' && (
                <PropertyVideosSection
                  propertyId={property.id}
                  videos={videos}
                  onMediaChange={refetch}
                />
              )}
              {section === 'plantas' && (
                <PropertyPlantasSection
                  propertyId={property.id}
                  plantas={plantas}
                  renders3d={renders3d}
                  onMediaChange={refetch}
                />
              )}
              {section === 'descricao' && (
                <div className="h-[min(70vh,640px)] flex flex-col">
                  <DescriptionEditorCanvas
                    propertyId={property.id}
                    onAfterFinalize={refetch}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-border/40 flex items-center justify-between gap-3 bg-background/60 backdrop-blur-xl">
          <div className="text-[11px] text-muted-foreground">
            {photos.length} foto{photos.length === 1 ? '' : 's'} · {videos.length} vídeo{videos.length === 1 ? '' : 's'} · {plantas.length} planta{plantas.length === 1 ? '' : 's'}
          </div>
          {!isCompleted ? (
            <Button
              type="button"
              size="sm"
              className="rounded-full h-9 px-4 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleComplete}
              disabled={completing || isLoading || !property}
            >
              {completing ? (
                <>
                  <Spinner className="h-3.5 w-3.5" />
                  A concluir…
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Marcar como concluída
                </>
              )}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
              <Check className="h-3.5 w-3.5" />
              Tarefa concluída
            </span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
