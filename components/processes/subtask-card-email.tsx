'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail, Eye, RotateCcw, Send, Edit } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { EMAIL_STATUS_CONFIG } from '@/lib/constants'
import { SubtaskCardBase, type CardState } from './subtask-card-base'
import type { ProcSubtask } from '@/types/subtask'
import type { LogEmail } from '@/types/process'

const EMAIL_STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Mail,
  // Dynamic icons loaded from EMAIL_STATUS_CONFIG
}

interface SubtaskCardEmailProps {
  subtask: ProcSubtask
  ownerEmail: string
  emails: LogEmail[]
  onOpenSheet: (subtask: ProcSubtask) => void
  onRevert: (subtaskId: string) => void
  onResend: (subtask: ProcSubtask) => void
}

export function SubtaskCardEmail({
  subtask, ownerEmail, emails, onOpenSheet, onRevert, onResend,
}: SubtaskCardEmailProps) {
  const hasRendered = !!(subtask.config as Record<string, unknown>).rendered
  const rendered = (subtask.config as Record<string, unknown>).rendered as Record<string, string> | undefined

  const state: CardState = subtask.is_completed ? 'completed' : hasRendered ? 'draft' : 'pending'

  // Email status from log_emails
  const emailLog = emails.find(e => e.proc_subtask_id === subtask.id)
  const emailStatus = emailLog?.last_event
  const statusConfig = emailStatus ? EMAIL_STATUS_CONFIG[emailStatus] : null

  return (
    <SubtaskCardBase
      subtask={subtask}
      state={state}
      icon={<Mail className={cn('h-4 w-4', state === 'completed' ? 'text-emerald-500' : 'text-amber-500')} />}
      typeLabel="Email"
    >
      <div className="space-y-2 text-xs">
        {/* Preview info */}
        {(rendered?.subject || ownerEmail) && (
          <div className="space-y-0.5 text-muted-foreground">
            {ownerEmail && <p>Para: <span className="font-medium text-foreground">{ownerEmail}</span></p>}
            {rendered?.subject && <p>Assunto: <span className="font-medium text-foreground">{rendered.subject}</span></p>}
          </div>
        )}

        {/* Email status badge */}
        {subtask.is_completed && statusConfig && (
          <div className="flex items-center gap-1.5">
            <Badge
              variant={statusConfig.badgeVariant || 'secondary'}
              className="gap-0.5 text-[10px] px-1.5 py-0"
            >
              <span className={cn('h-2.5 w-2.5', statusConfig.color)}>●</span>
              {statusConfig.label}
            </Badge>
            {subtask.completed_at && (
              <span className="text-muted-foreground">{formatDateTime(subtask.completed_at)}</span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {!subtask.is_completed && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onOpenSheet(subtask)}
            >
              <Edit className="mr-1 h-3 w-3" />
              {hasRendered ? 'Continuar Edição' : 'Editar Email'}
            </Button>
          )}

          {subtask.is_completed && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onOpenSheet(subtask)}
              >
                <Eye className="mr-1 h-3 w-3" />
                Ver Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onResend(subtask)}
              >
                <Send className="mr-1 h-3 w-3" />
                Reenviar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-orange-600 hover:text-orange-700"
                onClick={() => onRevert(subtask.id)}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Reverter
              </Button>
            </>
          )}
        </div>
      </div>
    </SubtaskCardBase>
  )
}
