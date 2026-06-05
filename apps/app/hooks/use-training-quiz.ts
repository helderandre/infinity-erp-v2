'use client'

import { useState, useCallback } from 'react'
import type { TrainingQuizQuestion, TrainingQuizAttempt } from '@/types/training'

interface UseTrainingQuizReturn {
  questions: TrainingQuizQuestion[]
  attempts: TrainingQuizAttempt[]
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  loadQuestions: (quizId: string) => Promise<void>
  loadAttempts: (quizId: string) => Promise<void>
  submitAttempt: (quizId: string, answers: Array<{
    question_id: string
    selected_options: string[]
  }>, timeSpent?: number) => Promise<{
    score: number
    passed: boolean
    answers: any[]
    attempt_number: number
  } | null>
}

export function useTrainingQuiz(): UseTrainingQuizReturn {
  const [questions, setQuestions] = useState<TrainingQuizQuestion[]>([])
  const [attempts, setAttempts] = useState<TrainingQuizAttempt[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadQuestions = useCallback(async (quizId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/training/quizzes/${quizId}/questions`)
      if (!res.ok) throw new Error('Erro ao carregar perguntas')
      const data = await res.json()
      setQuestions(data.data || [])
    } catch (err) {
      console.error('Erro ao carregar perguntas:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadAttempts = useCallback(async (quizId: string) => {
    try {
      const res = await fetch(`/api/training/quizzes/${quizId}/attempts`)
      if (!res.ok) throw new Error('Erro ao carregar tentativas')
      const data = await res.json()
      setAttempts(data.data || [])
    } catch (err) {
      console.error('Erro ao carregar tentativas:', err)
    }
  }, [])

  const submitAttempt = useCallback(async (
    quizId: string,
    answers: Array<{ question_id: string; selected_options: string[] }>,
    timeSpent?: number,
  ) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/training/quizzes/${quizId}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, time_spent_seconds: timeSpent }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao submeter quiz')
      }
      const result = await res.json()
      await loadAttempts(quizId)
      return result
    } catch (err) {
      console.error('Erro ao submeter quiz:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      return null
    } finally {
      setIsSubmitting(false)
    }
  }, [loadAttempts])

  return { questions, attempts, isLoading, isSubmitting, error, loadQuestions, loadAttempts, submitAttempt }
}
