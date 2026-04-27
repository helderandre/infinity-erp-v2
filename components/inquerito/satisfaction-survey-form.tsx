'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Star, ExternalLink, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SATISFACTION_SURVEY_QUESTIONS, type SurveyQuestion } from '@/lib/inquerito/constants'

type Answers = Record<string, string>

interface SatisfactionSurveyFormProps {
  token: string
  consultantName: string | null
  propertyAddress: string | null
  dealReference: string | null
}

export function SatisfactionSurveyForm({
  token,
  consultantName,
  propertyAddress,
  dealReference,
}: SatisfactionSurveyFormProps) {
  const [answers, setAnswers] = useState<Answers>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<{ is_promoter: boolean; google_review_url: string | null } | null>(null)

  const setAnswer = (field: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [field]: value }))
  }

  const requiredAnsweredCount = SATISFACTION_SURVEY_QUESTIONS.filter((q) => q.required && answers[q.field]).length
  const requiredTotal = SATISFACTION_SURVEY_QUESTIONS.filter((q) => q.required).length
  const canSubmit = requiredAnsweredCount === requiredTotal && !isSubmitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    // Find first unanswered required question for scroll anchor
    const firstMissing = SATISFACTION_SURVEY_QUESTIONS.find((q) => q.required && !answers[q.field])
    if (firstMissing) {
      const el = document.getElementById(`q-${firstMissing.field}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/inquerito/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Erro a submeter inquérito.')
      }
      const { data } = await res.json()
      setSubmitted({
        is_promoter: data.is_promoter ?? false,
        google_review_url: data.google_review_url ?? null,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Submitted state ───────────────────────────────────────────
  if (submitted) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 space-y-6 text-center">
        <div className="inline-flex h-16 w-16 rounded-full bg-emerald-100 items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Obrigado pela sua opinião</h1>
          <p className="text-sm text-muted-foreground">
            As suas respostas foram registadas e ajudam-nos a melhorar continuamente o serviço.
          </p>
        </div>

        {submitted.is_promoter && submitted.google_review_url && (
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5 space-y-3 text-left">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500 fill-amber-400" />
              <p className="text-sm font-semibold text-amber-900">Adoraríamos a sua opinião pública</p>
            </div>
            <p className="text-sm text-amber-900/80">
              Como ficou satisfeito com a nossa equipa, considere partilhar a sua experiência com uma
              review no Google. Demora menos de 1 minuto e ajuda outras famílias a confiar em nós.
            </p>
            <Button asChild className="bg-amber-600 hover:bg-amber-700 gap-2 w-full sm:w-auto">
              <a href={submitted.google_review_url} target="_blank" rel="noopener noreferrer">
                Deixar review no Google
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">— Equipa Infinity Group</p>
      </div>
    )
  }

  // ── Survey form ───────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Inquérito de Satisfação</h1>
        <p className="text-sm text-muted-foreground">
          Obrigado por ter confiado na <strong>Infinity Group</strong>. A sua opinião é fundamental para
          continuarmos a melhorar.
        </p>
        {(consultantName || propertyAddress || dealReference) && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-0.5">
            {dealReference && <div><span className="font-medium">Referência:</span> {dealReference}</div>}
            {propertyAddress && <div><span className="font-medium">Imóvel:</span> {propertyAddress}</div>}
            {consultantName && <div><span className="font-medium">Consultor(a):</span> {consultantName}</div>}
          </div>
        )}
      </header>

      <form onSubmit={handleSubmit} className="space-y-7">
        {SATISFACTION_SURVEY_QUESTIONS.map((q, idx) => (
          <QuestionField
            key={q.field}
            question={q}
            number={idx + 1}
            value={answers[q.field] ?? ''}
            onChange={(v) => setAnswer(q.field, v)}
          />
        ))}

        {error && (
          <p className="text-sm text-destructive bg-destructive/5 rounded-md px-3 py-2 border border-destructive/30">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted-foreground">
            {requiredAnsweredCount}/{requiredTotal} respostas obrigatórias
          </p>
          <Button type="submit" disabled={!canSubmit} className="min-w-32">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submeter
          </Button>
        </div>
      </form>
    </div>
  )
}

function QuestionField({
  question,
  number,
  value,
  onChange,
}: {
  question: SurveyQuestion
  number: number
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div id={`q-${question.field}`} className="space-y-2">
      <Label className="text-sm font-medium leading-snug">
        {number}. {question.label}
        {question.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {question.type === 'choice' && (
        <div className="space-y-1.5 pl-1">
          {question.choices.map((choice) => {
            const id = `${question.field}-${choice.value}`
            const checked = value === choice.value
            return (
              <label
                key={choice.value}
                htmlFor={id}
                className={cn(
                  'flex items-center gap-2.5 rounded-md border bg-card px-3 py-2 cursor-pointer transition-colors hover:bg-accent/40 text-sm',
                  checked && 'border-primary bg-primary/5',
                )}
              >
                <input
                  type="radio"
                  id={id}
                  name={question.field}
                  value={choice.value}
                  checked={checked}
                  onChange={() => onChange(choice.value)}
                  className="h-4 w-4 accent-primary"
                />
                <span>{choice.label}</span>
              </label>
            )
          })}
        </div>
      )}
      {question.type === 'text' && (
        <div className="space-y-1.5 pl-1">
          {question.helper && <p className="text-xs text-muted-foreground">{question.helper}</p>}
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder ?? 'A sua resposta…'}
            rows={3}
            className="resize-none text-sm"
            maxLength={2000}
          />
        </div>
      )}
    </div>
  )
}
