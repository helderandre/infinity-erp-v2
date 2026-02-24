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
import { Check, X, Undo2, AlertCircle, FileStack, Loader2 } from 'lucide-react'
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

  const loadTemplates = async () => {
    setIsLoadingTemplates(true)
    try {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error('Erro ao carregar templates')
      const data = await res.json()
      // Filtrar apenas templates activos
      const activeTemplates = data.filter((t: any) => t.is_active !== false)
      setTemplates(activeTemplates)

      // Se só houver 1 template activo, pré-seleccionar
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
      <Card className="border-amber-500/20 bg-amber-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            {isReturned ? 'Processo Devolvido' : 'Aguarda Aprovação'}
          </CardTitle>
          <CardDescription>
            {isReturned
              ? 'Este processo foi devolvido e aguarda correcções'
              : 'Reveja as informações, seleccione o template e aprove ou devolva o processo'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isReturned && process.returned_reason && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Motivo da devolução:</strong>
                <p className="mt-1">{process.returned_reason}</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Selecção de Template */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileStack className="h-4 w-4" />
              Template de Processo *
            </Label>
            {isLoadingTemplates ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                A carregar templates...
              </div>
            ) : templates.length === 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum template de processo activo encontrado.
                  Crie um template antes de aprovar.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar template de processo..." />
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

                {/* Info do template seleccionado */}
                {selectedTemplate && selectedTemplate.description && (
                  <p className="text-xs text-muted-foreground">
                    {selectedTemplate.description}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Botões de acção */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleApproveClick}
              disabled={isProcessing || !selectedTemplateId || templates.length === 0}
              className="flex-1 min-w-[120px]"
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Aprovar Processo
            </Button>

            <Button
              variant="outline"
              onClick={() => setReturnDialogOpen(true)}
              disabled={isProcessing}
              className="flex-1 min-w-[120px]"
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Devolver
            </Button>

            {!isReturned && (
              <Button
                variant="destructive"
                onClick={() => setRejectDialogOpen(true)}
                disabled={isProcessing}
                className="flex-1 min-w-[120px]"
              >
                <X className="mr-2 h-4 w-4" />
                Rejeitar
              </Button>
            )}
          </div>

          <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t">
            <p><strong>Consultor:</strong> {process.requested_by_user?.commercial_name || '—'}</p>
            {process.started_at && (
              <p><strong>Data de Início:</strong> {new Date(process.started_at).toLocaleDateString('pt-PT')}</p>
            )}
            {owners?.length > 0 && (
              <p><strong>Proprietários:</strong> {owners.length}</p>
            )}
            {documents?.length > 0 && (
              <p><strong>Documentos:</strong> {documents.length} anexado{documents.length > 1 ? 's' : ''}</p>
            )}
          </div>
        </CardContent>
      </Card>

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
