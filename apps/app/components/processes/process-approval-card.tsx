'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Check, X, Undo2, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'

interface ProcessApprovalCardProps {
  processId: string
  status: string
  returnedReason?: string | null
  externalRef?: string | null
  onChanged?: () => void
}

/**
 * Cartão de aprovação para processos `pending_approval` ou `returned`.
 * Visível apenas a roles em PROCESS_MANAGER_ROLES (Broker/CEO, Gestor
 * Processual, admin). Acções:
 *   • Aprovar → POST /api/processes/[id]/approve (corre `autoActivateProcess`)
 *   • Devolver (com motivo) → POST /api/processes/[id]/return
 *   • Rejeitar (com motivo) → POST /api/processes/[id]/reject
 */
export function ProcessApprovalCard({
  processId,
  status,
  returnedReason,
  externalRef,
  onChanged,
}: ProcessApprovalCardProps) {
  const router = useRouter()
  const { user } = useUser()
  const [isApproving, setIsApproving] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const roleName = user?.role?.name ?? ''
  const canManage = (PROCESS_MANAGER_ROLES as readonly string[]).some(
    (r) => r.toLowerCase() === roleName.toLowerCase()
  )

  if (!canManage) return null
  if (!['pending_approval', 'returned'].includes(status)) return null

  const isReturned = status === 'returned'

  const refresh = () => {
    onChanged?.()
    router.refresh()
  }

  const approve = async () => {
    setIsApproving(true)
    try {
      const res = await fetch(`/api/processes/${processId}/approve`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Erro ao aprovar')
      toast.success(`Processo aprovado${body.template_name ? ` · ${body.template_name}` : ''}`)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aprovar')
    } finally {
      setIsApproving(false)
    }
  }

  const submitReturn = async () => {
    if (returnReason.trim().length < 5) {
      toast.error('Motivo demasiado curto (mínimo 5 caracteres)')
      return
    }
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/processes/${processId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: returnReason.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Erro ao devolver')
      toast.success('Processo devolvido ao consultor')
      setReturnOpen(false)
      setReturnReason('')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao devolver')
    } finally {
      setIsProcessing(false)
    }
  }

  const submitReject = async () => {
    if (rejectReason.trim().length < 5) {
      toast.error('Motivo demasiado curto (mínimo 5 caracteres)')
      return
    }
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/processes/${processId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Erro ao rejeitar')
      toast.success('Processo rejeitado')
      setRejectOpen(false)
      setRejectReason('')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao rejeitar')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <div
        className={cn(
          'rounded-2xl border p-4 sm:p-5 shadow-sm',
          isReturned
            ? 'border-amber-300/60 bg-amber-50/40 dark:border-amber-800/60 dark:bg-amber-950/20'
            : 'border-blue-300/60 bg-blue-50/40 dark:border-blue-800/60 dark:bg-blue-950/20',
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'shrink-0 h-9 w-9 rounded-xl flex items-center justify-center',
              isReturned
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
            )}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold tracking-tight">
              {isReturned ? 'Processo devolvido — re-submetido' : 'Aguarda aprovação'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {isReturned
                ? 'O consultor corrigiu o pedido. Revê e aprova ou rejeita.'
                : `Revê os dados${externalRef ? ` de ${externalRef}` : ''} e decide.`}
            </p>
            {isReturned && returnedReason && (
              <div className="mt-2 rounded-lg border border-amber-200/60 bg-background/60 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                  Motivo da última devolução
                </p>
                <p className="text-xs text-foreground/90 whitespace-pre-wrap">{returnedReason}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={approve}
            disabled={isApproving || isProcessing}
            className="h-9 rounded-full px-4 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isApproving ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> A aprovar…</>
            ) : (
              <><Check className="h-3.5 w-3.5" /> Aprovar</>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setReturnOpen(true)}
            disabled={isApproving || isProcessing}
            className="h-9 rounded-full px-4 gap-1.5"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Devolver
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setRejectOpen(true)}
            disabled={isApproving || isProcessing}
            className="h-9 rounded-full px-4 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            <X className="h-3.5 w-3.5" />
            Rejeitar
          </Button>
        </div>
      </div>

      {/* Devolver dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver ao consultor</DialogTitle>
            <DialogDescription>
              O consultor recebe o processo de volta para corrigir e re-submeter. Indica o que precisa de mudar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="return-reason">Motivo da devolução</Label>
            <Textarea
              id="return-reason"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Ex.: falta a caderneta predial, comissão acordada não está clara…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button onClick={submitReturn} disabled={isProcessing || returnReason.trim().length < 5}>
              {isProcessing ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> A enviar…</> : 'Devolver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejeitar dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar processo</DialogTitle>
            <DialogDescription>
              A rejeição é definitiva: o processo fica como <strong>rejected</strong> e o imóvel volta a aguardar aprovação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Motivo da rejeição</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex.: documentação inválida, fora do scope da agência…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={submitReject}
              disabled={isProcessing || rejectReason.trim().length < 5}
            >
              {isProcessing ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> A enviar…</> : 'Rejeitar definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
