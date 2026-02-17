'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Check, X, Undo2, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ProcessReviewSectionProps {
  process: any
  property: any
  owners: any[]
  documents: any[]
  onApprove: () => Promise<void>
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

  const handleApproveClick = async () => {
    setIsProcessing(true)
    try {
      await onApprove()
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
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            {isReturned ? 'Processo Devolvido' : 'Aguarda Aprovação'}
          </CardTitle>
          <CardDescription>
            {isReturned
              ? 'Este processo foi devolvido e aguarda correções'
              : 'Reveja as informações e aprove ou devolva o processo'}
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

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleApproveClick}
              disabled={isProcessing}
              className="flex-1 min-w-[120px]"
            >
              <Check className="mr-2 h-4 w-4" />
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
            <p><strong>Data de Criação:</strong> {new Date(process.created_at).toLocaleDateString('pt-PT')}</p>
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
