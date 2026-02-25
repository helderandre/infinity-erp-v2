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
import { ACTION_TYPES, TASK_PRIORITY_LABELS } from '@/lib/constants'
import { SubtaskEditor } from './subtask-editor'
import type { TaskData } from './template-builder'
import type { SubtaskData } from '@/types/subtask'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

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
  const [priority, setPriority] = useState<'urgent' | 'normal' | 'low'>('normal')
  const [assignedRole, setAssignedRole] = useState('')
  const [docTypeId, setDocTypeId] = useState('')

  // FORM state
  const [ownerType, setOwnerType] = useState<'singular' | 'coletiva'>('singular')
  const [formType, setFormType] = useState<string>('kyc_singular')
  const [subtasks, setSubtasks] = useState<SubtaskData[]>([])

  // doc_types para select (UPLOAD e FORM)
  const [docTypes, setDocTypes] = useState<Array<{ id: string; name: string; category: string }>>([])
  const [docTypesLoading, setDocTypesLoading] = useState(false)

  // EMAIL state (M13)
  const [emailLibraryId, setEmailLibraryId] = useState('')
  const [emailTemplates, setEmailTemplates] = useState<Array<{ id: string; name: string; subject: string }>>([])
  const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(false)

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      if (initialData) {
        setTitle(initialData.title)
        setDescription(initialData.description || '')
        setActionType(initialData.action_type)
        setIsMandatory(initialData.is_mandatory)
        setPriority(initialData.priority || 'normal')
        setSlaDays(initialData.sla_days?.toString() || '')
        setAssignedRole(initialData.assigned_role || '')
        setDocTypeId(initialData.config?.doc_type_id || '')
        setEmailLibraryId(initialData.config?.email_library_id || '')
        setOwnerType(initialData.config?.owner_type || 'singular')
        setFormType(initialData.config?.form_type || 'kyc_singular')
        setSubtasks(initialData.subtasks || [])
      } else {
        setTitle('')
        setDescription('')
        setActionType('MANUAL')
        setIsMandatory(true)
        setPriority('normal')
        setSlaDays('')
        setAssignedRole('')
        setDocTypeId('')
        setEmailLibraryId('')
        setOwnerType('singular')
        setFormType('kyc_singular')
        setSubtasks([])
      }
    }
  }, [open, initialData])

  // Carregar doc_types quando action_type = UPLOAD ou FORM
  useEffect(() => {
    if (['UPLOAD', 'FORM'].includes(actionType) && docTypes.length === 0) {
      setDocTypesLoading(true)
      fetch('/api/libraries/doc-types')
        .then((res) => res.json())
        .then((data) => setDocTypes(Array.isArray(data) ? data : []))
        .catch(() => setDocTypes([]))
        .finally(() => setDocTypesLoading(false))
    }
  }, [actionType, docTypes.length])

  // Carregar email templates quando action_type = EMAIL
  useEffect(() => {
    if (actionType === 'EMAIL' && emailTemplates.length === 0) {
      setEmailTemplatesLoading(true)
      fetch('/api/libraries/emails')
        .then((res) => res.json())
        .then((data) => setEmailTemplates(Array.isArray(data) ? data : []))
        .catch(() => setEmailTemplates([]))
        .finally(() => setEmailTemplatesLoading(false))
    }
  }, [actionType, emailTemplates.length])

  const handleSubmit = () => {
    if (!title.trim()) return

    // Validar UPLOAD: doc_type_id obrigatório
    if (actionType === 'UPLOAD' && !docTypeId) return

    // Validar EMAIL: email_library_id obrigatório
    if (actionType === 'EMAIL' && !emailLibraryId) return

    // Validar FORM: owner_type obrigatório
    if (actionType === 'FORM' && !ownerType) return

    const config: Record<string, any> = {}
    if (actionType === 'UPLOAD' && docTypeId) {
      config.doc_type_id = docTypeId
    }
    if (actionType === 'EMAIL' && emailLibraryId) {
      config.email_library_id = emailLibraryId
    }
    if (actionType === 'FORM') {
      config.owner_type = ownerType
      config.form_type = formType
    }

    onSubmit({
      id: initialData?.id || '',
      title: title.trim(),
      description: description.trim() || undefined,
      action_type: actionType,
      is_mandatory: isMandatory,
      priority,
      sla_days: slaDays ? parseInt(slaDays, 10) : undefined,
      assigned_role: assignedRole || undefined,
      config,
      subtasks: actionType === 'FORM' ? subtasks : undefined,
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
      <DialogContent className="max-w-[500px] sm:max-w-[500px] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          <DialogDescription>
            Configure os detalhes da tarefa do template
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden -mx-4 px-4">
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

            {/* Config condicional: EMAIL -> selecção de template */}
            {actionType === 'EMAIL' && (
              <div className="space-y-2">
                <Label>Template de Email *</Label>
                <Select
                  value={emailLibraryId}
                  onValueChange={(v) => setEmailLibraryId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={emailTemplatesLoading ? 'A carregar...' : 'Seleccione um template de email...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {emailTemplates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        <div className="flex flex-col">
                          <span>{tpl.name}</span>
                          <span className="text-xs text-muted-foreground">{tpl.subject}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {emailLibraryId && (
                  <Link href={`/dashboard/templates-email/${emailLibraryId}`} target="_blank">
                    <Button variant="ghost" size="sm" type="button">
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Ver template
                    </Button>
                  </Link>
                )}
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

            {/* Config condicional: FORM -> owner_type + form_type + subtarefas */}
            {actionType === 'FORM' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de proprietário</Label>
                  <Select value={ownerType} onValueChange={(v) => setOwnerType(v as 'singular' | 'coletiva')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="singular">Pessoa Singular</SelectItem>
                      <SelectItem value="coletiva">Pessoa Colectiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de formulário</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kyc_singular">KYC Singular</SelectItem>
                      <SelectItem value="kyc_coletiva">KYC Colectiva</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <SubtaskEditor
                  subtasks={subtasks}
                  ownerType={ownerType}
                  docTypes={docTypes}
                  onChange={setSubtasks}
                />
              </div>
            )}

            {/* Prioridade */}
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as 'urgent' | 'normal' | 'low')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !title.trim() ||
              (actionType === 'UPLOAD' && !docTypeId) ||
              (actionType === 'EMAIL' && !emailLibraryId) ||
              (actionType === 'FORM' && !ownerType)
            }
          >
            {isEditing ? 'Guardar Alterações' : 'Adicionar Tarefa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
