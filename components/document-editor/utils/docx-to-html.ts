import mammoth from 'mammoth'
import type { ParsedVariable } from '../types'
import { extractVariableKeysFromText } from './parse-variables'

/**
 * Comprehensive style map for mammoth DOCX → HTML conversion.
 * Maps common Word paragraph/character styles (English + Portuguese locale)
 * to appropriate HTML elements, suppressing "Unrecognised paragraph style" warnings.
 */
const DOCX_STYLE_MAP = [
  // --- Headings ---
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h3:fresh",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",

  // --- Quotes ---
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Block Text'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",

  // --- Normal / Default paragraph styles ---
  "p[style-name='Normal'] => p:fresh",
  "p[style-name='Default'] => p:fresh",
  "p[style-name='Body Text'] => p:fresh",
  "p[style-name='Body Text 2'] => p:fresh",
  "p[style-name='Body Text 3'] => p:fresh",
  "p[style-name='Body Text Indent'] => p:fresh",
  "p[style-name='Body Text Indent 2'] => p:fresh",
  "p[style-name='Body Text Indent 3'] => p:fresh",
  "p[style-name='No Spacing'] => p:fresh",
  "p[style-name='Plain Text'] => p:fresh",
  "p[style-name='Normal (Web)'] => p:fresh",
  "p[style-name='Normal Indent'] => p:fresh",
  "p[style-name='macro'] => p:fresh",

  // --- List styles ---
  "p[style-name='List Paragraph'] => p:fresh",
  "p[style-name='List Number'] => ol > li:fresh",
  "p[style-name='List Number 2'] => ol > li:fresh",
  "p[style-name='List Number 3'] => ol > li:fresh",
  "p[style-name='List Bullet'] => ul > li:fresh",
  "p[style-name='List Bullet 2'] => ul > li:fresh",
  "p[style-name='List Bullet 3'] => ul > li:fresh",
  "p[style-name='List Continue'] => p:fresh",
  "p[style-name='List Continue 2'] => p:fresh",

  // --- Portuguese locale styles ---
  "p[style-name='Parágrafo da Lista'] => p:fresh",
  "p[style-name='Corpo de texto'] => p:fresh",
  "p[style-name='Corpo de texto 2'] => p:fresh",
  "p[style-name='Corpo de texto 3'] => p:fresh",
  "p[style-name='Sem Espaçamento'] => p:fresh",
  "p[style-name='Texto sem-formatação'] => p:fresh",
  "p[style-name='Título'] => h1:fresh",
  "p[style-name='Subtítulo'] => h2:fresh",
  "p[style-name='Citação'] => blockquote:fresh",
  "p[style-name='Citação Intensa'] => blockquote:fresh",

  // --- Headers, footers, other ---
  "p[style-name='Header'] => p:fresh",
  "p[style-name='Footer'] => p:fresh",
  "p[style-name='Footnote Text'] => p:fresh",
  "p[style-name='Endnote Text'] => p:fresh",
  "p[style-name='Caption'] => p:fresh",
  "p[style-name='TOC Heading'] => h2:fresh",
  "p[style-name='TOC 1'] => p:fresh",
  "p[style-name='TOC 2'] => p:fresh",
  "p[style-name='TOC 3'] => p:fresh",
  "p[style-name='Balloon Text'] => p:fresh",
  "p[style-name='Annotation Text'] => p:fresh",
  "p[style-name='Comment Text'] => p:fresh",

  // --- Character/Run styles ---
  "r[style-name='Strong'] => strong",
  "r[style-name='Emphasis'] => em",
  "r[style-name='Intense Emphasis'] => strong > em",
  "r[style-name='Subtle Emphasis'] => em",
  "r[style-name='Intense Reference'] => strong",
  "r[style-name='Book Title'] => strong > em",
]

/**
 * Post-process mammoth HTML output to convert manually numbered
 * paragraphs into proper <ol><li><p>...</p></li></ol> structures,
 * and bullet paragraphs into <ul><li><p>...</p></li></ul>.
 *
 * This handles cases where Word documents use "List Paragraph" style
 * without proper numbering XML, or where numbers are typed manually.
 */
function postProcessLists(html: string): string {
  if (typeof document === 'undefined') return html

  const wrapper = document.createElement('div')
  wrapper.innerHTML = html

  const result = document.createElement('div')
  const children = Array.from(wrapper.childNodes)

  // Regex for numbered items: "1." or "1)" with trailing space
  const numberedRegex = /^\s*(\d+)[\.\)]\s+/
  // Regex for bullet items: •, -, –, —, ►, ▪, ▸
  const bulletRegex = /^\s*[•\-–—►▪▸]\s+/

  let i = 0
  while (i < children.length) {
    const node = children[i]

    // Only process <p> elements — skip existing <ol>, <ul>, <h1>-<h3>, etc.
    if (!(node instanceof HTMLElement) || node.tagName !== 'P') {
      result.appendChild(node.cloneNode(true))
      i++
      continue
    }

    const text = node.textContent || ''

    // --- Detect numbered list paragraphs ---
    if (numberedRegex.test(text)) {
      const ol = document.createElement('ol')

      while (i < children.length) {
        const curr = children[i]
        if (!(curr instanceof HTMLElement) || curr.tagName !== 'P') break
        if (!numberedRegex.test(curr.textContent || '')) break

        const li = document.createElement('li')
        const p = document.createElement('p')
        p.innerHTML = removeLeadingPattern(curr as HTMLElement, numberedRegex)
        li.appendChild(p)
        ol.appendChild(li)
        i++
      }

      result.appendChild(ol)
      continue
    }

    // --- Detect bullet list paragraphs ---
    if (bulletRegex.test(text)) {
      const ul = document.createElement('ul')

      while (i < children.length) {
        const curr = children[i]
        if (!(curr instanceof HTMLElement) || curr.tagName !== 'P') break
        if (!bulletRegex.test(curr.textContent || '')) break

        const li = document.createElement('li')
        const p = document.createElement('p')
        p.innerHTML = removeLeadingPattern(curr as HTMLElement, bulletRegex)
        li.appendChild(p)
        ul.appendChild(li)
        i++
      }

      result.appendChild(ul)
      continue
    }

    result.appendChild(node.cloneNode(true))
    i++
  }

  return result.innerHTML
}

/**
 * Remove a leading text pattern from an element's innerHTML,
 * handling cases where the pattern may be inside nested elements
 * like <strong>1.</strong> or plain text.
 */
function removeLeadingPattern(el: HTMLElement, pattern: RegExp): string {
  const clone = el.cloneNode(true) as HTMLElement
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT)

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text
    const content = textNode.textContent || ''

    // Skip whitespace-only nodes
    if (!content.trim()) continue

    // Try to match and remove the pattern from the first significant text node
    const match = content.match(pattern)
    if (match) {
      textNode.textContent = content.substring(match[0].length)

      // If text node is now empty, remove its parent if the parent is also empty
      if (!textNode.textContent.trim() && textNode.parentElement && textNode.parentElement !== clone) {
        const parent = textNode.parentElement
        if (!parent.textContent?.trim()) {
          parent.remove()
        }
      }
    }
    break // Only process the first significant text node
  }

  return clone.innerHTML
}

/**
 * Extract paragraph alignment information from DOCX XML.
 * Parses the document.xml inside the DOCX ZIP to find paragraph justification.
 *
 * Returns a map of non-empty paragraph index → alignment.
 * Only counts paragraphs with text content (matching mammoth's ignoreEmptyParagraphs behavior).
 */
async function extractAlignments(arrayBuffer: ArrayBuffer): Promise<Map<number, string>> {
  const alignments = new Map<number, string>()

  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(arrayBuffer)
    const docXml = await zip.file('word/document.xml')?.async('string')
    if (!docXml) return alignments

    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(docXml, 'application/xml')

    // Map DOCX alignment values to CSS text-align
    const alignMap: Record<string, string> = {
      left: 'left',
      start: 'left',
      center: 'center',
      right: 'right',
      end: 'right',
      both: 'justify',
      distribute: 'justify',
    }

    const paragraphs = xmlDoc.getElementsByTagName('w:p')
    let nonEmptyIdx = 0

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i]

      // Check if the paragraph has text content (w:t elements)
      const textElements = para.getElementsByTagName('w:t')
      let hasText = false
      for (let t = 0; t < textElements.length; t++) {
        if (textElements[t].textContent?.trim()) {
          hasText = true
          break
        }
      }

      if (!hasText) continue // Skip empty paragraphs (mammoth skips them too)

      // Look for paragraph properties → justification
      const pPr = para.getElementsByTagName('w:pPr')[0]
      if (pPr) {
        const jc = pPr.getElementsByTagName('w:jc')[0]
        if (jc) {
          const val = jc.getAttribute('w:val')
          if (val) {
            const alignment = alignMap[val]
            if (alignment && alignment !== 'left') {
              alignments.set(nonEmptyIdx, alignment)
            }
          }
        }
      }

      nonEmptyIdx++
    }
  } catch {
    // If alignment extraction fails, continue without it
  }

  return alignments
}

/**
 * Apply extracted alignment information to the HTML output.
 * Maps non-empty paragraph indices from the DOCX XML to paragraph-level
 * elements in the HTML output (p, h1-h6, blockquote, li).
 */
function applyAlignments(html: string, alignments: Map<number, string>): string {
  if (typeof document === 'undefined' || alignments.size === 0) return html

  const wrapper = document.createElement('div')
  wrapper.innerHTML = html

  // Collect all paragraph-level elements in document order
  const paragraphElements: HTMLElement[] = []

  function collectParagraphs(parent: Element) {
    for (const child of Array.from(parent.children)) {
      const tag = child.tagName
      if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(tag)) {
        paragraphElements.push(child as HTMLElement)
      } else if (tag === 'OL' || tag === 'UL') {
        for (const li of Array.from(child.children)) {
          if (li.tagName === 'LI') {
            const innerP = li.querySelector('p')
            if (innerP) {
              paragraphElements.push(innerP)
            } else {
              paragraphElements.push(li as HTMLElement)
            }
          }
        }
      }
    }
  }

  collectParagraphs(wrapper)

  // Apply alignment to each paragraph element using the non-empty index from DOCX XML
  for (const [idx, alignment] of alignments) {
    const el = paragraphElements[idx]
    if (el) {
      el.style.textAlign = alignment
    }
  }

  return wrapper.innerHTML
}

/**
 * Filter warning messages to only show truly unrecognised styles.
 * Suppresses warnings for styles we've mapped but that mammoth still reports.
 */
function filterMessages(messages: string[]): string[] {
  const knownPatterns = [
    /Unrecogni[sz]ed paragraph style/i,
    /paragraph style.*was used but not defined/i,
  ]

  return messages.filter((msg) => {
    // Keep non-style messages (they might be important)
    if (!knownPatterns.some((p) => p.test(msg))) return true
    // Suppress style messages — our comprehensive styleMap handles them
    return false
  })
}

export async function convertDocxToHtml(file: File): Promise<{
  html: string
  variables: ParsedVariable[]
  messages: string[]
}> {
  const arrayBuffer = await file.arrayBuffer()

  // Extract alignment info from DOCX XML in parallel with mammoth conversion
  const [result, alignments] = await Promise.all([
    mammoth.convertToHtml(
      { arrayBuffer },
      {
        styleMap: DOCX_STYLE_MAP,
      }
    ),
    extractAlignments(arrayBuffer),
  ])

  let html = result.value

  // Post-process: convert manually numbered/bullet paragraphs to proper lists
  html = postProcessLists(html)

  // Post-process: apply text alignment from DOCX XML
  if (alignments.size > 0) {
    html = applyAlignments(html, alignments)
  }

  // Filter out noise from mammoth messages
  const messages = filterMessages(result.messages.map((m) => m.message))

  const keys = extractVariableKeysFromText(html)
  const variables: ParsedVariable[] = keys.map((key) => ({
    key,
    displayKey: `{{${key}}}`,
    isSystem: false,
    count: 1,
  }))

  return { html, variables, messages }
}
