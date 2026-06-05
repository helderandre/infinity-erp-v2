const DEFAULT_CC: Record<string, string> = {
  PT: '351',
  BR: '55',
  ES: '34',
}

export function normalizeToE164(
  input: string,
  defaultCountry: keyof typeof DEFAULT_CC = 'PT'
): string | null {
  if (!input) return null
  const raw = input.trim()
  const hasPlus = raw.startsWith('+')
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  const cc = DEFAULT_CC[defaultCountry] ?? '351'

  let full: string
  if (hasPlus) {
    full = digits
  } else if (digits.startsWith(cc)) {
    full = digits
  } else if (defaultCountry === 'PT' && digits.length === 9) {
    full = `${cc}${digits}`
  } else {
    full = digits
  }

  if (full.length < 8 || full.length > 15) return null
  return `+${full}`
}

export function isValidE164(input: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(input)
}

export function formatE164ForDisplay(e164: string): string {
  if (!e164.startsWith('+')) return e164
  const digits = e164.slice(1)
  if (digits.startsWith('351') && digits.length === 12) {
    const local = digits.slice(3)
    return `+351 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }
  return e164
}
