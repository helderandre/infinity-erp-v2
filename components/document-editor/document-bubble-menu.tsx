'use client'

import { useState } from 'react'
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
} from 'lucide-react'
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

interface DocumentBubbleMenuProps {
  editor: Editor
}

export function DocumentBubbleMenuContent({
  editor,
}: DocumentBubbleMenuProps) {
  const [isColorOpen, setIsColorOpen] = useState(false)
  const [isLinkOpen, setIsLinkOpen] = useState(false)

  return (
    <div className="flex items-center gap-0 rounded-lg border bg-popover/95 backdrop-blur-sm p-1 shadow-lg">
      <TooltipProvider delayDuration={300}>
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
