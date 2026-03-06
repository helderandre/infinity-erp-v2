import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export interface VariableNodeOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variableNode: {
      insertVariable: (key: string) => ReturnType
    }
  }
}

export const VariableNode = Node.create<VariableNodeOptions>({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      key: {
        default: '',
        parseHTML: (element) =>
          element.getAttribute('data-variable-key') ||
          element.textContent?.replace(/^\{\{|\}\}$/g, '').trim() ||
          '',
        renderHTML: (attributes) => ({
          'data-variable-key': attributes.key,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-variable-key]',
      },
      {
        tag: 'span.email-variable',
        getAttrs: (node) => {
          const el = node as HTMLElement
          const text = el.textContent || ''
          const match = text.match(/^\{\{(.+)\}\}$/)
          if (match) return { key: match[1].trim() }
          return false
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-variable-key': node.attrs.key,
        class: 'email-variable',
        contenteditable: 'false',
        style: [
          'background-color: color-mix(in oklch, var(--muted), transparent)',
          'border: 1px solid var(--border)',
          'border-radius: 6px',
          'padding: 1px 6px',
          'font-size: 0.85em',
          'font-family: ui-monospace, monospace',
          'white-space: nowrap',
          'user-select: all',
        ].join(';'),
      }),
      `{{${node.attrs.key}}}`,
    ]
  },

  addCommands() {
    return {
      insertVariable:
        (key: string) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: { key },
            })
            .run()
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('variablePaste'),
        props: {
          transformPasted: (slice) => {
            // Handle pasted content with {{variable}} patterns
            return slice
          },
        },
      }),
    ]
  },
})
