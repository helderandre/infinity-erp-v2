import { cn } from '@/lib/utils'
import {
  PROPERTY_STATUS,
  PROCESS_STATUS,
  TASK_STATUS,
} from '@/lib/constants'

type StatusType = 'property' | 'process' | 'task'

interface StatusBadgeProps {
  status: string
  type: StatusType
  showDot?: boolean
  className?: string
}

export function StatusBadge({
  status,
  type,
  showDot = true,
  className,
}: StatusBadgeProps) {
  // Selecionar o mapa de cores correto
  const statusMap =
    type === 'property'
      ? PROPERTY_STATUS
      : type === 'process'
        ? PROCESS_STATUS
        : TASK_STATUS

  const config = (statusMap as any)[status]

  if (!config) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
        {status}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      {showDot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', config.dot)}
          aria-hidden="true"
        />
      )}
      {config.label}
    </span>
  )
}
