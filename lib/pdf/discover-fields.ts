import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
} from 'pdf-lib'
import type { PdfFieldInfo } from '@/types/pdf-template'

/**
 * Discover AcroForm fields using pdf-lib (preferred — gives full type info).
 * Falls back to pdfjs-dist if pdf-lib can't parse the PDF or finds 0 fields.
 */
export async function discoverFields(pdfBytes: Uint8Array): Promise<PdfFieldInfo[]> {
  // Try pdf-lib first (faster, gives full type info)
  try {
    const result = await discoverWithPdfLib(pdfBytes.slice())
    if (result.length > 0) {
      console.log('[discoverFields] pdf-lib found', result.length, 'fields')
      return result
    }
    console.log('[discoverFields] pdf-lib found 0 fields, trying pdfjs-dist fallback')
  } catch (err) {
    console.warn('[discoverFields] pdf-lib threw, trying pdfjs-dist:', (err as Error).message)
  }

  // Fallback: pdfjs-dist is more tolerant with corrupted PDFs
  try {
    const result = await discoverWithPdfJs(pdfBytes.slice())
    console.log('[discoverFields] pdfjs-dist found', result.length, 'fields')
    return result
  } catch (err) {
    console.error('[discoverFields] pdfjs-dist also failed:', (err as Error).message)
    return []
  }
}

// ─── pdf-lib strategy ──────────────────────────────────────

async function discoverWithPdfLib(pdfBytes: Uint8Array): Promise<PdfFieldInfo[]> {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const form = pdf.getForm()
  const fields = form.getFields()
  const pages = pdf.getPages()

  if (fields.length === 0) return []

  const result: PdfFieldInfo[] = []

  for (const field of fields) {
    const name = field.getName()

    let type: PdfFieldInfo['type'] = 'unknown'
    let options: string[] | undefined

    if (field instanceof PDFTextField) {
      type = field.isMultiline() ? 'textarea' : 'text'
    } else if (field instanceof PDFCheckBox) {
      type = 'checkbox'
    } else if (field instanceof PDFDropdown) {
      type = 'dropdown'
      options = field.getOptions()
    } else if (field instanceof PDFRadioGroup) {
      type = 'radio'
      options = field.getOptions()
    }

    // Extract widget position
    let page = 0
    let position: PdfFieldInfo['position'] = null
    let suggestedFontSize: number | null = null

    try {
      const widgets = field.acroField.getWidgets()
      if (widgets.length > 0) {
        const widget = widgets[0]

        const widgetPage = widget.P()
        if (widgetPage) {
          const pageIndex = pages.findIndex(
            (p) => p.ref === widgetPage || p.ref.toString() === widgetPage.toString()
          )
          if (pageIndex >= 0) page = pageIndex
        }

        const rect = widget.getRectangle()
        if (rect) {
          position = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          suggestedFontSize = suggestFontSize(rect.width, rect.height)
        }
      }
    } catch {
      // Widget extraction failed — use defaults
    }

    result.push({ name, type, options, page, position, suggestedFontSize })
  }

  return result
}

// ─── pdfjs-dist fallback (server-side, no worker) ──────────

async function discoverWithPdfJs(pdfBytes: Uint8Array): Promise<PdfFieldInfo[]> {
  // Use pdfjs-dist main entry — works without worker setup in Node.js / Next.js server
  const { getDocument } = await import('pdfjs-dist')

  const doc = await getDocument({
    data: pdfBytes.slice(),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).promise
  const result: PdfFieldInfo[] = []
  const seen = new Set<string>()

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const annotations = await page.getAnnotations()

    for (const annot of annotations) {
      if (annot.subtype !== 'Widget') continue

      const name: string = annot.fieldName || `field_${annot.id}`
      if (seen.has(name)) continue
      seen.add(name)

      // Map pdfjs fieldType to our type
      let type: PdfFieldInfo['type'] = 'text'
      let options: string[] | undefined

      if (annot.fieldType === 'Btn') {
        const isRadio = (annot.fieldFlags ?? 0) & 0x8000
        type = isRadio ? 'radio' : 'checkbox'
      } else if (annot.fieldType === 'Ch') {
        type = 'dropdown'
        if (annot.options && Array.isArray(annot.options)) {
          options = annot.options.map((o: { displayValue?: string; exportValue?: string }) =>
            o.displayValue || o.exportValue || ''
          )
        }
      } else if (annot.fieldType === 'Tx') {
        const isMultiline = (annot.fieldFlags ?? 0) & 0x1000
        type = isMultiline ? 'textarea' : 'text'
      }

      // Extract position from rect [x1, y1, x2, y2] (bottom-left origin)
      let position: PdfFieldInfo['position'] = null
      let suggestedFontSize: number | null = null

      if (annot.rect && annot.rect.length === 4) {
        const [x1, y1, x2, y2] = annot.rect
        const width = Math.abs(x2 - x1)
        const height = Math.abs(y2 - y1)
        position = { x: Math.min(x1, x2), y: Math.min(y1, y2), width, height }
        suggestedFontSize = suggestFontSize(width, height)
      }

      result.push({
        name,
        type,
        options,
        page: i - 1,
        position,
        suggestedFontSize,
      })
    }
  }

  doc.destroy()
  return result
}

// ─── helpers ───────────────────────────────────────────────

function suggestFontSize(width: number, height: number): number | null {
  if (height < 14) return 7
  if (height < 18 || width < 60) return 8
  if (width < 120) return 9
  return null
}
