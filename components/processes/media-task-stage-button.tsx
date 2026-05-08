'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/kibo-ui/spinner'
import { Check, Clock, Images, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { MediaTaskSheet } from '@/components/tasks/media-task-sheet'

interface Props {
  processId: string
  /** Quando false, esconde o botão. Tipicamente passado pelo caller que
   *  já decidiu visibilidade (gestão + angariação + primeira stage). */
  visible?: boolean
}

interface MediaTaskRow {
  id: string
  is_completed: boolean
  due_date: string | null
}

/**
 * Botão "Tarefa Media" no header da primeira stage do processo.
 *
 * Comportamento idempotente:
 *  - Mount → GET /api/processes/[id]/media-task: descobre se já existe.
 *  - Click sem tarefa → POST cria + abre o <MediaTaskSheet>.
 *  - Click com tarefa → abre o sheet (não cria nova).
 *
 * O label muda consoante o estado:
 *  - sem tarefa: "+ Tarefa Media"
 *  - tarefa pendente: "Ver tarefa Media" (clock icon)
 *  - tarefa concluída: "Media concluída" (check icon)
 */
export function MediaTaskStageButton({ processId, visible = true }: Props) {
  const [task, setTask] = useState<MediaTaskRow | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const fetchTask = useCallback(async () => {
    if (!visible) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}/media-task`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setTask(data.task ?? null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [processId, visible])

  useEffect(() => {
    fetchTask()
  }, [fetchTask])

  const handleClick = useCallback(async () => {
    if (task) {
      // Já existe — só abre.
      setSheetOpen(true)
      return
    }
    // Criar e abrir.
    setIsCreating(true)
    try {
      const res = await fetch(`/api/processes/${processId}/media-task`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao criar tarefa Media')
      }
      const data = await res.json()
      setTask(data.task)
      toast.success(
        data.created
          ? 'Tarefa Media criada e atribuída ao consultor'
          : 'Tarefa Media já existia',
      )
      setSheetOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar tarefa Media')
    } finally {
      setIsCreating(false)
    }
  }, [task, processId])

  if (!visible) return null

  const label = task
    ? task.is_completed
      ? 'Media concluída'
      : 'Ver tarefa Media'
    : 'Tarefa Media'
  const icon = task
    ? task.is_completed
      ? <Check className="h-3.5 w-3.5" />
      : <Clock className="h-3.5 w-3.5" />
    : <Plus className="h-3.5 w-3.5" />
  const tone = task
    ? task.is_completed
      ? 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
      : 'text-violet-700 dark:text-violet-300 border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10'
    : 'text-violet-700 dark:text-violet-300 border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10'

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isLoading || isCreating}
        onClick={handleClick}
        className={cn(
          'h-7 rounded-full text-[11px] font-medium gap-1.5 px-3',
          tone,
        )}
        title={label}
      >
        {isCreating ? (
          <Spinner className="h-3 w-3" />
        ) : (
          <>
            <Images className="h-3.5 w-3.5" />
            {icon}
          </>
        )}
        <span className="hidden sm:inline">{label}</span>
      </Button>

      <MediaTaskSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        taskId={task?.id ?? null}
        onCompleted={fetchTask}
      />
    </>
  )
}
