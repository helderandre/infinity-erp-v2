/**
 * Extracção defensiva de email/telefone a partir do `field_data` cru.
 *
 * Motivo: a meta-api normaliza só keys hardcoded em inglês (`email`, `phone_number`,
 * etc.). Formulários com keys PT-PT (`e-mail`, `número_de_telefone`) ficam com
 * `lead.email`/`lead.phone` NULL apesar dos dados estarem no payload.
 *
 * Estratégia 2-passes (cumulativa):
 *   1. KEY MATCH — procura keys que contenham "email"/"mail"/"phone"/"telef"/etc.
 *      (case-insensitive, tolera hifens e underscores e acentos).
 *   2. VALUE PATTERN — se ainda faltar, scaneia todos os valores e identifica
 *      por regex (email RFC-básico, telefone com 7-20 dígitos opcionalmente
 *      prefixado por +). O primeiro match vence.
 *
 * Sempre prefere o valor já normalizado pela meta-api (`fallback`) quando existe.
 */

export interface LeadFieldDataItem {
  name: string
  values: string[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Telefone: opcional '+', depois dígito, depois 6-18 chars de dígitos/separadores
const PHONE_RE = /^\+?\d[\d\s\-().]{6,18}$/

const EMAIL_KEY_HINTS = ['mail'] // captura "email", "Email", "e-mail", "e_mail", "EMail"
const PHONE_KEY_HINTS = [
  'phone',
  'telef', // telefone, telefono
  'telem', // telemóvel, telemovel
  'celular',
  'whatsapp',
  'mobile',
  'numero', // "número_de_telefone" depois de normalizar acentos → "numero_de_telefone"
]

/** Remove acentos / diacríticos para matching tolerante. */
function deburr(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function keyMatches(name: string, hints: string[]): boolean {
  const n = deburr(name)
  return hints.some((h) => n.includes(h))
}

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, '')
}

function normalizeEmail(value: string): string {
  return value.toLowerCase().trim()
}

export function extractContactFromFieldData(
  fieldData: LeadFieldDataItem[] | null | undefined,
  fallback: { email: string | null; phone: string | null },
): { email: string | null; phone: string | null } {
  let email = fallback.email
  let phone = fallback.phone

  if (!fieldData || fieldData.length === 0) return { email, phone }

  // PASS 1: match por key name
  for (const item of fieldData) {
    if (!item?.name) continue
    const v = item.values?.[0]?.trim()
    if (!v) continue

    if (!email && keyMatches(item.name, EMAIL_KEY_HINTS) && EMAIL_RE.test(v)) {
      email = normalizeEmail(v)
    } else if (
      !phone &&
      keyMatches(item.name, PHONE_KEY_HINTS) &&
      PHONE_RE.test(v)
    ) {
      phone = normalizePhone(v)
    }

    if (email && phone) return { email, phone }
  }

  // PASS 2: fallback por value pattern (formulários com keys completamente custom)
  if (!email || !phone) {
    for (const item of fieldData) {
      const v = item.values?.[0]?.trim()
      if (!v) continue
      if (!email && EMAIL_RE.test(v)) {
        email = normalizeEmail(v)
      } else if (!phone && PHONE_RE.test(v) && !EMAIL_RE.test(v)) {
        phone = normalizePhone(v)
      }
      if (email && phone) break
    }
  }

  return { email, phone }
}
