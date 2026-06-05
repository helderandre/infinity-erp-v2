import { Node, mergeAttributes } from '@tiptap/core'
import {
  EMAIL_IMAGE_FORM_DEFAULTS,
  type EmailImageFormProps,
} from '@/components/email-editor/shared/email-block-forms'

/**
 * Tiptap atom node for an email image.
 *
 * Stores the full set of props from the advanced-mode Craft.js `EmailImage`
 * component. Renders a placeholder div with a URL-encoded JSON payload;
 * the email-renderer's `expandStandardMarkers` expands it via the canonical
 * `renderImage()` function.
 */

export type EmailImageAttrs = Required<EmailImageFormProps>

export const EMAIL_IMAGE_DEFAULTS: EmailImageAttrs = {
  ...EMAIL_IMAGE_FORM_DEFAULTS,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    emailImage: {
      insertEmailImage: (attrs?: Partial<EmailImageAttrs>) => ReturnType
      updateEmailImage: (attrs: Partial<EmailImageAttrs>) => ReturnType
    }
  }
}

function encodePayload(attrs: EmailImageAttrs): string {
  return encodeURIComponent(JSON.stringify(attrs))
}

function decodePayload(raw: string | null): EmailImageAttrs | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<EmailImageAttrs>
    return { ...EMAIL_IMAGE_DEFAULTS, ...parsed }
  } catch {
    return null
  }
}

export const EmailImageNode = Node.create({
  name: 'emailImage',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: EMAIL_IMAGE_DEFAULTS.src },
      alt: { default: EMAIL_IMAGE_DEFAULTS.alt },
      width: { default: EMAIL_IMAGE_DEFAULTS.width },
      height: { default: EMAIL_IMAGE_DEFAULTS.height },
      align: { default: EMAIL_IMAGE_DEFAULTS.align },
      href: { default: EMAIL_IMAGE_DEFAULTS.href },
      borderRadius: { default: EMAIL_IMAGE_DEFAULTS.borderRadius },
      boxShadow: { default: EMAIL_IMAGE_DEFAULTS.boxShadow },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-email-image]',
        getAttrs: (el) => {
          if (typeof el === 'string') return false
          const decoded = decodePayload(el.getAttribute('data-payload'))
          if (!decoded) return false
          return decoded
        },
      },
      // Fallback: plain <img> tags (from legacy content or AI-generated HTML)
      {
        tag: 'img[src]',
        priority: 40,
        getAttrs: (el) => {
          if (typeof el === 'string') return false
          const src = el.getAttribute('src') || ''
          const alt = el.getAttribute('alt') || ''
          const widthAttr = el.getAttribute('width')
          const width = widthAttr ? parseInt(widthAttr, 10) || 100 : 100
          return {
            ...EMAIL_IMAGE_DEFAULTS,
            src,
            alt,
            width,
          }
        },
      },
    ]
  },

  renderHTML({ node }) {
    const attrs = node.attrs as EmailImageAttrs
    const payload = encodePayload(attrs)

    if (!attrs.src) {
      return [
        'div',
        mergeAttributes({
          'data-email-image': '',
          'data-payload': payload,
          style:
            'padding: 32px; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; color: #64748b; font-size: 13px; text-align: center; margin: 8px 0;',
        }),
        'Sem imagem — clique duas vezes para configurar.',
      ]
    }

    const imgStyle = [
      'display: block',
      'max-width: 100%',
      attrs.height > 0 ? `height: ${attrs.height}px` : 'height: auto',
      'border: 0',
      attrs.borderRadius !== '0px' ? `border-radius: ${attrs.borderRadius}` : '',
      attrs.boxShadow !== 'none' ? `box-shadow: ${attrs.boxShadow}` : '',
    ]
      .filter(Boolean)
      .join('; ')

    const widthPercent = Math.max(10, Math.min(100, attrs.width || 100))

    return [
      'div',
      mergeAttributes({
        'data-email-image': '',
        'data-payload': payload,
        style: `text-align: ${attrs.align}; margin: 8px 0;`,
      }),
      [
        'img',
        {
          src: attrs.src,
          alt: attrs.alt,
          style: `${imgStyle}; width: ${widthPercent}%;`,
        },
      ],
    ]
  },

  addCommands() {
    return {
      insertEmailImage:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { ...EMAIL_IMAGE_DEFAULTS, ...attrs },
          }),
      updateEmailImage:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    }
  },
})
