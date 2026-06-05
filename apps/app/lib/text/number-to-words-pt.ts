const UNITS = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const TEENS = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove']
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function chunkToWords(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'

  const h = Math.floor(n / 100)
  const rem = n % 100

  const parts: string[] = []
  if (h > 0) parts.push(HUNDREDS[h])

  if (rem >= 10 && rem < 20) {
    parts.push(TEENS[rem - 10])
  } else {
    const t = Math.floor(rem / 10)
    const u = rem % 10
    if (t > 0) parts.push(TENS[t])
    if (u > 0) parts.push(UNITS[u])
  }

  return parts.join(' e ')
}

export function numberToWordsPt(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (n === 0) return 'zero'
  if (n < 0) return 'menos ' + numberToWordsPt(-n)

  const integer = Math.floor(n)

  const billions = Math.floor(integer / 1_000_000_000)
  const millions = Math.floor((integer % 1_000_000_000) / 1_000_000)
  const thousands = Math.floor((integer % 1_000_000) / 1000)
  const ones = integer % 1000

  type Chunk = { words: string; isUnit: boolean }
  const chunks: Chunk[] = []

  if (billions > 0) {
    const w = billions === 1 ? 'mil milhão' : `${chunkToWords(billions)} mil milhões`
    chunks.push({ words: w, isUnit: false })
  }
  if (millions > 0) {
    const w = millions === 1 ? 'um milhão' : `${chunkToWords(millions)} milhões`
    chunks.push({ words: w, isUnit: false })
  }
  if (thousands > 0) {
    const w = thousands === 1 ? 'mil' : `${chunkToWords(thousands)} mil`
    chunks.push({ words: w, isUnit: false })
  }
  if (ones > 0) {
    chunks.push({ words: chunkToWords(ones), isUnit: true })
  }

  if (chunks.length === 1) return chunks[0].words

  const last = chunks.pop()!
  return chunks.map((c) => c.words).join(' ') + ' e ' + last.words
}
