import { normalizeVariableKey } from './slugify'

export function decorateVariablesInHtml(
  html: string,
  systemKeys: string[] = []
): string {
  if (!html) return ''

  return html.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, rawKey: string) => {
    const key = normalizeVariableKey(String(rawKey))
    if (!key) return ''
    const isSystem = systemKeys.includes(key)
    return `<span data-type="variable" data-variable-key="${key}" data-is-system="${isSystem}">{{${key}}}</span>`
  })
}

export function stripVariableSpans(html: string): string {
  if (typeof window === 'undefined') {
    return html.replace(
      /<span[^>]*data-type="variable"[^>]*data-variable-key="([^"]+)"[^>]*>.*?<\/span>/g,
      (_match, key: string) => `{{${key}}}`
    )
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const nodes = doc.querySelectorAll('span[data-type="variable"][data-variable-key]')

  nodes.forEach((node) => {
    const key = node.getAttribute('data-variable-key') || ''
    const replacement = doc.createTextNode(`{{${key}}}`)
    node.replaceWith(replacement)
  })

  return doc.body.innerHTML
}
