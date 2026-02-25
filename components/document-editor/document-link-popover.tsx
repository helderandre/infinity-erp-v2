'use client'

import { useState, useCallback } from 'react'
import type { Editor } from '@tiptap/core'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Link } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocumentLinkPopoverProps {
  editor: Editor
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DocumentLinkPopover({
  editor,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: DocumentLinkPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const onOpenChange = controlledOnOpenChange ?? setInternalOpen
  const currentLink = editor.getAttributes('link').href || ''
  const [url, setUrl] = useState(currentLink)

  const isActive = editor.isActive('link')

  const handleOpen = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setUrl(editor.getAttributes('link').href || '')
      }
      onOpenChange(nextOpen)
    },
    [editor, onOpenChange]
  )

  const applyLink = () => {
    if (url) {
      const href = url.startsWith('http') ? url : `https://${url}`
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
    onOpenChange(false)
  }

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    onOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center justify-center rounded-md p-1.5 text-sm transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            isActive && 'bg-accent text-accent-foreground'
          )}
          title="Inserir link (Ctrl+K)"
          aria-label="Inserir link"
        >
          <Link size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start" sideOffset={8}>
        <div className="space-y-2">
          <p className="text-sm font-medium">Inserir link</p>
          <Input
            placeholder="https://exemplo.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyLink()
              }
            }}
            autoFocus
          />
          <div className="flex justify-between">
            {isActive && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={removeLink}
              >
                Remover link
              </Button>
            )}
            <div className="ml-auto flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={applyLink}>
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
