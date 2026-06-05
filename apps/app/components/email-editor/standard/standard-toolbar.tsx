'use client'

import { type Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  Minus,
  Eraser,
  ImageIcon,
  MousePointer,
  Paperclip,
  Link2,
  Building2,
  ExternalLink,
} from 'lucide-react'
import {
  VariablePicker,
  type VariableItem,
} from '@/components/automations/variable-picker'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const FONT_FAMILIES = [
  { label: 'Sans Serif', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monoespaçada', value: 'Menlo, Consolas, "Courier New", monospace' },
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
]

const FONT_SIZES = [10, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 40]

const TEXT_COLORS = [
  '#000000',
  '#404040',
  '#737373',
  '#DC2626',
  '#D97706',
  '#16A34A',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
]

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-8 w-8 p-0 shrink-0',
        active && 'bg-accent text-accent-foreground'
      )}
    >
      {children}
    </Button>
  )
}

function Separator() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />
}

interface StandardToolbarProps {
  editor: Editor | null
  variables: VariableItem[]
  onInsertImage: () => void
  onInsertButton: () => void
  onInsertAttachment: () => void
  onInsertLink: () => void
  onInsertPropertyGrid: () => void
  onInsertPortalLinks: () => void
}

export function StandardToolbar({
  editor,
  variables,
  onInsertImage,
  onInsertButton,
  onInsertAttachment,
  onInsertLink,
  onInsertPropertyGrid,
  onInsertPortalLinks,
}: StandardToolbarProps) {
  if (!editor) {
    return <div className="h-10 border-b bg-background" />
  }

  const currentFontFamily =
    (editor.getAttributes('textStyle').fontFamily as string | undefined) ??
    FONT_FAMILIES[0].value

  const rawFontSize = editor.getAttributes('textStyle').fontSize as
    | string
    | undefined
  const currentFontSizePx = rawFontSize
    ? parseInt(String(rawFontSize).replace('px', ''), 10) || 15
    : 15

  const currentColor =
    (editor.getAttributes('textStyle').color as string | undefined) ?? '#404040'

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b bg-background px-2 py-1.5 shrink-0">
      {/* Undo / Redo */}
      <ToolbarButton
        title="Desfazer"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Refazer"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <Separator />

      {/* Font family */}
      <Select
        value={currentFontFamily}
        onValueChange={(value) => {
          editor.chain().focus().setFontFamily(value).run()
        }}
      >
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_FAMILIES.map((f) => (
            <SelectItem key={f.value} value={f.value} className="text-xs">
              <span style={{ fontFamily: f.value }}>{f.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator />

      {/* Font size */}
      <Select
        value={String(currentFontSizePx)}
        onValueChange={(value) => {
          editor.chain().focus().setFontSize(`${value}px`).run()
        }}
      >
        <SelectTrigger className="h-8 w-[72px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((size) => (
            <SelectItem key={size} value={String(size)} className="text-xs">
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator />

      {/* Bold / Italic / Underline / Strike */}
      <ToolbarButton
        title="Negrito"
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Itálico"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Sublinhado"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Rasurado"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <Separator />

      {/* Text color */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Cor do texto"
            onMouseDown={(e) => e.preventDefault()}
            className="h-8 w-8 p-0 shrink-0 relative"
          >
            <span className="text-xs font-semibold leading-none">A</span>
            <span
              className="absolute bottom-1 left-1.5 right-1.5 h-0.5 rounded"
              style={{ backgroundColor: currentColor }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-5 gap-1">
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().setColor(color).run()}
                className={cn(
                  'h-6 w-6 rounded border',
                  currentColor === color && 'ring-2 ring-primary ring-offset-1'
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().unsetColor().run()}
              className="col-span-5 mt-1 h-7 rounded border text-xs hover:bg-accent"
            >
              Remover cor
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Separator />

      {/* Alignment */}
      <ToolbarButton
        title="Alinhar à esquerda"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Centrar"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Alinhar à direita"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Justificar"
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        active={editor.isActive({ textAlign: 'justify' })}
      >
        <AlignJustify className="h-4 w-4" />
      </ToolbarButton>

      <Separator />

      {/* Lists / blockquote */}
      <ToolbarButton
        title="Lista com marcadores"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Lista numerada"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Citação"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>

      <Separator />

      {/* Insert blocks */}
      <ToolbarButton
        title="Divisor"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Inserir link" onClick={onInsertLink}>
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Inserir imagem" onClick={onInsertImage}>
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Inserir botão" onClick={onInsertButton}>
        <MousePointer className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Inserir anexo" onClick={onInsertAttachment}>
        <Paperclip className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Inserir grelha de imóveis"
        onClick={onInsertPropertyGrid}
      >
        <Building2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Inserir links de portais"
        onClick={onInsertPortalLinks}
      >
        <ExternalLink className="h-4 w-4" />
      </ToolbarButton>

      <Separator />

      {/* Variable picker */}
      <VariablePicker
        onSelect={(v) => {
          editor.chain().focus().insertVariable(v.key).run()
        }}
        additionalVariables={variables}
        compact
      />

      <Separator />

      {/* Clear formatting */}
      <ToolbarButton
        title="Limpar formatação"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        <Eraser className="h-4 w-4" />
      </ToolbarButton>
    </div>
  )
}
