import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Helpers para cálculo de dias úteis (PT).
 *
 * `isBusinessDay()` / `shiftToNextBusinessDay()` consultam
 * `public.holidays_pt`. Ambos aceitam um `SupabaseClient` injectado
 * (normalmente o admin client do route handler) para que testes possam
 * passar fakes sem setup adicional.
 */

const NON_BUSINESS_WEEKDAYS: ReadonlySet<number> = new Set([0, 6]) // 0 = Sunday, 6 = Saturday

const MAX_SHIFT_ATTEMPTS = 14 // safety against infinite loop (Páscoa + 10 dias úteis jamais)

type HolidayCache = Map<number, Set<string>> // key: year; value: ISO YYYY-MM-DD set

/**
 * Cache module-scoped. Dura o tempo de vida do processo (seed do
 * holidays_pt é estável e volume pequeno), mas o formato (Map por
 * ano) permite evicção futura caso seja necessário.
 */
const holidayCache: HolidayCache = new Map()

function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function loadHolidaysForYear(
  supabase: SupabaseClient,
  year: number
): Promise<Set<string>> {
  const cached = holidayCache.get(year)
  if (cached) return cached

  const db = supabase as unknown as {
    from: (table: string) => ReturnType<SupabaseClient['from']>
  }
  const from = `${year}-01-01`
  const to = `${year}-12-31`

  const { data, error } = await (db.from('holidays_pt') as ReturnType<SupabaseClient['from']>)
    .select('date')
    .gte('date', from)
    .lte('date', to)

  if (error) {
    // Sem feriados carregados, caímos num set vazio — melhor UX que falhar
    // a conclusão de uma subtarefa por causa de um erro de DB.
    console.error('[business-days] Falha ao carregar holidays_pt:', error.message)
    return new Set()
  }

  const set = new Set<string>()
  for (const row of data ?? []) {
    const raw = (row as { date: string }).date
    if (typeof raw === 'string') set.add(raw.slice(0, 10))
  }
  holidayCache.set(year, set)
  return set
}

/**
 * True se `date` for dia útil em PT (seg-sex, não-feriado).
 *
 * A comparação é feita em UTC para evitar flips em DST — o cliente
 * nunca vê esta data a correr, é só para due_date.
 */
export async function isBusinessDay(
  date: Date,
  supabase: SupabaseClient
): Promise<boolean> {
  if (NON_BUSINESS_WEEKDAYS.has(date.getUTCDay())) return false
  const holidays = await loadHolidaysForYear(supabase, date.getUTCFullYear())
  return !holidays.has(toIsoDate(date))
}

/**
 * Devolve `date` se já for dia útil; caso contrário avança para o
 * próximo dia útil (seg-sex, não-feriado). Preserva a hora UTC original.
 */
export async function shiftToNextBusinessDay(
  date: Date,
  supabase: SupabaseClient
): Promise<Date> {
  const cursor = new Date(date.getTime())
  for (let i = 0; i < MAX_SHIFT_ATTEMPTS; i++) {
    if (await isBusinessDay(cursor, supabase)) return cursor
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  // Seguro fallback: devolve o último cursor (14 dias à frente) em vez
  // de lançar. Log avisa que o ano do holidays_pt pode estar mal seedado.
  console.warn('[business-days] shiftToNextBusinessDay atingiu MAX_SHIFT_ATTEMPTS', {
    start: toIsoDate(date),
    end: toIsoDate(cursor),
  })
  return cursor
}

/**
 * Parse de `offset` no formato `"Nh"` ou `"Nd"`.
 * - `"Nh"` → adiciona N horas (calendário).
 * - `"Nd"` → adiciona N dias (calendário; o shift para dia útil é
 *            responsabilidade do caller via `shiftToNextBusinessDay`).
 *
 * Devolve `null` em input malformado (caller decide o fallback).
 */
export function parseOffset(offset: string): { unit: 'h' | 'd'; amount: number } | null {
  const match = offset.trim().match(/^(\d+)\s*([hd])$/i)
  if (!match) return null
  return { unit: match[2].toLowerCase() as 'h' | 'd', amount: Number(match[1]) }
}

export function addOffset(base: Date, parsed: { unit: 'h' | 'd'; amount: number }): Date {
  const out = new Date(base.getTime())
  if (parsed.unit === 'h') out.setUTCHours(out.getUTCHours() + parsed.amount)
  else out.setUTCDate(out.getUTCDate() + parsed.amount)
  return out
}

/**
 * Reset do cache — para testes. NÃO usar em código de produção.
 */
export function __resetHolidayCache(): void {
  holidayCache.clear()
}
