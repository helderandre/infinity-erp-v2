import type { DocumentDomain } from '@/components/documents/types'

export function buildDefaultSubject(opts: {
  domain: DocumentDomain
  entityRef?: string | null
}): string {
  const base = 'Documentos'
  if (opts.entityRef) return `${base} — ${opts.entityRef}`
  return opts.domain === 'processes' ? `${base} — Processo` : `${base} — Imóvel`
}

export function buildDefaultEmailBody(opts: {
  folderNames: string[]
  entityRef?: string | null
  senderName?: string | null
}): string {
  const list = opts.folderNames.length
    ? opts.folderNames.map((n) => `<li>${escapeHtml(n)}</li>`).join('')
    : ''
  const ref = opts.entityRef ? ` (ref. ${escapeHtml(opts.entityRef)})` : ''
  const signature = opts.senderName
    ? `<p>Cumprimentos,<br/>${escapeHtml(opts.senderName)}</p>`
    : '<p>Cumprimentos</p>'
  const listSection = list
    ? `<p>Em anexo segue a documentação solicitada${ref}:</p><ul>${list}</ul>`
    : `<p>Em anexo segue a documentação solicitada${ref}.</p>`
  return `<p>Olá,</p>${listSection}${signature}`
}

export function buildDefaultWhatsappMessage(opts: {
  folderNames: string[]
  entityRef?: string | null
}): string {
  const ref = opts.entityRef ? ` (ref. ${opts.entityRef})` : ''
  if (opts.folderNames.length === 0) {
    return `Segue em anexo a documentação solicitada${ref}.`
  }
  const list = opts.folderNames.map((n) => `• ${n}`).join('\n')
  return `Segue em anexo a documentação solicitada${ref}:\n${list}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── Limits (shared across send flows) ─────────────────────────────────────

export const MAX_RECIPIENTS_PER_CHANNEL = 20
export const MAX_PROPERTY_IDS_PER_SEND = 20
export const MAX_FILES_PER_SEND = 30

// ─── Property-send defaults ────────────────────────────────────────────────

export function buildDefaultPropertiesSubject(opts: {
  entityLabel?: string | null
  count: number
}): string {
  if (opts.count === 1) return 'Sugestão de imóvel' + (opts.entityLabel ? ` — ${opts.entityLabel}` : '')
  return `Sugestão de ${opts.count} imóveis` + (opts.entityLabel ? ` — ${opts.entityLabel}` : '')
}

export function buildDefaultPropertiesIntro(opts: {
  leadFirstName?: string | null
  senderName?: string | null
  count: number
}): string {
  const greeting = opts.leadFirstName
    ? `<p>Olá ${escapeHtml(opts.leadFirstName)},</p>`
    : '<p>Olá,</p>'
  const body =
    opts.count === 1
      ? '<p>Partilho consigo o imóvel em baixo, que penso encaixar no seu perfil de procura.</p>'
      : `<p>Partilho consigo ${opts.count} imóveis que penso encaixarem no seu perfil de procura.</p>`
  const signature = opts.senderName
    ? `<p>Cumprimentos,<br/>${escapeHtml(opts.senderName)}</p>`
    : ''
  return `${greeting}${body}${signature}`
}

export function buildDefaultPropertiesWhatsappMessage(opts: {
  leadFirstName?: string | null
  properties: Array<{ title: string; priceLabel: string; href: string }>
}): string {
  const greeting = opts.leadFirstName ? `Olá ${opts.leadFirstName},` : 'Olá,'
  const intro =
    opts.properties.length === 1
      ? 'partilho o imóvel abaixo:'
      : `partilho os ${opts.properties.length} imóveis abaixo:`
  const list = opts.properties
    .map((p, i) => `${i + 1}. ${p.title} — ${p.priceLabel}\n${p.href}`)
    .join('\n\n')
  return `${greeting} ${intro}\n\n${list}`
}
