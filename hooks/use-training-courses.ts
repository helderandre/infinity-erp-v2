'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import type { TrainingCourse } from '@/types/training'

interface UseTrainingCoursesParams {
  search?: string
  categoryId?: string
  difficulty?: string
  status?: string
  instructorId?: string
  isMandatory?: boolean
  tag?: string
  page?: number
  perPage?: number
}

interface UseTrainingCoursesReturn {
  courses: TrainingCourse[]
  total: number
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useTrainingCourses({
  search = '',
  categoryId,
  difficulty,
  status = 'published',
  instructorId,
  isMandatory,
  tag,
  page = 1,
  perPage = 12,
}: UseTrainingCoursesParams = {}): UseTrainingCoursesReturn {
  const [courses, setCourses] = useState<TrainingCourse[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const fetchCourses = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (categoryId && categoryId !== 'all') params.set('category_id', categoryId)
      if (difficulty && difficulty !== 'all') params.set('difficulty', difficulty)
      if (status && status !== 'all') params.set('status', status)
      if (instructorId && instructorId !== 'all') params.set('instructor_id', instructorId)
      if (isMandatory !== undefined) params.set('is_mandatory', String(isMandatory))
      if (tag) params.set('tag', tag)
      params.set('page', String(page))
      params.set('limit', String(perPage))

      const res = await fetch(`/api/training/courses?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar formações')

      const data = await res.json()
      setCourses(data.data || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Erro ao carregar formações:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setCourses([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, categoryId, difficulty, status, instructorId, isMandatory, tag, page, perPage])

  useEffect(() => {
    fetchCourses()
  }, [fetchCourses])

  return { courses, total, isLoading, error, refetch: fetchCourses }
}
