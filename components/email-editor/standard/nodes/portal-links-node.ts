import { Node, mergeAttributes } from '@tiptap/core'

export interface PortalEntry {
  portal: string
  name: string
  url: string
}

export interface EmailPortalLinksAttrs {
  portals: PortalEntry[]
  title: string
  showTitle: boolean
  layout: 'vertical' | 'horizontal'
  gap: number
  borderRadius: string
  cardBackground: string
  boxShadow: string
}

const DEFAULT_ATTRS: EmailPortalLinksAttrs = {
  portals: [],
  title: 'Anúncios nos Portais',
  showTitle: true,
  layout: 'vertical',
  gap: 12,
  borderRadius: '8px',
  cardBackground: '#f9fafb',
  boxShadow: 'none',
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    emailPortalLinks: {
      insertEmailPortalLinks: (
        attrs?: Partial<EmailPortalLinksAttrs>
      ) => ReturnType
      updateEmailPortalLinks: (
        attrs: Partial<EmailPortalLinksAttrs>
      ) => ReturnType
    }
  }
}

function encodePayload(attrs: EmailPortalLinksAttrs): string {
  return encodeURIComponent(JSON.stringify(attrs))
}

function decodePayload(raw: string | null): EmailPortalLinksAttrs | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<EmailPortalLinksAttrs>
    return { ...DEFAULT_ATTRS, ...parsed }
  } catch {
    return null
  }
}

export const EmailPortalLinksNode = Node.create({
  name: 'emailPortalLinks',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      portals: { default: DEFAULT_ATTRS.portals },
      title: { default: DEFAULT_ATTRS.title },
      showTitle: { default: DEFAULT_ATTRS.showTitle },
      layout: { default: DEFAULT_ATTRS.layout },
      gap: { default: DEFAULT_ATTRS.gap },
      borderRadius: { default: DEFAULT_ATTRS.borderRadius },
      cardBackground: { default: DEFAULT_ATTRS.cardBackground },
      boxShadow: { default: DEFAULT_ATTRS.boxShadow },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-email-portal-links]',
        getAttrs: (el) => {
          if (typeof el === 'string') return false
          const decoded = decodePayload(el.getAttribute('data-payload'))
          if (!decoded) return false
          return decoded
        },
      },
    ]
  },

  renderHTML({ node }) {
    const attrs = node.attrs as EmailPortalLinksAttrs
    const payload = encodePayload(attrs)
    const count = (attrs.portals ?? []).length

    return [
      'div',
      mergeAttributes({
        'data-email-portal-links': '',
        'data-payload': payload,
        style:
          'padding: 16px; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; font-family: Arial, sans-serif; color: #0f172a; font-size: 13px; margin: 8px 0;',
      }),
      [
        'div',
        { style: 'font-weight: 600; margin-bottom: 4px;' },
        '🔗 Links de Portais',
      ],
      [
        'div',
        { style: 'color: #64748b; font-size: 12px;' },
        count === 0
          ? 'Clique duas vezes para configurar os portais'
          : `${count} portal${count === 1 ? '' : 'is'} · layout ${attrs.layout === 'vertical' ? 'vertical' : 'horizontal'}`,
      ],
    ]
  },

  addCommands() {
    return {
      insertEmailPortalLinks:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { ...DEFAULT_ATTRS, ...attrs },
          }),
      updateEmailPortalLinks:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    }
  },
})

export { DEFAULT_ATTRS as EMAIL_PORTAL_LINKS_DEFAULTS }
