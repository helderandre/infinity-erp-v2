'use client'

import { Check, Flag } from 'lucide-react'
import { format, isPast, isToday, isTomorrow, isYesterday } from 'date-fns'
import { pt } from 'date-fns/locale'
import { cn } from '@/lib/utils'

// ─── Priority mappings ─────────────────────────────────────────────────────

export type PriorityLevel = 1 | 2 | 3 | 4

const PRIORITY_RING: Record<PriorityLevel, string> = {
  1: 'border-red-500/70 hover:bg-red-500/5',
  2: 'border-orange-500/70 hover:bg-orange-500/5',
  3: 'border-blue-500/70 hover:bg-blue-500/5',
  4: 'border-muted-foreground/30 hover:bg-muted/60',
}

const PRIORITY_CHECK_BG: Record<PriorityLevel, string> = {
  1: 'bg-red-500/15 text-red-600',
  2: 'bg-orange-500/15 text-orange-600',
  3: 'bg-blue-500/15 text-blue-600',
  4: 'bg-muted text-muted-foreground',
}

const PRIORITY_FLAG: Record<PriorityLevel, string> = {
  1: 'text-red-500',
  2: 'text-orange-500',
  3: 'text-blue-500',
  4: 'text-muted-foreground/50',
}

const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  1: 'Urgente',
  2: 'Alta',
  3: 'Média',
  4: 'Normal',
}

export function priorityKey(p?: number): PriorityLevel {
  return (p === 1 || p === 2 || p === 3) ? p : 4
}

// ─── PriorityCheck — circular checkbox with priority-colored ring ──────────

export function PriorityCheck({
  priority,
  checked,
  disabled,
  onClick,
  title,
  size = 'sm',
}: {
  priority: number
  checked: boolean
  disabled?: boolean
  onClick: () => void
  title?: string
  size?: 'sm' | 'md'
}) {
  const p = priorityKey(priority)
  const sizeClass = size === 'md' ? 'size-[22px]' : 'size-[18px]'
  const checkSize = size === 'md' ? 'size-[14px]' : 'size-3'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={title}
      className={cn(
        'rounded-full border flex items-center justify-center transition-all shrink-0',
        sizeClass,
        checked
          ? PRIORITY_CHECK_BG[p]
          : cn('bg-transparent', PRIORITY_RING[p]),
        checked && 'border-transparent',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {checked && <Check className={checkSize} strokeWidth={3} />}
    </button>
  )
}

// ─── PriorityFlag — colored flag icon (shown for P1-P3 only) ───────────────

export function PriorityFlag({
  priority,
  className,
  showLabel,
}: {
  priority: number
  className?: string
  showLabel?: boolean
}) {
  const p = priorityKey(priority)
  if (p === 4) return null
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <Flag
        className={cn('h-3.5 w-3.5', PRIORITY_FLAG[p])}
        strokeWidth={2}
        fill="currentColor"
      />
      {showLabel && (
        <span className={PRIORITY_FLAG[p]}>{PRIORITY_LABEL[p]}</span>
      )}
    </span>
  )
}

// ─── Due date formatter ────────────────────────────────────────────────────

export function buildDueShort(date: Date): string {
  const time = format(date, 'HH:mm', { locale: pt })
  const midnight = time === '00:00'
  if (isToday(date)) return midnight ? 'Hoje' : `Hoje · ${time}`
  if (isTomorrow(date)) return midnight ? 'Amanhã' : `Amanhã · ${time}`
  if (isYesterday(date)) return midnight ? 'Ontem' : `Ontem · ${time}`
  return format(date, midnight ? 'd MMM' : "d MMM, HH:mm", { locale: pt })
}

export function buildDueLong(date: Date): string {
  const time = format(date, 'HH:mm', { locale: pt })
  const midnight = time === '00:00'
  if (isToday(date)) return midnight ? 'Hoje' : `Hoje às ${time}`
  if (isTomorrow(date)) return midnight ? 'Amanhã' : `Amanhã às ${time}`
  if (isYesterday(date)) return midnight ? 'Ontem' : `Ontem às ${time}`
  return format(date, midnight ? "d 'de' MMMM 'de' yyyy" : "d MMM yyyy · HH:mm", { locale: pt })
}

// ─── DueDateText — urgency-colored due date label ──────────────────────────

export function DueDateText({
  date,
  isCompleted,
  variant = 'short',
  className,
}: {
  date: Date
  isCompleted?: boolean
  variant?: 'short' | 'long'
  className?: string
}) {
  const overdue = !isCompleted && isPast(date) && !isToday(date)
  const dueToday = isToday(date)
  return (
    <span
      className={cn(
        'tabular-nums',
        isCompleted ? 'text-muted-foreground/60'
          : overdue ? 'text-red-600 font-medium'
          : dueToday ? 'text-emerald-600 font-medium'
          : 'text-muted-foreground',
        className,
      )}
    >
      {variant === 'long' ? buildDueLong(date) : buildDueShort(date)}
    </span>
  )
}
