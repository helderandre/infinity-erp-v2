'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Eye, RotateCcw, Edit, CheckCircle2, FileSignature, Lock } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { DocIcon } from '@/components/icons/doc-icon'
import { SubtaskCardBase, type CardState } from './subtask-card-base'
import type { ProcSubtask } from '@/types/subtask'

interface SubtaskCardDocProps {
  subtask: ProcSubtask
  onOpenSheet: (subtask: ProcSubtask) => void
  onRevert: (subtaskId: string) => void
  /**
   * Compact row variant — mesmo visual de `<SubtaskCardEmail>` com
   * ícone `FileSignature` (geração de documento). Ideal para rules
   * hardcoded hybrid que querem UX minimal + click-to-open sheet.
   */
  compact?: boolean
  /**
   * Override do label in-line (modo compact). Default: "Documento".
   * Rules hybrid passam `subtask.title` (ex.: "CMI - CRIATIVAR").
   */
  label?: string
  /**
   * Nó inline à direita do label (modo compact). Típico:
   * `<Badge>Singular</Badge>` / `<Badge>Coletivo</Badge>`. Mantido
   * visível mesmo depois de concluído.
   */
  badge?: ReactNode
}

export function SubtaskCardDoc({
  subtask, onOpenSheet, onRevert, compact, label, badge,
}: SubtaskCardDocProps) {
  const isBlocked = Boolean(subtask.is_blocked)
  const hasRendered = !!(subtask.config as Record<string, unknown>).rendered
  const state: CardState = subtask.is_completed ? 'completed' : hasRendered ? 'draft' : 'pending'

  // Variante compacta — linha clicável 100%, delega toda a UX para o sheet.
  if (compact) {
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
              : subtask.is_completed
                ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400'
                : hasRendered
                  ? 'bg-sky-500/15 text-sky-500 dark:text-sky-400'
                  : 'bg-amber-500/15 text-amber-500 dark:text-amber-400',
          )}
        >
          {isBlocked ? <Lock className="h-3.5 w-3.5" /> : <FileSignature className="h-3.5 w-3.5" />}
        </div>
        <span className="flex-1 text-sm text-muted-foreground group-hover:text-foreground truncate transition-colors">
          {label ?? 'Documento'}
        </span>
        {badge && <span className="shrink-0">{badge}</span>}
        {subtask.is_completed && (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
        )}
      </button>
    )
  }

  return (
    <SubtaskCardBase
      subtask={subtask}
      state={state}
      icon={<DocIcon className="h-5 w-5" />}
      typeLabel="Documento"
    >
      <div className="space-y-2 text-xs">
        {/* Completion info */}
        {subtask.is_completed && subtask.completed_at && (
          <p className="text-muted-foreground">
            Concluído em {formatDateTime(subtask.completed_at)}
          </p>
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
              {hasRendered ? 'Continuar Edição' : 'Editar Documento'}
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
                Ver
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
