'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, X, Undo2, AlertCircle, FileStack, Settings2 } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { usePermissions } from '@/hooks/use-permissions'
import type { ProcessInstance, ProcessOwner, ProcessDocument } from '@/types/process'

interface TemplateOption {
  id: string
  name: string
  description: string | null
  stages_count: number
  tasks_count: number
}

interface ProcessReviewSectionProps {
  process: ProcessInstance
  property: ProcessInstance['property']
  owners: ProcessOwner[]
  documents: ProcessDocument[]
  onApprove: (tplProcessId?: string) => Promise<void>
  onReturn: (reason: string) => Promise<void>
  onReject: (reason: string) => Promise<void>
}

export function ProcessReviewSection({
  process,
  onApprove,
  onReturn,
  onReject,
}: ProcessReviewSectionProps) {
  const { isBroker } = usePermissions()
  const canOverrideTemplate = isBroker()

  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Admin-only manual override state
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)

  const processType = (process as any).process_type as string | undefined

  useEffect(() => {
    if (!overrideOpen || templates.length > 0) return
    setIsLoadingTemplates(true)
    fetch('/api/templates')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const active = (data || []).filter((t: any) => {
          if (t.is_active === false) return false
          if (processType && t.process_type && t.process_type !== processType) return false
          return true
        })
        setTemplates(active)
      })
      .catch(() => setTemplates([]))
      .finally(() => setIsLoadingTemplates(false))
  }, [overrideOpen, processType, templates.length])

  const handleApproveAuto = async () => {
    setIsProcessing(true)
    try {
      await onApprove()
    } finally {
      setIsProcessing(false)
    }
  }

  const handleApproveOverride = async () => {
    if (!selectedTemplateId) return
    setIsProcessing(true)
    try {
      await onApprove(selectedTemplateId)
      setOverrideOpen(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReturnSubmit = async () => {
    if (returnReason.length < 10) {
      return
    }

    setIsProcessing(true)
    try {
      await onReturn(returnReason)
      setReturnDialogOpen(false)
      setReturnReason('')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRejectSubmit = async () => {
    if (rejectReason.length < 10) {
      return
    }

    setIsProcessing(true)
    try {
      await onReject(rejectReason)
      setRejectDialogOpen(false)
      setRejectReason('')
    } finally {
      setIsProcessing(false)
    }
  }

  const isReturned = process.current_status === 'returned'

  return (
    <>
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/5 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0" />
          <h3 className="text-sm font-semibold text-foreground">
            {isReturned ? 'Processo Devolvido' : 'Aguarda Aprovação'}
          </h3>
        </div>

        {isReturned && process.returned_reason && (
          <div className="rounded-md border border-amber-200 dark:border-amber-500/20 bg-white/60 dark:bg-background/40 px-3 py-2">
            <p className="text-xs font-medium text-foreground">Motivo da devolução:</p>
            <p className="text-xs text-muted-foreground mt-0.5">{process.returned_reason}</p>
          </div>
        )}

        {/* Action buttons — compact */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={handleApproveAuto} disabled={isProcessing}>
            {isProcessing ? (
              <Spinner variant="infinite" size={14} className="mr-1.5" />
            ) : (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            )}
            Aprovar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setReturnDialogOpen(true)}
            disabled={isProcessing}
          >
            <Undo2 className="mr-1.5 h-3.5 w-3.5" />
            Devolver
          </Button>

          {!isReturned && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRejectDialogOpen(true)}
              disabled={isProcessing}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Rejeitar
            </Button>
          )}

          {canOverrideTemplate && (
            <button
              type="button"
              onClick={() => setOverrideOpen(true)}
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              disabled={isProcessing}
            >
              <Settings2 className="h-3 w-3" />
              Aprovar com template específico
            </button>
          )}
        </div>

        {process.requested_by_user && (
          <p className="text-[11px] text-muted-foreground">
            Solicitado por <strong>{process.requested_by_user.commercial_name}</strong>
            {process.started_at && (
              <> em {new Date(process.started_at).toLocaleDateString('pt-PT')}</>
            )}
          </p>
        )}
      </div>

      {/* Dialog de Devolução */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver Processo</DialogTitle>
            <DialogDescription>
              Indique o motivo da devolução (mínimo 10 caracteres)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ex: Falta caderneta predial, documentos de identificação..."
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReturnDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReturnSubmit}
              disabled={isProcessing || returnReason.length < 10}
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Devolver Processo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Rejeição */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Processo</DialogTitle>
            <DialogDescription>
              Esta acção é irreversível. Indique o motivo da rejeição (mínimo 10 caracteres)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ex: Imóvel não cumpre requisitos, documentação irregular..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={isProcessing || rejectReason.length < 10}
            >
              <X className="mr-2 h-4 w-4" />
              Rejeitar Processo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin-only: manual template override */}
      {canOverrideTemplate && (
        <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aprovar com template específico</DialogTitle>
              <DialogDescription>
                Por defeito o sistema escolhe o template automaticamente. Use esta opção apenas se precisar de aplicar um template diferente.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <FileStack className="h-3.5 w-3.5" />
                Template de Processo
              </Label>
              {isLoadingTemplates ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Spinner variant="infinite" size={14} />
                  A carregar templates...
                </div>
              ) : templates.length === 0 ? (
                <p className="text-xs text-destructive">Nenhum template activo encontrado.</p>
              ) : (
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Seleccionar template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        <div className="flex items-center gap-2">
                          <span>{tpl.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({tpl.stages_count} fases, {tpl.tasks_count} tarefas)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOverrideOpen(false)} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button onClick={handleApproveOverride} disabled={isProcessing || !selectedTemplateId}>
                {isProcessing ? (
                  <Spinner variant="infinite" size={14} className="mr-1.5" />
                ) : (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                )}
                Aprovar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
