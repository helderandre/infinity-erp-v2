import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType
      outdent: () => ReturnType
    }
  }
}

export const Indent = Extension.create({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      indentUnit: 24,
      maxIndent: 4,
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const value = element.style.marginLeft || '0'
              const num = parseInt(value, 10)
              return Number.isNaN(num) ? 0 : Math.round(num / this.options.indentUnit)
            },
            renderHTML: (attributes) => {
              const indent = Number(attributes.indent) || 0
              if (indent <= 0) return {}
              return {
                style: `margin-left: ${indent * this.options.indentUnit}px`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ commands, state }) => {
          const { selection } = state
          const { from, to } = selection
          let updated = false

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!this.options.types.includes(node.type.name)) return
            const indent = Math.min((node.attrs.indent || 0) + 1, this.options.maxIndent)
            commands.command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent,
              })
              return true
            })
            updated = true
          })

          return updated
        },
      outdent:
        () =>
        ({ commands, state }) => {
          const { selection } = state
          const { from, to } = selection
          let updated = false

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!this.options.types.includes(node.type.name)) return
            const indent = Math.max((node.attrs.indent || 0) - 1, 0)
            commands.command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent,
              })
              return true
            })
            updated = true
          })

          return updated
        },
    }
  },
})
