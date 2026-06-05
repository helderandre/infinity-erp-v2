'use client'

import { useState, type ReactNode } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Phone, PhoneCall, PhoneOff, X, Tag, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FunnelSide } from '@/types/funnel-event'

interface CallContactButtonProps {
  /** Phone number to dial. Will be normalized into a tel: URL. */
  phone: string
  /** Display name of the contact (lead, owner, interessado) for the dialog */
  contactName?: string | null
  /** Pre-fill the side. If omitted, agent picks in the dialog. */
  defaultSide?: FunnelSide
  /** Lead/contact id — when present, logs the call to the contact's history
   *  via /api/crm/contacts/[id]/call-outcome. Skipped if absent. */
  leadId?: string | null
  /** Optional source ref for the v2 funnel event */
  sourceRefType?: string
  sourceRefId?: string | null
  /** Children = the trigger UI (icon, label, etc). */
  children: ReactNode
  /** Class on the anchor element */
  className?: string
  /** ARIA label override */
  ariaLabel?: string
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^+\d]/g, '')
}

// Wraps a phone-call trigger. The anchor still fires tel: natively (so the
// OS phone app opens), and we additionally open a picker dialog asking the
// agent whether they want to count the call toward their funnel goals.
export function CallContactButton({
  phone,
  contactName,
  defaultSide,
  leadId,
  sourceRefType,
  sourceRefId,
  children,
  className,
  ariaLabel,
}: CallContactButtonProps) {
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<FunnelSide | null>(defaultSide ?? null)
  const [countToward, setCountToward] = useState(true)
  const [isLogging, setIsLogging] = useState(false)
  const tel = `tel:${normalizePhone(phone)}`

  function handleClick() {
    setSide(defaultSide ?? null)
    setCountToward(true)
    // Slight delay so the tel: link fires first (mobile OS opens dialer),
    // then the dialog appears once the user comes back to the browser.
    setTimeout(() => setOpen(true), 50)
  }

  // Log the call to the contact's history (independent of funnel-counting toggle).
  // Always fires when leadId is present, with the appropriate outcome.
  async function logToContactHistory(outcome: 'success' | 'no_answer') {
    if (!leadId) return
    try {
      await fetch(`/api/crm/contacts/${leadId}/call-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, direction: 'outbound' }),
      })
    } catch (err) {
      // Don't block the UX flow on a history-logging failure
      console.error('Erro ao registar chamada no histórico do contacto:', err)
    }
  }

  // Log the call to the v2 funnel (only when agent opted in)
  async function logFunnelEvent(s: FunnelSide) {
    try {
      const res = await fetch('/api/agent-funnel-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side: s,
          stage: 'contacto',
          count: 1,
          source: 'call_picker',
          source_ref_type: sourceRefType ?? null,
          source_ref_id: sourceRefId ?? null,
          notes: contactName ? `Chamada para ${contactName}` : null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error || 'Erro ao registar chamada nos objectivos')
        return false
      }
      return true
    } catch {
      toast.error('Erro ao registar chamada nos objectivos')
      return false
    }
  }

  async function handleAtendeu() {
    if (countToward && !side) {
      toast.error('Escolhe vendedor ou comprador para contar.')
      return
    }
    setIsLogging(true)
    try {
      // 1) Always log to contact history when we have the lead id
      await logToContactHistory('success')

      // 2) Log to v2 funnel only when the agent opted in
      if (countToward && side) {
        const ok = await logFunnelEvent(side)
        if (ok) toast.success(`Chamada registada (lado ${side})`)
      } else {
        toast.success('Chamada registada no histórico do contacto')
      }
    } finally {
      setIsLogging(false)
      setOpen(false)
    }
  }

  async function handleNaoAtendeu() {
    setIsLogging(true)
    try {
      await logToContactHistory('no_answer')
      toast.success('Sem resposta — registado no histórico')
    } finally {
      setIsLogging(false)
      setOpen(false)
    }
  }

  return (
    <>
      <a
        href={tel}
        onClick={handleClick}
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </a>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl bg-background/95 supports-[backdrop-filter]:bg-background/85 backdrop-blur-2xl border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              Chamada
            </DialogTitle>
            <DialogDescription className="text-xs">
              {contactName ? <strong className="text-foreground">{contactName}</strong> : 'Contacto'}
              {' · '}
              <span className="tabular-nums">{phone}</span>
              <br />
              <span className="text-foreground font-medium">Atendeu?</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-xl border border-border/40 bg-background/40 backdrop-blur-sm p-3">
            {/* Side picker */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Lado do funil
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSide('vendedor')}
                  className={cn(
                    'inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                    side === 'vendedor'
                      ? 'border-primary/60 bg-primary/10 text-foreground'
                      : 'border-border/40 bg-background/40 text-muted-foreground hover:border-border/70'
                  )}
                >
                  <Tag className="h-3 w-3" />
                  Vendedor
                </button>
                <button
                  type="button"
                  onClick={() => setSide('comprador')}
                  className={cn(
                    'inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                    side === 'comprador'
                      ? 'border-primary/60 bg-primary/10 text-foreground'
                      : 'border-border/40 bg-background/40 text-muted-foreground hover:border-border/70'
                  )}
                >
                  <ShoppingCart className="h-3 w-3" />
                  Comprador
                </button>
              </div>
            </div>

            {/* Opt-in checkbox */}
            <div className="flex items-start gap-2">
              <Checkbox
                id="count-toward"
                checked={countToward}
                onCheckedChange={(v) => setCountToward(v === true)}
              />
              <div className="space-y-0.5">
                <Label htmlFor="count-toward" className="cursor-pointer text-xs font-medium">
                  Contar para os meus objectivos
                </Label>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Desativa para chamadas administrativas que não contam como prospeção.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col sm:gap-2">
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={handleNaoAtendeu}
                disabled={isLogging}
                className="rounded-xl gap-1.5"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                Não atendeu
              </Button>
              <Button
                type="button"
                onClick={handleAtendeu}
                disabled={isLogging}
                className="rounded-xl gap-1.5"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                {isLogging ? 'A registar…' : 'Atendeu'}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isLogging}
              className="text-xs text-muted-foreground gap-1"
            >
              <X className="h-3 w-3" />
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
