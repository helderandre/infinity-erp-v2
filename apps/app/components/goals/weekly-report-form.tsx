'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send, Save, CheckCircle, Clock } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

interface WeeklyReportFormProps {
  reportId: string | null
  initialData?: {
    notes_wins: string | null
    notes_challenges: string | null
    notes_next_week: string | null
    status: string
  }
  onSave: (data: {
    notes_wins?: string | null
    notes_challenges?: string | null
    notes_next_week?: string | null
    submit?: boolean
  }) => Promise<unknown>
  onSubmitted?: () => void
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  draft: { label: 'Rascunho', color: 'bg-slate-100 text-slate-700', icon: Clock },
  submitted: { label: 'Submetido', color: 'bg-blue-100 text-blue-700', icon: Send },
  reviewed: { label: 'Revisto', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
}

export function WeeklyReportForm({ reportId, initialData, onSave, onSubmitted }: WeeklyReportFormProps) {
  const [wins, setWins] = useState(initialData?.notes_wins || '')
  const [challenges, setChallenges] = useState(initialData?.notes_challenges || '')
  const [nextWeek, setNextWeek] = useState(initialData?.notes_next_week || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isSubmitted = initialData?.status === 'submitted' || initialData?.status === 'reviewed'
  const statusInfo = STATUS_MAP[initialData?.status || 'draft'] || STATUS_MAP.draft

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave({
        notes_wins: wins || null,
        notes_challenges: challenges || null,
        notes_next_week: nextWeek || null,
      })
      toast.success('Rascunho guardado')
    } catch {
      toast.error('Erro ao guardar')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onSave({
        notes_wins: wins || null,
        notes_challenges: challenges || null,
        notes_next_week: nextWeek || null,
        submit: true,
      })
      toast.success('Relatório submetido com sucesso!')
      onSubmitted?.()
    } catch {
      toast.error('Erro ao submeter')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className={`${statusInfo.color} rounded-lg text-xs`}>
          <statusInfo.icon className="mr-1 h-3 w-3" />
          {statusInfo.label}
        </Badge>
      </div>

      {/* Notes fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="wins" className="text-sm font-medium">
            O que correu bem esta semana?
          </Label>
          <Textarea
            id="wins"
            placeholder="Descreve as conquistas, boas interacções, progressos..."
            value={wins}
            onChange={(e) => setWins(e.target.value)}
            disabled={isSubmitted}
            className="min-h-[80px] rounded-xl resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="challenges" className="text-sm font-medium">
            Que dificuldades encontraste?
          </Label>
          <Textarea
            id="challenges"
            placeholder="Obstáculos, cancelamentos, leads frios, dificuldades técnicas..."
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
            disabled={isSubmitted}
            className="min-h-[80px] rounded-xl resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nextWeek" className="text-sm font-medium">
            Plano para a próxima semana
          </Label>
          <Textarea
            id="nextWeek"
            placeholder="Objectivos, visitas agendadas, leads para contactar, foco..."
            value={nextWeek}
            onChange={(e) => setNextWeek(e.target.value)}
            disabled={isSubmitted}
            className="min-h-[80px] rounded-xl resize-none"
          />
        </div>
      </div>

      {/* Actions */}
      {!isSubmitted && (
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isSubmitting}
            className="rounded-xl"
          >
            {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Guardar rascunho
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={isSaving || isSubmitting} className="rounded-xl">
                {isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                Submeter relatório
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Submeter relatório semanal?</AlertDialogTitle>
                <AlertDialogDescription>
                  Após submeter, o relatório ficará visível para o teu Team Leader e não poderá ser editado.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleSubmit} className="rounded-xl">
                  Submeter
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
