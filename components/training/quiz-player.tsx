'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import type { TrainingQuiz, TrainingQuizQuestion } from '@/types/training'

interface QuizPlayerProps {
  quiz: TrainingQuiz
  questions: TrainingQuizQuestion[]
  onSubmit: (
    answers: Array<{ question_id: string; selected_options: string[] }>,
    timeSpent: number
  ) => Promise<void>
  isSubmitting: boolean
}

export function QuizPlayer({
  quiz,
  questions,
  onSubmit,
  isSubmitting,
}: QuizPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [isExpired, setIsExpired] = useState(false)
  const startTimeRef = useRef(Date.now())

  const totalQuestions = questions.length
  const currentQuestion = questions[currentIndex]
  const answeredCount = Object.keys(answers).length
  const allAnswered = answeredCount === totalQuestions
  const hasTimeLimit = !!quiz.time_limit_minutes && quiz.time_limit_minutes > 0
  const timeLimitSeconds = hasTimeLimit ? quiz.time_limit_minutes! * 60 : 0
  const timeRemaining = Math.max(0, timeLimitSeconds - timeElapsed)

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setTimeElapsed(elapsed)

      if (hasTimeLimit && elapsed >= timeLimitSeconds) {
        setIsExpired(true)
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [hasTimeLimit, timeLimitSeconds])

  // Auto-submit when time expires
  useEffect(() => {
    if (isExpired && !isSubmitting) {
      handleSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpired])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const setAnswer = useCallback(
    (questionId: string, selectedOptions: string[]) => {
      setAnswers((prev) => ({ ...prev, [questionId]: selectedOptions }))
    },
    []
  )

  const handleSingleChoice = (questionId: string, optionId: string) => {
    setAnswer(questionId, [optionId])
  }

  const handleMultipleChoice = (
    questionId: string,
    optionId: string,
    checked: boolean
  ) => {
    const current = answers[questionId] || []
    const next = checked
      ? [...current, optionId]
      : current.filter((id) => id !== optionId)
    setAnswer(questionId, next)
  }

  const handleSubmit = async () => {
    const formattedAnswers = questions.map((q) => ({
      question_id: q.id,
      selected_options: answers[q.id] || [],
    }))
    const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000)
    await onSubmit(formattedAnswers, timeSpent)
  }

  const goToPrevious = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1)
  }

  const goToNext = () => {
    if (currentIndex < totalQuestions - 1) setCurrentIndex(currentIndex + 1)
  }

  const isQuestionAnswered = (questionId: string) => {
    return !!answers[questionId] && answers[questionId].length > 0
  }

  if (!currentQuestion) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{quiz.title}</h2>
          {quiz.max_attempts > 0 && (
            <p className="text-sm text-muted-foreground">
              Máximo de tentativas: {quiz.max_attempts}
            </p>
          )}
        </div>
        {hasTimeLimit && (
          <Badge
            variant={timeRemaining < 60 ? 'destructive' : 'secondary'}
            className="gap-1.5 px-3 py-1.5 text-sm"
          >
            <Clock className="h-4 w-4" />
            {formatTime(timeRemaining)}
          </Badge>
        )}
      </div>

      {/* Progress dots */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Pergunta {currentIndex + 1} de {totalQuestions}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className="focus:outline-none"
              title={`Pergunta ${i + 1}`}
            >
              {isQuestionAnswered(q.id) ? (
                <CheckCircle2
                  className={`h-5 w-5 ${
                    i === currentIndex
                      ? 'text-primary'
                      : 'text-emerald-500'
                  }`}
                />
              ) : (
                <Circle
                  className={`h-5 w-5 ${
                    i === currentIndex
                      ? 'text-primary'
                      : 'text-muted-foreground/40'
                  }`}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Time expired warning */}
      {isExpired && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            O tempo expirou. O quiz foi submetido automaticamente.
          </span>
        </div>
      )}

      {/* Question card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-lg">
              {currentQuestion.question_text}
            </CardTitle>
            <Badge variant="outline" className="shrink-0">
              {currentQuestion.points}{' '}
              {currentQuestion.points === 1 ? 'ponto' : 'pontos'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {currentQuestion.question_type === 'single_choice' &&
              'Seleccione uma opção'}
            {currentQuestion.question_type === 'multiple_choice' &&
              'Seleccione uma ou mais opções'}
            {currentQuestion.question_type === 'true_false' &&
              'Seleccione Verdadeiro ou Falso'}
          </p>
        </CardHeader>
        <CardContent>
          {/* Single choice */}
          {currentQuestion.question_type === 'single_choice' && (
            <RadioGroup
              value={answers[currentQuestion.id]?.[0] || ''}
              onValueChange={(value) =>
                handleSingleChoice(currentQuestion.id, value)
              }
              className="space-y-3"
            >
              {currentQuestion.options.map((option) => (
                <div
                  key={option.id}
                  className="flex items-center space-x-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <RadioGroupItem value={option.id} id={option.id} />
                  <Label
                    htmlFor={option.id}
                    className="flex-1 cursor-pointer text-sm font-normal"
                  >
                    {option.text}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {/* Multiple choice */}
          {currentQuestion.question_type === 'multiple_choice' && (
            <div className="space-y-3">
              {currentQuestion.options.map((option) => {
                const isChecked =
                  answers[currentQuestion.id]?.includes(option.id) || false
                return (
                  <div
                    key={option.id}
                    className="flex items-center space-x-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <Checkbox
                      id={option.id}
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        handleMultipleChoice(
                          currentQuestion.id,
                          option.id,
                          !!checked
                        )
                      }
                    />
                    <Label
                      htmlFor={option.id}
                      className="flex-1 cursor-pointer text-sm font-normal"
                    >
                      {option.text}
                    </Label>
                  </div>
                )
              })}
            </div>
          )}

          {/* True/False */}
          {currentQuestion.question_type === 'true_false' && (
            <RadioGroup
              value={answers[currentQuestion.id]?.[0] || ''}
              onValueChange={(value) =>
                handleSingleChoice(currentQuestion.id, value)
              }
              className="space-y-3"
            >
              {currentQuestion.options.map((option) => (
                <div
                  key={option.id}
                  className="flex items-center space-x-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <RadioGroupItem value={option.id} id={option.id} />
                  <Label
                    htmlFor={option.id}
                    className="flex-1 cursor-pointer text-sm font-normal"
                  >
                    {option.text === 'true' || option.text === 'Verdadeiro'
                      ? 'Verdadeiro'
                      : 'Falso'}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={goToPrevious}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Anterior
        </Button>

        <div className="flex items-center gap-3">
          {(allAnswered || currentIndex === totalQuestions - 1) && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isExpired}
            >
              {isSubmitting ? (
                <>A submeter...</>
              ) : (
                <>
                  <Send className="mr-1 h-4 w-4" />
                  Submeter Quiz
                </>
              )}
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          onClick={goToNext}
          disabled={currentIndex === totalQuestions - 1}
        >
          Pr&oacute;xima
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* Bottom progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {answeredCount} de {totalQuestions} respondidas
          </span>
          <span>
            {Math.round((answeredCount / totalQuestions) * 100)}%
          </span>
        </div>
        <Progress value={(answeredCount / totalQuestions) * 100} />
      </div>
    </div>
  )
}
