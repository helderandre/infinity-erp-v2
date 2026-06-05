import type { MaskPattern } from "@/components/ui/mask-input"

// ─── Telefone ────────────────────────────────────────────
export const phonePTMask: MaskPattern = {
  pattern: "+351 ### ### ###",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 9),
  validate: (value) => value.replace(/[^\d]/g, "").length === 9,
}

export const phoneInternationalMask: MaskPattern = {
  pattern: "+### ### ### ### ###",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 15),
  validate: (value) => {
    const len = value.replace(/[^\d]/g, "").length
    return len >= 9 && len <= 15
  },
}

// ─── Data PT ─────────────────────────────────────────────
export const datePTMask: MaskPattern = {
  pattern: "##/##/####",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 8),
  validate: (value) => {
    const cleaned = value.replace(/[^\d]/g, "")
    if (cleaned.length !== 8) return false
    const day = parseInt(cleaned.slice(0, 2), 10)
    const month = parseInt(cleaned.slice(2, 4), 10)
    const year = parseInt(cleaned.slice(4, 8), 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return false
    if (year < 1900 || year > 2100) return false
    const d = new Date(year, month - 1, day)
    return d.getDate() === day && d.getMonth() === month - 1
  },
}

// ─── NIF / NIPC ──────────────────────────────────────────
export const nifMask: MaskPattern = {
  pattern: "### ### ###",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 9),
  validate: (value) => value.replace(/[^\d]/g, "").length === 9,
}

// ─── IBAN PT ─────────────────────────────────────────────
export const ibanPTMask: MaskPattern = {
  pattern: "PT50 #### #### #### #### #### #",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 21),
  validate: (value) => value.replace(/[^\d]/g, "").length === 21,
}

// ─── Código Postal PT ────────────────────────────────────
export const postalCodePTMask: MaskPattern = {
  pattern: "####-###",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 7),
  validate: (value) => value.replace(/[^\d]/g, "").length === 7,
}

// ─── Helpers de parse ────────────────────────────────────
export const parseFloat0 = (v: string) => parseFloat(v) || 0
export const parseFloatOrNull = (v: string) => {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}
export const parseFloatOrUndefined = (v: string) => {
  const n = parseFloat(v)
  return isNaN(n) ? undefined : n
}

/** Converte string de data DD/MM/AAAA para ISO YYYY-MM-DD */
export function datePTtoISO(datePT: string): string {
  const digits = datePT.replace(/[^\d]/g, "")
  if (digits.length !== 8) return ""
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)
  return `${year}-${month}-${day}`
}

/** Converte ISO YYYY-MM-DD para DD/MM/AAAA (para popular o MaskInput) */
export function isoToDatePT(iso: string): string {
  if (!iso) return ""
  const parts = iso.split("-")
  if (parts.length !== 3) return ""
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}
