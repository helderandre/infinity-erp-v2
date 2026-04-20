'use client'

import { useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Paperclip,
  PenLine,
  Trash2,
  Loader2,
  Palette,
  Undo2,
  Redo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  editor: Editor | null
  signatureEnabled: boolean
  signatureAvailable: boolean
  onSignatureToggle: () => void
  onAttachFiles: (files: File[]) => void
  onInlineImageUpload: (file: File) => Promise<void>
  onDiscard: () => void
}

const TEXT_COLORS = [
  '#111827',
  '#6b7280',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Toggle
          size="sm"
          pressed={!!active}
          disabled={disabled}
          onPressedChange={onClick}
          className="h-7 w-7 p-0 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
          aria-label={label}
        >
          {children}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function ComposerToolbar({
  editor,
  signatureEnabled,
  signatureAvailable,
  onSignatureToggle,
  onAttachFiles,
  onInlineImageUpload,
  onDiscard,
}: Props) {
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const attachInputRef = useRef<HTMLInputElement>(null)

  if (!editor) {
    return (
      <div className="h-9 border-t bg-muted/30 animate-pulse" />
    )
  }

  function openLinkPopover() {
    if (!editor) return
    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, ' ')
    const prevUrl = (editor.getAttributes('link').href as string) || ''
    setLinkUrl(prevUrl)
    setLinkText(selectedText)
    setLinkPopoverOpen(true)
  }

  function applyLink() {
    if (!editor) return
    const url = linkUrl.trim()
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setLinkPopoverOpen(false)
      return
    }
    const href =
      /^(https?:\/\/|mailto:|tel:)/i.test(url) ? url : `https://${url}`
    const { from, to } = editor.state.selection
    const hasSelection = from !== to
    if (hasSelection) {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    } else {
      const label = linkText.trim() || href
      editor
        .chain()
        .focus()
        .insertContent(
          `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
        )
        .run()
    }
    setLinkUrl('')
    setLinkText('')
    setLinkPopoverOpen(false)
  }

  async function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('O ficheiro não é uma imagem válida')
      return
    }
    setUploadingImage(true)
    try {
      await onInlineImageUpload(file)
    } finally {
      setUploadingImage(false)
    }
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    files.forEach((f) => {
      void handleImageFile(f)
    })
  }

  function handleAttachPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length > 0) onAttachFiles(files)
  }

  function setTextColor(color: string) {
    editor?.chain().focus().setColor(color).run()
  }

  function clearTextColor() {
    editor?.chain().focus().unsetColor().run()
  }

  return (
    <div className="flex items-center gap-0.5 border-t bg-background px-2 py-1 flex-wrap">
      {/* Text formatting */}
      <ToolbarButton
        label="Negrito"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Itálico"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Sublinhado"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Rasurado"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>

      {/* Color */}
      <Popover>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                aria-label="Cor do texto"
              >
                <Palette className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Cor do texto
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-4 gap-1">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setTextColor(c)}
                className="h-6 w-6 rounded border shadow-sm transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearTextColor}
            className="mt-1.5 h-6 w-full justify-start text-xs"
          >
            Limpar cor
          </Button>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Alignment */}
      <ToolbarButton
        label="Alinhar à esquerda"
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Centrar"
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Alinhar à direita"
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <AlignRight className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Justificar"
        active={editor.isActive({ textAlign: 'justify' })}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
      >
        <AlignJustify className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Lists */}
      <ToolbarButton
        label="Lista com marcadores"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Lista numerada"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Link */}
      <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 w-7 p-0',
                  editor.isActive('link') && 'bg-accent text-accent-foreground'
                )}
                onClick={openLinkPopover}
                aria-label="Inserir link"
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Inserir link
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80 p-3" align="start">
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Texto
              </label>
              <Input
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Texto do link (opcional)"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                URL
              </label>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyLink()
                  }
                }}
                placeholder="https://..."
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              {editor.isActive('link') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    editor.chain().focus().extendMarkRange('link').unsetLink().run()
                    setLinkPopoverOpen(false)
                  }}
                  className="h-7 text-xs"
                >
                  Remover
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={applyLink}
                className="h-7 text-xs"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Image */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImagePick}
      />
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={uploadingImage}
            onClick={() => imageInputRef.current?.click()}
            aria-label="Inserir imagem"
          >
            {uploadingImage ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Inserir imagem
        </TooltipContent>
      </Tooltip>

      {/* Attach file */}
      <input
        ref={attachInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleAttachPick}
      />
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => attachInputRef.current?.click()}
            aria-label="Anexar ficheiro"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Anexar ficheiro
        </TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Undo/Redo */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            aria-label="Anular"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Anular
        </TooltipContent>
      </Tooltip>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            aria-label="Refazer"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Refazer
        </TooltipContent>
      </Tooltip>

      <div className="ml-auto flex items-center gap-0.5">
        {/* Signature toggle */}
        {signatureAvailable && (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                pressed={signatureEnabled}
                onPressedChange={onSignatureToggle}
                className="h-7 w-7 p-0 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
                aria-label="Alternar assinatura"
              >
                <PenLine className="h-3.5 w-3.5" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {signatureEnabled ? 'Remover assinatura' : 'Adicionar assinatura'}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Discard */}
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={onDiscard}
              aria-label="Descartar rascunho"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Descartar rascunho
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
