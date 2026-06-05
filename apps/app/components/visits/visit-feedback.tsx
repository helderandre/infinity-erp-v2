'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { visitFeedbackSchema, type VisitFeedbackFormData } from '@/lib/validations/visit'
import {
  VISIT_FEEDBACK_INTEREST_OPTIONS,
  VISIT_FEEDBACK_NEXT_STEP_OPTIONS,
} from '@/lib/constants'
import { Loader2, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface VisitFeedbackProps {
  visitId: string
  onSubmit: (id: string, feedback: VisitFeedbackFormData) => Promise<boolean>
  onCancel?: () => void
}

export function VisitFeedback({ visitId, onSubmit, onCancel }: VisitFeedbackProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hoverRating, setHoverRating] = useState(0)

  const {
    handleSubmit,
    setValue,
    watch,
    register,
    formState: { errors },
  } = useForm<VisitFeedbackFormData>({
    resolver: zodResolver(visitFeedbackSchema),
    defaultValues: {
      feedback_rating: 0,
      feedback_notes: '',
    },
  })

  const currentRating = watch('feedback_rating')

  const handleFormSubmit = async (data: VisitFeedbackFormData) => {
    setIsSubmitting(true)
    try {
      const success = await onSubmit(visitId, data)
      if (!success) {
        setIsSubmitting(false)
      }
    } catch {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {/* Rating */}
      <div className="space-y-2">
        <Label>Avaliação *</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="p-0.5 transition-transform hover:scale-110"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setValue('feedback_rating', star, { shouldValidate: true })}
            >
              <Star
                className={`h-7 w-7 ${
                  star <= (hoverRating || currentRating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-muted-foreground/30'
                }`}
              />
            </button>
          ))}
        </div>
        {errors.feedback_rating && (
          <p className="text-sm text-destructive">{errors.feedback_rating.message}</p>
        )}
      </div>

      {/* Interest */}
      <div className="space-y-2">
        <Label>Nível de Interesse *</Label>
        <Select
          value={watch('feedback_interest') || ''}
          onValueChange={(v) => setValue('feedback_interest', v as any, { shouldValidate: true })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar..." />
          </SelectTrigger>
          <SelectContent>
            {VISIT_FEEDBACK_INTEREST_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.feedback_interest && (
          <p className="text-sm text-destructive">{errors.feedback_interest.message}</p>
        )}
      </div>

      {/* Next Step */}
      <div className="space-y-2">
        <Label>Próximo Passo *</Label>
        <Select
          value={watch('feedback_next_step') || ''}
          onValueChange={(v) => setValue('feedback_next_step', v as any, { shouldValidate: true })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar..." />
          </SelectTrigger>
          <SelectContent>
            {VISIT_FEEDBACK_NEXT_STEP_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.feedback_next_step && (
          <p className="text-sm text-destructive">{errors.feedback_next_step.message}</p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="feedback_notes">Notas</Label>
        <Textarea
          id="feedback_notes"
          placeholder="Observações sobre a visita..."
          rows={3}
          {...register('feedback_notes')}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Registar Feedback
        </Button>
      </div>
    </form>
  )
}
