import { addDays, addWeeks, nextDay, setHours, setMinutes, setSeconds, setMilliseconds, startOfDay } from 'date-fns'

// ─── Natural-language date parser (PT-PT) ──────────────────────────────────
// Matches common phrases in a task title and returns { cleanedTitle, date }
// where date is a JS Date (may include time) and cleanedTitle has the matched
// tokens stripped. Returns { cleanedTitle: original, date: null } if nothing found.

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // Sun..Sat

const WEEKDAY_MAP: Record<string, Weekday> = {
  'domingo': 0,
  'segunda': 1, 'segunda-feira': 1,
  'terca': 2, 'terça': 2, 'terca-feira': 2, 'terça-feira': 2,
  'quarta': 3, 'quarta-feira': 3,
  'quinta': 4, 'quinta-feira': 4,
  'sexta': 5, 'sexta-feira': 5,
  'sabado': 6, 'sábado': 6,
}

function stripDiacritics(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

interface ParseResult {
  cleanedTitle: string
  date: Date | null
  matchedText?: string
}

export function parseTaskDateFromTitle(title: string): ParseResult {
  const now = new Date()
  let cleanedTitle = title
  let date: Date | null = null
  const matchedParts: string[] = []

  // Normalised copy for matching (lowercase, no diacritics)
  const normalised = stripDiacritics(title.toLowerCase())

  // ─── 1. Day keywords ────────────────────────────────────────────────────
  let baseDate: Date | null = null
  let keywordMatch: { match: string; raw: RegExp } | null = null

  // "depois de amanhã"
  const depAmanha = /\b(depois\s+de\s+amanha)\b/i
  if (depAmanha.test(normalised)) {
    baseDate = addDays(startOfDay(now), 2)
    keywordMatch = { match: 'depois de amanhã', raw: /\b(depois\s+de\s+amanh[aã])\b/gi }
  }

  // "amanhã"
  if (!baseDate && /\bamanha\b/i.test(normalised)) {
    baseDate = addDays(startOfDay(now), 1)
    keywordMatch = { match: 'amanhã', raw: /\bamanh[aã]\b/gi }
  }

  // "hoje"
  if (!baseDate && /\bhoje\b/i.test(normalised)) {
    baseDate = startOfDay(now)
    keywordMatch = { match: 'hoje', raw: /\bhoje\b/gi }
  }

  // "próxima semana" / "proxima semana"
  if (!baseDate && /\bpr[oó]xima\s+semana\b/i.test(title) || /\bproxima\s+semana\b/i.test(normalised)) {
    baseDate = addWeeks(startOfDay(now), 1)
    keywordMatch = { match: 'próxima semana', raw: /\bpr[oó]xima\s+semana\b/gi }
  }

  // Weekdays (opcional "próxima")
  if (!baseDate) {
    const weekdayRegex = /\b(proxima\s+|pr[oó]xima\s+)?(domingo|segunda(?:-feira)?|ter[cç]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[aá]bado)\b/i
    const m = normalised.match(weekdayRegex)
    if (m) {
      const wdKey = stripDiacritics(m[2].toLowerCase())
      const weekday = WEEKDAY_MAP[wdKey]
      if (weekday !== undefined) {
        baseDate = nextDay(now, weekday)
        // match na string original para preservar acentos
        const originalRegex = new RegExp(`\\b(pr[oó]xima\\s+)?${m[2]}\\b`, 'i')
        const origMatch = title.match(originalRegex)
        if (origMatch) {
          keywordMatch = { match: origMatch[0], raw: new RegExp(`\\b(pr[oó]xima\\s+)?${m[2]}\\b`, 'gi') }
        }
      }
    }
  }

  // "dia N" → próxima occurrence do dia N do mês
  if (!baseDate) {
    const diaMatch = title.match(/\bdia\s+(\d{1,2})\b/i)
    if (diaMatch) {
      const day = parseInt(diaMatch[1], 10)
      if (day >= 1 && day <= 31) {
        const candidate = new Date(now.getFullYear(), now.getMonth(), day)
        if (candidate < startOfDay(now)) {
          candidate.setMonth(candidate.getMonth() + 1)
        }
        baseDate = startOfDay(candidate)
        keywordMatch = { match: diaMatch[0], raw: /\bdia\s+\d{1,2}\b/gi }
      }
    }
  }

  // "N/M" ou "N-M" (dia/mês)
  if (!baseDate) {
    const dm = title.match(/\b(\d{1,2})[\/\-](\d{1,2})\b/)
    if (dm) {
      const day = parseInt(dm[1], 10)
      const month = parseInt(dm[2], 10)
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        let year = now.getFullYear()
        const candidate = new Date(year, month - 1, day)
        if (candidate < startOfDay(now)) year += 1
        baseDate = startOfDay(new Date(year, month - 1, day))
        keywordMatch = { match: dm[0], raw: /\b\d{1,2}[\/\-]\d{1,2}\b/g }
      }
    }
  }

  if (keywordMatch) {
    matchedParts.push(keywordMatch.match)
    cleanedTitle = cleanedTitle.replace(keywordMatch.raw, '').trim()
  }

  // ─── 2. Time ─────────────────────────────────────────────────────────────
  // Accepts: "15h", "15h30", "15:00", "14:30", "às 15", "as 14h30"
  let hours: number | null = null
  let minutes = 0
  let timeMatchText: string | null = null

  // "15h30" or "15h"
  const h1 = title.match(/\b(?:[aà]s\s+)?(\d{1,2})h(\d{2})?\b/i)
  if (h1) {
    hours = parseInt(h1[1], 10)
    if (h1[2]) minutes = parseInt(h1[2], 10)
    timeMatchText = h1[0]
  }

  // "14:30" or "14:00"
  if (hours === null) {
    const h2 = title.match(/\b(?:[aà]s\s+)?(\d{1,2}):(\d{2})\b/)
    if (h2) {
      hours = parseInt(h2[1], 10)
      minutes = parseInt(h2[2], 10)
      timeMatchText = h2[0]
    }
  }

  // "às 15" (sem "h" nem ":")
  if (hours === null) {
    const h3 = title.match(/\b[aà]s\s+(\d{1,2})\b/i)
    if (h3) {
      hours = parseInt(h3[1], 10)
      timeMatchText = h3[0]
    }
  }

  if (hours !== null && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && timeMatchText) {
    matchedParts.push(timeMatchText)
    cleanedTitle = cleanedTitle.replace(timeMatchText, '').trim()
    const ref = baseDate || startOfDay(now)
    baseDate = setMilliseconds(setSeconds(setMinutes(setHours(ref, hours), minutes), 0), 0)
  }

  if (baseDate) {
    date = baseDate
  }

  // Limpar espaços duplicados deixados pelo replace
  cleanedTitle = cleanedTitle.replace(/\s{2,}/g, ' ').trim()

  return {
    cleanedTitle: cleanedTitle || title,
    date,
    matchedText: matchedParts.length ? matchedParts.join(' ') : undefined,
  }
}
