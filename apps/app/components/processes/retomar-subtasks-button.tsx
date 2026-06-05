'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { PopulatingSubtasksOverlay } from './populating-subtasks-overlay'
import { usePopulateAngariacaoSubtasks } from '@/hooks/use-populate-angariacao-subtasks'

interface RetomarSubtasksButtonProps {
  processId: string
  variant?: 'outline' | 'default' | 'ghost' | 'secondary'
  size?: 'default' | 'sm'
  onComplete?: (inserted: number) => void
}

/**
 * Botão "Retomar preparação" para processos de angariação cuja populate
 * falhou parcialmente (ou nunca foi iniciado por um processo legacy).
 *
 * Consumo: colocar no `<ProcessDetailHeader>` ou na secção de alertas
 * quando `tasks.some(t => t.hardcoded_subtasks_missing)` for true. O
 * endpoint é idempotente — retomar é sempre seguro.
 */
export function RetomarSubtasksButton({
  processId,
  variant = 'outline',
  size = 'sm',
  onComplete,
}: RetomarSubtasksButtonProps) {
  const { run, isRunning, lastResult } = usePopulateAngariacaoSubtasks()

  async function handleClick() {
    const result = await run(processId)
    if (result.ok) onComplete?.(result.inserted)
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isRunning}
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
        {isRunning
          ? 'A preparar...'
          : lastResult && lastResult.ok && lastResult.inserted > 0
            ? `Subtarefas preparadas (${lastResult.inserted})`
            : 'Retomar preparação'}
      </Button>
      <PopulatingSubtasksOverlay open={isRunning} />
    </>
  )
}
