'use client'

import type { ReactNode } from 'react'
import { CheckCircle2, Lock, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProcSubtask } from '@/types/subtask'
import type { LogEmail } from '@/types/process'

interface SubtaskCardEmailProps {
  subtask: ProcSubtask
  // Kept for interface compatibility with SubtaskCardList — no longer rendered inline.
  ownerEmail?: string
  emails?: LogEmail[]
  onOpenSheet: (subtask: ProcSubtask) => void
  onRevert?: (subtaskId: string) => void
  onResend?: (subtask: ProcSubtask) => void
  onResetTemplate?: (subtaskId: string) => void
  /**
   * Override do label in-line. Default: "Email". Rules hardcoded hybrid
   * costumam passar `subtask.title` (ex.: "Email - Mariano") para que o
   * nome do owner apareça na linha sem abrir o sheet.
   */
  label?: string
  /**
   * Nó inline à direita do label, antes do ícone de completion. Típico:
   * `<Badge>Singular</Badge>` / `<Badge>Coletivo</Badge>` em rules
   * hardcoded per-owner. Mantido visível mesmo depois de concluído.
   */
  badge?: ReactNode
}

/**
 * Minimal, fully-clickable row. The entire row is the affordance — no inline
 * "Ver email" button. All email details (subject, recipients, template,
 * delivery status, resend/revert actions) live in the sheet opened on click.
 */
export function SubtaskCardEmail({
  subtask,
  onOpenSheet,
  label,
  badge,
}: SubtaskCardEmailProps) {
  const isBlocked = Boolean(subtask.is_blocked)
  const isCompleted = subtask.is_completed

  return (
    <button
      type="button"
      onClick={() => onOpenSheet(subtask)}
      disabled={isBlocked}
      className={cn(
        'group w-full flex items-center gap-3 py-1 text-left transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full shrink-0 transition-colors',
          isBlocked
            ? 'bg-muted text-muted-foreground'
            : isCompleted
              ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400'
              : 'bg-amber-500/15 text-amber-500 dark:text-amber-400',
        )}
      >
        {isBlocked ? <Lock className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
      </div>
      <span className="flex-1 text-sm text-muted-foreground group-hover:text-foreground truncate transition-colors">
        {label ?? 'Email'}
      </span>
      {badge && <span className="shrink-0">{badge}</span>}
      {isCompleted && (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
      )}
    </button>
  )
}
