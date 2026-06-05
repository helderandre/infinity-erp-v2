'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { SubtaskComponentProps } from '@/lib/processes/subtasks/types'

/**
 * Base visual para cards de subtarefas hardcoded.
 *
 * Cada rule entrega o seu próprio Component (pode estender este base
 * para pré-visualização específica), mas o contrato mínimo está aqui:
 * título, meta (owner/due date), acção "Concluir", estado completed.
 *
 * Comportamento de loading/erro vive neste ficheiro para que todos os
 * cards tenham UX consistente.
 */

interface HardcodedCardBaseProps extends SubtaskComponentProps {
  subtitle?: string
  children?: React.ReactNode
}

function formatDueDate(iso: string): string {
  try {
    return format(parseISO(iso), "d 'de' MMMM, HH:mm", { locale: pt })
  } catch {
    return iso
  }
}

export function HardcodedCardBase({
  subtask,
  subtitle,
  children,
  onComplete,
}: HardcodedCardBaseProps) {
  const [loading, setLoading] = useState(false)
  const isCompleted = Boolean(subtask.is_completed)

  async function handleComplete() {
    setLoading(true)
    try {
      await onComplete()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
      <div
        className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
          isCompleted ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-muted-foreground/40'
        }`}
      >
        {isCompleted && <Check className="h-3 w-3" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isCompleted ? 'text-muted-foreground line-through' : ''}`}>
          {subtask.title}
        </p>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        {subtask.due_date && !isCompleted && (
          <p className="mt-1 text-xs text-amber-700">
            Prazo: {formatDueDate(subtask.due_date)}
          </p>
        )}
        {children && <div className="mt-2">{children}</div>}
      </div>

      {!isCompleted && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleComplete}
          disabled={loading}
          className="shrink-0"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Concluir'}
        </Button>
      )}
    </div>
  )
}
