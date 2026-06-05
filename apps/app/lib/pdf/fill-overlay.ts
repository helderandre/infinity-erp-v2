import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { getDefaultFontBytes } from './get-font'
import { repairPdfIfNeeded } from './repair-pdf'
import type { PdfTemplateField } from '@/types/pdf-overlay'

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) / 255
  const g = parseInt(h.substring(2, 4), 16) / 255
  const b = parseInt(h.substring(4, 6), 16) / 255
  return rgb(r, g, b)
}

function applyTransform(value: string, transform: string | null): string {
  if (!transform || !value) return value
  switch (transform) {
    case 'uppercase': return value.toUpperCase()
    case 'lowercase': return value.toLowerCase()
    case 'date_pt': {
      const d = new Date(value)
      if (isNaN(d.getTime())) return value
      return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
    case 'currency_eur': {
      const num = parseFloat(value)
      if (isNaN(num)) return value
      return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(num)
    }
    default: return value
  }
}

/**
 * Fill a PDF by drawing text at specific coordinates (overlay approach).
 * Works with ANY PDF — no form fields required.
 *
 * @param templateBytes - Raw PDF bytes
 * @param fields - Field definitions with positions (percentage-based)
 * @param variables - Key→value map of data to fill
 * @returns Filled PDF bytes
 */
export async function fillPdfOverlay(
  templateBytes: Uint8Array,
  fields: PdfTemplateField[],
  variables: Record<string, string>
): Promise<Uint8Array> {
  const repairedBytes = await repairPdfIfNeeded(templateBytes)
  const pdfDoc = await PDFDocument.load(repairedBytes, { ignoreEncryption: true })

  // Register fontkit and embed a font that supports Portuguese characters
  pdfDoc.registerFontkit(fontkit)
  let font: any
  try {
    const fontBytes = await getDefaultFontBytes()
    font = await pdfDoc.embedFont(fontBytes)
  } catch {
    // Fallback to Helvetica
    font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  }

  const pages = pdfDoc.getPages()

  for (const field of fields) {
    const value = variables[field.variable_key]
    if (!value) continue

    const text = applyTransform(value, field.transform)
    const pageIndex = field.page_number - 1
    if (pageIndex < 0 || pageIndex >= pages.length) continue

    const page = pages[pageIndex]
    const { width, height } = page.getSize()

    // Convert percentage coordinates to absolute
    const x = (field.x_percent / 100) * width
    const y = height - ((field.y_percent / 100) * height) - field.font_size // PDF y=0 is bottom
    const maxWidth = (field.width_percent / 100) * width

    const fontSize = field.font_size || 11
    const color = hexToRgb(field.font_color || '#000000')

    // Calculate x offset for text alignment
    let drawX = x
    if (field.text_align === 'center') {
      const textWidth = font.widthOfTextAtSize(text, fontSize)
      drawX = x + (maxWidth - textWidth) / 2
    } else if (field.text_align === 'right') {
      const textWidth = font.widthOfTextAtSize(text, fontSize)
      drawX = x + maxWidth - textWidth
    }

    page.drawText(text, {
      x: drawX,
      y,
      size: fontSize,
      font,
      color,
      maxWidth,
    })
  }

  return pdfDoc.save()
}
