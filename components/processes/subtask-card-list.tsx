'use client'

import { useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ClipboardList, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useEmailStatus } from '@/hooks/use-email-status'
import { SubtaskCardChecklist } from './subtask-card-checklist'
import { SubtaskCardEmail } from './subtask-card-email'
import { SubtaskCardDoc } from './subtask-card-doc'
import { SubtaskCardUpload } from './subtask-card-upload'
import { SubtaskCardForm } from './subtask-card-form'
import { SubtaskCardField } from './subtask-card-field'
import { FormSubtaskDialog } from './form-subtask-dialog'
import { SubtaskEmailSheet } from './subtask-email-sheet'
import { SubtaskDocSheet } from './subtask-doc-sheet'
import type { ProcessTask, ProcessOwner, ProcessDocument } from '@/types/process'
import type { ProcSubtask } from '@/types/subtask'

interface SubtaskCardListProps {
  task: ProcessTask & { subtasks: ProcSubtask[] }
  processId: string
  propertyId: string
  owners?: ProcessOwner[]
  processDocuments?: ProcessDocument[]
  onSubtaskToggle: (taskId: string, subtaskId: string, completed: boolean) => Promise<void>
  onTaskUpdate: () => void
}

export function SubtaskCardList({
  task,
  processId,
  propertyId,
  owners = [],
  processDocuments = [],
  onSubtaskToggle,
  onTaskUpdate,
}: SubtaskCardListProps) {
  const { emails } = useEmailStatus(task.id)
  const [openEmailSubtask, setOpenEmailSubtask] = useState<ProcSubtask | null>(null)
  const [openEmailOwnerEmail, setOpenEmailOwnerEmail] = useState('')
  const [openDocSubtask, setOpenDocSubtask] = useState<ProcSubtask | null>(null)
  const [openFormSubtask, setOpenFormSubtask] = useState<ProcSubtask | null>(null)
  const [viewFormSubtask, setViewFormSubtask] = useState<ProcSubtask | null>(null)
  const [revertTarget, setRevertTarget] = useState<string | null>(null)

  const subtasks = task.subtasks || []
  const completedCount = subtasks.filter(s => s.is_completed).length
  const totalCount = subtasks.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Empty state
  if (subtasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ClipboardList className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Sem subtarefas definidas.</p>
      </div>
    )
  }

  const getSubtaskType = (subtask: ProcSubtask): string => {
    const config = subtask.config || {} as Record<string, unknown>
    if (config.type) return config.type as string
    if (config.check_type === 'manual') return 'checklist'
    if (config.check_type === 'document') return 'upload'
    if (config.check_type === 'field') return 'checklist'
    return 'checklist'
  }

  const handleRevert = async (subtaskId: string) => {
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${task.id}/subtasks/${subtaskId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_completed: false }),
        }
      )
      if (res.ok) {
        onTaskUpdate()
        toast.success('Subtarefa revertida')
      } else {
        toast.error('Erro ao reverter subtarefa')
      }
    } catch {
      toast.error('Erro ao reverter subtarefa')
    }
    setRevertTarget(null)
  }

  const handleResend = async (subtask: ProcSubtask) => {
    const emailLog = emails.find(e => e.proc_subtask_id === subtask.id)
    if (!emailLog) {
      toast.error('Nenhum email encontrado para reenviar')
      return
    }
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${task.id}/resend-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ log_email_id: emailLog.id }),
        }
      )
      if (res.ok) {
        toast.success('Email reenviado com sucesso!')
      } else {
        toast.error('Erro ao reenviar email')
      }
    } catch {
      toast.error('Erro ao reenviar email')
    }
  }

  const handleOpenEmailSheet = (subtask: ProcSubtask) => {
    const ownerEmail = owners.find(o => o.id === subtask.owner_id)?.email || ''
    setOpenEmailOwnerEmail(ownerEmail)
    setOpenEmailSubtask(subtask)
  }

  const mainOwnerId = owners.find(o => o.is_main_contact)?.id || owners[0]?.id

  const renderCard = (subtask: ProcSubtask) => {
    const type = getSubtaskType(subtask)

    switch (type) {
      case 'email':
        return (
          <SubtaskCardEmail
            key={subtask.id}
            subtask={subtask}
            ownerEmail={owners.find(o => o.id === subtask.owner_id)?.email || ''}
            emails={emails}
            onOpenSheet={handleOpenEmailSheet}
            onRevert={(id) => setRevertTarget(id)}
            onResend={handleResend}
          />
        )
      case 'generate_doc':
        return (
          <SubtaskCardDoc
            key={subtask.id}
            subtask={subtask}
            onOpenSheet={(s) => setOpenDocSubtask(s)}
            onRevert={(id) => setRevertTarget(id)}
          />
        )
      case 'upload':
        return (
          <SubtaskCardUpload
            key={subtask.id}
            subtask={subtask}
            processId={processId}
            taskId={task.id}
            propertyId={propertyId}
            existingDocs={processDocuments}
            ownerId={subtask.owner_id || mainOwnerId}
            onRevert={(id) => setRevertTarget(id)}
            onTaskUpdate={onTaskUpdate}
          />
        )
      case 'form':
        return (
          <SubtaskCardForm
            key={subtask.id}
            subtask={subtask}
            onOpenSheet={(s) => setOpenFormSubtask(s)}
            onViewSheet={(s) => setViewFormSubtask(s)}
            onRevert={(id) => setRevertTarget(id)}
          />
        )
      case 'field':
        return (
          <SubtaskCardField
            key={subtask.id}
            subtask={subtask}
            processId={processId}
            taskId={task.id}
            onCompleted={async () => {
              await onSubtaskToggle(task.id, subtask.id, true)
              onTaskUpdate()
            }}
          />
        )
      default:
        return (
          <SubtaskCardChecklist
            key={subtask.id}
            subtask={subtask}
            onToggle={async (subtaskId, completed) => {
              await onSubtaskToggle(task.id, subtaskId, completed)
              onTaskUpdate()
            }}
          />
        )
    }
  }

  return (
    <>
      <div className="space-y-3">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-xs font-medium text-muted-foreground">
              {completedCount} de {totalCount} items completos
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Cards */}
        <div className="space-y-2">
          {subtasks.map(renderCard)}
        </div>

        {/* Link para proprietário */}
        {task.owner?.id && (
          <div className="pt-2 border-t">
            <Button variant="outline" size="sm" className="w-full text-xs" asChild>
              <a
                href={`/dashboard/proprietarios/${task.owner.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-1.5 h-3 w-3" />
                Abrir ficha do proprietário
              </a>
            </Button>
          </div>
        )}
      </div>

      {/* Revert confirmation dialog */}
      <AlertDialog open={!!revertTarget} onOpenChange={(open) => { if (!open) setRevertTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverter subtarefa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende reverter esta subtarefa? O estado voltará a pendente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => revertTarget && handleRevert(revertTarget)}
            >
              Reverter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sheets */}
      {openEmailSubtask && (
        <SubtaskEmailSheet
          subtask={openEmailSubtask}
          propertyId={propertyId}
          processId={processId}
          taskId={task.id}
          ownerEmail={openEmailOwnerEmail}
          open={!!openEmailSubtask}
          onOpenChange={(v) => { if (!v) setOpenEmailSubtask(null) }}
          onComplete={() => onTaskUpdate()}
          onSaveDraft={onTaskUpdate}
        />
      )}

      {openDocSubtask && (
        <SubtaskDocSheet
          subtask={openDocSubtask}
          propertyId={propertyId}
          processId={processId}
          taskId={task.id}
          open={!!openDocSubtask}
          onOpenChange={(v) => { if (!v) setOpenDocSubtask(null) }}
          onComplete={() => onTaskUpdate()}
          onSaveDraft={onTaskUpdate}
        />
      )}

      {openFormSubtask && (
        <FormSubtaskDialog
          subtask={openFormSubtask}
          processId={processId}
          taskId={task.id}
          open={!!openFormSubtask}
          onOpenChange={(v) => { if (!v) setOpenFormSubtask(null) }}
          onCompleted={async () => {
            await onSubtaskToggle(task.id, openFormSubtask.id, true)
            onTaskUpdate()
            setOpenFormSubtask(null)
          }}
          onSaved={async () => {
            onTaskUpdate()
          }}
        />
      )}

      {viewFormSubtask && (
        <FormSubtaskDialog
          subtask={viewFormSubtask}
          processId={processId}
          taskId={task.id}
          open={!!viewFormSubtask}
          onOpenChange={(v) => { if (!v) setViewFormSubtask(null) }}
          onCompleted={async () => {}}
          readOnly
        />
      )}
    </>
  )
}
