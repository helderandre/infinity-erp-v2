import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata um valor numérico como moeda em euros
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'

  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Formata uma data ISO para formato português
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'

  const d = typeof date === 'string' ? new Date(date) : date

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/**
 * Formata uma data ISO para formato português com hora
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'

  const d = typeof date === 'string' ? new Date(date) : date

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
