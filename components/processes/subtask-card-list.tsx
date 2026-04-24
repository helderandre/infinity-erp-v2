'use client'

import { useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ClipboardList, ExternalLink, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { Badge } from '@/components/ui/badge'
import { getComponentForSubtaskKey } from '@/lib/processes/subtasks/components-registry'
import { GroupedSubtasksView } from './grouped-subtasks-view'
import { SubtaskCardChecklist } from './subtask-card-checklist'
import { SubtaskCardEmail } from './subtask-card-email'
import { SubtaskCardDoc } from './subtask-card-doc'
import { SubtaskCardUpload } from './subtask-card-upload'
import { SubtaskCardForm } from './subtask-card-form'
import { SubtaskCardField } from './subtask-card-field'
import { SubtaskCardScheduleEvent } from './subtask-card-schedule-event'
import { FormSubtaskDialog } from './form-subtask-dialog'
import { SubtaskEmailSheet } from './subtask-email-sheet'
import { SubtaskDocSheet } from './subtask-doc-sheet'
import { SubtaskPdfSheet } from './subtask-pdf-sheet'
import { SubtaskCardExternalForm } from './subtask-card-external-form'
import { SubtaskCardWhatsApp } from './subtask-card-whatsapp'
import { SubtaskWhatsAppSheet } from './subtask-whatsapp-sheet'
import { ExternalFormDialog } from './external-form-dialog'
import type { ProcessTask, ProcessInstance, ProcessOwner, ProcessDocument } from '@/types/process'
import type { ProcSubtask } from '@/types/subtask'
import type { Deal, DealClient, DealPayment } from '@/types/deal'

interface SubtaskCardListProps {
  task: ProcessTask & { subtasks: ProcSubtask[] }
  processId: string
  propertyId: string
  consultantId?: string
  property?: ProcessInstance['property']
  processInstance?: ProcessInstance
  owners?: ProcessOwner[]
  processDocuments?: ProcessDocument[]
  deal?: (Deal & { deal_clients?: DealClient[]; deal_payments?: DealPayment[] }) | null
  canDeleteAdhocSubtask?: boolean
  /** Skip upload subtasks — useful when a parent view (e.g. DocumentsChecklistCard) already renders them */
  excludeUploadSubtasks?: boolean
  onSubtaskToggle: (taskId: string, subtaskId: string, completed: boolean) => Promise<void>
  onTaskUpdate: () => void
  onDeleteSubtask?: (subtask: ProcSubtask) => void
}

export function SubtaskCardList({
  task,
  processId,
  propertyId,
  consultantId,
  property,
  processInstance,
  owners = [],
  processDocuments = [],
  deal,
  canDeleteAdhocSubtask,
  excludeUploadSubtasks = false,
  onSubtaskToggle,
  onTaskUpdate,
  onDeleteSubtask,
}: SubtaskCardListProps) {
  const { emails } = useEmailStatus(task.id)
  const [openEmailSubtask, setOpenEmailSubtask] = useState<ProcSubtask | null>(null)
  const [openEmailOwnerEmail, setOpenEmailOwnerEmail] = useState('')
  const [openDocSubtask, setOpenDocSubtask] = useState<ProcSubtask | null>(null)
  const [openPdfSubtask, setOpenPdfSubtask] = useState<ProcSubtask | null>(null)
  const [openFormSubtask, setOpenFormSubtask] = useState<ProcSubtask | null>(null)
  const [viewFormSubtask, setViewFormSubtask] = useState<ProcSubtask | null>(null)
  const [revertTarget, setRevertTarget] = useState<string | null>(null)
  const [openExternalFormSubtask, setOpenExternalFormSubtask] = useState<ProcSubtask | null>(null)
  const [isCompletingExternalForm, setIsCompletingExternalForm] = useState(false)
  const [openWhatsAppSubtask, setOpenWhatsAppSubtask] = useState<ProcSubtask | null>(null)

  const getSubtaskType = (subtask: ProcSubtask): string => {
    const config = subtask.config || {} as Record<string, unknown>
    if (config.type) return config.type as string
    if (config.check_type === 'manual') return 'checklist'
    if (config.check_type === 'document') return 'upload'
    if (config.check_type === 'field') return 'checklist'
    return 'checklist'
  }

  const rawSubtasks = task.subtasks || []
  const subtasks = excludeUploadSubtasks
    ? rawSubtasks.filter((s) => getSubtaskType(s) !== 'upload')
    : rawSubtasks
  const completedCount = subtasks.filter(s => s.is_completed).length
  const totalCount = subtasks.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Empty state — render nothing when upload subtasks are excluded and no other subtasks remain
  if (subtasks.length === 0) {
    if (excludeUploadSubtasks) return null
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ClipboardList className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Sem subtarefas definidas.</p>
      </div>
    )
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

  const [resetTemplateTarget, setResetTemplateTarget] = useState<string | null>(null)

  const handleResetTemplate = async (subtaskId: string) => {
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${task.id}/subtasks/${subtaskId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reset_template: true }),
        }
      )
      if (res.ok) {
        onTaskUpdate()
        toast.success('Template resetado para o original')
      } else {
        toast.error('Erro ao resetar template')
      }
    } catch {
      toast.error('Erro ao resetar template')
    }
    setResetTemplateTarget(null)
  }

  const handleOpenEmailSheet = (subtask: ProcSubtask) => {
    const ownerEmail = owners.find(o => o.id === subtask.owner_id)?.email || ''
    setOpenEmailOwnerEmail(ownerEmail)
    setOpenEmailSubtask(subtask)
  }

  const mainOwnerId = owners.find(o => o.is_main_contact)?.id || owners[0]?.id

  const renderCard = (subtask: ProcSubtask) => {
    // Hardcoded rules (add-hardcoded-process-subtasks): resolve componente
    // do registry via `subtask_key`. Fallback silencioso para o switch
    // legacy em linhas `legacy_*` ou keys não registadas.
    const HardcodedComponent = subtask.subtask_key
      ? getComponentForSubtaskKey(subtask.subtask_key)
      : null
    if (HardcodedComponent) {
      return (
        <HardcodedComponent
          key={subtask.id}
          subtask={subtask as unknown as import('@/lib/processes/subtasks/types').ProcSubtaskRow}
          processId={processId}
          onComplete={async (body) => {
            const res = await fetch(
              `/api/processes/${processId}/subtasks/${subtask.id}/complete`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined,
              }
            )
            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              toast.error(err?.error || 'Erro ao concluir subtarefa')
              return
            }
            onTaskUpdate()
          }}
        />
      )
    }

    const type = getSubtaskType(subtask)

    switch (type) {
      case 'email': {
        // Rules hardcoded hybrid (config.hardcoded=true) mostram o title
        // completo ("Email - Mariano") + badge de person_type para manter
        // contexto visual em linhas per-owner. Default ("Email", sem badge)
        // preserva a UX original de subtasks legacy one-shot.
        const isHardcoded = Boolean((subtask.config as Record<string, unknown>)?.hardcoded)
        const ownerPersonType = subtask.owner?.person_type
        const label = isHardcoded ? subtask.title : undefined
        const badge = isHardcoded && ownerPersonType ? (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-medium px-1.5 py-0 h-5',
              ownerPersonType === 'singular'
                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900'
                : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900'
            )}
          >
            {ownerPersonType === 'singular' ? 'Singular' : 'Coletivo'}
          </Badge>
        ) : undefined
        return (
          <SubtaskCardEmail
            key={subtask.id}
            subtask={subtask}
            ownerEmail={owners.find(o => o.id === subtask.owner_id)?.email || ''}
            emails={emails}
            label={label}
            badge={badge}
            onOpenSheet={handleOpenEmailSheet}
            onRevert={(id) => setRevertTarget(id)}
            onResend={handleResend}
            onResetTemplate={(id) => setResetTemplateTarget(id)}
          />
        )
      }
      case 'generate_doc': {
        // Rules hardcoded hybrid → variante compacta (estilo SubtaskCardEmail)
        // com ícone FileSignature + label custom + badge de person_type.
        const isHardcoded = Boolean((subtask.config as Record<string, unknown>)?.hardcoded)
        const ownerPersonType = subtask.owner?.person_type
        const docLabel = isHardcoded ? subtask.title : undefined
        const docBadge = isHardcoded && ownerPersonType ? (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-medium px-1.5 py-0 h-5',
              ownerPersonType === 'singular'
                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900'
                : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900'
            )}
          >
            {ownerPersonType === 'singular' ? 'Singular' : 'Coletivo'}
          </Badge>
        ) : undefined
        return (
          <SubtaskCardDoc
            key={subtask.id}
            subtask={subtask}
            compact={isHardcoded}
            label={docLabel}
            badge={docBadge}
            onOpenSheet={async (s) => {
              // Check template_type to decide which sheet to open
              const c = s.config as Record<string, unknown>
              let docLibId = c.doc_library_id as string | undefined
              if (c.has_person_type_variants) {
                const pt = (s as unknown as { owner?: { person_type?: string } }).owner?.person_type
                if (pt === 'singular') docLibId = (c.singular_config as Record<string, string> | undefined)?.doc_library_id
                else if (pt === 'coletiva') docLibId = (c.coletiva_config as Record<string, string> | undefined)?.doc_library_id
              }
              if (docLibId) {
                try {
                  const res = await fetch(`/api/libraries/docs/${docLibId}`)
                  if (res.ok) {
                    const tpl = await res.json()
                    if (tpl.template_type === 'pdf') {
                      setOpenPdfSubtask(s)
                      return
                    }
                  }
                } catch { /* fallback to HTML sheet */ }
              }
              setOpenDocSubtask(s)
            }}
            onRevert={(id) => setRevertTarget(id)}
          />
        )
      }
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
      case 'schedule_event':
        return (
          <SubtaskCardScheduleEvent
            key={subtask.id}
            subtask={subtask}
            processId={processId}
            taskId={task.id}
            owners={owners.map(o => ({ id: o.id, name: o.name, person_type: o.person_type }))}
            consultants={[]}
            onRefresh={onTaskUpdate}
          />
        )
      case 'external_form':
        return (
          <SubtaskCardExternalForm
            key={subtask.id}
            subtask={subtask}
            onOpenDialog={(s) => setOpenExternalFormSubtask(s)}
            onRevert={(id) => setRevertTarget(id)}
          />
        )
      case 'whatsapp':
        return (
          <SubtaskCardWhatsApp
            key={subtask.id}
            subtask={subtask}
            ownerPhone={owners.find(o => o.id === subtask.owner_id)?.phone || ''}
            onOpenSheet={(s) => setOpenWhatsAppSubtask(s)}
            onRevert={(id) => setRevertTarget(id)}
            onResend={handleResend}
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

  // Tasks hardcoded (add-hardcoded-process-subtasks + split 2026-05-02)
  // usam vista agrupada com grupos por entidade (Imóvel / Pessoa Colectiva /
  // Pessoa Singular). Resto continua flat.
  const GROUPED_TASK_TITLES = new Set([
    'Documentos do Imóvel',
    'Documentos Pessoa Colectiva',
    'Documentos Pessoa Singular',
  ])
  const useGroupedView = GROUPED_TASK_TITLES.has(task.title)

  return (
    <>
      <div className="space-y-3">
        {useGroupedView ? (
          <GroupedSubtasksView
            subtasks={subtasks}
            owners={owners}
            renderCard={renderCard}
          />
        ) : (
        <div className="rounded-xl border bg-card/50 overflow-hidden divide-y">
          {subtasks.map((subtask, idx) => {
            const isAdhocSubtask = !subtask.tpl_subtask_id
            return (
              <div key={subtask.id} className="group flex py-2 pr-3">
                {/* Step number */}
                <div className="flex items-start pt-2 pl-3 pr-2 shrink-0">
                  <span className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums',
                    subtask.is_completed
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {idx + 1}
                  </span>
                </div>
                {/* Subtask content */}
                <div className="relative flex-1 min-w-0">
                  {renderCard(subtask)}
                  {/* Adhoc controls: Manual tag + delete — inside the card */}
                  {isAdhocSubtask && canDeleteAdhocSubtask && !subtask.is_completed && (
                    <div className="absolute top-1 right-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onDeleteSubtask?.(subtask)}
                        title="Remover subtarefa manual"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        )}

        {/* Link para proprietário */}
        {task.owner?.id && (
          <div className="pt-2 border-t">
            <Button variant="outline" size="sm" className="w-full text-xs rounded-full" asChild>
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

      {/* Reset template confirmation dialog */}
      <AlertDialog open={!!resetTemplateTarget} onOpenChange={(open) => { if (!open) setResetTemplateTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar template de email</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende resetar o email para o template original? Todas as edições feitas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => resetTemplateTarget && handleResetTemplate(resetTemplateTarget)}
            >
              Resetar Template
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
          consultantId={consultantId}
          ownerEmail={openEmailOwnerEmail}
          open={!!openEmailSubtask}
          onOpenChange={(v) => { if (!v) setOpenEmailSubtask(null) }}
          onComplete={() => onTaskUpdate()}
          onSaveDraft={onTaskUpdate}
          onResetTemplate={onTaskUpdate}
        />
      )}

      {openDocSubtask && (
        <SubtaskDocSheet
          subtask={openDocSubtask}
          propertyId={propertyId}
          processId={processId}
          taskId={task.id}
          consultantId={consultantId}
          open={!!openDocSubtask}
          onOpenChange={(v) => { if (!v) setOpenDocSubtask(null) }}
          onComplete={() => onTaskUpdate()}
          onSaveDraft={onTaskUpdate}
        />
      )}

      {openPdfSubtask && (
        <SubtaskPdfSheet
          subtask={openPdfSubtask}
          propertyId={propertyId}
          processId={processId}
          taskId={task.id}
          consultantId={consultantId}
          open={!!openPdfSubtask}
          onOpenChange={(v) => { if (!v) setOpenPdfSubtask(null) }}
          onComplete={() => onTaskUpdate()}
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

      {openWhatsAppSubtask && (
        <SubtaskWhatsAppSheet
          subtask={openWhatsAppSubtask}
          processId={processId}
          taskId={task.id}
          ownerPhone={owners.find(o => o.id === openWhatsAppSubtask.owner_id)?.phone || ''}
          ownerName={owners.find(o => o.id === openWhatsAppSubtask.owner_id)?.name}
          ownerPersonType={owners.find(o => o.id === openWhatsAppSubtask.owner_id)?.person_type}
          open={!!openWhatsAppSubtask}
          onOpenChange={(v) => { if (!v) setOpenWhatsAppSubtask(null) }}
          onComplete={() => {
            onTaskUpdate()
            setOpenWhatsAppSubtask(null)
          }}
        />
      )}

      {openExternalFormSubtask && (
        <ExternalFormDialog
          open={!!openExternalFormSubtask}
          onOpenChange={(v) => { if (!v) setOpenExternalFormSubtask(null) }}
          subtask={openExternalFormSubtask}
          property={property}
          owner={
            owners.find(o => o.id === openExternalFormSubtask.owner_id)
            || owners.find(o => o.is_main_contact)
            || owners[0]
          }
          processInstance={processInstance}
          processDocuments={processDocuments}
          deal={deal}
          isCompleting={isCompletingExternalForm}
          onComplete={async () => {
            setIsCompletingExternalForm(true)
            try {
              await onSubtaskToggle(task.id, openExternalFormSubtask.id, true)
              onTaskUpdate()
              setOpenExternalFormSubtask(null)
            } finally {
              setIsCompletingExternalForm(false)
            }
          }}
        />
      )}
    </>
  )
}
