'use client'

import { useCallback, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalendarRichEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  toolbarExtra?: React.ReactNode
}

export function CalendarRichEditor({
  value,
  onChange,
  placeholder = 'Escreva aqui...',
  className,
  toolbarExtra,
}: CalendarRichEditorProps) {
  const handleUpdate = useCallback(
    ({ editor }: { editor: { getHTML: () => string; isEmpty: boolean } }) => {
      const html = editor.isEmpty ? '' : editor.getHTML()
      onChange(html)
    },
    [onChange]
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
      }),
      Underline,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none min-h-[100px] px-3 py-2 focus:outline-none text-sm',
          '[&_p]:my-0.5',
          '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_li]:my-0.5',
          '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-1',
          '[&_strong]:font-semibold',
        ),
      },
    },
  })

  // Sync external value changes (e.g. from AI improve or voice)
  useEffect(() => {
    if (!editor) return
    const currentHtml = editor.getHTML()
    // Only update if value differs (avoid cursor jump)
    if (value && value !== currentHtml && value !== '<p></p>') {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  if (!editor) return null

  return (
    <div className={cn('rounded-md border focus-within:ring-1 focus-within:ring-ring', className)}>
      {/* Compact toolbar */}
      <div className="flex items-center gap-0.5 border-b px-1.5 py-1 flex-wrap">
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

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Toggle
          size="sm"
          className="h-7 w-7 p-0"
          pressed={editor.isActive('bulletList')}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Lista"
        >
          <List className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          className="h-7 w-7 p-0"
          pressed={editor.isActive('orderedList')}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Lista numerada"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Toggle>

        {toolbarExtra && (
          <>
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            {toolbarExtra}
          </>
        )}
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}

/** Read-only renderer for rich text HTML content */
export function RichTextContent({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none text-sm',
        '[&_p]:my-0.5',
        '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_li]:my-0.5',
        '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-1',
        '[&_strong]:font-semibold',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
