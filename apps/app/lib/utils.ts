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
 * Substitui {{variável}} por valores reais num template de texto/HTML.
 * Variáveis sem valor ficam como placeholder {{key}}.
 */
export function interpolateVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return variables[key] !== undefined ? variables[key] : `{{${key}}}`
  })
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

/**
 * Ensure a website URL has a protocol. `example.com` → `https://example.com`,
 * `http://...` and `https://...` are returned unchanged. Empty / nullish → null.
 */
export function normalizeWebsiteUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/**
 * Build a Google Maps "search by query" URL from address parts. Returns null
 * when there's nothing more than a country to search for.
 */
export function buildGoogleMapsUrl(parts: {
  address?: string | null
  city?: string | null
  postalCode?: string | null
  country?: string | null
}): string | null {
  const core = [parts.address, parts.city, parts.postalCode].filter(Boolean) as string[]
  if (core.length === 0) return null
  const query = [...core, parts.country || 'Portugal'].join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
