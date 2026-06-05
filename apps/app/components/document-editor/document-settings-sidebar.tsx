'use client'

import { useState } from 'react'
import { ChevronRight, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'

interface DocumentSettingsSidebarProps {
  description: string
  letterheadUrl?: string
  letterheadFileName?: string
  onDescriptionChange: (value: string) => void
  onLetterheadUpload: (file: File) => void
  onLetterheadClear: () => void
  isLoadingLetterhead?: boolean
}

export function DocumentSettingsSidebar({
  description,
  letterheadUrl,
  letterheadFileName,
  onDescriptionChange,
  onLetterheadUpload,
  onLetterheadClear,
  isLoadingLetterhead = false,
}: DocumentSettingsSidebarProps) {
  const [isOpen, setIsOpen] = useState(true)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (file) {
      onLetterheadUpload(file)
      e.currentTarget.value = ''
    }
  }

  if (!isOpen) {
    return (
      <div className="flex flex-col items-center border-r border-border bg-background w-12 py-2 gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="h-8 w-8 p-0 rounded"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col border-r border-border bg-background w-72 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Configurações</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="h-6 w-6 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-semibold">
              Descrição
            </Label>
            <Textarea
              id="description"
              placeholder="Descrição breve..."
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="min-h-[80px] resize-none text-xs"
            />
          </div>

          {/* Timbrado */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Timbrado</Label>

            <input
              type="file"
              accept=".docx,.png,.jpg,.jpeg,.webp"
              onChange={handleFileSelect}
              className="hidden"
              id="letterhead-upload"
              disabled={isLoadingLetterhead}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              disabled={isLoadingLetterhead}
              className="w-full text-xs"
            >
              <label htmlFor="letterhead-upload" className="cursor-pointer">
                {isLoadingLetterhead ? 'A carregar...' : 'Carregar'}
              </label>
            </Button>

            {letterheadUrl ? (
              <div className="flex items-center justify-between rounded-md bg-muted p-2 gap-2">
                <p className="truncate text-xs text-muted-foreground flex-1">
                  {letterheadFileName || 'Carregado'}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onLetterheadClear}
                  disabled={isLoadingLetterhead}
                  className="h-5 w-5 p-0 text-xs flex-shrink-0"
                >
                  ✕
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
