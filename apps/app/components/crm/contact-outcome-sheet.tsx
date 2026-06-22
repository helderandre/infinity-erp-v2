'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PhoneOff, PhoneMissed, Voicemail, Clock, CheckCircle2 } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

export type ContactChannel = 'phone' | 'email' | 'whatsapp'
export type ContactOutcome = 'success' | 'failed' | 'no_answer' | 'busy' | 'voicemail'

interface ContactOutcomeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Always a leads.id (unified pipeline). The outcome endpoint keys on this. */
  contactId: string
  contactName?: string | null
  /** Optional phone shown in the subtitle. */
  phone?: string | null
  /** When the call was placed from an opportunity, link the outcome to it. */
  negocioId?: string | null
  /** Drives the title/labels. Defaults to phone. */
  channel?: ContactChannel
  defaultDirection?: 'outbound' | 'inbound'
  onCompleted?: (outcome: ContactOutcome, stageUpdated: boolean) => void
}

type OutcomeOption = { value: ContactOutcome; label: string; icon: React.ElementType; color: string }

// Per-outcome visuals, shared across channels.
const OUTCOME_STYLE: Record<ContactOutcome, { icon: React.ElementType; color: string }> = {
  success: { icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20' },
  no_answer: { icon: PhoneMissed, color: 'bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20' },
  busy: { icon: Clock, color: 'bg-orange-500/10 text-orange-600 border-orange-200 hover:bg-orange-500/20' },
  voicemail: { icon: Voicemail, color: 'bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20' },
  failed: { icon: PhoneOff, color: 'bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20' },
}

// Channel-appropriate vocabulary. Values stay within the endpoint's enum;
// only the labels and the offered set change per channel.
const CHANNEL_OUTCOMES: Record<ContactChannel, { value: ContactOutcome; label: string }[]> = {
  phone: [
    { value: 'success', label: 'Atendeu' },
    { value: 'no_answer', label: 'Sem resposta' },
    { value: 'busy', label: 'Ocupado' },
    { value: 'voicemail', label: 'Voicemail' },
    { value: 'failed', label: 'Cancelado' },
  ],
  whatsapp: [
    { value: 'success', label: 'Respondeu' },
    { value: 'no_answer', label: 'Sem resposta' },
    { value: 'failed', label: 'Cancelado' },
  ],
  email: [
    { value: 'success', label: 'Respondeu' },
    { value: 'no_answer', label: 'Sem resposta' },
  ],
}

function outcomesFor(channel: ContactChannel): OutcomeOption[] {
  return CHANNEL_OUTCOMES[channel].map((o) => ({ ...o, ...OUTCOME_STYLE[o.value] }))
}

const CHANNEL_TITLE: Record<ContactChannel, string> = {
  phone: 'Como correu a chamada?',
  email: 'Como correu o email?',
  whatsapp: 'Como correu o WhatsApp?',
}

function newRequestId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    // Fallback for environments without crypto.randomUUID
    return `req-${Date.now()}-${Math.round(Math.random() * 1e9)}`
  }
}

/**
 * Canonical "did they pick up?" form. One-tap submit, optional direction toggle
 * and notes. Posts to /api/crm/contacts/[id]/call-outcome which fans the result
 * out to the contact history, the lead-entry funnel/SLA, and the objetivos
 * ledger. Mount it everywhere a contact is reached (lead, contacto, opportunity,
 * base de dados) so the experience and the "what counts" rules stay identical.
 */
export function ContactOutcomeSheet({
  open,
  onOpenChange,
  contactId,
  contactName,
  phone,
  negocioId,
  channel = 'phone',
  defaultDirection = 'outbound',
  onCompleted,
}: ContactOutcomeSheetProps) {
  const isMobile = useIsMobile()
  const [notes, setNotes] = useState('')
  const [direction, setDirection] = useState<'outbound' | 'inbound'>(defaultDirection)
  const [submitting, setSubmitting] = useState(false)

  const handleOutcome = async (outcome: ContactOutcome) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}/call-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          direction,
          notes: notes.trim() || undefined,
          negocio_id: negocioId ?? undefined,
          // Idempotency: dedups a double-tap into a single logged outcome.
          request_id: newRequestId(),
        }),
      })

      if (!res.ok) throw new Error()

      const data = await res.json()

      if (outcome === 'success') {
        toast.success('Contacto registado')
        if (data.stage_updated) {
          toast.success('Contacto atualizado para Contactado', {
            description: 'Primeira chamada atendida — estado atualizado automaticamente',
          })
        }
      } else {
        toast.info('Resultado registado')
      }

      setNotes('')
      onOpenChange(false)
      onCompleted?.(outcome, Boolean(data.stage_updated))
    } catch {
      toast.error('Erro ao registar o contacto')
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
            {CHANNEL_TITLE[channel]}
          </SheetTitle>
          <SheetDescription className="mt-1 text-sm">
            {contactName || 'Contacto'}
            {phone ? ` · ${phone}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-4">
          {/* Direction toggle — only meaningful for live calls */}
          {channel === 'phone' && (
            <div className="flex gap-1 p-0.5 rounded-full bg-muted/40 border border-border/40 w-fit">
              <button
                type="button"
                onClick={() => setDirection('outbound')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  direction === 'outbound'
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                ↗ Enviada
              </button>
              <button
                type="button"
                onClick={() => setDirection('inbound')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  direction === 'inbound'
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                ↙ Recebida
              </button>
            </div>
          )}

          {/* Notes (optional) */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full text-sm bg-background/60 rounded-xl border border-border/50 p-3 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none leading-relaxed placeholder:text-muted-foreground/50"
            placeholder="Notas (opcional)..."
            disabled={submitting}
          />

          {/* Outcome buttons — one tap registers */}
          <div className="grid grid-cols-2 gap-2">
            {outcomesFor(channel).map((o) => (
              <button
                key={o.value}
                onClick={() => handleOutcome(o.value)}
                disabled={submitting}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all disabled:opacity-50',
                  o.color,
                  o.value === 'success' && 'col-span-2',
                )}
              >
                {submitting ? <Spinner className="h-4 w-4" /> : <o.icon className="h-4 w-4" />}
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
