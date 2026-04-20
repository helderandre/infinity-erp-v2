'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Loader2, SlidersHorizontal, CalendarDays, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTaskMutations } from '@/hooks/use-tasks'
import { parseTaskDateFromTitle } from '@/lib/tasks/parse-date'
import { buildDueShort } from '@/components/tasks/task-primitives'

interface TaskQuickAddProps {
  onCreated: () => void
  onOpenFullForm: () => void
  taskListId?: string | null
  section?: string | null
  placeholder?: string
  autoFocus?: boolean
  onCancel?: () => void
}

export function TaskQuickAdd({
  onCreated,
  onOpenFullForm,
  taskListId,
  section,
  placeholder,
  autoFocus,
  onCancel,
}: TaskQuickAddProps) {
  const [open, setOpen] = useState(!!autoFocus)
  const [title, setTitle] = useState('')
  const [manualDate, setManualDate] = useState<Date | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { createTask } = useTaskMutations()

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Parse date from title in real time; manualDate overrides parsed date when set
  const parsed = useMemo(() => parseTaskDateFromTitle(title), [title])
  const effectiveDate = manualDate ?? parsed.date
  const displayTitle = parsed.cleanedTitle

  const reset = () => {
    setTitle('')
    setManualDate(null)
    setOpen(false)
    onCancel?.()
  }

  const submit = async () => {
    const t = parsed.cleanedTitle.trim() || title.trim()
    if (!t) return
    setIsSubmitting(true)
    try {
      await createTask({
        title: t,
        priority: 4,
        ...(effectiveDate && { due_date: effectiveDate.toISOString() }),
        ...(taskListId && { task_list_id: taskListId }),
        ...(section && { section }),
      })
      toast.success('Tarefa criada')
      setTitle('')
      setManualDate(null)
      onCreated()
      inputRef.current?.focus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar tarefa')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full flex items-center gap-2 px-2.5 py-2 text-[13px] text-muted-foreground',
          'hover:bg-muted/40 rounded-md transition-colors group',
        )}
      >
        <span className="size-[18px] rounded-full border border-muted-foreground/30 group-hover:border-primary group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
          <Plus className="h-3 w-3 group-hover:text-primary" strokeWidth={2.5} />
        </span>
        <span className="group-hover:text-foreground transition-colors">
          Adicionar tarefa
        </span>
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-border/70 bg-card p-2.5 shadow-sm focus-within:border-primary/40 transition-colors">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
          if (e.key === 'Escape') reset()
        }}
        placeholder={placeholder || 'Ex.: Ligar ao cliente amanhã às 15h'}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        disabled={isSubmitting}
      />

      {/* Linha de chips: título limpo preview + data detectada */}
      {(displayTitle !== title || effectiveDate) && (
        <div className="mt-1.5 flex items-center flex-wrap gap-1.5 text-[11px]">
          {effectiveDate && (
            <button
              type="button"
              onClick={() => setManualDate(null)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
                'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                'border border-emerald-500/30 hover:bg-emerald-500/15 transition-colors group',
              )}
              title="Remover data"
            >
              <CalendarDays className="h-3 w-3" />
              <span className="tabular-nums">{buildDueShort(effectiveDate)}</span>
              <X className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
          {displayTitle !== title && displayTitle && (
            <span className="text-muted-foreground/70 truncate">
              → {displayTitle}
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => { onOpenFullForm(); reset() }}
          disabled={isSubmitting}
        >
          <SlidersHorizontal className="h-3 w-3" />
          Mais opções
        </Button>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={reset}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 px-3 text-xs gap-1.5"
            onClick={submit}
            disabled={!title.trim() || isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  )
}
