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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ACTION_TYPES } from '@/lib/constants'
import type { TaskData } from './template-builder'

const ASSIGNABLE_ROLES = [
  { value: 'Processual', label: 'Gestora Processual' },
  { value: 'Consultor', label: 'Consultor' },
  { value: 'Broker/CEO', label: 'Broker/CEO' },
] as const

interface TemplateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: TaskData | null // null = criar, objecto = editar
  onSubmit: (data: TaskData) => void
}

export function TemplateTaskDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
}: TemplateTaskDialogProps) {
  const isEditing = !!initialData

  // Estado local do formulário
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [actionType, setActionType] = useState<TaskData['action_type']>('MANUAL')
  const [isMandatory, setIsMandatory] = useState(true)
  const [slaDays, setSlaDays] = useState<string>('')
  const [assignedRole, setAssignedRole] = useState('')
  const [docTypeId, setDocTypeId] = useState('')

  // doc_types para select (UPLOAD)
  const [docTypes, setDocTypes] = useState<Array<{ id: string; name: string; category: string }>>([])
  const [docTypesLoading, setDocTypesLoading] = useState(false)

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      if (initialData) {
        setTitle(initialData.title)
        setDescription(initialData.description || '')
        setActionType(initialData.action_type)
        setIsMandatory(initialData.is_mandatory)
        setSlaDays(initialData.sla_days?.toString() || '')
        setAssignedRole(initialData.assigned_role || '')
        setDocTypeId(initialData.config?.doc_type_id || '')
      } else {
        setTitle('')
        setDescription('')
        setActionType('MANUAL')
        setIsMandatory(true)
        setSlaDays('')
        setAssignedRole('')
        setDocTypeId('')
      }
    }
  }, [open, initialData])

  // Carregar doc_types quando action_type = UPLOAD
  useEffect(() => {
    if (actionType === 'UPLOAD' && docTypes.length === 0) {
      setDocTypesLoading(true)
      fetch('/api/libraries/doc-types')
        .then((res) => res.json())
        .then((data) => setDocTypes(Array.isArray(data) ? data : []))
        .catch(() => setDocTypes([]))
        .finally(() => setDocTypesLoading(false))
    }
  }, [actionType, docTypes.length])

  const handleSubmit = () => {
    if (!title.trim()) return

    // Validar UPLOAD: doc_type_id obrigatório
    if (actionType === 'UPLOAD' && !docTypeId) return

    const config: Record<string, any> = {}
    if (actionType === 'UPLOAD' && docTypeId) {
      config.doc_type_id = docTypeId
    }

    onSubmit({
      id: initialData?.id || '',
      title: title.trim(),
      description: description.trim() || undefined,
      action_type: actionType,
      is_mandatory: isMandatory,
      sla_days: slaDays ? parseInt(slaDays, 10) : undefined,
      assigned_role: assignedRole || undefined,
      config,
    })
  }

  // Agrupar doc_types por categoria
  const docTypesByCategory = docTypes.reduce<Record<string, typeof docTypes>>((acc, dt) => {
    const cat = dt.category || 'Outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(dt)
    return acc
  }, {})

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          <DialogDescription>
            Configure os detalhes da tarefa do template
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="task-title">Título *</Label>
            <Input
              id="task-title"
              placeholder="Ex: Upload do Contrato de Mediação"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="task-desc">Descrição</Label>
            <Textarea
              id="task-desc"
              placeholder="Descrição opcional..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          {/* Tipo de Acção */}
          <div className="space-y-2">
            <Label>Tipo de Acção *</Label>
            <Select value={actionType} onValueChange={(v) => setActionType(v as TaskData['action_type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTION_TYPES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Config condicional: UPLOAD -> doc_type_id */}
          {actionType === 'UPLOAD' && (
            <div className="space-y-2">
              <Label>Tipo de Documento *</Label>
              <Select value={docTypeId} onValueChange={setDocTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder={docTypesLoading ? 'A carregar...' : 'Seleccionar tipo de documento'} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(docTypesByCategory).map(([category, types]) => (
                    <SelectGroup key={category}>
                      <SelectLabel>{category}</SelectLabel>
                      {types.map((dt) => (
                        <SelectItem key={dt.id} value={dt.id}>
                          {dt.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Config condicional: EMAIL -> mensagem "Em breve" */}
          {actionType === 'EMAIL' && (
            <div className="rounded-md border border-dashed p-3">
              <p className="text-sm text-muted-foreground">
                Selecção de template de email ficará disponível em breve (M13).
              </p>
            </div>
          )}

          {/* Config condicional: GENERATE_DOC -> mensagem "Em breve" */}
          {actionType === 'GENERATE_DOC' && (
            <div className="rounded-md border border-dashed p-3">
              <p className="text-sm text-muted-foreground">
                Selecção de template de documento ficará disponível em breve (M13).
              </p>
            </div>
          )}

          {/* Role Atribuído */}
          <div className="space-y-2">
            <Label>Role Atribuído</Label>
            <Select value={assignedRole} onValueChange={setAssignedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar role..." />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SLA (dias) */}
          <div className="space-y-2">
            <Label htmlFor="task-sla">SLA (dias)</Label>
            <Input
              id="task-sla"
              type="number"
              min="1"
              placeholder="Ex: 5"
              value={slaDays}
              onChange={(e) => setSlaDays(e.target.value)}
            />
          </div>

          {/* Obrigatória? */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="task-mandatory">Tarefa Obrigatória</Label>
              <p className="text-xs text-muted-foreground">
                Tarefas obrigatórias não podem ser dispensadas
              </p>
            </div>
            <Switch
              id="task-mandatory"
              checked={isMandatory}
              onCheckedChange={setIsMandatory}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || (actionType === 'UPLOAD' && !docTypeId)}
          >
            {isEditing ? 'Guardar Alterações' : 'Adicionar Tarefa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
