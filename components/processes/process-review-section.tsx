'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Check, X, Undo2, AlertCircle, FileStack } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  onApprove: (tplProcessId: string) => Promise<void>
  onReturn: (reason: string) => Promise<void>
  onReject: (reason: string) => Promise<void>
}

export function ProcessReviewSection({
  process,
  property,
  owners,
  documents,
  onApprove,
  onReturn,
  onReject,
}: ProcessReviewSectionProps) {
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Estado do template
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)

  // Carregar templates activos ao montar
  useEffect(() => {
    loadTemplates()
  }, [])

  const processType = (process as any).process_type as string | undefined

  const loadTemplates = async () => {
    setIsLoadingTemplates(true)
    try {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error('Erro ao carregar templates')
      const data = await res.json()
      // Filtrar templates activos e compatíveis com o tipo de processo
      const activeTemplates = data.filter((t: any) => {
        if (t.is_active === false) return false
        if (processType && t.process_type && t.process_type !== processType) return false
        return true
      })
      setTemplates(activeTemplates)

      // Auto-select if only 1 compatible template
      if (activeTemplates.length === 1) {
        setSelectedTemplateId(activeTemplates[0].id)
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error)
      setTemplates([])
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  const handleApproveClick = async () => {
    if (!selectedTemplateId) return

    setIsProcessing(true)
    try {
      await onApprove(selectedTemplateId)
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

        {/* Template selector — hidden when auto-selected (single match) */}
        {isLoadingTemplates ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
            <Spinner variant="infinite" size={14} />
            A carregar templates...
          </div>
        ) : templates.length === 0 ? (
          <p className="text-xs text-destructive">
            Nenhum template activo encontrado. Crie um template antes de aprovar.
          </p>
        ) : templates.length > 1 ? (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <FileStack className="h-3.5 w-3.5" />
              Template de Processo *
            </Label>
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
            >
              <SelectTrigger className="h-9 bg-white dark:bg-background">
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
            {selectedTemplate?.description && (
              <p className="text-[11px] text-muted-foreground">{selectedTemplate.description}</p>
            )}
          </div>
        ) : null}

        {/* Action buttons — compact */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleApproveClick}
            disabled={isProcessing || !selectedTemplateId || templates.length === 0}
          >
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
    </>
  )
}
