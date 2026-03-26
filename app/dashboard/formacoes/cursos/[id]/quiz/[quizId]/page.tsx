'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { QuizPlayer } from '@/components/training/quiz-player'
import { QuizResults } from '@/components/training/quiz-results'
import { useTrainingQuiz } from '@/hooks/use-training-quiz'
import { toast } from 'sonner'
import type { TrainingQuiz } from '@/types/training'

export default function QuizPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <QuizContent />
    </Suspense>
  )
}

function QuizContent() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  const quizId = params.quizId as string

  const [quiz, setQuiz] = useState<TrainingQuiz | null>(null)
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(true)
  const [mode, setMode] = useState<'start' | 'playing' | 'results'>('start')
  const [result, setResult] = useState<any>(null)

  const { questions, attempts, isLoading, isSubmitting, loadQuestions, loadAttempts, submitAttempt } = useTrainingQuiz()

  const fetchQuiz = useCallback(async () => {
    setIsLoadingQuiz(true)
    try {
      const res = await fetch(`/api/training/quizzes/${quizId}`)
      if (!res.ok) throw new Error('Erro')
      setQuiz(await res.json())
    } catch {
      toast.error('Erro ao carregar quiz')
    } finally {
      setIsLoadingQuiz(false)
    }
  }, [quizId])

  useEffect(() => {
    fetchQuiz()
    loadQuestions(quizId)
    loadAttempts(quizId)
  }, [fetchQuiz, loadQuestions, loadAttempts, quizId])

  const handleSubmit = async (
    answers: Array<{ question_id: string; selected_options: string[] }>,
    timeSpent: number
  ) => {
    const res = await submitAttempt(quizId, answers, timeSpent)
    if (res) {
      setResult(res)
      setMode('results')
      if (res.passed) {
        toast.success('Parabéns! Quiz aprovado!')
      } else {
        toast.error('Não atingiu a nota mínima. Tente novamente.')
      }
    }
  }

  const handleRetry = () => {
    setResult(null)
    setMode('playing')
    loadQuestions(quizId)
  }

  if (isLoadingQuiz || isLoading) return <Skeleton className="h-96 w-full" />
  if (!quiz) return (
    <div className="flex flex-col items-center py-16">
      <h3 className="font-semibold">Quiz não encontrado</h3>
      <Link href={`/dashboard/formacoes/cursos/${courseId}`} className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"><ArrowLeft className="h-3.5 w-3.5" />Voltar ao Curso</Link>
    </div>
  )

  const canRetry = quiz.max_attempts === 0 || attempts.length < quiz.max_attempts

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href={`/dashboard/formacoes/cursos/${courseId}`} className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
        <ArrowLeft className="h-3.5 w-3.5" />Voltar ao Curso
      </Link>

      {mode === 'start' && (
        <div className="rounded-lg border p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold">{quiz.title}</h1>
          {quiz.description && <p className="text-muted-foreground">{quiz.description}</p>}
          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <span>{questions.length} perguntas</span>
            <span>Nota mínima: {quiz.passing_score}%</span>
            {quiz.time_limit_minutes && <span>Tempo: {quiz.time_limit_minutes} minutos</span>}
            {quiz.max_attempts > 0 && <span>Tentativas: {attempts.length}/{quiz.max_attempts}</span>}
          </div>
          {attempts.length > 0 && (
            <div className="text-sm">
              <p>Melhor resultado: <strong>{Math.max(...attempts.map(a => a.score))}%</strong></p>
            </div>
          )}
          <Button size="lg" onClick={() => setMode('playing')} disabled={!canRetry}>
            {attempts.length > 0 ? 'Tentar Novamente' : 'Iniciar Quiz'}
          </Button>
          {!canRetry && (
            <p className="text-sm text-red-500">Número máximo de tentativas atingido.</p>
          )}
        </div>
      )}

      {mode === 'playing' && (
        <QuizPlayer
          quiz={quiz}
          questions={questions}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {mode === 'results' && result && (
        <QuizResults
          score={result.score}
          passed={result.passed}
          passingScore={quiz.passing_score}
          answers={result.answers || []}
          attemptNumber={result.attempt_number}
          maxAttempts={quiz.max_attempts}
          onRetry={canRetry ? handleRetry : undefined}
          onBack={() => router.push(`/dashboard/formacoes/cursos/${courseId}`)}
        />
      )}
    </div>
  )
}
