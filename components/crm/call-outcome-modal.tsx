'use client'

import { useState } from 'react'
import { PhoneOff, PhoneCall, VoicemailIcon, Clock, CheckCircle2, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CallOutcomeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactName?: string
  contactMethod: 'phone' | 'email' | 'whatsapp'
  negocioId?: string | null
}

const OUTCOMES = [
  { value: 'success', label: 'Atendeu', icon: CheckCircle2, color: 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100' },
  { value: 'no_answer', label: 'Sem resposta', icon: PhoneOff, color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' },
  { value: 'busy', label: 'Ocupado', icon: Clock, color: 'text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100' },
  { value: 'voicemail', label: 'Voicemail', icon: VoicemailIcon, color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { value: 'failed', label: 'Não consegui', icon: PhoneCall, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
] as const

const METHOD_LABELS = {
  phone: 'chamada',
  email: 'email',
  whatsapp: 'WhatsApp',
}

export function CallOutcomeModal({
  open,
  onOpenChange,
  contactId,
  contactName,
  contactMethod,
  negocioId,
}: CallOutcomeModalProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!selectedOutcome) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}/call-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: selectedOutcome,
          direction: 'outbound',
          notes: notes.trim() || null,
          negocio_id: negocioId || null,
        }),
      })

      if (!res.ok) throw new Error()

      const data = await res.json()

      if (selectedOutcome === 'success') {
        toast.success(
          data.stage_updated
            ? 'Contacto registado — estado actualizado'
            : 'Contacto registado com sucesso'
        )
      } else {
        toast.success('Resultado registado')
      }

      // Reset and close
      setSelectedOutcome(null)
      setNotes('')
      onOpenChange(false)
    } catch {
      toast.error('Erro ao registar resultado')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    setSelectedOutcome(null)
    setNotes('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resultado do contacto</DialogTitle>
          <DialogDescription>
            Como correu a {METHOD_LABELS[contactMethod]}
            {contactName ? ` com ${contactName}` : ''}?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 mt-2">
          {OUTCOMES.map(({ value, label, icon: Icon, color }) => (
            <button
              key={value}
              onClick={() => setSelectedOutcome(value)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all',
                selectedOutcome === value
                  ? cn(color, 'ring-2 ring-offset-1 ring-primary/30 font-medium')
                  : 'border-border bg-background hover:bg-muted/50',
                value === 'success' && 'col-span-2'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        <Textarea
          placeholder="Notas (opcional)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-2 resize-none"
        />

        <div className="flex justify-between mt-2">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Ignorar
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!selectedOutcome || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Registar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
