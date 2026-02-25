'use client'

import { useState } from 'react'
import type { Editor } from '@tiptap/core'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TEXT_COLORS, HIGHLIGHT_COLORS } from './types'

interface DocumentColorPickerProps {
  editor: Editor
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DocumentColorPicker({
  editor,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: DocumentColorPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const onOpenChange = controlledOnOpenChange ?? setInternalOpen
  const [hexInput, setHexInput] = useState('')

  const currentColor = editor.getAttributes('textStyle').color || ''
  const currentHighlight = editor.getAttributes('highlight').color || ''

  const applyTextColor = (color: string) => {
    if (color) {
      editor.chain().focus().setColor(color).run()
    } else {
      editor.chain().focus().unsetColor().run()
    }
  }

  const applyHighlightColor = (color: string) => {
    if (color) {
      editor.chain().focus().toggleHighlight({ color }).run()
    } else {
      editor.chain().focus().unsetHighlight().run()
    }
  }

  const applyHexColor = (tab: 'text' | 'background') => {
    const color = hexInput.startsWith('#') ? hexInput : `#${hexInput}`
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      if (tab === 'text') {
        applyTextColor(color)
      } else {
        applyHighlightColor(color)
      }
      setHexInput('')
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center justify-center rounded-md p-1.5 text-sm transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            open && 'bg-accent text-accent-foreground'
          )}
          title="Cor do texto"
          aria-label="Cor do texto"
        >
          <Palette size={16} />
          {currentColor && (
            <div
              className="ml-0.5 h-1.5 w-3 rounded-full"
              style={{ backgroundColor: currentColor }}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start" sideOffset={8}>
        <Tabs defaultValue="text">
          <TabsList className="w-full">
            <TabsTrigger value="text" className="flex-1">
              Cor do Texto
            </TabsTrigger>
            <TabsTrigger value="background" className="flex-1">
              Cor do Fundo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="mt-3 space-y-3">
            <div className="grid grid-cols-8 gap-1.5">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => applyTextColor(color.value)}
                  title={color.name}
                  className={cn(
                    'h-6 w-6 rounded-md border transition-all hover:scale-110',
                    currentColor === color.value &&
                      'ring-2 ring-ring ring-offset-1'
                  )}
                  style={{ backgroundColor: color.value }}
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                placeholder="#000000"
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyHexColor('text')
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs"
                onClick={() => applyHexColor('text')}
              >
                Aplicar
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => applyTextColor('')}
            >
              Remover cor
            </Button>
          </TabsContent>

          <TabsContent value="background" className="mt-3 space-y-3">
            <div className="grid grid-cols-8 gap-1.5">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => applyHighlightColor(color.value)}
                  title={color.name}
                  className={cn(
                    'h-6 w-6 rounded-md border transition-all hover:scale-110',
                    !color.value && 'bg-background',
                    currentHighlight === color.value &&
                      color.value &&
                      'ring-2 ring-ring ring-offset-1'
                  )}
                  style={color.value ? { backgroundColor: color.value } : undefined}
                >
                  {!color.value && (
                    <span className="text-[10px] text-muted-foreground">--</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                placeholder="#f0fdf4"
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyHexColor('background')
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs"
                onClick={() => applyHexColor('background')}
              >
                Aplicar
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => applyHighlightColor('')}
            >
              Remover fundo
            </Button>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
