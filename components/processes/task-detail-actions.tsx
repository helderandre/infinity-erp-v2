'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TaskUploadAction } from './task-upload-action'
import { SubtaskCardList } from './subtask-card-list'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  PlayCircle,
  CheckCircle2,
  Ban,
  RotateCcw,
  Mail,
  FileText,
  ExternalLink,
  Download,
  Send,
  MailCheck,
  MailOpen,
  MousePointerClick,
  MailX,
  AlertCircle,
  Clock,
  ShieldAlert,
  Lock,
  Plus,
  Upload,
  CheckSquare,
  FormInput,
  Type,
  CalendarPlus,
  ClipboardList,
} from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { cn, formatDate } from '@/lib/utils'
import { wrapEmailHtml } from '@/lib/email-renderer'
import { useUser } from '@/hooks/use-user'
import { useEmailStatus } from '@/hooks/use-email-status'
import { EMAIL_STATUS_CONFIG } from '@/lib/constants'
import { ADHOC_TASK_ROLES } from '@/lib/auth/roles'
import { SubtaskConfigDialog } from '@/components/templates/subtask-config-dialog'
import type { ProcessTask, ProcessInstance, ProcessDocument, ProcessOwner } from '@/types/process'
import type { ProcSubtask } from '@/types/subtask'

const EMAIL_STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Mail, MailCheck, MailOpen, MousePointerClick, MailX, AlertCircle, Clock, ShieldAlert,
}

interface TaskDetailActionsProps {
  task: ProcessTask
  processId: string
  propertyId: string
  consultantId?: string
  property?: ProcessInstance['property']
  processDocuments?: ProcessDocument[]
  owners?: ProcessOwner[]
  onTaskUpdate: () => void
}

export function TaskDetailActions({
  task,
  processId,
  propertyId,
  consultantId,
  property,
  processDocuments = [],
  owners = [],
  onTaskUpdate,
}: TaskDetailActionsProps) {
  const { user } = useUser()
  const [isProcessing, setIsProcessing] = useState(false)
  const [showBypassInput, setShowBypassInput] = useState(false)
  const [bypassReason, setBypassReason] = useState('')
  const [addSubtaskOpen, setAddSubtaskOpen] = useState(false)
  const [addSubtaskType, setAddSubtaskType] = useState<string>('checklist')
  const [deletingSubtask, setDeletingSubtask] = useState<ProcSubtask | null>(null)
  const [isDeletingSubtask, setIsDeletingSubtask] = useState(false)

  const userRole = (user as any)?.role?.name as string | undefined
  const canManageAdhoc = !!userRole && ADHOC_TASK_ROLES.includes(userRole as any)

  const SUBTASK_TYPE_OPTIONS = [
    { type: 'checklist', label: 'Checklist', icon: CheckSquare },
    { type: 'upload', label: 'Upload de Documento', icon: Upload },
    { type: 'email', label: 'Email', icon: Mail },
    { type: 'generate_doc', label: 'Gerar Documento', icon: FileText },
    { type: 'form', label: 'Formulário', icon: FormInput },
    { type: 'field', label: 'Campo', icon: Type },
    { type: 'schedule_event', label: 'Agendar Evento', icon: CalendarPlus },
    { type: 'external_form', label: 'Formulário Externo', icon: ClipboardList },
  ]

  const openAddSubtask = (type: string) => {
    setAddSubtaskType(type)
    setAddSubtaskOpen(true)
  }

  // Email status + resend
  const { emails: emailLogs } = useEmailStatus(task.action_type === 'EMAIL' ? task.id : null)
  const latestEmail = emailLogs[0]
  const canResendEmail = task.status === 'completed' && task.action_type === 'EMAIL' && !!latestEmail
  const [isResendingEmail, setIsResendingEmail] = useState(false)

  const handleResendEmail = async () => {
    if (!latestEmail) return
    setIsResendingEmail(true)
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${task.id}/resend-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ log_email_id: latestEmail.id }),
        }
      )
      if (!res.ok) throw new Error('Falha ao reenviar')
      toast.success('Email reenviado com sucesso!')
    } catch {
      toast.error('Erro ao reenviar email')
    } finally {
      setIsResendingEmail(false)
    }
  }

  // Email send dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailForm, setEmailForm] = useState({
    senderName: '',
    senderEmail: '',
    recipientEmail: '',
    cc: '',
    subject: '',
    body: '',
  })

  const mainOwnerId = owners.find((o) => o.is_main_contact)?.id || owners[0]?.id

  const handleAction = async (action: string, extra?: Record<string, unknown>) => {
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/processes/${processId}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao executar acção')
      }
      toast.success('Tarefa actualizada com sucesso!')
      onTaskUpdate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao executar acção')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBypassSubmit = async () => {
    if (bypassReason.length < 10) return
    await handleAction('bypass', { bypass_reason: bypassReason })
    setShowBypassInput(false)
    setBypassReason('')
  }

  const handleOpenEmailDialog = () => {
    const config = task.config as Record<string, unknown> | null
    const mainOwner = owners.find((o) => o.is_main_contact) || owners[0]
    setEmailForm({
      senderName: user?.commercial_name || '',
      senderEmail: user?.professional_email || '',
      recipientEmail: mainOwner?.email || '',
      cc: '',
      subject: config?.subject ? String(config.subject) : '',
      body: config?.body_html ? String(config.body_html) : '',
    })
    setEmailDialogOpen(true)
  }

  const handleSendEmail = async () => {
    setIsSendingEmail(true)
    try {
      const ccList = emailForm.cc
        ? emailForm.cc.split(',').map((e) => e.trim()).filter(Boolean)
        : []

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderName: emailForm.senderName,
            senderEmail: emailForm.senderEmail,
            recipientEmail: emailForm.recipientEmail,
            ...(ccList.length > 0 && { cc: ccList }),
            subject: emailForm.subject,
            body: wrapEmailHtml(emailForm.body),
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao enviar email')
      }

      const sendData = await res.json()

      toast.success('Email enviado com sucesso!')
      setEmailDialogOpen(false)
      await handleAction('complete', {
        resend_email_id: sendData.id,
        email_metadata: {
          sender_email: emailForm.senderEmail,
          sender_name: emailForm.senderName,
          recipient_email: emailForm.recipientEmail,
          cc: emailForm.cc ? emailForm.cc.split(',').map((e: string) => e.trim()).filter(Boolean) : [],
          subject: emailForm.subject,
          body_html: wrapEmailHtml(emailForm.body),
        },
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar email')
    } finally {
      setIsSendingEmail(false)
    }
  }

  const handleAddSubtask = async (subtaskData: any) => {
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${task.id}/subtasks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: subtaskData.title,
            is_mandatory: subtaskData.is_mandatory ?? true,
            order_index: (task.subtasks?.length ?? 0),
            priority: subtaskData.priority || 'normal',
            config: {
              type: subtaskData.type || 'checklist',
              ...subtaskData.config,
            },
            owner_id: subtaskData.config?.owner_id || undefined,
          }),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao adicionar subtarefa')
      }
      toast.success('Subtarefa adicionada com sucesso!')
      setAddSubtaskOpen(false)
      onTaskUpdate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar subtarefa')
    }
  }

  const handleDeleteSubtask = async () => {
    if (!deletingSubtask) return
    setIsDeletingSubtask(true)
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${task.id}/subtasks/${deletingSubtask.id}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao remover subtarefa')
      }
      toast.success('Subtarefa removida com sucesso!')
      setDeletingSubtask(null)
      onTaskUpdate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover subtarefa')
    } finally {
      setIsDeletingSubtask(false)
    }
  }

  // Render action-type specific content
  const renderActionContent = () => {
    switch (task.action_type) {
      case 'UPLOAD': {
        const config = task.config as Record<string, unknown> | null
        const docTypeId = config?.doc_type_id as string | undefined

        // Completed/skipped: show the uploaded document
        if (['completed', 'skipped'].includes(task.status ?? '')) {
          const taskResult = task.task_result as Record<string, unknown> | null
          const docRegistryId = taskResult?.doc_registry_id as string | undefined
          const linkedDoc = docRegistryId
            ? processDocuments.find((d) => d.id === docRegistryId)
            : undefined

          if (!linkedDoc) return null

          return (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-emerald-600" />
                <span className="font-medium">Documento Associado</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/40">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{linkedDoc.file_name}</p>
                    <p className="text-xs text-muted-foreground">{linkedDoc.doc_type?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a href={linkedDoc.file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a href={linkedDoc.file_url} download={linkedDoc.file_name}>
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )
        }

        if (!docTypeId) return null

        return (
          <TaskUploadAction
            taskId={task.id}
            processId={processId}
            propertyId={propertyId}
            docTypeId={docTypeId}
            docTypeName={(config?.doc_type_name as string) || task.title}
            allowedExtensions={
              (config?.allowed_extensions as string[]) || [
                'pdf',
                'jpg',
                'jpeg',
                'png',
                'doc',
                'docx',
              ]
            }
            existingDocs={processDocuments}
            ownerId={task.owner_id || mainOwnerId}
            onCompleted={onTaskUpdate}
          />
        )
      }

      case 'COMPOSITE':
      case 'FORM': {
        return (
          <div className="space-y-3">
            {task.subtasks && task.subtasks.length > 0 && (
              <SubtaskCardList
                task={task as ProcessTask & { subtasks: ProcSubtask[] }}
                processId={processId}
                propertyId={propertyId}
                consultantId={consultantId}
                property={property}
                owners={owners}
                processDocuments={processDocuments}
                canDeleteAdhocSubtask={canManageAdhoc}
                onSubtaskToggle={async (taskId, subtaskId, completed) => {
                  const res = await fetch(
                    `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtaskId}`,
                    {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ is_completed: completed }),
                    }
                  )
                  if (!res.ok) throw new Error('Erro ao actualizar subtarefa')
                }}
                onTaskUpdate={onTaskUpdate}
                onDeleteSubtask={(subtask) => setDeletingSubtask(subtask)}
              />
            )}
            {canManageAdhoc && !['completed', 'skipped'].includes(task.status ?? '') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Subtarefa
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  {SUBTASK_TYPE_OPTIONS.map(opt => (
                    <DropdownMenuItem key={opt.type} onClick={() => openAddSubtask(opt.type)}>
                      <opt.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )
      }

      case 'EMAIL': {
        const config = task.config as Record<string, unknown> | null
        if (!config) return null

        return (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Template de Email</span>
            </div>
            {config.subject ? (
              <div className="text-sm">
                <span className="text-muted-foreground">Assunto: </span>
                <span className="font-medium">{String(config.subject)}</span>
              </div>
            ) : null}
            {config.body_html ? (
              <div
                className="text-sm text-muted-foreground prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: String(config.body_html) }}
              />
            ) : null}
          </div>
        )
      }

      case 'GENERATE_DOC': {
        const config = task.config as Record<string, unknown> | null
        if (!config) return null

        return (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-violet-600" />
              <span className="font-medium">Template de Documento</span>
            </div>
            {config.doc_name ? (
              <p className="text-sm text-muted-foreground">
                {String(config.doc_name)}
              </p>
            ) : null}
          </div>
        )
      }

      default:
        // For MANUAL or other types, allow adding subtasks ad-hoc
        if (canManageAdhoc && !['completed', 'skipped'].includes(task.status ?? '')) {
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Subtarefa
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                {SUBTASK_TYPE_OPTIONS.map(opt => (
                  <DropdownMenuItem key={opt.type} onClick={() => openAddSubtask(opt.type)}>
                    <opt.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
        return null
    }
  }

  const isBlocked = !!task.is_blocked

  // Render state transition buttons
  const renderStateButtons = () => {
    if (isBlocked && !['completed', 'skipped'].includes(task.status ?? '')) {
      return (
        <div className="flex items-start gap-2 text-sm text-primary">
          <Lock className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <span>Acções bloqueadas — aguarda conclusão de dependência</span>
            {task.blocking_task_title && (
              <p className="text-xs text-primary/70 mt-0.5">
                Depende de: <strong>{task.blocking_task_title}</strong>
              </p>
            )}
          </div>
        </div>
      )
    }

    if (task.status === 'completed') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            Tarefa concluída em {formatDate(task.completed_at)}
          </div>
          {canResendEmail && (() => {
            const emailStatus = latestEmail?.last_event
            const statusConfig = emailStatus ? EMAIL_STATUS_CONFIG[emailStatus] : null
            const StatusIcon = statusConfig ? EMAIL_STATUS_ICONS[statusConfig.icon] : null
            return (
              <div className="flex items-center gap-2">
                <Badge
                  variant={statusConfig?.badgeVariant || 'secondary'}
                  className="gap-1 text-xs"
                >
                  {StatusIcon && <StatusIcon className={cn('h-3 w-3', statusConfig?.color)} />}
                  {statusConfig?.label || emailStatus}
                </Badge>
                <Button variant="outline" size="sm" onClick={handleResendEmail} disabled={isResendingEmail}>
                  {isResendingEmail ? <Spinner variant="infinite" size={14} className="mr-1.5" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
                  Reenviar
                </Button>
              </div>
            )
          })()}
          {canManageAdhoc && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('reset')}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Spinner variant="infinite" size={16} className="mr-2" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Reabrir Tarefa
            </Button>
          )}
        </div>
      )
    }

    if (task.status === 'skipped') {
      return (
        <div className="space-y-2">
          {task.bypass_reason && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Motivo da dispensa: </span>
              {task.bypass_reason}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('reset')}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Spinner variant="infinite" size={16} className="mr-2" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Reactivar
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {task.status === 'pending' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('start')}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Spinner variant="infinite" size={16} className="mr-2" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              Iniciar
            </Button>
          )}

          {task.action_type === 'EMAIL' ? (
            <Button
              size="sm"
              onClick={handleOpenEmailDialog}
              disabled={isProcessing}
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar Email
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => handleAction('complete')}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Spinner variant="infinite" size={16} className="mr-2" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Concluir
            </Button>
          )}

          {!task.is_mandatory && !showBypassInput && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBypassInput(true)}
              disabled={isProcessing}
            >
              <Ban className="mr-2 h-4 w-4" />
              Dispensar
            </Button>
          )}
        </div>

        {/* Inline bypass input */}
        {showBypassInput && (
          <div className="space-y-2 rounded-lg border p-3">
            <Textarea
              placeholder="Motivo da dispensa (mín. 10 caracteres)..."
              value={bypassReason}
              onChange={(e) => setBypassReason(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleBypassSubmit}
                disabled={isProcessing || bypassReason.length < 10}
              >
                {isProcessing ? (
                  <Spinner variant="infinite" size={16} className="mr-2" />
                ) : (
                  <Ban className="mr-2 h-4 w-4" />
                )}
                Confirmar Dispensa
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowBypassInput(false)
                  setBypassReason('')
                }}
                disabled={isProcessing}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const isEmailFormValid =
    emailForm.senderName.trim() &&
    emailForm.senderEmail.trim() &&
    emailForm.recipientEmail.trim() &&
    emailForm.subject.trim() &&
    emailForm.body.trim()

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Acções</h4>

      {/* Action-type specific content — disabled overlay when blocked */}
      {isBlocked && !['completed', 'skipped'].includes(task.status ?? '') ? (
        <div className="relative">
          <div className="pointer-events-none opacity-40 select-none" aria-disabled="true">
            {renderActionContent()}
          </div>
        </div>
      ) : (
        renderActionContent()
      )}

      {/* State transition buttons */}
      {renderStateButtons()}

      {/* Add Subtask Dialog */}
      {addSubtaskOpen && (
        <SubtaskConfigDialog
          open={addSubtaskOpen}
          onOpenChange={setAddSubtaskOpen}
          subtask={{ id: '', title: '', is_mandatory: true, order_index: 0, type: addSubtaskType as any, config: {} }}
          docTypes={[]}
          docTypesByCategory={{}}
          emailTemplates={[]}
          docTemplates={[]}
          sameTaskSubtasks={[]}
          mode="adhoc"
          availableOwners={owners?.map((o) => ({
            id: o.id,
            name: o.name,
            person_type: o.person_type as 'singular' | 'coletiva',
            nif: o.nif || undefined,
          })) || []}
          onSave={(data) => handleAddSubtask(data)}
        />
      )}

      {/* Delete Subtask Confirmation */}
      <AlertDialog open={!!deletingSubtask} onOpenChange={(open) => { if (!open) setDeletingSubtask(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover subtarefa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende remover a subtarefa &ldquo;{deletingSubtask?.title}&rdquo;? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSubtask}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteSubtask}
              disabled={isDeletingSubtask}
            >
              {isDeletingSubtask ? 'A remover...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Send Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Enviar Email
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Remetente */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="senderName">Nome do remetente</Label>
                <Input
                  id="senderName"
                  value={emailForm.senderName}
                  onChange={(e) => setEmailForm((f) => ({ ...f, senderName: e.target.value }))}
                  placeholder="Ex: Infinity Group"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="senderEmail">
                  Email do remetente
                  {!emailForm.senderEmail && (
                    <span className="ml-1 text-xs text-destructive">*</span>
                  )}
                </Label>
                <Input
                  id="senderEmail"
                  type="email"
                  value={emailForm.senderEmail}
                  onChange={(e) => setEmailForm((f) => ({ ...f, senderEmail: e.target.value }))}
                  placeholder="noreply@dominio.pt"
                />
              </div>
            </div>

            {/* Destinatário + CC */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="recipientEmail">
                  Para
                  {!emailForm.recipientEmail && (
                    <span className="ml-1 text-xs text-destructive">*</span>
                  )}
                </Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  value={emailForm.recipientEmail}
                  onChange={(e) => setEmailForm((f) => ({ ...f, recipientEmail: e.target.value }))}
                  placeholder="destinatario@exemplo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc">CC <span className="text-xs text-muted-foreground">(separar por vírgula)</span></Label>
                <Input
                  id="cc"
                  value={emailForm.cc}
                  onChange={(e) => setEmailForm((f) => ({ ...f, cc: e.target.value }))}
                  placeholder="cc1@exemplo.com, cc2@exemplo.com"
                />
              </div>
            </div>

            {/* Assunto */}
            <div className="space-y-1.5">
              <Label htmlFor="subject">
                Assunto
                {!emailForm.subject && (
                  <span className="ml-1 text-xs text-destructive">*</span>
                )}
              </Label>
              <Input
                id="subject"
                value={emailForm.subject}
                onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Assunto do email..."
              />
            </div>

            {/* Corpo */}
            <div className="space-y-1.5">
              <Label>Corpo do email</Label>
              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="h-8 mb-2">
                  <TabsTrigger value="preview" className="text-xs h-7">Pré-visualização</TabsTrigger>
                  <TabsTrigger value="source" className="text-xs h-7">Fonte HTML</TabsTrigger>
                </TabsList>
                <TabsContent value="preview">
                  {emailForm.body ? (
                    <div
                      className="rounded-md border p-3 text-sm prose prose-sm max-w-none max-h-48 overflow-y-auto bg-white"
                      dangerouslySetInnerHTML={{ __html: emailForm.body }}
                    />
                  ) : (
                    <div className="rounded-md border p-3 text-sm text-muted-foreground italic">
                      Sem corpo configurado no template.
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="source">
                  <Textarea
                    value={emailForm.body}
                    onChange={(e) => setEmailForm((f) => ({ ...f, body: e.target.value }))}
                    placeholder="Corpo do email em HTML..."
                    className="min-h-[120px] font-mono text-xs"
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEmailDialogOpen(false)}
              disabled={isSendingEmail}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={isSendingEmail || !isEmailFormValid}
            >
              {isSendingEmail ? (
                <Spinner variant="infinite" size={16} className="mr-2" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
