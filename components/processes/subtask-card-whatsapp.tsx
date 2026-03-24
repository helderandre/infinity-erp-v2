'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageCircle, Eye, RotateCcw, Send, Edit } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { SubtaskCardBase, type CardState } from './subtask-card-base'
import type { ProcSubtask } from '@/types/subtask'

const WPP_STATUS_CONFIG: Record<string, { label: string; color: string; badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  sent: { label: 'Enviada', color: 'text-blue-500', badgeVariant: 'secondary' },
  delivered: { label: 'Entregue', color: 'text-emerald-500', badgeVariant: 'secondary' },
  read: { label: 'Lida', color: 'text-emerald-600', badgeVariant: 'secondary' },
  failed: { label: 'Falhou', color: 'text-red-500', badgeVariant: 'destructive' },
}

interface SubtaskCardWhatsAppProps {
  subtask: ProcSubtask
  ownerPhone: string
  onOpenSheet: (subtask: ProcSubtask) => void
  onRevert: (subtaskId: string) => void
  onResend: (subtask: ProcSubtask) => void
}

export function SubtaskCardWhatsApp({
  subtask, ownerPhone, onOpenSheet, onRevert, onResend,
}: SubtaskCardWhatsAppProps) {
  const isBlocked = !!(subtask as any).is_blocked
  const config = subtask.config as Record<string, any>
  const hasRendered = !!config.rendered
  const rendered = config.rendered as { message?: string; phone?: string } | undefined

  const state: CardState = subtask.is_completed ? 'completed' : hasRendered ? 'draft' : 'pending'

  // Message status from task_result
  const taskResult = config.task_result as { status?: string } | undefined
  const msgStatus = taskResult?.status || (subtask.is_completed ? 'sent' : undefined)
  const statusConfig = msgStatus ? WPP_STATUS_CONFIG[msgStatus] : null

  return (
    <SubtaskCardBase
      subtask={subtask}
      state={state}
      icon={<MessageCircle className={cn('h-4 w-4', state === 'completed' ? 'text-emerald-500' : 'text-green-500')} />}
      typeLabel="WhatsApp"
    >
      <div className="space-y-2 text-xs">
        {/* Preview info */}
        {(rendered?.message || ownerPhone) && (
          <div className="space-y-0.5 text-muted-foreground">
            {ownerPhone && <p>Para: <span className="font-medium text-foreground">{ownerPhone}</span></p>}
            {rendered?.message && <p className="line-clamp-2">{rendered.message}</p>}
          </div>
        )}

        {/* Template name */}
        {config.whatsapp_template_name && !rendered?.message && (
          <div className="text-muted-foreground">
            Template: <span className="font-medium text-foreground">{config.whatsapp_template_name as string}</span>
          </div>
        )}

        {/* Status badge */}
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
              className="h-7 text-xs rounded-full"
              onClick={() => onOpenSheet(subtask)}
              disabled={isBlocked}
            >
              <Edit className="mr-1 h-3 w-3" />
              {hasRendered ? 'Editar Mensagem' : 'Preparar Mensagem'}
            </Button>
          )}

          {subtask.is_completed && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-full"
                onClick={() => onOpenSheet(subtask)}
              >
                <Eye className="mr-1 h-3 w-3" />
                Ver Mensagem
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-full"
                onClick={() => onResend(subtask)}
              >
                <Send className="mr-1 h-3 w-3" />
                Reenviar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-orange-600 hover:text-orange-700 rounded-full"
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
