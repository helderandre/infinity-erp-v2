'use client'

import { BubbleMenu, type Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
} from 'lucide-react'
import { useState, useCallback } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'

const PRESET_COLORS = [
  '#000000',
  '#333333',
  '#666666',
  '#999999',
  '#DC2626',
  '#2563EB',
  '#16A34A',
  '#D97706',
  '#7C3AED',
  '#EC4899',
]

interface EmailBubbleMenuProps {
  editor: Editor
}

export function EmailBubbleMenu({ editor }: EmailBubbleMenuProps) {
  const [colorOpen, setColorOpen] = useState(false)
  const [customColor, setCustomColor] = useState('')

  const applyColor = useCallback(
    (color: string) => {
      editor.chain().focus().setColor(color).run()
      setColorOpen(false)
    },
    [editor]
  )

  const currentColor =
    (editor.getAttributes('textStyle').color as string) || '#000000'

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 150,
        theme: 'editor-menu',
        zIndex: 10000,
      }}
      shouldShow={({ state }) => {
        const { from, to } = state.selection
        return from !== to
      }}
    >
      <div className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg">
        {/* Typography */}
        <BubbleButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrito"
        >
          <Bold className="h-3.5 w-3.5" />
        </BubbleButton>
        <BubbleButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Itálico"
        >
          <Italic className="h-3.5 w-3.5" />
        </BubbleButton>
        <BubbleButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Sublinhado"
        >
          <Underline className="h-3.5 w-3.5" />
        </BubbleButton>
        <BubbleButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Riscado"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </BubbleButton>

        <Separator />

        {/* Lists */}
        <BubbleButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Lista"
        >
          <List className="h-3.5 w-3.5" />
        </BubbleButton>
        <BubbleButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Lista numerada"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </BubbleButton>

        <Separator />

        {/* Alignment */}
        <BubbleButton
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Alinhar à esquerda"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </BubbleButton>
        <BubbleButton
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Centrar"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </BubbleButton>
        <BubbleButton
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Alinhar à direita"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </BubbleButton>
        <BubbleButton
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          title="Justificar"
        >
          <AlignJustify className="h-3.5 w-3.5" />
        </BubbleButton>

        <Separator />

        {/* Color */}
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative flex h-7 w-7 items-center justify-center rounded hover:bg-accent transition-colors"
              title="Cor do texto"
            >
              <Type className="h-3.5 w-3.5" />
              <span
                className="absolute bottom-0.5 left-1 right-1 h-0.5 rounded-full"
                style={{ backgroundColor: currentColor }}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-2"
            side="top"
            align="center"
            sideOffset={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="grid grid-cols-5 gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="h-6 w-6 rounded border border-border transition-transform hover:scale-110"
                  style={{ backgroundColor: color }}
                  onClick={() => applyColor(color)}
                  title={color}
                />
              ))}
            </div>
            <div className="mt-2 flex gap-1">
              <Input
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                placeholder="#hex"
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customColor) {
                    applyColor(customColor)
                    setCustomColor('')
                  }
                }}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </BubbleMenu>
  )
}

function BubbleButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
      }`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  )
}

function Separator() {
  return <div className="mx-0.5 h-4 w-px bg-border" />
}
