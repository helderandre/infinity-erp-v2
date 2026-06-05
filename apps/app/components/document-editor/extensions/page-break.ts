import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      setPageBreak: () => ReturnType
    }
  }
}

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,

  parseHTML() {
    return [
      { tag: 'div[data-type="page-break"]' },
      {
        tag: 'div',
        getAttrs: (el) =>
          (el as HTMLElement).style.pageBreakAfter === 'always' ? null : false,
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'page-break',
        style: 'page-break-after: always;',
        class:
          "my-4 border-t-2 border-dashed border-muted-foreground/30 relative after:content-['Quebra_de_pagina'] after:absolute after:left-1/2 after:-translate-x-1/2 after:-top-3 after:bg-background after:px-2 after:text-xs after:text-muted-foreground",
      }),
    ]
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name })
        },
    }
  },
})
