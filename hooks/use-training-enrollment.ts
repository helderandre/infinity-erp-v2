'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TrainingEnrollment } from '@/types/training'

interface UseTrainingEnrollmentParams {
  status?: string
}

interface UseTrainingEnrollmentReturn {
  enrollments: TrainingEnrollment[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  enroll: (courseId: string) => Promise<boolean>
}

export function useTrainingEnrollment({
  status = 'all',
}: UseTrainingEnrollmentParams = {}): UseTrainingEnrollmentReturn {
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEnrollments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (status && status !== 'all') params.set('status', status)

      const res = await fetch(`/api/training/my-courses?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar os meus cursos')

      const data = await res.json()
      setEnrollments(data.data || [])
    } catch (err) {
      console.error('Erro ao carregar inscrições:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setEnrollments([])
    } finally {
      setIsLoading(false)
    }
  }, [status])

  useEffect(() => {
    fetchEnrollments()
  }, [fetchEnrollments])

  const enroll = useCallback(async (courseId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/training/courses/${courseId}/enroll`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao inscrever')
      }
      await fetchEnrollments()
      return true
    } catch (err) {
      console.error('Erro ao inscrever:', err)
      return false
    }
  }, [fetchEnrollments])

  return { enrollments, isLoading, error, refetch: fetchEnrollments, enroll }
}
