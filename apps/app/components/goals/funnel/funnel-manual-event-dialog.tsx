'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { getStageDef } from '@/lib/goals/funnel/stages'
import type { FunnelType, FunnelStageKey } from '@/types/funnel'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  consultantId: string
  funnel: FunnelType
  stageKey: FunnelStageKey | null
  onSuccess?: () => void
}

/**
 * Quick-fill sheet for registering a manual funnel event. Visual identity
 * mirrors `calendar-event-form.tsx` (right-side on desktop, bottom on
 * mobile, translucent blurred surface) so this stays cohesive with the
 * rest of the app.
 */
export function FunnelManualEventDialog({
  open,
  onOpenChange,
  consultantId,
  funnel,
  stageKey,
  onSuccess,
}: Props) {
  const isMobile = useIsMobile()
  const [submitting, setSubmitting] = useState(false)
  const [occurredAt, setOccurredAt] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 16)
  })
  const [notes, setNotes] = useState('')

  const stageDef = stageKey ? getStageDef(funnel, stageKey) : undefined
  const funnelLabel = funnel === 'buyer' ? 'Compradores' : 'Vendedores'

  async function handleSubmit() {
    if (!stageKey) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/goals/funnel/manual-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultant_id: consultantId,
          funnel_type: funnel,
          stage_key: stageKey,
          occurred_at: new Date(occurredAt).toISOString(),
          notes: notes || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Erro ao registar')
      toast.success('Evento registado')
      setNotes('')
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registar')
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
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[480px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
          <SheetHeader className="p-0 gap-0">
            <p className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">
              Funil {funnelLabel}
            </p>
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10 mt-1">
              Registar manualmente
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-1.5">
              Etapa: <span className="font-medium text-foreground">{stageDef?.label ?? '—'}</span>
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-5">
          <div className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur-sm p-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="occurred_at" className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">
                Quando aconteceu
              </Label>
              <Input
                id="occurred_at"
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="rounded-xl bg-background/80"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">
                Notas (opcional)
              </Label>
              <Textarea
                id="notes"
                rows={3}
                maxLength={500}
                placeholder="Breve descrição do evento..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-xl bg-background/80 resize-none"
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Vai ficar marcado como{' '}
            <span className="font-medium text-amber-700 bg-amber-50/80 border border-amber-200/60 rounded-full px-1.5 py-0.5">
              manual
            </span>{' '}
            para distinção dos eventos detectados automaticamente.
          </p>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 px-6 pb-5 pt-3 border-t border-border/30 bg-background/40">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="rounded-full h-9 text-xs"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-full h-9 text-xs"
          >
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Registar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
