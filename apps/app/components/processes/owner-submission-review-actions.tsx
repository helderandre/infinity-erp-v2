'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { CheckCircle2, XCircle, FileSignature, Eye, Inbox } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'

interface OwnerSubmission {
  id: string
  file_name: string
  file_url: string
  status: 'under_review' | 'approved' | 'rejected' | 'signed'
  owner_id: string | null
  owner_name: string | null
  doc_type_name: string | null
  uploaded_via:
    | 'owner_angariacao_checklist'
    | 'owner_app'
    | 'owner_smart_batch_upload'
    | null
  signature_method: 'canvas_png_stamped' | null
  signed_from_subtask_id: string | null
  notes: string | null
  created_at: string
}

interface Props {
  processId: string
  taskId: string
  subtaskId: string
  onUpdate?: () => void
}

export function OwnerSubmissionReviewActions({
  processId,
  taskId,
  subtaskId,
  onUpdate,
}: Props) {
  const [submissions, setSubmissions] = useState<OwnerSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtaskId}/owner-submissions`,
        { cache: 'no-store' }
      )
      if (!res.ok) {
        setSubmissions([])
        return
      }
      const json = await res.json()
      setSubmissions(json.submissions ?? [])
    } finally {
      setLoading(false)
    }
  }, [processId, taskId, subtaskId])

  useEffect(() => {
    refetch()
  }, [refetch])

  const handleApprove = async (docId: string, isCmi: boolean) => {
    setPendingId(docId)
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtaskId}/review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_id: docId, action: 'approve' }),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error ?? 'Erro ao aprovar')
        return
      }
      toast.success(isCmi ? 'Assinatura aceite.' : 'Documento aprovado.')
      await refetch()
      onUpdate?.()
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro de rede')
    } finally {
      setPendingId(null)
    }
  }

  const handleReject = async () => {
    if (!rejectDialogId) return
    if (rejectReason.trim().length < 5) {
      toast.error('Motivo deve ter pelo menos 5 caracteres.')
      return
    }
    setPendingId(rejectDialogId)
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtaskId}/review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doc_id: rejectDialogId,
            action: 'reject',
            reason: rejectReason.trim(),
          }),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error ?? 'Erro ao rejeitar')
        return
      }
      toast.success('Documento rejeitado e proprietário notificado.')
      setRejectDialogId(null)
      setRejectReason('')
      await refetch()
      onUpdate?.()
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro de rede')
    } finally {
      setPendingId(null)
    }
  }

  // Hide entire UI when there's nothing to review (avoids cluttering cards with no owner submissions)
  const hasUnderReview = submissions.some((s) => s.status === 'under_review' || s.status === 'signed')

  if (loading) return null
  if (submissions.length === 0) return null
  if (!hasUnderReview) return null

  return (
    <>
      <div className="rounded-md border border-amber-200 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/20 p-2 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          <Inbox className="h-3.5 w-3.5" />
          <span>Submissões do proprietário</span>
        </div>
        {submissions
          .filter((s) => s.status === 'under_review' || s.status === 'signed')
          .map((sub) => {
            const isCmi = sub.signature_method === 'canvas_png_stamped'
            const busy = pendingId === sub.id
            return (
              <div
                key={sub.id}
                className="rounded-md border bg-card p-2 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-xs font-medium truncate">{sub.file_name}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'h-5 px-1.5 py-0 text-[10px] font-normal',
                          isCmi
                            ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'
                            : 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400'
                        )}
                      >
                        {isCmi ? (
                          <span className="inline-flex items-center gap-1">
                            <FileSignature className="h-2.5 w-2.5" />
                            CMI assinado pelo proprietário
                          </span>
                        ) : (
                          'Enviado pelo proprietário via app'
                        )}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {sub.owner_name ?? 'Proprietário'}
                      {sub.doc_type_name ? ` · ${sub.doc_type_name}` : ''}
                      {' · '}
                      {formatDateTime(sub.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    asChild
                  >
                    <a
                      href={sub.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir documento"
                      aria-label="Abrir documento"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 text-xs rounded-full flex-1"
                    onClick={() => handleApprove(sub.id, isCmi)}
                    disabled={busy}
                  >
                    {busy ? (
                      <Spinner variant="infinite" size={12} className="mr-1.5" />
                    ) : (
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    )}
                    {isCmi ? 'Aceitar assinatura' : 'Aprovar'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs rounded-full text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 dark:border-red-800 dark:hover:border-red-700"
                    onClick={() => {
                      setRejectDialogId(sub.id)
                      setRejectReason('')
                    }}
                    disabled={busy}
                  >
                    <XCircle className="mr-1 h-3.5 w-3.5" />
                    Rejeitar
                  </Button>
                </div>
              </div>
            )
          })}
      </div>

      <Dialog open={!!rejectDialogId} onOpenChange={(open) => !open && setRejectDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar documento</DialogTitle>
            <DialogDescription>
              Indique o motivo. O proprietário será notificado para corrigir.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ex.: Documento ilegível, página em falta, validade expirada..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {rejectReason.trim().length < 5
              ? `Faltam ${5 - rejectReason.trim().length} caracteres`
              : 'Pronto a enviar'}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogId(null)
                setRejectReason('')
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectReason.trim().length < 5 || pendingId !== null}
            >
              {pendingId !== null ? (
                <Spinner variant="infinite" size={12} className="mr-1.5" />
              ) : null}
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
