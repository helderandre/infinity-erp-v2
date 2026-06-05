'use client'

/**
 * Secção de acções para eventos de calendário do tipo visita.
 *
 * Mostra os botões correctos consoante o estado da visita e quem é o
 * utilizador autenticado:
 *
 *  - status='proposal' + user é o seller agent → Confirmar / Rejeitar
 *  - status='scheduled' + user é buyer ou seller → Realizada / Não compareceu / Cancelar
 *  - status='completed' + user é o buyer agent → Preencher ficha (link externo)
 *
 * Os endpoints chamados estão documentados em:
 *   - POST /api/visits/[id]/respond
 *   - POST /api/visits/[id]/outcome
 */

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Check, X, Loader2, CheckCircle2, AlertTriangle, XCircle, FileText, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import type { CalendarEvent } from '@/types/calendar'

interface VisitActionsSectionProps {
  event: CalendarEvent
  currentUserId?: string
  onChanged?: () => void
}

type ReasonAction = 'reject' | 'cancel' | null

export function VisitActionsSection({
  event,
  currentUserId,
  onChanged,
}: VisitActionsSectionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reasonAction, setReasonAction] = useState<ReasonAction>(null)
  const [reasonText, setReasonText] = useState('')

  if (!event.visit_id) return null

  const isBuyerAgent = !!currentUserId && event.visit_buyer_agent_id === currentUserId
  const isSellerAgent = !!currentUserId && event.visit_seller_agent_id === currentUserId
  const isInvolved = isBuyerAgent || isSellerAgent

  // Sem acções a oferecer para quem não está envolvido
  if (!isInvolved) return null

  const visitId = event.visit_id
  const propertyId = event.property_id

  // ─── Acções ─────────────────────────────────────────────────────────────
  const respond = async (decision: 'confirm' | 'reject', reason?: string) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/visits/${visitId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision === 'confirm' ? { decision } : { decision, reason }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao responder')
      }
      toast.success(decision === 'confirm' ? 'Visita confirmada' : 'Proposta rejeitada')
      setReasonAction(null)
      setReasonText('')
      onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    } finally {
      setIsSubmitting(false)
    }
  }

  const setOutcome = async (
    outcome: 'completed' | 'no_show' | 'cancelled',
    reason?: string,
  ) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/visits/${visitId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outcome === 'cancelled' ? { outcome, reason } : { outcome }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao registar desfecho')
      }
      const labels = {
        completed: 'Visita marcada como realizada',
        no_show: 'Visita marcada como cliente não compareceu',
        cancelled: 'Visita cancelada',
      }
      toast.success(labels[outcome])
      setReasonAction(null)
      setReasonText('')
      onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  // O botão de Preencher ficha aparece para o buyer agent assim que a visita
  // está marcada como completed. Abre o link público em nova tab — o
  // utilizador pode partilhar com o cliente ou preencher ele próprio no telemóvel.
  const fichaUrl = propertyId ? `/fichas/${propertyId}?visit=${visitId}` : null

  return (
    <>
      <Separator />

      {/* Proposta a aguardar resposta — só o seller agent pode responder */}
      {event.status === 'proposal' && isSellerAgent && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Proposta a aguardar a tua resposta
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => respond('confirm')}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5 border-red-500/30 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
              onClick={() => setReasonAction('reject')}
              disabled={isSubmitting}
            >
              <X className="h-3.5 w-3.5" />
              Rejeitar
            </Button>
          </div>
        </div>
      )}

      {/* Visita aguardando informação ao seller agent ainda */}
      {event.status === 'proposal' && !isSellerAgent && (
        <div className="rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-muted-foreground">
          A aguardar confirmação do consultor da angariação
          {event.visit_seller_agent_name ? ` (${event.visit_seller_agent_name})` : ''}.
        </div>
      )}

      {/* Visita confirmada — registar desfecho */}
      {event.status === 'scheduled' && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Registar desfecho
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 dark:text-emerald-300"
              onClick={() => setOutcome('completed')}
              disabled={isSubmitting}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Realizada
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-orange-500/30 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30 dark:text-orange-300"
              onClick={() => setOutcome('no_show')}
              disabled={isSubmitting}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Não compareceu
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-slate-500/30 text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-950/30 dark:text-slate-300"
              onClick={() => setReasonAction('cancel')}
              disabled={isSubmitting}
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Visita realizada — preencher ficha (buyer agent) */}
      {event.status === 'completed' && isBuyerAgent && fichaUrl && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Ficha de visita
          </p>
          <Button
            size="sm"
            className="w-full gap-1.5"
            asChild
          >
            <a href={fichaUrl} target="_blank" rel="noopener noreferrer">
              <FileText className="h-3.5 w-3.5" />
              Preencher ficha
              <ExternalLink className="h-3 w-3 opacity-70" />
            </a>
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Abre o formulário público numa nova tab. Podes preencher tu próprio
            no telemóvel ou enviar o link ao cliente.
          </p>
        </div>
      )}

      {/* Reason dialog (rejeição ou cancelamento) */}
      <AlertDialog
        open={reasonAction !== null}
        onOpenChange={(o) => { if (!o) { setReasonAction(null); setReasonText('') } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reasonAction === 'reject' ? 'Rejeitar proposta' : 'Cancelar visita'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reasonAction === 'reject'
                ? 'Indica o motivo da rejeição. O consultor do comprador será notificado.'
                : 'Indica o motivo do cancelamento.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder={reasonAction === 'reject'
              ? 'Ex: Imóvel já tem visita marcada nesse horário'
              : 'Ex: Cliente desistiu'}
            rows={3}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!reasonText.trim() || isSubmitting}
              onClick={(e) => {
                e.preventDefault()
                if (reasonAction === 'reject') {
                  respond('reject', reasonText.trim())
                } else if (reasonAction === 'cancel') {
                  setOutcome('cancelled', reasonText.trim())
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
