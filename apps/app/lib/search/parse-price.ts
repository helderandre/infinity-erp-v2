// Parses free-text price input into a number of euros. Returns null if the
// input doesn't look like a price.
//
// Accepts:
//   - bare numbers: "300000", "1500"
//   - 'k' / 'm' suffix: "300k", "1.5m"
//   - PT-PT thousand separators: "300.000", "1.500.000"
//   - space separators: "300 000", "1 500 000"
//   - trailing currency: "300 000 €", "300k€"
//
// Rejects too-small values (< 1000) to avoid surfacing the price shortcut for
// every numeric query — typing "3" shouldn't suggest "Imóveis até 3 €".

const MIN_REASONABLE_PRICE = 1000

export function parsePriceInput(raw: string): number | null {
  if (!raw) return null
  const trimmed = raw.trim().replace(/€/g, '').replace(/\s+/g, '').toLowerCase()
  if (!trimmed) return null

  // Match: digits + optional decimal part + optional k/m suffix
  const match = trimmed.match(/^(\d+(?:[.,]\d+)?(?:[.,]\d+)*)(k|m)?$/)
  if (!match) return null

  const [, numPart, suffix] = match

  // Heuristic: if string has multiple separators, they're thousand separators
  // (PT-PT). If only one separator and the part after it is exactly 3 chars,
  // also treat as thousand separator. Otherwise treat as decimal.
  const parts = numPart.split(/[.,]/)
  let value: number
  if (parts.length === 1) {
    value = parseInt(parts[0], 10)
  } else if (parts.length === 2 && parts[1].length === 3 && !suffix) {
    // "300.000" → 300000
    value = parseInt(parts.join(''), 10)
  } else if (parts.length > 2) {
    // "1.500.000" → 1500000
    value = parseInt(parts.join(''), 10)
  } else {
    // "1.5" with suffix → 1.5 (multiplied below)
    value = parseFloat(parts.join('.'))
  }

  if (!Number.isFinite(value)) return null

  if (suffix === 'k') value *= 1_000
  else if (suffix === 'm') value *= 1_000_000

  value = Math.round(value)
  if (value < MIN_REASONABLE_PRICE) return null
  return value
}

export function formatPriceShort(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}
