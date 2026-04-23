'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Phone, PhoneOff, PhoneMissed, Voicemail, Clock } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

type CallOutcome = 'success' | 'failed' | 'no_answer' | 'busy' | 'voicemail'

interface CallOutcomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactName: string
  phone: string
  negocioId?: string
  onCompleted?: (outcome: CallOutcome, stageUpdated: boolean) => void
}

const OUTCOMES: { value: CallOutcome; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'success', label: 'Atendeu', icon: Phone, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20' },
  { value: 'no_answer', label: 'Sem resposta', icon: PhoneMissed, color: 'bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20' },
  { value: 'busy', label: 'Ocupado', icon: Clock, color: 'bg-orange-500/10 text-orange-600 border-orange-200 hover:bg-orange-500/20' },
  { value: 'voicemail', label: 'Voicemail', icon: Voicemail, color: 'bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20' },
  { value: 'failed', label: 'Cancelado', icon: PhoneOff, color: 'bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20' },
]

export function CallOutcomeDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  phone,
  negocioId,
  onCompleted,
}: CallOutcomeDialogProps) {
  const isMobile = useIsMobile()
  const [notes, setNotes] = useState('')
  const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound')
  const [submitting, setSubmitting] = useState(false)

  const handleOutcome = async (outcome: CallOutcome) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}/call-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          direction,
          notes: notes.trim() || undefined,
          negocio_id: negocioId,
        }),
      })

      if (!res.ok) throw new Error()

      const data = await res.json()

      if (outcome === 'success') {
        toast.success('Chamada registada com sucesso')
        if (data.stage_updated) {
          toast.success('Contacto atualizado para Contactado', {
            description: 'Primeira chamada atendida — estado atualizado automaticamente',
          })
        }
      } else {
        toast.info('Chamada registada')
      }

      setNotes('')
      onOpenChange(false)
      onCompleted?.(outcome, data.stage_updated)
    } catch {
      toast.error('Erro ao registar chamada')
    } finally {
      setSubmitting(false)
    }
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
            Como correu a chamada?
          </SheetTitle>
          <SheetDescription className="mt-1 text-sm">
            {contactName} · {phone}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-4">
          {/* Direction toggle */}
          <div className="flex gap-1 p-0.5 rounded-full bg-muted/40 border border-border/40 w-fit">
            <button
              onClick={() => setDirection('outbound')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                direction === 'outbound'
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              ↗ Enviada
            </button>
            <button
              onClick={() => setDirection('inbound')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                direction === 'inbound'
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              ↙ Recebida
            </button>
          </div>

          {/* Notes (optional) */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full text-sm bg-background/60 rounded-xl border border-border/50 p-3 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none leading-relaxed placeholder:text-muted-foreground/50"
            placeholder="Notas sobre a chamada (opcional)..."
            disabled={submitting}
          />

          {/* Outcome buttons */}
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                onClick={() => handleOutcome(o.value)}
                disabled={submitting}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all disabled:opacity-50',
                  o.color,
                  o.value === 'success' && 'col-span-2'
                )}
              >
                {submitting ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <o.icon className="h-4 w-4" />
                )}
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
