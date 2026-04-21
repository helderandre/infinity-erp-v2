/**
 * Helpers for the "standard" email editor mode — a Tiptap-driven experience
 * that persists to the same Craft.js editor_state as the advanced mode.
 *
 * Canonical shape:
 *   ROOT (EmailContainer, canvas)
 *     ├── HEADER (EmailHeader)
 *     ├── INNER  (EmailContainer, canvas) → [TEXT (EmailText)]
 *     ├── SIGNATURE (EmailSignature)
 *     └── FOOTER (EmailFooter)
 *
 * Standard mode also accepts advanced-authored states whose only non-envelope
 * content is representable in Tiptap (EmailText, EmailHeading, EmailImage,
 * EmailButton, EmailDivider, EmailAttachment). These nodes are serialized to
 * inline HTML on read and collapsed into a single EmailText on write. Nodes
 * outside that set (EmailGrid, EmailPropertyGrid, EmailPortalLinks,
 * EmailSpacer, nested EmailContainer) are counted as "dropped".
 */

const ROOT_ID = 'ROOT'
const HEADER_ID = 'standard-header'
const INNER_ID = 'standard-inner'
const TEXT_ID = 'standard-text'
const SIGNATURE_ID = 'standard-signature'
const FOOTER_ID = 'standard-footer'

type CraftNode = {
  type: { resolvedName: string }
  isCanvas?: boolean
  props: Record<string, unknown>
  displayName?: string
  custom?: Record<string, unknown>
  hidden?: boolean
  nodes: string[]
  linkedNodes: Record<string, string>
  parent: string | null
}

type CraftState = Record<string, CraftNode>

export interface BuildStandardStateInput {
  html: string
  signatureConsultantId?: string
}

/**
 * Build a canonical Craft.js editor state for the standard mode,
 * wrapping the given HTML as the sole EmailText child.
 */
export function buildStandardState({
  html,
  signatureConsultantId,
}: BuildStandardStateInput): string {
  const state: CraftState = {
    [ROOT_ID]: {
      type: { resolvedName: 'EmailContainer' },
      isCanvas: true,
      props: {
        padding: 0,
        background: '#ffffff',
        width: '100%',
        direction: 'column',
        align: 'stretch',
        justify: 'flex-start',
        gap: 0,
      },
      displayName: 'Contentor',
      custom: {},
      hidden: false,
      nodes: [HEADER_ID, INNER_ID, SIGNATURE_ID, FOOTER_ID],
      linkedNodes: {},
      parent: null,
    },
    [HEADER_ID]: {
      type: { resolvedName: 'EmailHeader' },
      isCanvas: false,
      props: {},
      displayName: 'Cabeçalho',
      custom: {},
      hidden: false,
      nodes: [],
      linkedNodes: {},
      parent: ROOT_ID,
    },
    [INNER_ID]: {
      type: { resolvedName: 'EmailContainer' },
      isCanvas: true,
      props: {
        padding: 24,
        background: '#ffffff',
        width: '100%',
        direction: 'column',
        align: 'stretch',
        justify: 'flex-start',
        gap: 8,
      },
      displayName: 'Contentor',
      custom: {},
      hidden: false,
      nodes: [TEXT_ID],
      linkedNodes: {},
      parent: ROOT_ID,
    },
    [TEXT_ID]: {
      type: { resolvedName: 'EmailText' },
      isCanvas: false,
      props: {
        html: html || '',
        fontSize: 15,
        color: '#404040',
        textAlign: 'left',
        lineHeight: 1.6,
        fontFamily: 'Arial, sans-serif',
      },
      displayName: 'Texto',
      custom: {},
      hidden: false,
      nodes: [],
      linkedNodes: {},
      parent: INNER_ID,
    },
    [SIGNATURE_ID]: {
      type: { resolvedName: 'EmailSignature' },
      isCanvas: false,
      props: signatureConsultantId ? { consultantId: signatureConsultantId } : {},
      displayName: 'Assinatura',
      custom: {},
      hidden: false,
      nodes: [],
      linkedNodes: {},
      parent: ROOT_ID,
    },
    [FOOTER_ID]: {
      type: { resolvedName: 'EmailFooter' },
      isCanvas: false,
      props: {},
      displayName: 'Rodapé',
      custom: {},
      hidden: false,
      nodes: [],
      linkedNodes: {},
      parent: ROOT_ID,
    },
  }

  return JSON.stringify(state)
}

// ─── Types representable in the standard Tiptap editor ───────────────────

const STANDARD_REPRESENTABLE_TYPES = new Set([
  'EmailText',
  'EmailHeading',
  'EmailImage',
  'EmailButton',
  'EmailDivider',
  'EmailAttachment',
  'EmailPropertyGrid',
  'EmailPortalLinks',
])

const ENVELOPE_TYPES = new Set([
  'EmailContainer',
  'EmailHeader',
  'EmailSignature',
  'EmailFooter',
])

const DROPPABLE_LABELS_PT: Record<string, string> = {
  EmailSpacer: 'espaçador',
  EmailGrid: 'grelha',
  EmailPortalLinks: 'links de portais',
  EmailPropertyGrid: 'grelha de imóveis',
}

/**
 * Human-readable PT-PT label for a dropped-block type, suitable for the
 * AlertDialog shown before a lossy mode switch.
 */
export function labelForDroppedType(type: string): string {
  return DROPPABLE_LABELS_PT[type] ?? type
}

// ─── HTML converters per advanced node type ──────────────────────────────

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderHeadingAsTiptap(props: Record<string, unknown>): string {
  const rawHtml = typeof props.html === 'string' ? props.html : ''
  const level = typeof props.level === 'string' ? props.level : 'h2'
  const lvl = /^h[1-4]$/i.test(level) ? level.toLowerCase() : 'h2'
  const textAlign = typeof props.textAlign === 'string' ? props.textAlign : 'left'
  const color = typeof props.color === 'string' ? props.color : undefined

  const styleParts: string[] = []
  if (textAlign && textAlign !== 'left') styleParts.push(`text-align: ${textAlign}`)
  if (color) styleParts.push(`color: ${color}`)
  const styleAttr = styleParts.length ? ` style="${styleParts.join('; ')}"` : ''

  return `<${lvl}${styleAttr}>${rawHtml}</${lvl}>`
}

/**
 * Converts advanced-mode `EmailImage` props to a payload-based marker div
 * matching the standard-mode `EmailImageNode.parseHTML` shape so the
 * Tiptap editor restores the full set of props (align, href, borderRadius,
 * boxShadow, width, height) instead of only src/alt/width from a bare <img>.
 */
function renderImageAsTiptap(props: Record<string, unknown>): string {
  const attrs = {
    src: typeof props.src === 'string' ? props.src : '',
    alt: typeof props.alt === 'string' ? props.alt : '',
    width: typeof props.width === 'number' ? props.width : 100,
    height: typeof props.height === 'number' ? props.height : 0,
    align: typeof props.align === 'string' ? props.align : 'center',
    href: typeof props.href === 'string' ? props.href : '',
    borderRadius:
      typeof props.borderRadius === 'string' ? props.borderRadius : '0px',
    boxShadow: typeof props.boxShadow === 'string' ? props.boxShadow : 'none',
  }
  const payload = encodeURIComponent(JSON.stringify(attrs))
  return (
    `<div data-email-image data-payload="${payload}" ` +
    `style="text-align: ${attrs.align}; margin: 8px 0;">` +
    (attrs.src
      ? `<img src="${escapeHtml(attrs.src)}" alt="${escapeHtml(attrs.alt)}" style="max-width: 100%; height: auto; display: block; margin: 0 auto; width: ${attrs.width}%;">`
      : `<div style="padding: 32px; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; color: #64748b; font-size: 13px; text-align: center;">Sem imagem</div>`) +
    `</div>`
  )
}

function renderButtonAsTiptap(props: Record<string, unknown>): string {
  const attrs = {
    text: typeof props.text === 'string' ? props.text : 'Clique aqui',
    href: typeof props.href === 'string' ? props.href : '#',
    backgroundColor:
      typeof props.backgroundColor === 'string' ? props.backgroundColor : '#576c98',
    color: typeof props.color === 'string' ? props.color : '#fafafa',
    borderRadius:
      typeof props.borderRadius === 'string' ? props.borderRadius : '65px',
    fontSize: typeof props.fontSize === 'number' ? props.fontSize : 16,
    paddingX: typeof props.paddingX === 'number' ? props.paddingX : 24,
    paddingY: typeof props.paddingY === 'number' ? props.paddingY : 12,
    align: typeof props.align === 'string' ? props.align : 'center',
    fullWidth: props.fullWidth === true,
    boxShadow: typeof props.boxShadow === 'string' ? props.boxShadow : 'none',
  }
  const payload = encodeURIComponent(JSON.stringify(attrs))

  const innerStyle = [
    'display: inline-block',
    `background: ${attrs.backgroundColor}`,
    `color: ${attrs.color}`,
    `padding: ${attrs.paddingY}px ${attrs.paddingX}px`,
    `border-radius: ${attrs.borderRadius}`,
    `font-size: ${attrs.fontSize}px`,
    'font-family: Arial, sans-serif',
    'font-weight: 600',
    'text-decoration: none',
    'line-height: 1.2',
    attrs.fullWidth ? 'width: 100%; text-align: center;' : '',
    attrs.boxShadow !== 'none' ? `box-shadow: ${attrs.boxShadow}` : '',
  ]
    .filter(Boolean)
    .join('; ')

  return (
    `<div data-email-button data-payload="${payload}" ` +
    `style="text-align: ${attrs.align}; margin: 8px 0;">` +
    `<span style="${innerStyle}">${escapeHtml(attrs.text)}</span>` +
    `</div>`
  )
}

function renderDividerAsTiptap(): string {
  return '<hr>'
}

function renderPropertyGridAsTiptap(props: Record<string, unknown>): string {
  const properties = Array.isArray(props.properties) ? props.properties : []
  // Advanced-mode templates predated the `mode` attr — if properties is
  // non-empty assume manual; otherwise dynamic.
  const explicitMode =
    props.mode === 'manual' || props.mode === 'dynamic' ? props.mode : null
  const mode = explicitMode ?? (properties.length > 0 ? 'manual' : 'dynamic')
  const attrs = {
    mode,
    properties,
    columns: typeof props.columns === 'number' ? props.columns : 3,
    ctaLabel:
      typeof props.ctaLabel === 'string' ? (props.ctaLabel as string) : 'Ver imóvel',
  }
  const payload = encodeURIComponent(JSON.stringify(attrs))
  const count = properties.length
  const summary =
    mode === 'dynamic'
      ? `Dinâmica · preenchida automaticamente no envio · ${attrs.columns} coluna${attrs.columns === 1 ? '' : 's'}`
      : `${count} imóve${count === 1 ? 'l' : 'is'} · ${attrs.columns} coluna${attrs.columns === 1 ? '' : 's'} · CTA: ${escapeHtml(attrs.ctaLabel)}`
  return (
    `<div data-email-property-grid data-payload="${payload}" ` +
    `style="padding: 16px; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; font-family: Arial, sans-serif; color: #0f172a; font-size: 13px; margin: 8px 0;">` +
    `<div style="font-weight: 600; margin-bottom: 4px;">🏠 Grelha de Imóveis</div>` +
    `<div style="color: #64748b; font-size: 12px;">${summary}</div>` +
    `</div>`
  )
}

function renderPortalLinksAsTiptap(props: Record<string, unknown>): string {
  const attrs = {
    portals: Array.isArray(props.portals) ? props.portals : [],
    title: typeof props.title === 'string' ? props.title : 'Anúncios nos Portais',
    showTitle: typeof props.showTitle === 'boolean' ? props.showTitle : true,
    layout:
      props.layout === 'horizontal' ? 'horizontal' : 'vertical',
    gap: typeof props.gap === 'number' ? props.gap : 12,
    borderRadius:
      typeof props.borderRadius === 'string' ? props.borderRadius : '8px',
    cardBackground:
      typeof props.cardBackground === 'string' ? props.cardBackground : '#f9fafb',
    boxShadow: typeof props.boxShadow === 'string' ? props.boxShadow : 'none',
  }
  const payload = encodeURIComponent(JSON.stringify(attrs))
  const count = (attrs.portals as unknown[]).length
  return (
    `<div data-email-portal-links data-payload="${payload}" ` +
    `style="padding: 16px; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; font-family: Arial, sans-serif; color: #0f172a; font-size: 13px; margin: 8px 0;">` +
    `<div style="font-weight: 600; margin-bottom: 4px;">🔗 Links de Portais</div>` +
    `<div style="color: #64748b; font-size: 12px;">${count} portal${count === 1 ? '' : 'is'} · layout ${attrs.layout}</div>` +
    `</div>`
  )
}

function renderAttachmentAsTiptap(props: Record<string, unknown>): string {
  const attrs = {
    label: typeof props.label === 'string' ? props.label : 'Documento anexo',
    description: typeof props.description === 'string' ? props.description : '',
    docTypeId: typeof props.docTypeId === 'string' ? props.docTypeId : '',
    required: props.required !== false,
    fileUrl: typeof props.fileUrl === 'string' ? props.fileUrl : '',
    fileName: typeof props.fileName === 'string' ? props.fileName : '',
    fileSize: typeof props.fileSize === 'number' ? props.fileSize : 0,
  }
  const payload = encodeURIComponent(JSON.stringify(attrs))
  const caption = attrs.fileName
    ? `${attrs.fileName}${attrs.fileSize > 0 ? ` (${(attrs.fileSize / 1024).toFixed(1)} KB)` : ''}`
    : 'Ficheiro por carregar'

  return (
    `<div data-email-attachment data-payload="${payload}" ` +
    `style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; margin: 8px 0; font-family: Arial, sans-serif; font-size: 13px; color: #374151;">` +
    `<span style="font-weight: 600; color: #111827;">${escapeHtml(attrs.label)}</span>` +
    `<span style="color: #6b7280;">—</span>` +
    `<span style="color: #6b7280; word-break: break-all;">${escapeHtml(caption)}</span>` +
    `</div>`
  )
}

function renderNodeAsTiptap(
  node: CraftNode | undefined
): { html: string; representable: boolean } {
  if (!node?.type?.resolvedName) return { html: '', representable: true }
  const type = node.type.resolvedName
  const props = node.props ?? {}

  if (type === 'EmailText') {
    return {
      html: typeof props.html === 'string' ? props.html : '',
      representable: true,
    }
  }
  if (type === 'EmailHeading') {
    return { html: renderHeadingAsTiptap(props), representable: true }
  }
  if (type === 'EmailImage') {
    return { html: renderImageAsTiptap(props), representable: true }
  }
  if (type === 'EmailButton') {
    return { html: renderButtonAsTiptap(props), representable: true }
  }
  if (type === 'EmailDivider') {
    return { html: renderDividerAsTiptap(), representable: true }
  }
  if (type === 'EmailAttachment') {
    return { html: renderAttachmentAsTiptap(props), representable: true }
  }
  if (type === 'EmailPropertyGrid') {
    return { html: renderPropertyGridAsTiptap(props), representable: true }
  }
  if (type === 'EmailPortalLinks') {
    return { html: renderPortalLinksAsTiptap(props), representable: true }
  }
  return { html: '', representable: false }
}

// ─── Extraction & compatibility ──────────────────────────────────────────

export interface ExtractStandardContentResult {
  /** HTML that the standard Tiptap editor can parse. */
  html: string
  /** Count of blocks that will be lost when converting to standard. */
  droppedCount: number
  /** Breakdown of dropped blocks by `resolvedName` → count. */
  droppedByType: Record<string, number>
}

/**
 * Walk an editor_state, concatenate a Tiptap-compatible HTML document from
 * every representable node (EmailText + headings/images/buttons/dividers/
 * attachments), and count non-representable nodes as dropped.
 *
 * Envelope nodes (EmailContainer, EmailHeader, EmailSignature, EmailFooter)
 * are always transparent — they don't contribute HTML and don't count as
 * dropped — the envelope is reinstated in the canonical shape.
 */
export function extractStandardContent(
  editorState: string | null | undefined
): ExtractStandardContentResult {
  const empty: ExtractStandardContentResult = {
    html: '',
    droppedCount: 0,
    droppedByType: {},
  }
  if (!editorState) return empty

  let state: CraftState
  try {
    state = JSON.parse(editorState) as CraftState
  } catch {
    return empty
  }

  if (!state[ROOT_ID]) return empty

  const htmlParts: string[] = []
  const droppedByType: Record<string, number> = {}
  const visited = new Set<string>()

  function walk(nodeId: string) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    const node = state[nodeId]
    if (!node) return

    const typeName = node.type?.resolvedName

    // Envelope containers are transparent — recurse into children without
    // contributing to HTML or dropped counts.
    if (typeName && ENVELOPE_TYPES.has(typeName)) {
      for (const childId of node.nodes ?? []) walk(childId)
      for (const linkedId of Object.values(node.linkedNodes ?? {})) walk(linkedId)
      return
    }

    const converted = renderNodeAsTiptap(node)
    if (converted.representable) {
      if (converted.html.trim()) htmlParts.push(converted.html)
      return
    }

    // Non-representable leaf-like node — count as dropped and still try to
    // recover any nested EmailText inside.
    if (typeName) {
      droppedByType[typeName] = (droppedByType[typeName] ?? 0) + 1
    }
    for (const childId of node.nodes ?? []) walk(childId)
    for (const linkedId of Object.values(node.linkedNodes ?? {})) walk(linkedId)
  }

  walk(ROOT_ID)

  const droppedCount = Object.values(droppedByType).reduce((a, b) => a + b, 0)
  return {
    html: htmlParts.join('\n'),
    droppedCount,
    droppedByType,
  }
}

/**
 * Returns true when all non-envelope nodes in the state are representable
 * inside the standard Tiptap editor. Used by the page-level heuristic to
 * decide whether to open a template in standard mode.
 *
 * This is a looser check than the "canonical shape" test — any advanced
 * state composed of text/headings/images/buttons/dividers/attachments plus
 * the envelope is considered standard-compatible.
 */
export function isStandardCompatible(
  editorState: string | null | undefined
): boolean {
  if (!editorState) return false
  try {
    const state = JSON.parse(editorState) as CraftState
    if (!state[ROOT_ID]) return false
    const root = state[ROOT_ID]
    if (root.type?.resolvedName !== 'EmailContainer') return false

    // Quick check: any non-envelope, non-representable node anywhere?
    for (const node of Object.values(state)) {
      const type = node?.type?.resolvedName
      if (!type) continue
      if (ENVELOPE_TYPES.has(type)) continue
      if (!STANDARD_REPRESENTABLE_TYPES.has(type)) return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Strict check: the state has the EXACT canonical standard shape —
 *   ROOT (EmailContainer) → [EmailHeader, EmailContainer (inner) → [EmailText], EmailSignature, EmailFooter]
 *
 * Use this for deciding whether `syncStandardToCraft` can take the fast
 * path (setProp on the single EmailText). When the state has multiple
 * content nodes (e.g. AI-generated: heading + text + divider + button),
 * the fast path would leave the extra nodes in place and cause duplication.
 */
export function isStandardCanonical(
  editorState: string | null | undefined
): boolean {
  if (!editorState) return false
  try {
    const state = JSON.parse(editorState) as CraftState
    const root = state[ROOT_ID]
    if (!root || root.type?.resolvedName !== 'EmailContainer') return false

    const rootChildren = root.nodes ?? []
    if (rootChildren.length !== 4) return false

    const [headerId, innerId, signatureId, footerId] = rootChildren
    const header = state[headerId]
    const inner = state[innerId]
    const signature = state[signatureId]
    const footer = state[footerId]

    if (header?.type?.resolvedName !== 'EmailHeader') return false
    if (inner?.type?.resolvedName !== 'EmailContainer') return false
    if (signature?.type?.resolvedName !== 'EmailSignature') return false
    if (footer?.type?.resolvedName !== 'EmailFooter') return false

    const innerChildren = inner.nodes ?? []
    if (innerChildren.length !== 1) return false
    const text = state[innerChildren[0]]
    if (text?.type?.resolvedName !== 'EmailText') return false

    return true
  } catch {
    return false
  }
}

/**
 * Read the `consultantId` prop stored on the EmailSignature node. Returns
 * `null` when absent.
 */
export function readStandardSignatureConsultantId(
  editorState: string | null | undefined
): string | null {
  if (!editorState) return null
  try {
    const state = JSON.parse(editorState) as CraftState
    const sig = Object.values(state).find(
      (n) => n?.type?.resolvedName === 'EmailSignature'
    )
    const val = sig?.props?.consultantId
    return typeof val === 'string' && val ? val : null
  } catch {
    return null
  }
}

export const STANDARD_NODE_IDS = {
  ROOT: ROOT_ID,
  HEADER: HEADER_ID,
  INNER: INNER_ID,
  TEXT: TEXT_ID,
  SIGNATURE: SIGNATURE_ID,
  FOOTER: FOOTER_ID,
} as const
