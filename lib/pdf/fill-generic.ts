import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { PdfFieldMapping } from '@/types/pdf-template'
import type { PdfFieldInfo } from '@/types/pdf-template'
import { getDefaultFontBytes } from './get-font'
import { repairPdfIfNeeded } from './repair-pdf'

function applyTransform(value: string, transform: string | null): string {
  if (!transform || !value) return value

  switch (transform) {
    case 'uppercase':
      return value.toUpperCase()
    case 'lowercase':
      return value.toLowerCase()
    case 'date_pt': {
      const d = new Date(value)
      if (isNaN(d.getTime())) return value
      return d.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    }
    case 'currency_eur': {
      const num = parseFloat(value)
      if (isNaN(num)) return value
      return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
      }).format(num)
    }
    default:
      return value
  }
}

function resolveValue(
  mapping: PdfFieldMapping,
  resolvedVariables: Record<string, string>
): string {
  let value = ''
  if (mapping.variable_key && resolvedVariables[mapping.variable_key]) {
    value = resolvedVariables[mapping.variable_key]
  } else if (mapping.default_value) {
    value = mapping.default_value
  }
  return applyTransform(value, mapping.transform)
}

export async function fillPdfGeneric(
  templateBytes: Uint8Array,
  mappings: PdfFieldMapping[],
  resolvedVariables: Record<string, string>,
  fontBytes?: Uint8Array
): Promise<Uint8Array> {
  const actualFontBytes = fontBytes || getDefaultFontBytes()

  // Try standard AcroForm fill first — use .slice() to avoid buffer mutation
  try {
    const pdf = await PDFDocument.load(templateBytes.slice(), { ignoreEncryption: true })
    const form = pdf.getForm()
    const formFields = form.getFields()

    if (formFields.length > 0) {
      pdf.registerFontkit(fontkit)
      const font = await pdf.embedFont(actualFontBytes)
      return fillViaAcroForm(pdf, form, font, mappings, resolvedVariables)
    }
  } catch {
    // pdf-lib couldn't load or access form — fall through to fallback
  }

  // Fallback: repair PDF + draw text at discovered positions
  console.warn('[fillPdfGeneric] pdf-lib found 0 form fields — using drawText fallback')
  return fillViaDrawText(templateBytes.slice(), actualFontBytes, mappings, resolvedVariables)
}

// ─── Standard AcroForm fill (well-formed PDFs) ────────────

async function fillViaAcroForm(
  pdf: PDFDocument,
  form: ReturnType<PDFDocument['getForm']>,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  mappings: PdfFieldMapping[],
  resolvedVariables: Record<string, string>
): Promise<Uint8Array> {
  for (const mapping of mappings) {
    const value = resolveValue(mapping, resolvedVariables)

    try {
      switch (mapping.field_type) {
        case 'text': {
          const field = form.getTextField(mapping.pdf_field_name)
          // Let pdf-lib auto-size font to fit the field
          field.setFontSize(0)
          field.setText(value)
          break
        }
        case 'checkbox': {
          const field = form.getCheckBox(mapping.pdf_field_name)
          const truthyValues = ['true', '1', 'sim', 'yes', 'x', 'on']
          if (truthyValues.includes(value.toLowerCase())) {
            field.check()
          } else {
            field.uncheck()
          }
          break
        }
        case 'dropdown': {
          const field = form.getDropdown(mapping.pdf_field_name)
          if (value && field.getOptions().includes(value)) {
            field.select(value)
          }
          break
        }
        case 'radio': {
          const field = form.getRadioGroup(mapping.pdf_field_name)
          if (value && field.getOptions().includes(value)) {
            field.select(value)
          }
          break
        }
      }
    } catch {
      // Field not found or not fillable — skip
    }
  }

  form.updateFieldAppearances(font)
  form.flatten()
  return pdf.save()
}

// ─── Fallback: repair PDF + draw text at pdfjs-dist positions ──

async function fillViaDrawText(
  originalBytes: Uint8Array,
  fontBytes: Uint8Array,
  mappings: PdfFieldMapping[],
  resolvedVariables: Record<string, string>
): Promise<Uint8Array> {
  // Discover field positions using pdfjs-dist (uses independent copy internally)
  const { discoverFields } = await import('./discover-fields')
  let discoveredFields: PdfFieldInfo[]
  try {
    discoveredFields = await discoverFields(originalBytes.slice())
  } catch {
    console.error('Fallback: impossível descobrir campos do PDF')
    // Return original bytes unchanged
    return originalBytes
  }

  // Build lookup: field name → position info
  const fieldPositions = new Map(
    discoveredFields.filter((f) => f.position).map((f) => [f.name, f])
  )

  // Repair the PDF so pdf-lib can access pages (only if pages tree is broken)
  let workingBytes: Uint8Array
  const repaired = await repairPdfIfNeeded(originalBytes.slice())
  workingBytes = repaired || originalBytes.slice()
  console.log('[fillViaDrawText] repaired:', !!repaired, ', workingBytes:', workingBytes.length)

  let pdf: PDFDocument
  try {
    pdf = await PDFDocument.load(workingBytes, { ignoreEncryption: true })
  } catch (err) {
    console.error('[fillViaDrawText] PDFDocument.load failed:', (err as Error).message)
    return originalBytes
  }

  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(fontBytes)

  let pages: ReturnType<PDFDocument['getPages']>
  try {
    pages = pdf.getPages()
    console.log('[fillViaDrawText] pages:', pages.length)
  } catch {
    console.error('Fallback: impossível aceder a páginas mesmo após reparação')
    return originalBytes
  }

  for (const mapping of mappings) {
    const value = resolveValue(mapping, resolvedVariables)
    if (!value) continue

    const fieldInfo = fieldPositions.get(mapping.pdf_field_name)
    if (!fieldInfo?.position) continue

    const pageIndex = fieldInfo.page
    if (pageIndex < 0 || pageIndex >= pages.length) continue

    const page = pages[pageIndex]
    const pos = fieldInfo.position

    try {
      if (mapping.field_type === 'checkbox') {
        const truthyValues = ['true', '1', 'sim', 'yes', 'x', 'on']
        if (truthyValues.includes(value.toLowerCase())) {
          const checkSize = Math.min(pos.width, pos.height) * 0.7
          page.drawText('X', {
            x: pos.x + pos.width / 2 - checkSize / 3,
            y: pos.y + pos.height / 2 - checkSize / 3,
            size: checkSize,
            font,
            color: rgb(0, 0, 0),
          })
        }
      } else {
        const padding = 2
        const maxFontSize = Math.max(6, pos.height * 0.7)
        const available = pos.width - padding * 2
        // Auto-shrink font if text overflows width
        let fontSize = maxFontSize
        const textWidth = font.widthOfTextAtSize(value, fontSize)
        if (textWidth > available && available > 0) {
          fontSize = Math.max(4, fontSize * (available / textWidth))
        }
        page.drawText(value, {
          x: pos.x + padding,
          y: pos.y + (pos.height - fontSize) / 2,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        })
      }
    } catch (err) {
      console.warn(`drawText falhou para "${mapping.pdf_field_name}":`, err)
    }
  }

  const savedBytes = await pdf.save()
  const hdr = Array.from(savedBytes.slice(0, 5)).map(b => String.fromCharCode(b)).join('')
  console.log('[fillViaDrawText] saved PDF:', savedBytes.length, 'bytes, header:', hdr)
  return savedBytes
}
