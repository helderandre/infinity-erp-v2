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
import { Checkbox } from '@/components/ui/checkbox'
import type { StageData } from './template-builder'

interface TemplateStageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: StageData | null // null = criar, objecto = editar
  onSubmit: (data: { name: string; description?: string; depends_on_stages?: string[] }) => void
  allStages?: { id: string; name: string }[]
  currentStageId?: string
}

export function TemplateStageDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  allStages = [],
  currentStageId,
}: TemplateStageDialogProps) {
  const isEditing = !!initialData
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dependsOnStages, setDependsOnStages] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setName(initialData?.name || '')
      setDescription(initialData?.description || '')
      setDependsOnStages(initialData?.depends_on_stages || [])
    }
  }, [open, initialData])

  const otherStages = allStages.filter((s) => s.id !== currentStageId)

  const handleSubmit = () => {
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      depends_on_stages: dependsOnStages,
    })
  }

  const toggleDep = (stageId: string, checked: boolean) => {
    setDependsOnStages((prev) =>
      checked ? [...prev, stageId] : prev.filter((id) => id !== stageId)
    )
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

          {otherStages.length > 0 && (
            <div className="space-y-2">
              <Label>Depende dos Estágios</Label>
              <p className="text-xs text-muted-foreground">
                Este estágio só pode ser concluído após os estágios seleccionados.
              </p>
              <div className="space-y-2 mt-2">
                {otherStages.map((stage) => (
                  <div key={stage.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`dep-${stage.id}`}
                      checked={dependsOnStages.includes(stage.id)}
                      onCheckedChange={(checked) => toggleDep(stage.id, !!checked)}
                    />
                    <Label htmlFor={`dep-${stage.id}`} className="text-sm font-normal cursor-pointer">
                      {stage.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
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
