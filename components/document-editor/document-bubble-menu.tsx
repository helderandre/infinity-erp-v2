'use client'

import { useState, useCallback } from 'react'
import type { Editor } from '@tiptap/core'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Braces,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { DocumentColorPicker } from './document-color-picker'
import { DocumentLinkPopover } from './document-link-popover'
import { normalizeVariableKey } from './utils/slugify'
import type { EditorMode } from './types'

interface DocumentBubbleMenuProps {
  editor: Editor
  mode: EditorMode
  getIsSystem?: (key: string) => boolean
}

export function DocumentBubbleMenuContent({
  editor,
  mode,
  getIsSystem,
}: DocumentBubbleMenuProps) {
  const [isColorOpen, setIsColorOpen] = useState(false)
  const [isLinkOpen, setIsLinkOpen] = useState(false)
  const [isVariablePopoverOpen, setIsVariablePopoverOpen] = useState(false)
  const [variableSlug, setVariableSlug] = useState('')

  const getActiveStyle = useCallback(() => {
    if (editor.isActive('heading', { level: 1 })) return 'h1'
    if (editor.isActive('heading', { level: 2 })) return 'h2'
    if (editor.isActive('heading', { level: 3 })) return 'h3'
    if (editor.isActive('blockquote')) return 'blockquote'
    return 'paragraph'
  }, [editor])

  const handleStyleChange = useCallback(
    (value: string) => {
      switch (value) {
        case 'h1':
          editor.chain().focus().toggleHeading({ level: 1 }).run()
          break
        case 'h2':
          editor.chain().focus().toggleHeading({ level: 2 }).run()
          break
        case 'h3':
          editor.chain().focus().toggleHeading({ level: 3 }).run()
          break
        case 'blockquote':
          editor.chain().focus().toggleBlockquote().run()
          break
        default:
          editor.chain().focus().setParagraph().run()
      }
    },
    [editor]
  )

  const handleCreateVariable = useCallback(() => {
    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, '')
    if (selectedText) {
      const slug = normalizeVariableKey(selectedText)
      setVariableSlug(slug)
      setIsVariablePopoverOpen(true)
    }
  }, [editor])

  const confirmCreateVariable = useCallback(() => {
    if (variableSlug) {
      const isSystem = getIsSystem?.(variableSlug) ?? false
      editor.chain().focus().wrapSelectionAsVariable(variableSlug, isSystem).run()
      setIsVariablePopoverOpen(false)
      setVariableSlug('')
    }
  }, [editor, getIsSystem, variableSlug])

  return (
    <div className="flex items-center gap-0 rounded-lg border bg-popover/95 backdrop-blur-sm p-1 shadow-lg">
      <TooltipProvider delayDuration={300}>
        <Select value={getActiveStyle()} onValueChange={handleStyleChange}>
          <SelectTrigger className="h-7 w-[120px] border-0 bg-transparent text-xs shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paragraph">Texto normal</SelectItem>
            <SelectItem value="h1">Título 1</SelectItem>
            <SelectItem value="h2">Título 2</SelectItem>
            <SelectItem value="h3">Título 3</SelectItem>
            <SelectItem value="blockquote">Citação</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        <BubbleButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          tooltip="Negrito (Ctrl+B)"
        >
          <Bold size={16} />
        </BubbleButton>

        <BubbleButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          tooltip="Itálico (Ctrl+I)"
        >
          <Italic size={16} />
        </BubbleButton>

        <BubbleButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          tooltip="Sublinhado (Ctrl+U)"
        >
          <Underline size={16} />
        </BubbleButton>

        <BubbleButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          tooltip="Riscado"
        >
          <Strikethrough size={16} />
        </BubbleButton>

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        <DocumentLinkPopover
          editor={editor}
          open={isLinkOpen}
          onOpenChange={(open) => {
            setIsLinkOpen(open)
            if (open) setIsColorOpen(false)
          }}
        />

        <DocumentColorPicker
          editor={editor}
          open={isColorOpen}
          onOpenChange={(open) => {
            setIsColorOpen(open)
            if (open) setIsLinkOpen(false)
          }}
        />

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        <BubbleButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          tooltip="Alinhar à esquerda"
        >
          <AlignLeft size={16} />
        </BubbleButton>

        <BubbleButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          tooltip="Centralizar"
        >
          <AlignCenter size={16} />
        </BubbleButton>

        <BubbleButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          tooltip="Alinhar à direita"
        >
          <AlignRight size={16} />
        </BubbleButton>

        <BubbleButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          isActive={editor.isActive({ textAlign: 'justify' })}
          tooltip="Justificar"
        >
          <AlignJustify size={16} />
        </BubbleButton>

        {mode === 'template' && (
          <>
            <Separator orientation="vertical" className="mx-0.5 h-6" />

            <Popover
              modal={false}
              open={isVariablePopoverOpen}
              onOpenChange={setIsVariablePopoverOpen}
            >
              <PopoverTrigger asChild>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleCreateVariable}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                    'hover:bg-amber-100 hover:text-amber-800 dark:hover:bg-amber-900/30 dark:hover:text-amber-300',
                    'text-amber-700 dark:text-amber-300'
                  )}
                  title="Criar variável a partir da selecção"
                  aria-label="Criar variável"
                >
                  <Braces size={16} />
                  <span className="hidden sm:inline">Variável</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="start" sideOffset={8}>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Criar variável</p>
                  <Input
                    value={variableSlug}
                    onChange={(e) => setVariableSlug(normalizeVariableKey(e.target.value))}
                    placeholder="nome_da_variavel"
                    className="h-8 font-mono text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        confirmCreateVariable()
                      }
                    }}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Será inserida como{' '}
                    <code className="rounded bg-muted px-1">{`{{${variableSlug || '...'}}}`}</code>
                  </p>
                  <div className="flex justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setIsVariablePopoverOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={confirmCreateVariable}
                      disabled={!variableSlug}
                    >
                      Criar variável
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}
      </TooltipProvider>
    </div>
  )
}

function BubbleButton({
  children,
  onClick,
  isActive,
  tooltip,
}: {
  children: React.ReactNode
  onClick: () => void
  isActive?: boolean
  tooltip: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'inline-flex items-center justify-center rounded-md p-1.5 text-sm transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            isActive && 'bg-accent text-accent-foreground'
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
