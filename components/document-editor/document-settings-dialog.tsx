'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FileText, FileWarning, Settings, Loader2 } from 'lucide-react'

interface DocumentSettingsDialogProps {
  description: string
  letterheadUrl: string
  letterheadFileName: string
  letterheadFileType: string
  onDescriptionChange: (value: string) => void
  onLetterheadUpload: (file: File) => Promise<void>
  onLetterheadClear: () => void
}

export function DocumentSettingsDialog({
  description,
  letterheadUrl,
  letterheadFileName,
  letterheadFileType,
  onDescriptionChange,
  onLetterheadUpload,
  onLetterheadClear,
}: DocumentSettingsDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const letterheadInputRef = useRef<HTMLInputElement>(null)

  const handleLetterheadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setIsUploading(true)
      try {
        await onLetterheadUpload(file)
      } finally {
        setIsUploading(false)
      }
    }
    e.currentTarget.value = ''
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Configurações do Template">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações do Template</DialogTitle>
          <DialogDescription>
            Edite a descrição e o timbrado do seu template
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Descrição */}
          <div className="grid gap-2">
            <Label htmlFor="doc-desc">Descrição</Label>
            <Textarea
              id="doc-desc"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Descrição breve do template"
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Timbrado */}
          <div className="grid gap-2">
            <Label>Timbrado (imagem ou DOCX)</Label>
            <div className="space-y-2">
              <input
                ref={letterheadInputRef}
                type="file"
                accept=".doc,.docx,image/*"
                className="hidden"
                onChange={handleLetterheadChange}
              />
              <Button
                variant="outline"
                onClick={() => letterheadInputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A enviar...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Carregar timbrado
                  </>
                )}
              </Button>

              {letterheadUrl ? (
                <div className="flex flex-col gap-2 text-sm p-3 bg-muted rounded-md border">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{letterheadFileType || 'timbrado'}</Badge>
                    <span className="truncate flex-1 text-muted-foreground">
                      {letterheadFileName || letterheadUrl}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLetterheadClear}
                    className="w-full text-destructive hover:text-destructive"
                  >
                    Remover timbrado
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted rounded-md border border-dashed">
                  <FileWarning className="h-4 w-4 shrink-0" />
                  <span>Nenhum timbrado associado</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
