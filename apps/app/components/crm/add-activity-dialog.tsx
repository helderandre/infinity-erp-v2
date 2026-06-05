'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_DIRECTION_LABELS,
} from '@/lib/constants-leads-crm'
import type { ActivityType, ActivityDirection } from '@/types/leads-crm'

const MANUAL_ACTIVITY_TYPES: ActivityType[] = [
  'call',
  'email',
  'whatsapp',
  'sms',
  'note',
  'visit',
]

interface AddActivityDialogProps {
  contactId: string
  negocioId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddActivityDialog({
  contactId,
  negocioId,
  open,
  onOpenChange,
  onSuccess,
}: AddActivityDialogProps) {
  const [activityType, setActivityType] = useState<ActivityType | ''>('')
  const [direction, setDirection] = useState<ActivityDirection | ''>('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function resetForm() {
    setActivityType('')
    setDirection('')
    setSubject('')
    setDescription('')
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!activityType) {
      toast.error('Seleccione o tipo de actividade')
      return
    }

    setIsSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        activity_type: activityType,
        direction: direction || null,
        subject: subject.trim() || null,
        description: description.trim() || null,
      }
      if (negocioId) body.negocio_id = negocioId

      const res = await fetch(`/api/crm/contacts/${contactId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao registar actividade')
      }

      toast.success('Actividade registada com sucesso')
      handleOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registar actividade')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Registar Actividade</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="activity_type">Tipo de actividade *</Label>
            <Select
              value={activityType}
              onValueChange={(v) => setActivityType(v as ActivityType)}
            >
              <SelectTrigger id="activity_type">
                <SelectValue placeholder="Seleccionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_ACTIVITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {ACTIVITY_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Direction */}
          <div className="space-y-1.5">
            <Label htmlFor="direction">Direcção</Label>
            <Select
              value={direction}
              onValueChange={(v) => setDirection(v as ActivityDirection)}
            >
              <SelectTrigger id="direction">
                <SelectValue placeholder="Seleccionar direcção..." />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ACTIVITY_DIRECTION_LABELS) as [ActivityDirection, string][]).map(
                  ([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="subject">Assunto</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Assunto da actividade..."
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição / Notas</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes da actividade..."
              rows={4}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-full"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-full">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
