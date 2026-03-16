'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowLeft,
  Trophy,
  Target,
  Hash,
  Info,
} from 'lucide-react'

interface QuizResultsProps {
  score: number
  passed: boolean
  passingScore: number
  answers: Array<{
    question_id: string
    question_text?: string
    selected_options: string[]
    correct_options?: string[]
    is_correct: boolean
    points_earned: number
    explanation?: string
  }>
  attemptNumber: number
  maxAttempts: number
  onRetry?: () => void
  onBack: () => void
}

export function QuizResults({
  score,
  passed,
  passingScore,
  answers,
  attemptNumber,
  maxAttempts,
  onRetry,
  onBack,
}: QuizResultsProps) {
  const correctCount = answers.filter((a) => a.is_correct).length
  const hasAttemptsRemaining = maxAttempts === 0 || attemptNumber < maxAttempts

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Score circle */}
      <div className="flex flex-col items-center gap-4 pt-4">
        <div
          className={`flex h-36 w-36 flex-col items-center justify-center rounded-full border-4 ${
            passed
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
              : 'border-red-500 bg-red-50 text-red-700'
          }`}
        >
          <span className="text-4xl font-bold">{Math.round(score)}%</span>
          {passed ? (
            <Trophy className="mt-1 h-5 w-5" />
          ) : (
            <XCircle className="mt-1 h-5 w-5" />
          )}
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold">
            {passed ? 'Aprovado!' : 'Reprovado'}
          </h2>
          <p className="text-muted-foreground">
            {passed
              ? 'Parabens! Completou o quiz com sucesso.'
              : 'Nao atingiu a nota minima necessaria.'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <Target className="h-5 w-5 text-muted-foreground" />
            <span className="text-xl font-semibold">{Math.round(score)}%</span>
            <span className="text-xs text-muted-foreground">Nota Obtida</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            <span className="text-xl font-semibold">{passingScore}%</span>
            <span className="text-xs text-muted-foreground">
              Nota de Aprovacao
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <span className="text-xl font-semibold">
              {attemptNumber}
              {maxAttempts > 0 ? `/${maxAttempts}` : ''}
            </span>
            <span className="text-xs text-muted-foreground">Tentativa</span>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-center gap-4 text-sm">
        <span className="flex items-center gap-1 text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          {correctCount} correctas
        </span>
        <span className="flex items-center gap-1 text-red-600">
          <XCircle className="h-4 w-4" />
          {answers.length - correctCount} incorrectas
        </span>
      </div>

      {/* Question breakdown */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Detalhes das Respostas</h3>
        {answers.map((answer, i) => (
          <Card
            key={answer.question_id}
            className={`border-l-4 ${
              answer.is_correct ? 'border-l-emerald-500' : 'border-l-red-500'
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-medium">
                  <span className="text-muted-foreground">
                    Pergunta {i + 1}.
                  </span>{' '}
                  {answer.question_text || `Pergunta ${i + 1}`}
                </CardTitle>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={answer.is_correct ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {answer.points_earned}{' '}
                    {answer.points_earned === 1 ? 'ponto' : 'pontos'}
                  </Badge>
                  {answer.is_correct ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {/* Selected options */}
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Sua resposta:
                </p>
                <p className="text-sm">
                  {answer.selected_options.length > 0
                    ? answer.selected_options.join(', ')
                    : 'Sem resposta'}
                </p>
              </div>

              {/* Correct options (if available and incorrect) */}
              {!answer.is_correct &&
                answer.correct_options &&
                answer.correct_options.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-emerald-600">
                      Resposta correcta:
                    </p>
                    <p className="text-sm text-emerald-700">
                      {answer.correct_options.join(', ')}
                    </p>
                  </div>
                )}

              {/* Explanation */}
              {answer.explanation && (
                <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <p className="text-xs text-muted-foreground">
                    {answer.explanation}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3 pb-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar ao Curso
        </Button>
        {!passed && hasAttemptsRemaining && onRetry && (
          <Button onClick={onRetry}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Tentar Novamente
          </Button>
        )}
      </div>
    </div>
  )
}
