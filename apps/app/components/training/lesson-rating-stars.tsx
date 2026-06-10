'use client'

import { useCallback, useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface LessonRatingStarsProps {
  lessonId: string
  className?: string
}

/**
 * Standalone star-rating control for a lesson (self-fetches + saves).
 * Used in the mobile lesson view's "Conteúdo" tab, where the complete/navigation
 * actions live in the fixed bottom bar instead of inside a combined card.
 */
export function LessonRatingStars({ lessonId, className }: LessonRatingStarsProps) {
  const [userRating, setUserRating] = useState<number | null>(null)
  const [averageRating, setAverageRating] = useState(0)
  const [totalRatings, setTotalRatings] = useState(0)
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

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

  useEffect(() => {
    fetchRating()
  }, [fetchRating])

  const handleRate = async (rating: number) => {
    if (isSaving) return
    setIsSaving(true)
    const prev = userRating
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
        setUserRating(prev)
        toast.error('Erro ao guardar avaliação')
      }
    } catch {
      setUserRating(prev)
      toast.error('Erro ao guardar avaliação')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return null

  const displayRating = hoveredStar ?? userRating ?? 0

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="text-sm font-medium text-muted-foreground">Avalie esta lição</span>
      <div
        role="radiogroup"
        aria-label="Avaliação da lição de 1 a 5 estrelas"
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHoveredStar(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            role="radio"
            aria-checked={userRating === star ? 'true' : 'false'}
            aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
            className="p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHoveredStar(star)}
            disabled={isSaving}
          >
            <Star
              className={cn(
                'h-6 w-6 transition-colors',
                star <= displayRating
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-transparent text-muted-foreground/40'
              )}
            />
          </button>
        ))}
      </div>
      {totalRatings > 0 && (
        <span className="text-xs text-muted-foreground">
          {averageRating} ({totalRatings})
        </span>
      )}
    </div>
  )
}
