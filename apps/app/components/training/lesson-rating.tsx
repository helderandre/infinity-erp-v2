'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Star, ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/use-permissions'
import { WATCH_GATE_PERCENT } from '@/lib/training/watch-gate'
import type { LessonContentType } from '@/types/training'

interface LessonRatingProps {
  lessonId: string
  courseId: string
  prevLesson?: { id: string; title: string } | null
  nextLesson?: { id: string; title: string } | null
  courseLink?: string
  isCompleted?: boolean
  onMarkCompleted?: () => void
  isSaving?: boolean
  /** Content type of this lesson — gate only applies to 'video'. */
  contentType?: LessonContentType
  /** Current watch percentage from the player (0-100). */
  watchPercent?: number
  /** Mobile-only slot rendered between the rating/complete row and the navigation row. */
  commentSlot?: React.ReactNode
}

export function LessonRating({
  lessonId,
  courseId,
  prevLesson,
  nextLesson,
  courseLink,
  isCompleted,
  onMarkCompleted,
  isSaving,
  contentType,
  watchPercent = 0,
  commentSlot,
}: LessonRatingProps) {
  const { hasPermission } = usePermissions()
  const isTrainingAdmin = hasPermission('training')

  const isVideoLesson = contentType === 'video'
  const gateApplies = isVideoLesson && !isTrainingAdmin
  const belowGate = gateApplies && watchPercent < WATCH_GATE_PERCENT
  const completeButtonDisabled = Boolean(isSaving) || belowGate
  const [userRating, setUserRating] = useState<number | null>(null)
  const [averageRating, setAverageRating] = useState(0)
  const [totalRatings, setTotalRatings] = useState(0)
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingRating, setIsSavingRating] = useState(false)

  const fetchRating = useCallback(async () => {
    try {
      const res = await fetch(`/api/training/lessons/${lessonId}/rate`)
      if (!res.ok) return
      const data = await res.json()
      setUserRating(data.user_rating)
      setAverageRating(data.average_rating)
      setTotalRatings(data.total_ratings)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [lessonId])

  useEffect(() => { fetchRating() }, [fetchRating])

  const handleRate = async (rating: number) => {
    if (isSavingRating) return
    setIsSavingRating(true)
    const prevRating = userRating
    setUserRating(rating)

    try {
      const res = await fetch(`/api/training/lessons/${lessonId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })
      if (res.ok) {
        toast.success('Avaliação guardada!')
        fetchRating()
      } else {
        setUserRating(prevRating)
        toast.error('Erro ao guardar avaliação')
      }
    } catch {
      setUserRating(prevRating)
      toast.error('Erro ao guardar avaliação')
    } finally {
      setIsSavingRating(false)
    }
  }

  const displayRating = hoveredStar ?? userRating ?? 0

  return (
    <Card className="py-0 max-sm:ring-0 max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none max-sm:overflow-visible">
      <CardContent className="flex flex-col gap-3 py-3 max-sm:px-0 max-sm:py-0 sm:flex-row sm:items-center sm:gap-4">
        {/* Linha estrelas (esq.) + Concluir (dir.) — estilo footer de card de imóvel */}
        <div className="flex items-center justify-between gap-3 min-w-0 sm:flex-1 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0 sm:gap-4">
          {!isLoading && (
            <>
              <div
                role="radiogroup"
                aria-label="Avaliação da lição de 1 a 5 estrelas"
                className="flex items-center gap-0.5 shrink-0"
                onMouseLeave={() => setHoveredStar(null)}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    role="radio"
                    aria-checked={userRating === star ? 'true' : 'false'}
                    aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
                    className="p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    onClick={() => handleRate(star)}
                    onMouseEnter={() => setHoveredStar(star)}
                    disabled={isSavingRating}
                  >
                    <Star
                      className={cn(
                        'h-5 w-5 transition-colors',
                        star <= displayRating
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-transparent text-muted-foreground/40'
                      )}
                    />
                  </button>
                ))}
              </div>
              {totalRatings > 0 && (
                <span className="hidden text-xs text-muted-foreground shrink-0 sm:inline">
                  {averageRating} ({totalRatings})
                </span>
              )}
            </>
          )}

        </div>

        {/* Concluir / Concluída — pill glassmórfico à direita */}
        <div className="flex items-center shrink-0">
          {!isCompleted && onMarkCompleted ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="shrink-0 inline-flex">
                  <Button
                    size="sm"
                    onClick={onMarkCompleted}
                    disabled={completeButtonDisabled}
                    aria-disabled={completeButtonDisabled}
                    className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/15 text-emerald-700 shadow-sm backdrop-blur-md hover:bg-emerald-500/25 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200 max-sm:h-10 max-sm:px-5"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    )}
                    Concluir
                  </Button>
                </span>
              </TooltipTrigger>
              {belowGate && (
                <TooltipContent>
                  Assista a pelo menos {WATCH_GATE_PERCENT}% do vídeo para concluir (actualmente {Math.round(watchPercent)}%)
                </TooltipContent>
              )}
            </Tooltip>
          ) : isCompleted ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-600 font-medium shrink-0 backdrop-blur-sm">
              <CheckCircle2 className="h-4 w-4" />
              Concluída
            </span>
          ) : null}
        </div>
        </div>

        {/* Mobile: separador seguido do botão Comentar */}
        {commentSlot && (
          <>
            <div className="h-px w-full bg-border/60 sm:hidden" />
            <div className="flex justify-center sm:hidden">{commentSlot}</div>
          </>
        )}

        {/* Divider — só desktop */}
        <div className="hidden h-6 w-px bg-border shrink-0 sm:block" />

        {/* Navegação anterior/seguinte — só desktop (mobile usa a barra inferior) */}
        <div className="hidden items-center gap-2 sm:flex sm:shrink-0">
          {prevLesson ? (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-11 flex-1 min-w-0 rounded-full bg-muted/60 shadow-sm backdrop-blur-md hover:bg-muted sm:flex-none"
            >
              <Link href={`/dashboard/formacoes/cursos/${courseId}/licoes/${prevLesson.id}`}>
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <span className="flex min-w-0 flex-col items-start gap-0.5 leading-none">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] opacity-60">Anterior</span>
                  <span className="truncate max-w-[110px] text-[13px]">{prevLesson.title}</span>
                </span>
              </Link>
            </Button>
          ) : null}
          {nextLesson ? (
            <Button
              size="sm"
              asChild
              className="h-11 flex-1 min-w-0 rounded-full bg-neutral-900/85 text-white shadow-sm backdrop-blur-md hover:bg-neutral-900/70 dark:bg-white/90 dark:text-neutral-900 dark:hover:bg-white/75 sm:flex-none"
            >
              <Link href={`/dashboard/formacoes/cursos/${courseId}/licoes/${nextLesson.id}`}>
                <span className="truncate max-w-[140px]">{nextLesson.title}</span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </Link>
            </Button>
          ) : courseLink ? (
            <Button
              size="sm"
              variant="ghost"
              asChild
              className="h-11 flex-1 min-w-0 rounded-full bg-muted/60 shadow-sm backdrop-blur-md hover:bg-muted sm:flex-none"
            >
              <Link href={courseLink}>Voltar ao Curso</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
