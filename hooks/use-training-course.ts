'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TrainingCourse } from '@/types/training'

interface UseTrainingCourseReturn {
  course: TrainingCourse | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useTrainingCourse(courseId: string | null): UseTrainingCourseReturn {
  const [course, setCourse] = useState<TrainingCourse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCourse = useCallback(async () => {
    if (!courseId) {
      setCourse(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/training/courses/${courseId}`)
      if (!res.ok) throw new Error('Erro ao carregar formação')

      const data = await res.json()
      setCourse(data)
    } catch (err) {
      console.error('Erro ao carregar formação:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setCourse(null)
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    fetchCourse()
  }, [fetchCourse])

  return { course, isLoading, error, refetch: fetchCourse }
}
