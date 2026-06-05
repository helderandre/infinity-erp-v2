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
  Link2,
  Unlink,
  Variable,
} from 'lucide-react'
import { useState, useCallback } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

const LINK_VARIABLES = [
  { value: '{{link_imovel}}', label: 'Link do Imóvel' },
  { value: '{{link_portal_remax}}', label: 'Link RE/MAX' },
  { value: '{{link_portal_idealista}}', label: 'Link Idealista' },
  { value: '{{link_portal_imovirtual}}', label: 'Link Imovirtual' },
  { value: '{{link_portal_casasapo}}', label: 'Link Casa Sapo' },
  { value: '{{link_proposta}}', label: 'Link da Proposta' },
  { value: '{{link_documento}}', label: 'Link do Documento' },
]

export function EmailBubbleMenu({ editor }: EmailBubbleMenuProps) {
  const [colorOpen, setColorOpen] = useState(false)
  const [customColor, setCustomColor] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const applyColor = useCallback(
    (color: string) => {
      editor.chain().focus().setColor(color).run()
      setColorOpen(false)
    },
    [editor]
  )

  const applyLink = useCallback(
    (url: string) => {
      if (!url) return
      editor.chain().focus().setLink({ href: url, target: '_blank' }).run()
      setLinkUrl('')
      setLinkOpen(false)
    },
    [editor]
  )

  const removeLink = useCallback(() => {
    editor.chain().focus().unsetLink().run()
    setLinkOpen(false)
  }, [editor])

  const openLinkPopover = useCallback(() => {
    const existingHref = editor.getAttributes('link').href as string | undefined
    setLinkUrl(existingHref || '')
    setLinkOpen(true)
  }, [editor])

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

        <Separator />

        {/* Link */}
        {editor.isActive('link') ? (
          <BubbleButton
            active={true}
            onClick={removeLink}
            title="Remover link"
          >
            <Unlink className="h-3.5 w-3.5" />
          </BubbleButton>
        ) : (
          <Popover open={linkOpen} onOpenChange={(o) => { if (o) openLinkPopover(); else setLinkOpen(false) }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                  editor.isActive('link') ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
                }`}
                title="Adicionar link"
              >
                <Link2 className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-64 p-3 space-y-2"
              side="top"
              align="center"
              sideOffset={8}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <p className="text-xs font-medium text-muted-foreground">URL ou variável</p>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyLink(linkUrl)
                  }
                }}
              />
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Variable className="h-2.5 w-2.5" />Variáveis</p>
                <div className="flex flex-wrap gap-1">
                  {LINK_VARIABLES.map(v => (
                    <button
                      key={v.value}
                      type="button"
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent transition-colors"
                      onClick={() => applyLink(v.value)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" className="h-6 text-xs rounded-md px-2" onClick={() => applyLink(linkUrl)} disabled={!linkUrl}>
                  Aplicar
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
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
