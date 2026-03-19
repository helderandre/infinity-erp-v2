'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Flag, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface LessonReportDialogProps {
  lessonId: string
  courseId: string
  trigger?: React.ReactNode
}

const REPORT_REASONS = [
  { value: 'video_corrupted', label: 'Vídeo corrompido ou não reproduz' },
  { value: 'audio_issues', label: 'Problemas de áudio' },
  { value: 'wrong_content', label: 'Conteúdo errado ou desactualizado' },
  { value: 'file_corrupted', label: 'Ficheiro corrompido (PDF/documento)' },
  { value: 'broken_link', label: 'Link partido' },
  { value: 'other', label: 'Outro problema' },
] as const

export function LessonReportDialog({ lessonId, trigger }: LessonReportDialogProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('Seleccione um motivo')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/training/lessons/${lessonId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, comment: comment || undefined }),
      })

      if (res.ok) {
        toast.success('Problema reportado com sucesso')
        setOpen(false)
        setReason('')
        setComment('')
      } else if (res.status === 409) {
        toast.error('Já existe um problema reportado em aberto para esta lição')
      } else {
        toast.error('Erro ao reportar problema')
      }
    } catch {
      toast.error('Erro ao reportar problema')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Flag className="h-4 w-4" />
            Reportar problema
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar Problema</DialogTitle>
          <DialogDescription>
            Descreva o problema encontrado nesta lição. A nossa equipa irá analisar o mais breve possível.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup value={reason} onValueChange={setReason}>
            {REPORT_REASONS.map((r) => (
              <div key={r.value} className="flex items-center space-x-2">
                <RadioGroupItem value={r.value} id={r.value} />
                <Label htmlFor={r.value} className="cursor-pointer">
                  {r.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="report-comment">Comentário adicional (opcional)</Label>
            <Textarea
              id="report-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Descreva o problema com mais detalhe..."
              maxLength={1000}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !reason}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
