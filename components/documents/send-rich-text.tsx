'use client'

import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
} from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'

interface SendRichTextProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeightClass?: string
}

export function SendRichText({
  value,
  onChange,
  placeholder,
  minHeightClass = 'min-h-[140px]',
}: SendRichTextProps) {
  const skipNextSync = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Underline,
      Placeholder.configure({ placeholder: placeholder || 'Escreva aqui...' }),
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      skipNextSync.current = true
      onChange(ed.isEmpty ? '' : ed.getHTML())
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none px-3 py-2 focus:outline-none',
          minHeightClass,
          '[&_p]:my-1',
          '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_li]:my-0.5'
        ),
      },
    },
    immediatelyRender: false,
  })

  // Sync external value changes (e.g., defaults reset) into the editor.
  useEffect(() => {
    if (!editor) return
    if (skipNextSync.current) {
      skipNextSync.current = false
      return
    }
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value || '', false)
    }
  }, [editor, value])

  if (!editor) {
    return (
      <div
        className={cn('rounded-md border bg-muted/30', minHeightClass)}
        aria-busy="true"
      />
    )
  }

  return (
    <div className="rounded-md border focus-within:ring-1 focus-within:ring-ring">
      <div className="flex flex-wrap items-center gap-1 border-b px-1.5 py-1">
        <Toggle
          size="sm"
          className="h-7 w-7 p-0"
          pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label="Negrito"
        >
          <Bold className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          className="h-7 w-7 p-0"
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Itálico"
        >
          <Italic className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          className="h-7 w-7 p-0"
          pressed={editor.isActive('underline')}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Sublinhado"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Toggle>
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        <Toggle
          size="sm"
          className="h-7 w-7 p-0"
          pressed={editor.isActive('bulletList')}
          onPressedChange={() =>
            editor.chain().focus().toggleBulletList().run()
          }
          aria-label="Lista"
        >
          <List className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          className="h-7 w-7 p-0"
          pressed={editor.isActive('orderedList')}
          onPressedChange={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
          aria-label="Lista numerada"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Toggle>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
