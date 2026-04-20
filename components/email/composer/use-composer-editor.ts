'use client'

import { useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'

export interface UseComposerEditorOptions {
  initialHtml?: string
  onUpdate?: (html: string) => void
  placeholder?: string
  editable?: boolean
}

export function useComposerEditor({
  initialHtml = '',
  onUpdate,
  placeholder = 'Escreva a sua mensagem...',
  editable = true,
}: UseComposerEditorOptions): Editor | null {
  return useEditor({
    immediatelyRender: false,
    autofocus: 'start',
    editable,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        code: false,
        horizontalRule: false,
        heading: false,
      }),
      Underline,
      TextAlign.configure({
        types: ['paragraph', 'listItem'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          style: 'color: #1a73e8; text-decoration: underline;',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          style: 'max-width: 100%; height: auto; border-radius: 4px; margin: 4px 0;',
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialHtml,
    onUpdate: ({ editor }) => onUpdate?.(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          'tiptap-composer prose prose-sm max-w-none focus:outline-none min-h-[180px] px-4 py-3 text-sm leading-relaxed',
      },
    },
  })
}
