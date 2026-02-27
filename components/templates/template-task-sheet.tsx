'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TASK_PRIORITY_LABELS } from '@/lib/constants'
import { SubtaskEditor } from './subtask-editor'
import { toast } from 'sonner'
import type { TaskData } from './template-builder'
import type { SubtaskData } from '@/types/subtask'

const ASSIGNABLE_ROLES = [
  { value: 'Processual', label: 'Gestora Processual' },
  { value: 'Consultor', label: 'Consultor' },
  { value: 'Broker/CEO', label: 'Broker/CEO' },
] as const

interface TemplateTaskSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: TaskData | null // null = criar, TaskData = editar
  onSubmit: (data: TaskData) => void
}

export function TemplateTaskSheet({
  open,
  onOpenChange,
  initialData,
  onSubmit,
}: TemplateTaskSheetProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isMandatory, setIsMandatory] = useState(true)
  const [priority, setPriority] = useState<'urgent' | 'normal' | 'low'>('normal')
  const [assignedRole, setAssignedRole] = useState('')
  const [slaDays, setSlaDays] = useState<string>('')
  const [subtasks, setSubtasks] = useState<SubtaskData[]>([])

  // Reset/populate ao abrir
  useEffect(() => {
    if (!open) return
    if (initialData) {
      setTitle(initialData.title)
      setDescription(initialData.description || '')
      setIsMandatory(initialData.is_mandatory)
      setPriority(initialData.priority || 'normal')
      setAssignedRole(initialData.assigned_role || '')
      setSlaDays(initialData.sla_days ? String(initialData.sla_days) : '')
      setSubtasks(initialData.subtasks || [])
    } else {
      setTitle('')
      setDescription('')
      setIsMandatory(true)
      setPriority('normal')
      setAssignedRole('')
      setSlaDays('')
      setSubtasks([])
    }
  }, [open, initialData])

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('O título da tarefa é obrigatório')
      return
    }

    // Validar subtasks com config obrigatória
    for (const st of subtasks) {
      if (!st.title.trim()) {
        toast.error('Todas as subtasks devem ter título')
        return
      }
      if (st.type === 'upload' && !st.config.doc_type_id) {
        toast.error(`Subtask "${st.title || 'Upload'}": seleccione o tipo de documento`)
        return
      }
      if (st.type === 'email' && !st.config.email_library_id) {
        toast.error(`Subtask "${st.title || 'Email'}": seleccione o template de email`)
        return
      }
      if (st.type === 'generate_doc' && !st.config.doc_library_id) {
        toast.error(`Subtask "${st.title || 'Gerar Documento'}": seleccione o template de documento`)
        return
      }
    }

    onSubmit({
      id: initialData?.id || '',
      title: title.trim(),
      description: description.trim() || undefined,
      is_mandatory: isMandatory,
      priority,
      sla_days: slaDays ? parseInt(slaDays, 10) : undefined,
      assigned_role: assignedRole || undefined,
      subtasks,
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl w-full min-w-[600px] p-0 flex flex-col h-full">
        {/* HEADER FIXO */}
        <SheetHeader className="border-b px-6 py-4 space-y-3 shrink-0">
          <SheetTitle className="text-lg">
            {initialData ? 'Editar Tarefa' : 'Nova Tarefa'}
          </SheetTitle>
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da tarefa"
              className="text-base font-medium"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={2}
              className="resize-none text-sm"
            />
            <div className="flex items-center gap-2">
              <Switch checked={isMandatory} onCheckedChange={setIsMandatory} />
              <Label className="text-sm">Obrigatória</Label>
            </div>
          </div>
        </SheetHeader>

        {/* CORPO SCROLLÁVEL */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Secção: Detalhes */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Detalhes</h3>
            <div className="grid grid-cols-3 gap-4">
              {/* Prioridade */}
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as 'urgent' | 'normal' | 'low')}>
                  <SelectTrigger className="h-9 w-full">
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

              {/* Role atribuído */}
              <div className="space-y-1.5">
                <Label className="text-xs">Role atribuído</Label>
                <Select value={assignedRole} onValueChange={setAssignedRole}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Seleccionar..." />
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
              <div className="space-y-1.5">
                <Label className="text-xs">SLA (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Ex: 5"
                  value={slaDays}
                  onChange={(e) => setSlaDays(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Secção: Subtasks */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Subtasks ({subtasks.length})
            </h3>
            <SubtaskEditor subtasks={subtasks} onChange={setSubtasks} />
          </div>
        </div>

        {/* FOOTER FIXO */}
        <div className="border-t px-6 py-3 shrink-0">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {initialData ? 'Guardar' : 'Criar Tarefa'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
