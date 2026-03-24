import { readFileSync } from 'fs'
import { join } from 'path'

let cachedFont: Uint8Array | null = null

export function getDefaultFontBytes(): Uint8Array {
  if (cachedFont) return cachedFont
  const fontPath = join(process.cwd(), 'public', 'fonts', 'NotoSans-VariableFont_wdth,wght.ttf')
  cachedFont = new Uint8Array(readFileSync(fontPath))
  return cachedFont
}
