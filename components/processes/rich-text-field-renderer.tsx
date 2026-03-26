'use client'

import { useCallback, useState, useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import {
  FormItem, FormLabel, FormDescription, FormMessage,
} from '@/components/ui/form'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FieldRendererProps, FormRendererContext } from './dynamic-form-renderer'
import { PropertyDescriptionGenerator } from '@/components/properties/property-description-generator'

type Level = 1 | 2 | 3 | 4 | 5 | 6

const BLOCK_OPTIONS = [
  { value: 'paragraph', label: 'Parágrafo' },
  { value: 'h1', label: 'Título 1' },
  { value: 'h2', label: 'Título 2' },
  { value: 'h3', label: 'Título 3' },
  { value: 'h4', label: 'Título 4' },
  { value: 'h5', label: 'Título 5' },
  { value: 'h6', label: 'Título 6' },
]

export function RichTextFieldRenderer({ field, name, context }: FieldRendererProps & { context?: FormRendererContext }) {
  const form = useFormContext()
  const currentValue = form.watch(name) as string | null | undefined
  const [property, setProperty] = useState<any>(null)

  const isDescription = field.field_name === 'description'
  const propertyId = context?.propertyId

  // Fetch property data for AI generator (only for description fields)
  useEffect(() => {
    if (!isDescription || !propertyId) return
    fetch(`/api/properties/${propertyId}`)
      .then((r) => r.json())
      .then((data) => setProperty(data))
      .catch(() => {})
  }, [isDescription, propertyId])

  const handleUpdate = useCallback(
    ({ editor }: { editor: { getHTML: () => string; isEmpty: boolean } }) => {
      const html = editor.isEmpty ? '' : editor.getHTML()
      form.setValue(name, html, { shouldDirty: true, shouldValidate: true })
    },
    [form, name]
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Underline,
      Placeholder.configure({
        placeholder: field.placeholder || 'Escreva aqui...',
      }),
    ],
    content: currentValue || '',
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none min-h-[160px] px-3 py-2 focus:outline-none',
          '[&_p]:my-1',
          '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_li]:my-0.5',
          '[&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-2',
          '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:my-2',
          '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:my-1',
          '[&_h4]:text-sm [&_h4]:font-semibold [&_h4]:my-1',
          '[&_h5]:text-xs [&_h5]:font-semibold [&_h5]:my-1',
          '[&_h6]:text-xs [&_h6]:font-medium [&_h6]:my-1',
        ),
      },
    },
  })

  if (!editor) return null

  // Determine current block type for the select
  const getCurrentBlock = (): string => {
    for (let i = 1; i <= 6; i++) {
      if (editor.isActive('heading', { level: i })) return `h${i}`
    }
    return 'paragraph'
  }

  const handleBlockChange = (value: string) => {
    if (value === 'paragraph') {
      editor.chain().focus().setParagraph().run()
    } else {
      const level = parseInt(value.replace('h', '')) as Level
      editor.chain().focus().toggleHeading({ level }).run()
    }
  }

  return (
    <FormItem>
      <FormLabel>
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </FormLabel>

      <div className="rounded-md border focus-within:ring-1 focus-within:ring-ring">
        {/* Toolbar */}
        <div className="flex items-center gap-1 border-b px-1.5 py-1 flex-wrap">
          {/* Block type selector */}
          <Select value={getCurrentBlock()} onValueChange={handleBlockChange}>
            <SelectTrigger className="h-7 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BLOCK_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-5 mx-0.5" />

          {/* Inline formatting */}
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

          {/* Lists */}
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

          {/* AI description generator (only for description field with property context) */}
          {isDescription && propertyId && property && (
            <>
              <Separator orientation="vertical" className="h-5 mx-0.5" />
              <PropertyDescriptionGenerator
                propertyId={propertyId}
                property={property}
                existingDescription={currentValue || ''}
                onUseDescription={(desc) => {
                  // Convert markdown-ish bold to HTML and set in editor
                  const html = desc
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\n/g, '<br/>')
                  editor.commands.setContent(`<p>${html}</p>`)
                  form.setValue(name, editor.getHTML(), { shouldDirty: true, shouldValidate: true })
                }}
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Assistente IA</span>
                  </button>
                }
              />
            </>
          )}
        </div>

        {/* Editor */}
        <EditorContent editor={editor} />
      </div>

      {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
      <FormMessage />
    </FormItem>
  )
}
