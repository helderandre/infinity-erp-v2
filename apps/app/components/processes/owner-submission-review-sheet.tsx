'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  CheckCircle2,
  XCircle,
  Download,
  ExternalLink,
  FileSignature,
  AlertTriangle,
  RotateCcw,
  Pencil,
} from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { DocIcon } from '@/components/icons/doc-icon'
import { cn, formatDateTime } from '@/lib/utils'

export interface ReviewSheetDoc {
  id: string
  file_name: string
  file_url: string
  status: string | null
  metadata?: Record<string, any> | null
  doc_type?: { id?: string; name?: string } | null
  created_at?: string | null
  notes?: string | null
  /** Resolvido pelo parent (lookup em property_owners). */
  owner_name?: string | null
}

const UPLOADED_VIA_LABELS: Record<string, string> = {
  owner_angariacao_checklist: 'via app do cliente',
  owner_app: 'via app do cliente',
  owner_smart_batch_upload: 'via app do cliente (envio em lote)',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: ReviewSheetDoc | null
  processId: string
  /** Called after a successful approve/reject so parent refreshes its state. */
  onUpdate?: () => void
}

function classifyExtension(fileName: string): 'pdf' | 'image' | 'office' | 'other' {
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) return 'image'
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office'
  return 'other'
}

export function OwnerSubmissionReviewSheet({
  open,
  onOpenChange,
  doc,
  processId,
  onUpdate,
}: Props) {
  const isMobile = useIsMobile()
  const [pending, setPending] = useState<'approve' | 'reject' | 'reopen' | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const subtaskId = doc?.metadata?.subtask_id as string | undefined
  const procTaskId = doc?.metadata?.proc_task_id as string | undefined
  const signatureMethod = doc?.metadata?.signature_method as string | undefined
  const isCmiSigned = signatureMethod === 'canvas_png_stamped'
  const fileKind = useMemo(
    () => (doc ? classifyExtension(doc.file_name) : 'other'),
    [doc]
  )

  // Proxy with `inline=1` so the browser renders PDFs/images instead of
  // forcing a download (the default attachment disposition).
  const previewUrl = useMemo(() => {
    if (!doc) return ''
    return `/api/documents/proxy?inline=1&url=${encodeURIComponent(doc.file_url)}`
  }, [doc])

  // PDF viewer fragment params: hide thumbnail sidebar (navpanes), fit width,
  // start at 100% zoom. Browsers (Chromium-family) respect these on the
  // built-in PDF viewer.
  const pdfPreviewUrl = useMemo(() => {
    if (!previewUrl) return ''
    return `${previewUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`
  }, [previewUrl])

  const canReview =
    !!doc && !!subtaskId && !!procTaskId &&
    (doc.status === 'under_review' || doc.status === 'signed')

  const canReopen =
    !!doc && !!subtaskId && !!procTaskId &&
    (doc.status === 'approved' || doc.status === 'active')

  async function callReopen() {
    if (!doc || !subtaskId || !procTaskId) return
    setPending('reopen')
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${procTaskId}/subtasks/${subtaskId}/reopen`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_id: doc.id }),
        }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error ?? 'Erro a reabrir subtarefa')
        return
      }
      toast.success('Aprovação revertida — subtarefa voltou a pendente.')
      onUpdate?.()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro de rede')
    } finally {
      setPending(null)
    }
  }

  async function callReview(action: 'approve' | 'reject', reason?: string) {
    if (!doc || !subtaskId || !procTaskId) return
    setPending(action)
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${procTaskId}/subtasks/${subtaskId}/review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doc_id: doc.id,
            action,
            ...(reason ? { reason } : {}),
          }),
        }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error ?? 'Erro a actualizar documento')
        return
      }
      toast.success(
        action === 'approve'
          ? isCmiSigned
            ? 'Assinatura aceite.'
            : 'Documento aprovado.'
          : 'Documento rejeitado e proprietário notificado.'
      )
      onUpdate?.()
      onOpenChange(false)
      setRejectDialogOpen(false)
      setRejectReason('')
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro de rede')
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
            'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
            isMobile
              ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
              : 'w-full data-[side=right]:sm:max-w-[640px] sm:rounded-l-3xl'
          )}
        >
          {isMobile && (
            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
          )}

          <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
            <SheetHeader className="p-0 gap-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10 flex items-center gap-2">
                    {isCmiSigned && (
                      <FileSignature className="h-5 w-5 text-emerald-600 shrink-0" />
                    )}
                    <span className="truncate">
                      {doc?.doc_type?.name ?? doc?.file_name ?? 'Documento'}
                    </span>
                  </SheetTitle>
                  <SheetDescription className="text-xs mt-1 leading-relaxed">
                    {doc?.file_name && doc?.doc_type?.name && (
                      <>
                        <span className="text-muted-foreground">{doc.file_name}</span>
                        <br />
                      </>
                    )}
                    {doc?.owner_name && (
                      <>
                        Enviado por <span className="font-medium text-foreground">{doc.owner_name}</span>
                        {doc?.created_at && <> em {formatDateTime(doc.created_at)}</>}
                      </>
                    )}
                    {!doc?.owner_name && doc?.created_at && (
                      <>Enviado em {formatDateTime(doc.created_at)}</>
                    )}
                    {(() => {
                      const via = doc?.metadata?.uploaded_via as string | undefined
                      const label = via ? UPLOADED_VIA_LABELS[via] : undefined
                      if (!label) return null
                      return (
                        <>
                          {' · '}
                          <span className="text-muted-foreground">{label}</span>
                        </>
                      )
                    })()}
                  </SheetDescription>
                </div>
                {doc && (
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {(() => {
                      const status = (doc.status ?? '').toLowerCase()
                      let label = 'Aguarda revisão'
                      let cls =
                        'border-sky-300/70 bg-sky-50/60 text-sky-700 dark:border-sky-700/60 dark:bg-sky-950/30 dark:text-sky-400'
                      if (status === 'approved' || status === 'active') {
                        label = 'Aprovado'
                        cls =
                          'border-emerald-300/70 bg-emerald-50/60 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/30 dark:text-emerald-400'
                      } else if (status === 'rejected') {
                        label = 'Rejeitado'
                        cls =
                          'border-red-300/70 bg-red-50/60 text-red-700 dark:border-red-700/60 dark:bg-red-950/30 dark:text-red-400'
                      } else if (status === 'signed') {
                        label = 'CMI assinado'
                        cls =
                          'border-emerald-300/70 bg-emerald-50/60 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/30 dark:text-emerald-400'
                      }
                      return (
                        <Badge
                          variant="outline"
                          className={cn('backdrop-blur-sm', cls)}
                        >
                          {label}
                        </Badge>
                      )
                    })()}

                    {canReopen && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-amber-700 hover:text-amber-800 hover:bg-amber-50/60 dark:text-amber-400 dark:hover:bg-amber-950/40"
                        onClick={callReopen}
                        disabled={pending !== null}
                        title="Reabrir para revisão"
                        aria-label="Reabrir para revisão"
                      >
                        {pending === 'reopen' ? (
                          <Spinner variant="infinite" size={14} />
                        ) : (
                          <Pencil className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </SheetHeader>
          </div>

          {/* Preview area */}
          <div className="flex-1 overflow-hidden bg-muted/30 supports-[backdrop-filter]:bg-muted/20 border-y border-border/40">
            {!doc ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Sem documento seleccionado.
              </div>
            ) : fileKind === 'pdf' ? (
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full bg-white"
                title={doc.file_name}
              />
            ) : fileKind === 'image' ? (
              <div className="h-full flex items-center justify-center p-4 overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={doc.file_name}
                  className="max-w-full max-h-full object-contain rounded-md shadow-sm"
                />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                <DocIcon
                  className="h-16 w-16"
                  extension={doc.file_name.split('.').pop()}
                />
                <p className="text-sm font-medium">{doc.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  Pré-visualização não disponível para este formato.
                </p>
                <Button variant="outline" asChild>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={doc.file_name}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descarregar
                  </a>
                </Button>
              </div>
            )}
          </div>

          {/* Footer translúcido */}
          <div className="shrink-0 px-6 py-4 space-y-3 bg-background/60 supports-[backdrop-filter]:bg-background/40 backdrop-blur-xl border-t border-border/40">
            {doc && doc.status === 'rejected' && (
              <div className="rounded-xl border border-red-200/60 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/30 backdrop-blur-sm p-3 text-xs">
                <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 font-medium mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Documento rejeitado
                </div>
                {doc.notes && <p className="text-red-700 dark:text-red-400">{doc.notes}</p>}
              </div>
            )}

            {doc && (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" asChild className="rounded-full bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Abrir em nova janela
                  </a>
                </Button>
                <Button variant="ghost" size="sm" asChild className="rounded-full">
                  <a href={doc.file_url} download={doc.file_name}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Descarregar
                  </a>
                </Button>
              </div>
            )}

            {canReview && (
              <div className="flex items-center gap-2 pt-1">
                <Button
                  className="rounded-full flex-1 shadow-sm"
                  onClick={() => callReview('approve')}
                  disabled={pending !== null}
                >
                  {pending === 'approve' ? (
                    <Spinner variant="infinite" size={14} className="mr-1.5" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  )}
                  {isCmiSigned ? 'Aceitar assinatura' : 'Aprovar'}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full text-red-600 border-red-300/70 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm hover:text-red-700 hover:border-red-400 dark:border-red-800/60 dark:hover:border-red-700"
                  onClick={() => {
                    setRejectDialogOpen(true)
                    setRejectReason('')
                  }}
                  disabled={pending !== null}
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  Rejeitar
                </Button>
              </div>
            )}

            {canReopen && (
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  className="rounded-full flex-1 text-amber-700 border-amber-300/70 bg-amber-50/40 supports-[backdrop-filter]:bg-amber-50/30 backdrop-blur-sm hover:text-amber-800 hover:border-amber-400 dark:border-amber-800/60 dark:hover:border-amber-700 dark:text-amber-400 dark:bg-amber-950/30"
                  onClick={callReopen}
                  disabled={pending !== null}
                >
                  {pending === 'reopen' ? (
                    <Spinner variant="infinite" size={14} className="mr-1.5" />
                  ) : (
                    <RotateCcw className="mr-1.5 h-4 w-4" />
                  )}
                  Reabrir para revisão
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(o) => {
          if (!o && pending !== 'reject') {
            setRejectDialogOpen(false)
            setRejectReason('')
          }
        }}
      >
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
                setRejectDialogOpen(false)
                setRejectReason('')
              }}
              disabled={pending === 'reject'}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => callReview('reject', rejectReason.trim())}
              disabled={rejectReason.trim().length < 5 || pending !== null}
            >
              {pending === 'reject' && (
                <Spinner variant="infinite" size={12} className="mr-1.5" />
              )}
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
