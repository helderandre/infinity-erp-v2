import { Node, mergeAttributes } from '@tiptap/core'

export interface PropertyGridItem {
  title: string
  priceLabel: string
  location?: string
  specs?: string
  imageUrl?: string | null
  href: string
  reference?: string | null
}

export type PropertyGridMode = 'dynamic' | 'manual'

export interface EmailPropertyGridAttrs {
  /**
   * `dynamic`: the list is populated automatically at send-time (e.g. from a
   *   negócio dossier). Stored `properties` is ignored by the editor preview.
   * `manual`: the template author picked a fixed set of imóveis.
   */
  mode: PropertyGridMode
  properties: PropertyGridItem[]
  columns: number
  ctaLabel: string
}

const DEFAULT_ATTRS: EmailPropertyGridAttrs = {
  mode: 'dynamic',
  properties: [],
  columns: 3,
  ctaLabel: 'Ver imóvel',
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    emailPropertyGrid: {
      insertEmailPropertyGrid: (
        attrs?: Partial<EmailPropertyGridAttrs>
      ) => ReturnType
      updateEmailPropertyGrid: (
        attrs: Partial<EmailPropertyGridAttrs>
      ) => ReturnType
    }
  }
}

function encodePayload(attrs: EmailPropertyGridAttrs): string {
  return encodeURIComponent(JSON.stringify(attrs))
}

function decodePayload(raw: string | null): EmailPropertyGridAttrs | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<EmailPropertyGridAttrs>
    return { ...DEFAULT_ATTRS, ...parsed }
  } catch {
    return null
  }
}

export const EmailPropertyGridNode = Node.create({
  name: 'emailPropertyGrid',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      mode: { default: DEFAULT_ATTRS.mode },
      properties: {
        default: DEFAULT_ATTRS.properties,
        // stored in HTML via parseHTML/renderHTML below
      },
      columns: { default: DEFAULT_ATTRS.columns },
      ctaLabel: { default: DEFAULT_ATTRS.ctaLabel },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-email-property-grid]',
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
    const attrs = node.attrs as EmailPropertyGridAttrs
    const payload = encodePayload(attrs)
    const count = (attrs.properties ?? []).length

    const summary =
      attrs.mode === 'dynamic'
        ? `Dinâmica · preenchida automaticamente no envio · ${attrs.columns} coluna${attrs.columns === 1 ? '' : 's'}`
        : count === 0
          ? 'Seleccione imóveis para mostrar na grelha'
          : `${count} imóve${count === 1 ? 'l' : 'is'} · ${attrs.columns} coluna${attrs.columns === 1 ? '' : 's'} · CTA: ${attrs.ctaLabel}`

    return [
      'div',
      mergeAttributes({
        'data-email-property-grid': '',
        'data-payload': payload,
        style:
          'padding: 16px; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; font-family: Arial, sans-serif; color: #0f172a; font-size: 13px; margin: 8px 0;',
      }),
      [
        'div',
        { style: 'font-weight: 600; margin-bottom: 4px;' },
        '🏠 Grelha de Imóveis',
      ],
      [
        'div',
        { style: 'color: #64748b; font-size: 12px;' },
        summary,
      ],
    ]
  },

  addCommands() {
    return {
      insertEmailPropertyGrid:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { ...DEFAULT_ATTRS, ...attrs },
          }),
      updateEmailPropertyGrid:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    }
  },
})

export { DEFAULT_ATTRS as EMAIL_PROPERTY_GRID_DEFAULTS }
