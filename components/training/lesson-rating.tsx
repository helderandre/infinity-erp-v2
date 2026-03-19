'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Star, ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface LessonRatingProps {
  lessonId: string
  courseId: string
  prevLesson?: { id: string; title: string } | null
  nextLesson?: { id: string; title: string } | null
  courseLink?: string
  isCompleted?: boolean
  onMarkCompleted?: () => void
  isSaving?: boolean
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
}: LessonRatingProps) {
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
    <Card className="py-0">
      <CardContent className="flex items-center gap-4 py-3">
        {/* Rating */}
        {!isLoading && (
          <>
            <span className="text-sm font-medium text-muted-foreground shrink-0">Avalie esta lição</span>
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
              <span className="text-xs text-muted-foreground shrink-0">
                {averageRating} ({totalRatings})
              </span>
            )}
          </>
        )}

        {/* Separator + status/complete */}
        <div className="mx-auto" />

        {!isCompleted && onMarkCompleted ? (
          <Button size="sm" onClick={onMarkCompleted} disabled={isSaving} className="shrink-0">
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
            )}
            Concluir
          </Button>
        ) : isCompleted ? (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            Concluída
          </span>
        ) : null}

        {/* Divider */}
        <div className="h-6 w-px bg-border shrink-0" />

        {/* Navigation */}
        {prevLesson ? (
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href={`/dashboard/formacoes/cursos/${courseId}/licoes/${prevLesson.id}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span className="truncate max-w-[120px]">{prevLesson.title}</span>
            </Link>
          </Button>
        ) : null}
        {nextLesson ? (
          <Button size="sm" asChild className="shrink-0">
            <Link href={`/dashboard/formacoes/cursos/${courseId}/licoes/${nextLesson.id}`}>
              <span className="truncate max-w-[120px]">{nextLesson.title}</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        ) : courseLink ? (
          <Button size="sm" variant="outline" asChild className="shrink-0">
            <Link href={courseLink}>Voltar ao Curso</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
