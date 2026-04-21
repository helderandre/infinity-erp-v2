import { Node, mergeAttributes } from '@tiptap/core'
import {
  EMAIL_ATTACHMENT_FORM_DEFAULTS,
  type EmailAttachmentFormProps,
} from '@/components/email-editor/shared/email-block-forms'

/**
 * Tiptap atom node for an email attachment.
 *
 * Stores the full set of props from the advanced-mode Craft.js
 * `EmailAttachment` component. Renders to a placeholder card with a
 * URL-encoded JSON payload; the email-renderer's `expandStandardMarkers`
 * expands it via the canonical `renderAttachment()` function.
 */

export type EmailAttachmentAttrs = Required<EmailAttachmentFormProps>

export const EMAIL_ATTACHMENT_DEFAULTS: EmailAttachmentAttrs = {
  ...EMAIL_ATTACHMENT_FORM_DEFAULTS,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    emailAttachment: {
      insertEmailAttachment: (attrs?: Partial<EmailAttachmentAttrs>) => ReturnType
      updateEmailAttachment: (attrs: Partial<EmailAttachmentAttrs>) => ReturnType
    }
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function encodePayload(attrs: EmailAttachmentAttrs): string {
  return encodeURIComponent(JSON.stringify(attrs))
}

function decodePayload(raw: string | null): EmailAttachmentAttrs | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<EmailAttachmentAttrs>
    return { ...EMAIL_ATTACHMENT_DEFAULTS, ...parsed }
  } catch {
    return null
  }
}

export const EmailAttachmentNode = Node.create({
  name: 'emailAttachment',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      label: { default: EMAIL_ATTACHMENT_DEFAULTS.label },
      description: { default: EMAIL_ATTACHMENT_DEFAULTS.description },
      docTypeId: { default: EMAIL_ATTACHMENT_DEFAULTS.docTypeId },
      required: { default: EMAIL_ATTACHMENT_DEFAULTS.required },
      fileUrl: { default: EMAIL_ATTACHMENT_DEFAULTS.fileUrl },
      fileName: { default: EMAIL_ATTACHMENT_DEFAULTS.fileName },
      fileSize: { default: EMAIL_ATTACHMENT_DEFAULTS.fileSize },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-email-attachment]',
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
    const attrs = node.attrs as EmailAttachmentAttrs
    const payload = encodePayload(attrs)
    const caption = attrs.fileName
      ? `${attrs.fileName}${attrs.fileSize > 0 ? ` (${formatFileSize(attrs.fileSize)})` : ''}`
      : 'Ficheiro por carregar'

    return [
      'div',
      mergeAttributes({
        'data-email-attachment': '',
        'data-payload': payload,
        style:
          'display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; margin: 8px 0; font-family: Arial, sans-serif; font-size: 13px; color: #374151;',
      }),
      ['span', { style: 'font-weight: 600; color: #111827;' }, attrs.label],
      ['span', { style: 'color: #6b7280;' }, '—'],
      ['span', { style: 'color: #6b7280; word-break: break-all;' }, caption],
    ]
  },

  addCommands() {
    return {
      insertEmailAttachment:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { ...EMAIL_ATTACHMENT_DEFAULTS, ...attrs },
          }),
      updateEmailAttachment:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    }
  },
})
