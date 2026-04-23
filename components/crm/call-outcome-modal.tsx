'use client'

import { useState } from 'react'
import { PhoneOff, PhoneCall, VoicemailIcon, Clock, CheckCircle2, Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'

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
  { value: 'failed', label: 'Cancelado', icon: PhoneCall, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
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
  const isMobile = useIsMobile()
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-auto data-[side=bottom]:max-h-[75dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[420px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-10" />
        )}

        <SheetHeader className="shrink-0 px-6 pt-8 pb-3 gap-0 text-left">
          <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight">
            Resultado do contacto
          </SheetTitle>
          <SheetDescription className="mt-1 text-sm">
            Como correu a {METHOD_LABELS[contactMethod]}
            {contactName ? ` com ${contactName}` : ''}?
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedOutcome(value)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all',
                  selectedOutcome === value
                    ? cn(color, 'ring-2 ring-offset-1 ring-primary/30 font-medium')
                    : 'border-border/50 bg-background/40 hover:bg-muted/50',
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
            className="resize-none bg-background/60"
          />
        </div>

        <div className="shrink-0 px-6 py-4 flex flex-row gap-2 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md border-t border-border/40">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={handleSkip}
          >
            Ignorar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={!selectedOutcome || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Registar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
