/**
 * Phone number normalization for matching contacts across WhatsApp ↔ CRM.
 *
 * Portugal-first: treats 9-digit numbers as PT local and adds 351 prefix.
 * Tolerates common international formats (+, 00, raw digits).
 *
 * Not a full E.164 parser — for ambiguous foreign numbers without country
 * code (e.g. a Spanish `612345678` stored raw), matching will fail because
 * there is no reliable way to infer the country from digits alone.
 */

/** Strip all non-digits + the international `00` prefix. */
export function normalizePhoneDigits(input: string): string {
  let digits = (input || '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  return digits
}

/**
 * Return every equivalent string form of a phone number so that a lead stored
 * in one format matches a WhatsApp contact stored in another.
 *
 * Example: `"+351 915 981 132"` →
 *   ["351915981132", "+351915981132", "915981132"]
 */
export function phoneVariants(input: string): string[] {
  const digits = normalizePhoneDigits(input)
  if (!digits) return []

  const out = new Set<string>()
  out.add(digits)
  out.add(`+${digits}`)

  // PT-specific: toggle between full (with 351 country code) and local (9 digits)
  if (digits.startsWith('351') && digits.length === 12) {
    out.add(digits.slice(3))
  } else if (digits.length === 9) {
    out.add(`351${digits}`)
    out.add(`+351${digits}`)
  }

  return [...out]
}

/**
 * Return WhatsApp JID variants (`{digits}@s.whatsapp.net`) for a phone.
 * Useful when querying `wa_chat_id` / `wa_contact_id` columns.
 */
export function phoneJidVariants(input: string): string[] {
  const digits = normalizePhoneDigits(input)
  if (!digits) return []

  const out = new Set<string>()
  out.add(`${digits}@s.whatsapp.net`)

  if (digits.startsWith('351') && digits.length === 12) {
    out.add(`${digits.slice(3)}@s.whatsapp.net`)
  } else if (digits.length === 9) {
    out.add(`351${digits}@s.whatsapp.net`)
  }

  return [...out]
}
