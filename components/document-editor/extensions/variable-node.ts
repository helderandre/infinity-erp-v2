import { Node, mergeAttributes, InputRule } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { normalizeVariableKey } from '../utils/slugify'
import { VariableNodeView } from '../nodes/VariableNodeView'

export interface VariableNodeOptions {
  getIsSystem?: (key: string) => boolean
  onVariableClick?: (variableKey: string) => void
  mode?: 'template' | 'document'
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variable: {
      insertVariable: (key: string, isSystem?: boolean) => ReturnType
      wrapSelectionAsVariable: (key: string, isSystem?: boolean) => ReturnType
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
      getIsSystem: undefined,
      onVariableClick: undefined,
      mode: 'template',
    }
  },

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-variable-key'),
        renderHTML: (attrs) => ({ 'data-variable-key': attrs.key }),
      },
      isSystem: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-is-system') === 'true',
        renderHTML: (attrs) => ({ 'data-is-system': String(attrs.isSystem) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="variable"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-type': 'variable' }, HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableNodeView)
  },

  addCommands() {
    return {
      insertVariable:
        (key: string, isSystem?: boolean) =>
        ({ commands }) => {
          const normalized = normalizeVariableKey(key)
          if (!normalized) return false
          const system = isSystem ?? this.options.getIsSystem?.(normalized) ?? false
          return commands.insertContent({
            type: this.name,
            attrs: { key: normalized, isSystem: system },
          })
        },
      wrapSelectionAsVariable:
        (key: string, isSystem?: boolean) =>
        ({ chain, state }) => {
          const normalized = normalizeVariableKey(key)
          if (!normalized) return false
          const { from, to } = state.selection
          const system = isSystem ?? this.options.getIsSystem?.(normalized) ?? false
          return chain()
            .deleteRange({ from, to })
            .insertContentAt(from, {
              type: this.name,
              attrs: { key: normalized, isSystem: system },
            })
            .run()
        },
    }
  },

  addInputRules() {
    const variableInputRegex = /\{\{([a-zA-Z0-9\u00C0-\u024F\s\-_]+)\}\}$/

    return [
      new InputRule({
        find: variableInputRegex,
        handler: ({ state, range, match }) => {
          const { tr } = state
          const rawText = match[1]
          const key = normalizeVariableKey(rawText)

          if (!key) return

          const isSystem = this.options.getIsSystem?.(key) ?? false

          const node = state.schema.nodes.variable.create({
            key,
            isSystem,
          })

          tr.replaceWith(range.from, range.to, node)
        },
      }),
    ]
  },
})
