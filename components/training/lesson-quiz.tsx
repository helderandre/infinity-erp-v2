// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  HelpCircle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Trophy,
  RotateCcw,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { TrainingQuiz, TrainingQuizQuestion } from '@/types/training'

interface LessonQuizProps {
  lessonId: string
  courseId: string
  isMainContent?: boolean
  onQuizPassed?: () => void
}

type QuizMode = 'loading' | 'collapsed' | 'start' | 'playing' | 'results'

interface AttemptResult {
  score: number
  passed: boolean
  passing_score: number
  total_points: number
  earned_points: number
  attempt_number: number
  max_attempts: number | null
  answers?: Array<{
    question_id: string
    question_text: string
    selected_options: string[]
    correct_options: string[]
    is_correct: boolean
    points: number
    earned_points: number
    explanation: string | null
  }>
}

export function LessonQuiz({ lessonId, courseId, isMainContent, onQuizPassed }: LessonQuizProps) {
  const [quiz, setQuiz] = useState<TrainingQuiz | null>(null)
  const [questions, setQuestions] = useState<TrainingQuizQuestion[]>([])
  const [mode, setMode] = useState<QuizMode>('loading')
  const [isExpanded, setIsExpanded] = useState(isMainContent || false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string[]>>({})
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [currentStep, setCurrentStep] = useState(0)

  // Fetch quiz and check for previous passed attempt
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const quizRes = await fetch(`/api/training/quizzes?lesson_id=${lessonId}`)
        const quizJson = await quizRes.json()
        if (cancelled) return

        if (!quizJson.data?.length) return

        const quizData = quizJson.data[0]
        setQuiz(quizData)

        // Check for previous attempts
        const attemptsRes = await fetch(`/api/training/quizzes/${quizData.id}/attempts`)
        const attemptsJson = await attemptsRes.json()
        if (cancelled) return

        const attempts = attemptsJson.data || []
        // Find the best passed attempt, or the latest attempt
        const passedAttempt = attempts.find((a: any) => a.passed)

        if (passedAttempt) {
          // Quiz already passed — show results permanently
          setResult({
            score: passedAttempt.score,
            passed: true,
            passing_score: quizData.passing_score,
            total_points: passedAttempt.answers?.reduce((s: number, a: any) => s + (a.points || 0), 0) || 0,
            earned_points: passedAttempt.answers?.reduce((s: number, a: any) => s + (a.earned_points || 0), 0) || 0,
            attempt_number: passedAttempt.attempt_number,
            max_attempts: quizData.max_attempts,
            answers: passedAttempt.answers,
          })
          setMode('results')
        } else {
          // No passed attempt — check if can still retry
          const latestAttempt = attempts[0]
          if (latestAttempt) {
            const canRetry = !quizData.max_attempts || quizData.max_attempts === 0 || latestAttempt.attempt_number < quizData.max_attempts
            setResult({
              score: latestAttempt.score,
              passed: false,
              passing_score: quizData.passing_score,
              total_points: latestAttempt.answers?.reduce((s: number, a: any) => s + (a.points || 0), 0) || 0,
              earned_points: latestAttempt.answers?.reduce((s: number, a: any) => s + (a.earned_points || 0), 0) || 0,
              attempt_number: latestAttempt.attempt_number,
              max_attempts: quizData.max_attempts,
              answers: latestAttempt.answers,
            })
            setMode('results')
          } else {
            setMode(isMainContent ? 'start' : 'collapsed')
          }
        }
      } catch {
        setMode(isMainContent ? 'start' : 'collapsed')
      }
    }
    init()
    return () => { cancelled = true }
  }, [lessonId, isMainContent])

  const loadQuestions = async () => {
    if (!quiz) return
    try {
      const res = await fetch(`/api/training/quizzes/${quiz.id}/questions`)
      const json = await res.json()
      setQuestions(json.data || [])
    } catch {
      toast.error('Erro ao carregar perguntas.')
    }
  }

  const handleStart = async () => {
    await loadQuestions()
    setCurrentAnswers({})
    setResult(null)
    setCurrentStep(0)
    setMode('playing')
  }

  const handleSelectOption = (questionId: string, optionId: string, questionType: string) => {
    setCurrentAnswers(prev => {
      if (questionType === 'single_choice' || questionType === 'true_false') {
        return { ...prev, [questionId]: [optionId] }
      }
      const current = prev[questionId] || []
      if (current.includes(optionId)) {
        return { ...prev, [questionId]: current.filter(id => id !== optionId) }
      }
      return { ...prev, [questionId]: [...current, optionId] }
    })
  }

  const handleSubmit = async () => {
    if (!quiz) return

    const answers = Object.entries(currentAnswers).map(([question_id, selected_options]) => ({
      question_id,
      selected_options,
    }))

    if (answers.length < questions.length) {
      toast.error('Responda a todas as perguntas antes de submeter.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/training/quizzes/${quiz.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Erro ao submeter tentativa.')
        return
      }

      const json = await res.json()
      setResult(json.data)
      setMode('results')

      if (json.data.passed) {
        onQuizPassed?.()
      }
    } catch {
      toast.error('Erro ao submeter tentativa.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (mode === 'loading') return null
  if (!quiz) return null

  const currentQuestion = questions[currentStep]
  const selectedOptions = currentQuestion ? (currentAnswers[currentQuestion.id] || []) : []
  const hasAnswered = selectedOptions.length > 0
  const isLastStep = currentStep === questions.length - 1
  const answeredCount = Object.keys(currentAnswers).length

  // ─── Start / Collapsed ───
  if (mode === 'collapsed' || mode === 'start') {
    return (
      <div className="overflow-hidden rounded-2xl border-2 border-primary/20 bg-primary/5">
        <div
          className={cn('px-5 py-4', !isMainContent && 'cursor-pointer')}
          onClick={() => !isMainContent && setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
                <HelpCircle className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  {isMainContent ? quiz.title : `Quiz: ${quiz.title}`}
                </h3>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  {quiz.question_count && (
                    <span>{quiz.question_count} {quiz.question_count === 1 ? 'pergunta' : 'perguntas'}</span>
                  )}
                  <span>Nota mínima: {quiz.passing_score}%</span>
                </div>
              </div>
            </div>
            {!isMainContent && (
              isExpanded
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {(isMainContent || isExpanded) && (
          <div className="px-5 pb-4 space-y-3">
            {quiz.description && (
              <p className="text-sm text-muted-foreground">{quiz.description}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {quiz.max_attempts > 0 && (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  Máx. {quiz.max_attempts} tentativas
                </Badge>
              )}
              {quiz.time_limit_minutes && (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  Limite: {quiz.time_limit_minutes} min
                </Badge>
              )}
            </div>
            <Button onClick={handleStart} className="rounded-full">
              Iniciar Quiz
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ─── Playing (step by step) ───
  if (mode === 'playing' && currentQuestion) {
    return (
      <div className="overflow-hidden rounded-2xl border shadow-sm">
        {/* Dark Header */}
        <div className="bg-neutral-900 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
              <HelpCircle className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{quiz.title}</h3>
              <p className="text-xs text-neutral-400">
                Pergunta {currentStep + 1} de {questions.length}
              </p>
            </div>
            <Badge className="rounded-full bg-white/15 text-white border-0 text-[10px]">
              {answeredCount}/{questions.length}
            </Badge>
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {questions.map((_, i) => {
              const isAnswered = !!currentAnswers[questions[i].id]
              const isCurrent = i === currentStep
              return (
                <button
                  key={i}
                  type="button"
                  title={`Pergunta ${i + 1}`}
                  onClick={() => setCurrentStep(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    isCurrent
                      ? 'w-6 bg-white'
                      : isAnswered
                        ? 'w-1.5 bg-white/60'
                        : 'w-1.5 bg-white/25'
                  )}
                />
              )
            })}
          </div>
        </div>

        {/* Question Body */}
        <div className="px-5 py-5">
          <div className="space-y-4">
            <p className="text-sm font-medium leading-relaxed">{currentQuestion.question_text}</p>

            {(currentQuestion.question_type === 'single_choice' || currentQuestion.question_type === 'true_false') ? (
              <RadioGroup
                value={selectedOptions[0] || ''}
                onValueChange={(val) => handleSelectOption(currentQuestion.id, val, currentQuestion.question_type)}
                className="space-y-2"
              >
                {currentQuestion.options.map((option) => {
                  const isSelected = selectedOptions[0] === option.id
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all duration-200',
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border hover:border-primary/30 hover:bg-muted/30'
                      )}
                    >
                      <RadioGroupItem value={option.id} id={`${currentQuestion.id}-${option.id}`} />
                      <span className="text-sm">{option.text}</span>
                    </label>
                  )
                })}
              </RadioGroup>
            ) : (
              <div className="space-y-2">
                {currentQuestion.options.map((option) => {
                  const isChecked = selectedOptions.includes(option.id)
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all duration-200',
                        isChecked
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border hover:border-primary/30 hover:bg-muted/30'
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleSelectOption(currentQuestion.id, option.id, currentQuestion.question_type)}
                        id={`${currentQuestion.id}-${option.id}`}
                      />
                      <span className="text-sm">{option.text}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep(s => s - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Anterior
          </Button>

          {isLastStep ? (
            <Button
              size="sm"
              className="rounded-full"
              onClick={handleSubmit}
              disabled={isSubmitting || answeredCount < questions.length}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  A submeter...
                </>
              ) : (
                'Submeter Respostas'
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => setCurrentStep(s => s + 1)}
              disabled={!hasAnswered}
            >
              Próxima
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ─── Results ───
  if (mode === 'results' && result) {
    const reviewAnswers = result.answers || []
    const canRetry = !result.passed && (
      result.max_attempts === null ||
      result.max_attempts === 0 ||
      result.attempt_number < (result.max_attempts ?? 0)
    )
    const attemptsExhausted = !result.passed &&
      result.max_attempts &&
      result.max_attempts > 0 &&
      result.attempt_number >= result.max_attempts

    return (
      <div className="overflow-hidden rounded-2xl border shadow-sm">
        {/* Header — success or fail */}
        <div className={cn(
          'px-5 py-4',
          result.passed ? 'bg-emerald-600' : 'bg-neutral-900'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full',
              result.passed ? 'bg-white/20' : 'bg-white/15'
            )}>
              {result.passed ? (
                <Trophy className="h-4.5 w-4.5 text-white" />
              ) : (
                <XCircle className="h-4.5 w-4.5 text-white" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white">
                {result.passed ? 'Quiz Aprovado!' : 'Quiz Reprovado'}
              </h3>
              <p className="text-xs text-white/60">
                {result.earned_points}/{result.total_points} pontos
                {result.passed && ' · Concluído'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{result.score}%</p>
              <p className="text-[10px] text-white/50">mín. {result.passing_score}%</p>
            </div>
          </div>
        </div>

        {/* All answers stacked */}
        {reviewAnswers.length > 0 && (
          <div className="px-5 py-4 space-y-3">
            {reviewAnswers.map((answer) => (
              <div
                key={answer.question_id}
                className={cn(
                  'rounded-xl border p-4',
                  answer.is_correct
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                )}
              >
                <div className="flex items-start gap-2.5">
                  {answer.is_correct ? (
                    <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-4.5 w-4.5 shrink-0 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{answer.question_text}</p>
                    {answer.explanation && (
                      <p className="text-xs text-muted-foreground mt-1">{answer.explanation}</p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 rounded-full text-[10px] border-0',
                      answer.is_correct
                        ? 'bg-emerald-200/60 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                        : 'bg-red-200/60 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                    )}
                  >
                    {answer.earned_points}/{answer.points}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer — only show for failed quizzes */}
        {!result.passed && (
          <div className="flex items-center justify-end border-t px-5 py-3 gap-2">
            {canRetry && (
              <Button onClick={handleStart} variant="outline" size="sm" className="rounded-full">
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Repetir
              </Button>
            )}
            {attemptsExhausted && (
              <span className="text-xs text-muted-foreground">
                Tentativas esgotadas ({result.attempt_number}/{result.max_attempts})
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  return null
}
