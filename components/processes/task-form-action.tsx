// @deprecated — Substituído por SubtaskCardList + cards individuais (subtask-card-*.tsx)
'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ClipboardList,
  CheckCircle2,
  Circle,
  ChevronDown,
  ExternalLink,
  Upload,
  Mail,
  FileText,
  CheckSquare,
  Eye,
  MailCheck,
  MailOpen,
  MousePointerClick,
  MailX,
  AlertCircle,
  Clock,
  ShieldAlert,
} from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { cn } from '@/lib/utils'
import { SUBTASK_TYPE_LABELS, EMAIL_STATUS_CONFIG } from '@/lib/constants'
import { useEmailStatus } from '@/hooks/use-email-status'
import { SubtaskEmailSheet } from './subtask-email-sheet'
import { SubtaskDocSheet } from './subtask-doc-sheet'
import type { ProcessTask, ProcessOwner } from '@/types/process'
import type { ProcSubtask } from '@/types/subtask'

const EMAIL_STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Mail, MailCheck, MailOpen, MousePointerClick, MailX, AlertCircle, Clock, ShieldAlert,
}

interface TaskFormActionProps {
  task: ProcessTask & { subtasks: ProcSubtask[] }
  processId: string
  propertyId: string
  owners?: ProcessOwner[]
  onSubtaskToggle: (taskId: string, subtaskId: string, completed: boolean) => Promise<void>
  onTaskUpdate: () => void
}

export function TaskFormAction({
  task,
  processId,
  propertyId,
  owners = [],
  onSubtaskToggle,
  onTaskUpdate,
}: TaskFormActionProps) {
  const [open, setOpen] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const { emails } = useEmailStatus(task.id)
  const [openEmailSubtask, setOpenEmailSubtask] = useState<ProcSubtask | null>(null)
  const [openEmailOwnerEmail, setOpenEmailOwnerEmail] = useState<string>('')
  const [openDocSubtask, setOpenDocSubtask] = useState<ProcSubtask | null>(null)

  const subtasks = task.subtasks || []
  const completedCount = subtasks.filter((s) => s.is_completed).length
  const totalCount = subtasks.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Determina se uma subtarefa é de toggle manual (checklist)
  const isManualSubtask = (subtask: ProcSubtask) => {
    const config = subtask.config || ({} as any)
    if (config.type === 'checklist') return true
    if (config.check_type === 'manual') return true
    return false
  }

  const getSubtaskType = (subtask: ProcSubtask): string => {
    const config = subtask.config || ({} as any)
    if (config.type) return config.type
    if (config.check_type === 'manual') return 'checklist'
    if (config.check_type === 'document') return 'upload'
    if (config.check_type === 'field') return 'checklist'
    return 'checklist'
  }

  const SUBTASK_ICON_MAP: Record<string, React.ReactNode> = {
    upload: <Upload className="h-3.5 w-3.5 text-blue-500" />,
    checklist: <CheckSquare className="h-3.5 w-3.5 text-slate-500" />,
    email: <Mail className="h-3.5 w-3.5 text-amber-500" />,
    generate_doc: <FileText className="h-3.5 w-3.5 text-purple-500" />,
  }

  const handleToggle = async (subtask: ProcSubtask) => {
    if (!isManualSubtask(subtask)) return

    setToggling(subtask.id)
    try {
      await onSubtaskToggle(task.id, subtask.id, !subtask.is_completed)
      onTaskUpdate()
    } catch {
      // Error handled by parent
    } finally {
      setToggling(null)
    }
  }

  const handleSubtaskComplete = () => {
    onTaskUpdate()
  }

  return (
    <>
      <div className="rounded-lg border bg-card/50 p-3 space-y-3">
        {/* Header */}
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
            <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-xs font-medium text-muted-foreground">
              {completedCount} de {totalCount} items completos
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground transition-transform',
                open && 'rotate-180'
              )}
            />
          </CollapsibleTrigger>

          {/* Progress bar */}
          <Progress value={progress} className="h-1.5 mt-2" />

          <CollapsibleContent>
            <div className="mt-3 space-y-1.5">
              {subtasks.map((subtask) => {
                const isManual = isManualSubtask(subtask)
                const subtaskType = getSubtaskType(subtask)
                const isLoading = toggling === subtask.id
                const isEmail = subtaskType === 'email'
                const isDoc = subtaskType === 'generate_doc'
                const hasAction = isEmail || isDoc
                const hasRendered = !!(subtask.config as Record<string, unknown>).rendered

                return (
                  <div
                    key={subtask.id}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                      subtask.is_completed && 'opacity-60'
                    )}
                  >
                    {/* Checkbox ou ícone de estado */}
                    {isManual ? (
                      <div className="shrink-0">
                        {isLoading ? (
                          <Spinner variant="infinite" size={16} className="text-muted-foreground" />
                        ) : (
                          <Checkbox
                            checked={subtask.is_completed}
                            onCheckedChange={() => handleToggle(subtask)}
                            className="h-4 w-4"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="shrink-0">
                        {subtask.is_completed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    )}

                    {/* Ícone do tipo */}
                    <div className="shrink-0">
                      {SUBTASK_ICON_MAP[subtaskType] || (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Título */}
                    <span
                      className={cn(
                        'flex-1 text-xs',
                        subtask.is_completed && 'line-through text-muted-foreground'
                      )}
                    >
                      {subtask.title}
                    </span>

                    {/* Badge de proprietário */}
                    {subtask.owner && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] px-1.5 py-0 shrink-0',
                          subtask.owner.person_type === 'singular'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        )}
                      >
                        {subtask.owner.person_type === 'singular' ? '👤' : '🏢'}{' '}
                        {subtask.owner.name}
                      </Badge>
                    )}

                    {/* Badges de tipo */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!isManual && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {SUBTASK_TYPE_LABELS[subtaskType] || 'Auto'}
                        </Badge>
                      )}
                      {!subtask.is_mandatory && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          Opcional
                        </Badge>
                      )}
                      {(() => {
                        // Show email status badge if email subtask is completed
                        if (isEmail && subtask.is_completed) {
                          const emailForSubtask = emails.find(e => e.proc_subtask_id === subtask.id)
                          const emailStatus = emailForSubtask?.last_event
                          if (emailStatus) {
                            const statusConfig = EMAIL_STATUS_CONFIG[emailStatus]
                            const StatusIcon = statusConfig ? EMAIL_STATUS_ICONS[statusConfig.icon] : null
                            return (
                              <Badge
                                variant={statusConfig?.badgeVariant || 'secondary'}
                                className="gap-0.5 text-[10px] px-1 py-0"
                              >
                                {StatusIcon && <StatusIcon className={cn('h-2.5 w-2.5', statusConfig?.color)} />}
                                {statusConfig?.label || emailStatus}
                              </Badge>
                            )
                          }
                        }
                        // Show draft badge for non-completed actions with rendered content
                        if (hasRendered && hasAction) {
                          return (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200"
                            >
                              Rascunho
                            </Badge>
                          )
                        }
                        return null
                      })()}
                    </div>

                    {/* Botão Ver (email / generate_doc) */}
                    {hasAction && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => {
                          if (isEmail) {
                            const ownerEmail = owners.find((o) => o.id === subtask.owner_id)?.email || ''
                            setOpenEmailOwnerEmail(ownerEmail)
                            setOpenEmailSubtask(subtask)
                          } else {
                            setOpenDocSubtask(subtask)
                          }
                        }}
                        title={isEmail ? 'Ver email' : 'Ver documento'}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Link para o proprietário */}
            {task.owner?.id && (
              <div className="mt-3 pt-2 border-t">
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
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Sheets de email e documento */}
      {openEmailSubtask && (
        <SubtaskEmailSheet
          subtask={openEmailSubtask}
          propertyId={propertyId}
          processId={processId}
          taskId={task.id}
          ownerEmail={openEmailOwnerEmail}
          open={!!openEmailSubtask}
          onOpenChange={(v) => { if (!v) setOpenEmailSubtask(null) }}
          onComplete={handleSubtaskComplete}
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
          onComplete={handleSubtaskComplete}
          onSaveDraft={onTaskUpdate}
        />
      )}
    </>
  )
}
