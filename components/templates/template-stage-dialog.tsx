'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { StageData } from './template-builder'

interface TemplateStageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: StageData | null // null = criar, objecto = editar
  onSubmit: (data: { name: string; description?: string }) => void
}

export function TemplateStageDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
}: TemplateStageDialogProps) {
  const isEditing = !!initialData
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open) {
      setName(initialData?.name || '')
      setDescription(initialData?.description || '')
    }
  }, [open, initialData])

  const handleSubmit = () => {
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Fase' : 'Nova Fase'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Altere os dados da fase'
              : 'Adicione uma nova fase ao template'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="stage-name">Nome da Fase *</Label>
            <Input
              id="stage-name"
              placeholder="Ex: Contrato de Mediação (CMI)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage-desc">Descrição</Label>
            <Textarea
              id="stage-desc"
              placeholder="Descrição opcional da fase..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {isEditing ? 'Guardar' : 'Adicionar Fase'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
