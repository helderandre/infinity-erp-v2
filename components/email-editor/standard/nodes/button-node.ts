import { Node, mergeAttributes } from '@tiptap/core'
import {
  EMAIL_BUTTON_FORM_DEFAULTS,
  type EmailButtonFormProps,
} from '@/components/email-editor/shared/email-block-forms'

/**
 * Tiptap atom node for an email button.
 *
 * Stores the full set of props from the advanced-mode Craft.js `EmailButton`
 * component so both modes present identical settings. The rendered HTML in
 * the editor is a placeholder card carrying a URL-encoded JSON payload; the
 * email-renderer's `expandStandardMarkers` substitutes it with the real
 * button HTML via the canonical `renderButton()` function.
 */

export type EmailButtonAttrs = Required<EmailButtonFormProps>

export const EMAIL_BUTTON_DEFAULTS: EmailButtonAttrs = {
  ...EMAIL_BUTTON_FORM_DEFAULTS,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    emailButton: {
      insertEmailButton: (attrs?: Partial<EmailButtonAttrs>) => ReturnType
      updateEmailButton: (attrs: Partial<EmailButtonAttrs>) => ReturnType
    }
  }
}

function encodePayload(attrs: EmailButtonAttrs): string {
  return encodeURIComponent(JSON.stringify(attrs))
}

function decodePayload(raw: string | null): EmailButtonAttrs | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<EmailButtonAttrs>
    return { ...EMAIL_BUTTON_DEFAULTS, ...parsed }
  } catch {
    return null
  }
}

export const EmailButtonNode = Node.create({
  name: 'emailButton',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      text: { default: EMAIL_BUTTON_DEFAULTS.text },
      href: { default: EMAIL_BUTTON_DEFAULTS.href },
      backgroundColor: { default: EMAIL_BUTTON_DEFAULTS.backgroundColor },
      color: { default: EMAIL_BUTTON_DEFAULTS.color },
      borderRadius: { default: EMAIL_BUTTON_DEFAULTS.borderRadius },
      fontSize: { default: EMAIL_BUTTON_DEFAULTS.fontSize },
      paddingX: { default: EMAIL_BUTTON_DEFAULTS.paddingX },
      paddingY: { default: EMAIL_BUTTON_DEFAULTS.paddingY },
      align: { default: EMAIL_BUTTON_DEFAULTS.align },
      fullWidth: { default: EMAIL_BUTTON_DEFAULTS.fullWidth },
      boxShadow: { default: EMAIL_BUTTON_DEFAULTS.boxShadow },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-email-button]',
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
    const attrs = node.attrs as EmailButtonAttrs
    const payload = encodePayload(attrs)

    // Inline preview close to the final email look, so the editor is WYSIWYG.
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

    return [
      'div',
      mergeAttributes({
        'data-email-button': '',
        'data-payload': payload,
        style: `text-align: ${attrs.align}; margin: 8px 0;`,
      }),
      [
        'span',
        {
          style: innerStyle,
        },
        attrs.text,
      ],
    ]
  },

  addCommands() {
    return {
      insertEmailButton:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { ...EMAIL_BUTTON_DEFAULTS, ...attrs },
          }),
      updateEmailButton:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    }
  },
})
