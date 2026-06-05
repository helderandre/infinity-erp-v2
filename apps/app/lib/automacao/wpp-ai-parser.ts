import type { WhatsAppTemplateMessage } from '@/lib/types/whatsapp-template'

export interface WppAiMeta {
  name: string
  description: string
  category: string
}

export interface WppAiResult {
  messages: WhatsAppTemplateMessage[]
  meta: WppAiMeta | null
}

function extractBlock<T>(text: string, startMarker: string, endMarker: string): T | null {
  const startIdx = text.indexOf(startMarker)
  const endIdx = text.indexOf(endMarker)

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null

  const jsonStr = text.slice(startIdx + startMarker.length, endIdx).trim()

  try {
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

export function extractWppMeta(text: string): WppAiMeta | null {
  return extractBlock<WppAiMeta>(text, ':::WPP_META_START:::', ':::WPP_META_END:::')
}

export function extractWppMessages(text: string): WhatsAppTemplateMessage[] | null {
  const raw = extractBlock<Array<{ type: string; content: string; delay?: number }>>(
    text,
    ':::WPP_MESSAGES_START:::',
    ':::WPP_MESSAGES_END:::'
  )

  if (!raw || !Array.isArray(raw) || raw.length === 0) return null

  // Sanitize: ensure each message has a unique id and valid fields
  return raw.map((msg) => ({
    id: crypto.randomUUID(),
    type: 'text' as const,
    content: typeof msg.content === 'string' ? msg.content : '',
    delay: typeof msg.delay === 'number' ? Math.max(0, Math.min(30, msg.delay)) : 0,
  }))
}

export function extractWppAiResult(text: string): WppAiResult | null {
  const messages = extractWppMessages(text)
  if (!messages) return null
  const meta = extractWppMeta(text)
  return { messages, meta }
}

/**
 * Clean stream text — remove all marker blocks for preview display.
 */
export function cleanWppStreamText(text: string): string {
  let clean = text

  // Remove meta block
  const metaStart = clean.indexOf(':::WPP_META_START:::')
  const metaEnd = clean.indexOf(':::WPP_META_END:::')
  if (metaStart !== -1 && metaEnd !== -1) {
    clean = clean.slice(0, metaStart) + clean.slice(metaEnd + ':::WPP_META_END:::'.length)
  } else if (metaStart !== -1) {
    clean = clean.slice(0, metaStart)
  }

  // Remove messages block
  const msgStart = clean.indexOf(':::WPP_MESSAGES_START:::')
  if (msgStart !== -1) {
    clean = clean.slice(0, msgStart)
  }

  // Catch partial markers
  const partial = clean.indexOf(':::WPP_')
  if (partial !== -1) {
    clean = clean.slice(0, partial)
  }

  return clean.trim()
}
