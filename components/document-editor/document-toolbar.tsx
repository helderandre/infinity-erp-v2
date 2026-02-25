'use client'

import { useCallback } from 'react'
import type { Editor } from '@tiptap/core'
import {
  Undo2,
  Redo2,
  Minus,
  Plus,
  Table,
  Image as ImageIcon,
  SeparatorHorizontal,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  IndentDecrease,
  IndentIncrease,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { DocumentColorPicker } from './document-color-picker'
import { DocumentLinkPopover } from './document-link-popover'
import { EDITOR_FONTS, LINE_SPACING_OPTIONS } from './types'

interface DocumentToolbarProps {
  editor: Editor
  fontSize: number
  onFontSizeChange: (size: number) => void
  lineHeight: number
  onLineHeightChange: (lh: number) => void
  currentFont: string
  onFontFamilyChange: (font: string) => void
  onInsertImage?: () => void
}

export function DocumentToolbar({
  editor,
  fontSize,
  onFontSizeChange,
  lineHeight,
  onLineHeightChange,
  currentFont,
  onFontFamilyChange,
  onInsertImage,
}: DocumentToolbarProps) {
  const handleFontChange = useCallback(
    (value: string) => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        editor.chain().focus().setFontFamily(value).run()
      }
      onFontFamilyChange(value)
    },
    [editor, onFontFamilyChange]
  )

  const decreaseFontSize = useCallback(() => {
    const newSize = Math.max(8, fontSize - 1)
    onFontSizeChange(newSize)
  }, [fontSize, onFontSizeChange])

  const increaseFontSize = useCallback(() => {
    const newSize = Math.min(72, fontSize + 1)
    onFontSizeChange(newSize)
  }, [fontSize, onFontSizeChange])

  const handleIndent = useCallback(() => {
    if (editor.isActive('listItem')) {
      editor.chain().focus().sinkListItem('listItem').run()
      return
    }
    editor.chain().focus().indent().run()
  }, [editor])

  const handleOutdent = useCallback(() => {
    if (editor.isActive('listItem')) {
      editor.chain().focus().liftListItem('listItem').run()
      return
    }
    editor.chain().focus().outdent().run()
  }, [editor])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-border bg-card px-3 py-1.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          tooltip="Desfazer (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          tooltip="Refazer (Ctrl+Shift+Z)"
        >
          <Redo2 size={18} />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Select value={currentFont} onValueChange={handleFontChange}>
          <SelectTrigger className="h-8 w-[180px] border-0 bg-transparent text-xs shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EDITOR_FONTS.map((font) => (
              <SelectItem
                key={font.value}
                value={font.value}
                style={{ fontFamily: font.value }}
              >
                {font.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-0">
          <ToolbarButton onClick={decreaseFontSize} tooltip="Diminuir fonte">
            <Minus size={14} />
          </ToolbarButton>
          <span className="w-8 text-center text-xs font-medium tabular-nums">
            {fontSize}
          </span>
          <ToolbarButton onClick={increaseFontSize} tooltip="Aumentar fonte">
            <Plus size={14} />
          </ToolbarButton>
        </div>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          tooltip="Negrito (Ctrl+B)"
        >
          <Bold size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          tooltip="Itálico (Ctrl+I)"
        >
          <Italic size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          tooltip="Sublinhado (Ctrl+U)"
        >
          <Underline size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          tooltip="Riscado"
        >
          <Strikethrough size={18} />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          tooltip="Alinhar à esquerda"
        >
          <AlignLeft size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          tooltip="Centralizar"
        >
          <AlignCenter size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          tooltip="Alinhar à direita"
        >
          <AlignRight size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          isActive={editor.isActive({ textAlign: 'justify' })}
          tooltip="Justificar"
        >
          <AlignJustify size={18} />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          tooltip="Lista com marcadores"
        >
          <List size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          tooltip="Lista numerada"
        >
          <ListOrdered size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={handleOutdent}
          tooltip="Diminuir indentação"
        >
          <IndentDecrease size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={handleIndent}
          tooltip="Aumentar indentação"
        >
          <IndentIncrease size={18} />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <DocumentColorPicker editor={editor} />
        <DocumentLinkPopover editor={editor} />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Select
          value={String(lineHeight)}
          onValueChange={(v) => onLineHeightChange(parseFloat(v))}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <SelectTrigger className="h-8 w-[70px] border-0 bg-transparent text-xs shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Espaçamento de linha
            </TooltipContent>
          </Tooltip>
          <SelectContent>
            {LINE_SPACING_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'inline-flex items-center justify-center rounded-md p-1.5',
                    'text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors'
                  )}
                  aria-label="Mais opções"
                >
                  <SeparatorHorizontal size={18} />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Mais opções
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-auto whitespace-nowrap">
            <DropdownMenuItem className="whitespace-nowrap"
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run()
              }
            >
              <Table size={16} className="mr-2" />
              Inserir tabela
            </DropdownMenuItem>
            <DropdownMenuItem className="whitespace-nowrap" onClick={onInsertImage} disabled={!onInsertImage}>
              <ImageIcon size={16} className="mr-2" />
              Inserir imagem
            </DropdownMenuItem>
            <DropdownMenuItem className="whitespace-nowrap"
              onClick={() => editor.chain().focus().setPageBreak().run()}
            >
              <SeparatorHorizontal size={16} className="mr-2" />
              Quebra de página
            </DropdownMenuItem>
            <DropdownMenuItem className="whitespace-nowrap"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
            >
              <SeparatorHorizontal size={16} className="mr-2" />
              Linha horizontal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  )
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  isActive,
  tooltip,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  isActive?: boolean
  tooltip: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'inline-flex items-center justify-center rounded-md p-1.5 transition-colors',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            isActive && 'bg-accent text-accent-foreground',
            disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
          )}
          aria-label={tooltip}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
