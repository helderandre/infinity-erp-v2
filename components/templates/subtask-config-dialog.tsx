'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Clock,
  Users,
  Lock,
  Bell,
  Upload,
  CheckSquare,
  Mail,
  Info,
  ClipboardList,
  TextCursorInput,
  CalendarPlus,
  Plus,
  Trash2,
  ExternalLink,
  MessageCircle,
} from 'lucide-react'
import {
  SUBTASK_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
} from '@/lib/constants'
import { AlertConfigEditor } from './alert-config-editor'
import { FormFieldPicker } from './form-field-picker'
import { OwnerSelector } from '@/components/processes/owner-selector'
import { cn } from '@/lib/utils'
import type { SubtaskData } from '@/types/subtask'
import type { AlertsConfig } from '@/types/alert'

// ─── Types ───────────────────────────────────────────────

type NavSection = 'dados' | 'prazos' | 'proprietarios' | 'dependencias' | 'alertas'

interface FeatureDef {
  key: Exclude<NavSection, 'dados'>
  label: string
  icon: React.ElementType
  description: string
}

const FEATURES: FeatureDef[] = [
  { key: 'prazos', label: 'Prazos & Responsável', icon: Clock, description: 'Prazo, responsável e prioridade' },
  { key: 'proprietarios', label: 'Proprietários', icon: Users, description: 'Repetir por proprietário' },
  { key: 'dependencias', label: 'Dependências', icon: Lock, description: 'Bloquear até outra tarefa' },
  { key: 'alertas', label: 'Alertas', icon: Bell, description: 'Notificações automáticas' },
]

const TYPE_ICONS: Record<string, React.ElementType> = {
  upload: Upload,
  checklist: CheckSquare,
  email: Mail,
  generate_doc: FileText,
  form: ClipboardList,
  field: TextCursorInput,
  schedule_event: CalendarPlus,
  external_form: ClipboardList,
  whatsapp: MessageCircle,
}

// ─── Dependency types (passed from SubtaskEditor) ────────

export interface SubtaskDependencyOption {
  stageLabel: string
  taskId: string
  taskTitle: string
}

export interface SubtaskContextItem {
  stageLabel: string
  taskTitle: string
  taskId: string
  subtask: SubtaskData
}

interface RoleOption {
  value: string
  label: string
}

// ─── Props ───────────────────────────────────────────────

interface SubtaskConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subtask: SubtaskData | null
  onSave: (data: SubtaskData) => void
  // Data from parent
  docTypes: { id: string; name: string; category?: string }[]
  docTypesByCategory: Record<string, { id: string; name: string; category?: string }[]>
  emailTemplates: { id: string; name: string; subject: string }[]
  docTemplates: { id: string; name: string; template_type?: string }[]
  roles?: RoleOption[]
  // Dependencies
  sameTaskSubtasks: SubtaskData[]
  taskDependencyOptions?: SubtaskDependencyOption[]
  allSubtasksContext?: SubtaskContextItem[]
  currentTaskId?: string
  // Ad-hoc mode
  mode?: 'template' | 'adhoc'
  availableOwners?: { id: string; name: string; person_type: 'singular' | 'coletiva'; nif?: string | null }[]
}

// ─── WhatsApp Template Selector ──────────────────────────

function WhatsAppTemplateSelector({
  templateId,
  instanceId,
  onTemplateChange,
  onInstanceChange,
}: {
  templateId?: string
  instanceId?: string
  onTemplateChange: (id?: string) => void
  onInstanceChange: (id?: string) => void
}) {
  const [templates, setTemplates] = useState<{ id: string; name: string; category: string }[]>([])
  const [instances, setInstances] = useState<{ id: string; name: string; phone?: string | null; connection_status: string }[]>([])

  useEffect(() => {
    fetch('/api/automacao/templates-wpp')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTemplates(data) })
      .catch(() => {})
    fetch('/api/automacao/instancias')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setInstances(data) })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 px-4 py-3 text-sm flex items-start gap-2">
        <MessageCircle className="h-4 w-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
        <div>
          <p className="font-medium text-green-700 dark:text-green-300">Mensagem WhatsApp</p>
          <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">
            Envia uma mensagem WhatsApp ao proprietário usando um template pré-definido.
            O número de telemóvel do proprietário será usado como destinatário.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Instância WhatsApp</Label>
        <Select
          value={instanceId || '__none__'}
          onValueChange={(v) => onInstanceChange(v === '__none__' ? undefined : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar instância..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">(Nenhuma — usar padrão)</SelectItem>
            {instances.map((inst) => (
              <SelectItem key={inst.id} value={inst.id}>
                <span className="flex items-center gap-2">
                  {inst.name}
                  {inst.phone && <span className="text-muted-foreground text-xs">{inst.phone}</span>}
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    inst.connection_status === 'connected' ? 'bg-emerald-500' : 'bg-slate-400'
                  )} />
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Template de Mensagem</Label>
        <Select
          value={templateId || '__none__'}
          onValueChange={(v) => onTemplateChange(v === '__none__' ? undefined : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar template WhatsApp..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">(Nenhum)</SelectItem>
            {templates.map((tpl) => (
              <SelectItem key={tpl.id} value={tpl.id}>
                <span className="flex items-center gap-2">
                  {tpl.name}
                  <Badge variant="outline" className="text-[10px] px-1 py-0">{tpl.category}</Badge>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// ─── Form Template Selector ──────────────────────────────

function FormTemplateSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  const [templates, setTemplates] = useState<
    { id: string; name: string; category: string | null; description: string | null }[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/form-templates')
        if (res.ok) setTemplates(await res.json())
      } catch {
        // silenciar
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return <p className="text-sm text-muted-foreground">A carregar templates...</p>
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-center">
        <p className="text-sm text-muted-foreground">Nenhum template de formulário disponível.</p>
        <p className="text-xs text-muted-foreground mt-1">Crie templates em Definições → Templates de Formulário</p>
      </div>
    )
  }

  // Agrupar por categoria
  const grouped = templates.reduce((acc, t) => {
    const cat = t.category || 'Sem Categoria'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {} as Record<string, typeof templates>)

  return (
    <div className="space-y-2">
      <Label>Template de Formulário</Label>
      <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Seleccionar template..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">(Nenhum)</SelectItem>
          {Object.entries(grouped).map(([category, items]) => (
            <SelectGroup key={category}>
              <SelectLabel>{category}</SelectLabel>
              {items.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                  {t.description && (
                    <span className="text-muted-foreground ml-2 text-xs">— {t.description}</span>
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {value && (
        <p className="text-xs text-muted-foreground">
          As secções e campos serão carregados do template seleccionado ao executar a subtarefa.
        </p>
      )}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────

export function SubtaskConfigDialog({
  open,
  onOpenChange,
  subtask,
  onSave,
  docTypes,
  docTypesByCategory,
  emailTemplates,
  docTemplates,
  roles,
  sameTaskSubtasks,
  taskDependencyOptions,
  allSubtasksContext,
  currentTaskId,
  mode = 'template',
  availableOwners,
}: SubtaskConfigDialogProps) {
  const [activeSection, setActiveSection] = useState<NavSection>('dados')
  const [enabledFeatures, setEnabledFeatures] = useState<Set<NavSection>>(new Set())
  const [local, setLocal] = useState<SubtaskData | null>(null)

  // Initialize state when dialog opens
  useEffect(() => {
    if (!open) return
    const initial: SubtaskData = subtask
      ? { ...subtask, config: { ...subtask.config } }
      : {
          id: crypto.randomUUID(),
          title: '',
          is_mandatory: true,
          order_index: 0,
          type: 'checklist',
          config: {},
        }
    setLocal(initial)
    setActiveSection('dados')

    // Detect already-enabled features
    const enabled = new Set<NavSection>()
    if (subtask) {
      if (subtask.sla_days || subtask.assigned_role || (subtask.priority && subtask.priority !== 'normal')) {
        enabled.add('prazos')
      }
      if (subtask.config.owner_scope && subtask.config.owner_scope !== 'none') {
        enabled.add('proprietarios')
      }
      if (subtask.dependency_type && subtask.dependency_type !== 'none') {
        enabled.add('dependencias')
      }
      const alerts = subtask.config.alerts
      if (alerts && Object.values(alerts).some((e) => e?.enabled)) {
        enabled.add('alertas')
      }
    }
    setEnabledFeatures(enabled)
  }, [open, subtask])

  if (!local) return null

  // ─── Helpers ─────────────────────────────────────────

  const update = (data: Partial<SubtaskData>) => {
    setLocal((prev) => (prev ? { ...prev, ...data } : prev))
  }

  const updateConfig = (config: Partial<SubtaskData['config']>) => {
    setLocal((prev) =>
      prev ? { ...prev, config: { ...prev.config, ...config } } : prev
    )
  }

  const toggleFeature = (key: Exclude<NavSection, 'dados'>) => {
    const next = new Set(enabledFeatures)
    if (next.has(key)) {
      next.delete(key)
      // Clear related data
      if (key === 'prazos') {
        update({ sla_days: undefined, assigned_role: undefined, priority: 'normal' })
      }
      if (key === 'proprietarios') {
        updateConfig({
          owner_scope: 'none',
          person_type_filter: undefined,
          has_person_type_variants: undefined,
          singular_config: undefined,
          coletiva_config: undefined,
        })
      }
      if (key === 'dependencias') {
        update({
          dependency_type: 'none',
          dependency_subtask_id: null,
          dependency_task_id: null,
        })
      }
      if (key === 'alertas') {
        updateConfig({ alerts: undefined })
      }
      if (activeSection === key) setActiveSection('dados')
    } else {
      next.add(key)
      setActiveSection(key)
    }
    setEnabledFeatures(next)
  }

  const handleSave = () => {
    onSave(local)
    onOpenChange(false)
  }

  // ─── Render ──────────────────────────────────────────

  const TypeIcon = TYPE_ICONS[local.type] || FileText

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl w-full p-0 gap-0 flex flex-col overflow-hidden z-[60]"
        overlayClassName="z-[60]"
        style={{ maxHeight: '85vh' }}
        showCloseButton
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
              <TypeIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <DialogTitle className="text-base">
                Configurar Subtarefa
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {SUBTASK_TYPE_LABELS[local.type]} &middot; {local.title || '(Sem título)'}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Body: Split Layout */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left Nav */}
          <nav className="w-52 border-r bg-muted/20 p-3 flex flex-col gap-1 shrink-0 overflow-y-auto">
            {/* Dados — always visible */}
            <button
              onClick={() => setActiveSection('dados')}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
                activeSection === 'dados'
                  ? 'bg-background text-foreground shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <FileText className="h-4 w-4 shrink-0" />
              Dados
            </button>

            {/* Enabled features as nav items */}
            {FEATURES.filter((f) => enabledFeatures.has(f.key)).map((feature) => (
              <button
                key={feature.key}
                onClick={() => setActiveSection(feature.key)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
                  activeSection === feature.key
                    ? 'bg-background text-foreground shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                )}
              >
                <feature.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{feature.label}</span>
              </button>
            ))}

            {/* Feature toggles section */}
            <Separator className="my-2" />
            <p className="px-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Funcionalidades
            </p>
            {FEATURES.map((feature) => {
              const isEnabled = enabledFeatures.has(feature.key)
              return (
                <div
                  key={feature.key}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors cursor-pointer',
                    isEnabled ? 'text-foreground' : 'text-muted-foreground'
                  )}
                  onClick={() => {
                    if (!isEnabled) toggleFeature(feature.key)
                    else setActiveSection(feature.key)
                  }}
                >
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => toggleFeature(feature.key)}
                    className="scale-[0.65] shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-xs truncate">{feature.label}</span>
                </div>
              )
            })}
          </nav>

          {/* Right Content */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-5">
              {activeSection === 'dados' && (
                <SectionDados
                  local={local}
                  update={update}
                  updateConfig={updateConfig}
                  docTypes={docTypes}
                  docTypesByCategory={docTypesByCategory}
                  emailTemplates={emailTemplates}
                  docTemplates={docTemplates}
                />
              )}
              {activeSection === 'prazos' && (
                <SectionPrazos
                  local={local}
                  update={update}
                  roles={roles}
                />
              )}
              {activeSection === 'proprietarios' && mode === 'adhoc' && availableOwners ? (
                <SectionProprietariosAdhoc
                  local={local}
                  update={update}
                  availableOwners={availableOwners}
                />
              ) : activeSection === 'proprietarios' && (
                <SectionProprietarios
                  local={local}
                  updateConfig={updateConfig}
                  docTypes={docTypes}
                  docTypesByCategory={docTypesByCategory}
                  emailTemplates={emailTemplates}
                  docTemplates={docTemplates}
                />
              )}
              {activeSection === 'dependencias' && (
                <SectionDependencias
                  local={local}
                  update={update}
                  sameTaskSubtasks={sameTaskSubtasks}
                  taskDependencyOptions={taskDependencyOptions}
                  allSubtasksContext={allSubtasksContext}
                  currentTaskId={currentTaskId}
                />
              )}
              {activeSection === 'alertas' && (
                <SectionAlertas
                  local={local}
                  updateConfig={updateConfig}
                />
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex justify-end gap-2 shrink-0 bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Section: Dados ──────────────────────────────────────

function SectionDados({
  local,
  update,
  updateConfig,
  docTypes,
  docTypesByCategory,
  emailTemplates,
  docTemplates,
}: {
  local: SubtaskData
  update: (data: Partial<SubtaskData>) => void
  updateConfig: (config: Partial<SubtaskData['config']>) => void
  docTypes: { id: string; name: string; category?: string }[]
  docTypesByCategory: Record<string, typeof docTypes>
  emailTemplates: { id: string; name: string; subject: string }[]
  docTemplates: { id: string; name: string; template_type?: string }[]
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium mb-3">Informação Básica</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input
              value={local.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Título da subtarefa"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea
              value={local.description || ''}
              onChange={(e) => update({ description: e.target.value || undefined })}
              placeholder="Descreva o que é esperado..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={local.is_mandatory}
              onCheckedChange={(v) => update({ is_mandatory: v })}
            />
            <Label className="text-sm">Obrigatória</Label>
          </div>
        </div>
      </div>

      {/* Type-specific config (only when NOT using person type variants) */}
      {['upload', 'email', 'generate_doc'].includes(local.type) && !local.config.has_person_type_variants && (
        <div>
          <h3 className="text-sm font-medium mb-3">
            {local.type === 'upload' && 'Tipo de Documento'}
            {local.type === 'email' && 'Template de Email'}
            {local.type === 'generate_doc' && 'Template de Documento'}
          </h3>
          {local.type === 'upload' && (
            <Select
              value={local.config.doc_type_id || '__none__'}
              onValueChange={(v) => updateConfig({ doc_type_id: v === '__none__' ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo de documento..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">(Nenhum)</SelectItem>
                {Object.entries(docTypesByCategory).map(([category, types]) => (
                  <SelectGroup key={category}>
                    <SelectLabel>{category}</SelectLabel>
                    {types.map((dt) => (
                      <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          )}
          {local.type === 'email' && (
            <Select
              value={local.config.email_library_id || '__none__'}
              onValueChange={(v) => updateConfig({ email_library_id: v === '__none__' ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar template de email..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">(Nenhum)</SelectItem>
                {emailTemplates.map((et) => (
                  <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {local.type === 'generate_doc' && (
            <Select
              value={local.config.doc_library_id || '__none__'}
              onValueChange={(v) => updateConfig({ doc_library_id: v === '__none__' ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar template de documento..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">(Nenhum)</SelectItem>
                {docTemplates.map((dt) => (
                  <SelectItem key={dt.id} value={dt.id}>
                    <span className="flex items-center gap-2">
                      {dt.name}
                      {dt.template_type === 'pdf' ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1 py-0">PDF</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] px-1 py-0">HTML</Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {local.type === 'checklist' && (
        <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Subtarefas do tipo <strong>Checklist</strong> não requerem configuração adicional — basta o título.</span>
        </div>
      )}

      {local.type === 'schedule_event' && (
        <div className="rounded-md bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-4 py-3 text-sm flex items-start gap-2">
          <CalendarPlus className="h-4 w-4 mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <div>
            <p className="font-medium text-indigo-700 dark:text-indigo-300">Agendar Evento no Calendário</p>
            <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80 mt-1">
              Ao executar esta subtarefa, o utilizador definirá a data, horário, participantes e proprietários.
              O evento ficará visível no calendário e vinculado a este processo.
            </p>
          </div>
        </div>
      )}

      {local.type === 'whatsapp' && (
        <WhatsAppTemplateSelector
          templateId={local.config.whatsapp_template_id}
          instanceId={local.config.whatsapp_instance_id}
          onTemplateChange={(id) => updateConfig({ whatsapp_template_id: id })}
          onInstanceChange={(id) => updateConfig({ whatsapp_instance_id: id })}
        />
      )}

      {/* Form subtask config */}
      {local.type === 'form' && (
        <div className="space-y-3">
          <Label>Título do Formulário (opcional)</Label>
          <Input
            value={local.config.form_title || ''}
            onChange={(e) => updateConfig({ form_title: e.target.value })}
            placeholder="Ex: Completar Dados do Imóvel"
          />
          <Separator />

          {/* Toggle: Template da DB vs Campos inline */}
          <div className="flex items-center justify-between">
            <Label>Usar template de formulário</Label>
            <Switch
              checked={!!local.config.form_template_id}
              onCheckedChange={(checked) => {
                if (checked) {
                  // Activar modo template — manter sections como backup
                  updateConfig({ form_template_id: '' })
                } else {
                  // Voltar a campos inline — remover referência ao template
                  updateConfig({ form_template_id: undefined })
                }
              }}
            />
          </div>

          {local.config.form_template_id !== undefined ? (
            <FormTemplateSelector
              value={local.config.form_template_id || ''}
              onChange={(id) => updateConfig({ form_template_id: id })}
            />
          ) : (
            <>
              <Label>Campos do Formulário</Label>
              <FormFieldPicker
                mode="form"
                sections={local.config.sections || []}
                onSectionsChange={(sections) => updateConfig({ sections })}
              />
            </>
          )}
        </div>
      )}

      {/* Field subtask config */}
      {local.type === 'field' && (
        <div className="space-y-3">
          <Label>Campo a Vincular</Label>
          <FormFieldPicker
            mode="field"
            field={local.config.field || null}
            onFieldChange={(field) => updateConfig({ field: field || undefined })}
            showCurrentValue={local.config.show_current_value ?? true}
            onShowCurrentValueChange={(v) => updateConfig({ show_current_value: v })}
            autoCompleteOnSave={local.config.auto_complete_on_save ?? true}
            onAutoCompleteOnSaveChange={(v) => updateConfig({ auto_complete_on_save: v })}
          />
        </div>
      )}

      {/* External form config */}
      {local.type === 'external_form' && (
        <div className="space-y-3">
          <Label>Título do Popup (opcional)</Label>
          <Input
            value={local.config.form_title || ''}
            onChange={(e) => updateConfig({ form_title: e.target.value || undefined })}
            placeholder="Ex: Dados para Registo"
          />
          <Separator />

          <Label>Campos do Formulário</Label>
          <FormFieldPicker
            mode="form"
            sections={local.config.sections || []}
            onSectionsChange={(sections) => updateConfig({ sections })}
          />

          <Separator />

          <ExternalFormLinksSection
            local={local}
            updateConfig={updateConfig}
            docTypes={docTypes}
            docTypesByCategory={docTypesByCategory}
          />
        </div>
      )}
    </div>
  )
}

// ─── Section: Prazos & Responsável ───────────────────────

function SectionPrazos({
  local,
  update,
  roles,
}: {
  local: SubtaskData
  update: (data: Partial<SubtaskData>) => void
  roles?: RoleOption[]
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium mb-1">Prazos & Responsável</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Defina o prazo em dias, o responsável e a prioridade desta subtarefa.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Prazo (dias)</Label>
            <Input
              type="number"
              min="1"
              placeholder="Ex: 5"
              value={local.sla_days || ''}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : undefined
                update({ sla_days: val && val > 0 ? val : undefined })
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Responsável</Label>
            <Select
              value={local.assigned_role || '_none'}
              onValueChange={(v) => update({ assigned_role: v === '_none' ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">(Sem atribuição)</SelectItem>
                {(roles || []).map((role) => (
                  <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Prioridade</Label>
            <Select
              value={local.priority || 'normal'}
              onValueChange={(v) => update({ priority: v as SubtaskData['priority'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Section: Proprietários ──────────────────────────────

function SectionProprietarios({
  local,
  updateConfig,
  docTypes,
  docTypesByCategory,
  emailTemplates,
  docTemplates,
}: {
  local: SubtaskData
  updateConfig: (config: Partial<SubtaskData['config']>) => void
  docTypes: { id: string; name: string; category?: string }[]
  docTypesByCategory: Record<string, typeof docTypes>
  emailTemplates: { id: string; name: string; subject: string }[]
  docTemplates: { id: string; name: string; template_type?: string }[]
}) {
  const ownerScope = local.config.owner_scope || 'none'
  const isMultiplied = ownerScope !== 'none'

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium mb-1">Configuração por Proprietário</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Esta subtarefa pode ser repetida para cada proprietário do imóvel.
        </p>

        <div className="space-y-4">
          {/* Mode selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div>
                <p className="text-sm font-medium">Repetir por proprietário</p>
                <p className="text-xs text-muted-foreground">Criar uma cópia para cada proprietário</p>
              </div>
              <Switch
                checked={ownerScope === 'all_owners'}
                onCheckedChange={(checked) => {
                  updateConfig({
                    owner_scope: checked ? 'all_owners' : 'none',
                    person_type_filter: checked ? (local.config.person_type_filter || 'all') : undefined,
                    ...(!checked ? {
                      has_person_type_variants: undefined,
                      singular_config: undefined,
                      coletiva_config: undefined,
                    } : {}),
                  })
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div>
                <p className="text-sm font-medium">Apenas contacto principal</p>
                <p className="text-xs text-muted-foreground">Aplicar apenas ao proprietário principal</p>
              </div>
              <Switch
                checked={ownerScope === 'main_contact_only'}
                onCheckedChange={(checked) => {
                  updateConfig({
                    owner_scope: checked ? 'main_contact_only' : 'none',
                    person_type_filter: checked ? (local.config.person_type_filter || 'all') : undefined,
                    ...(!checked ? {
                      has_person_type_variants: undefined,
                      singular_config: undefined,
                      coletiva_config: undefined,
                    } : {}),
                  })
                }}
              />
            </div>
          </div>

          {/* Additional options when a mode is active */}
          {isMultiplied && (
            <div className="space-y-4 pl-4 border-l-2 border-primary/20">
              {/* Person type filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Aplicar a</Label>
                <Select
                  value={local.config.person_type_filter || 'all'}
                  onValueChange={(v) =>
                    updateConfig({ person_type_filter: v as 'all' | 'singular' | 'coletiva' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os proprietários</SelectItem>
                    <SelectItem value="singular">Apenas Pessoa Singular</SelectItem>
                    <SelectItem value="coletiva">Apenas Pessoa Colectiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Config diferente por tipo de pessoa */}
              {local.type !== 'checklist' && (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div>
                    <p className="text-sm font-medium">Config. diferente por tipo</p>
                    <p className="text-xs text-muted-foreground">
                      Templates diferentes para singular e colectiva
                    </p>
                  </div>
                  <Switch
                    checked={!!local.config.has_person_type_variants}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        has_person_type_variants: checked || undefined,
                        singular_config: checked ? (local.config.singular_config || {}) : undefined,
                        coletiva_config: checked ? (local.config.coletiva_config || {}) : undefined,
                        ...(checked ? {
                          doc_type_id: undefined,
                          email_library_id: undefined,
                          doc_library_id: undefined,
                        } : {}),
                      })
                    }
                  />
                </div>
              )}

              {/* Variant selectors */}
              {local.type !== 'checklist' && local.config.has_person_type_variants && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Pessoa Singular</Label>
                    <VariantSelect
                      type={local.type}
                      config={local.config.singular_config || {}}
                      onChange={(cfg) => updateConfig({ singular_config: cfg })}
                      docTypesByCategory={docTypesByCategory}
                      emailTemplates={emailTemplates}
                      docTemplates={docTemplates}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Pessoa Colectiva</Label>
                    <VariantSelect
                      type={local.type}
                      config={local.config.coletiva_config || {}}
                      onChange={(cfg) => updateConfig({ coletiva_config: cfg })}
                      docTypesByCategory={docTypesByCategory}
                      emailTemplates={emailTemplates}
                      docTemplates={docTemplates}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper: Variant select (singular/coletiva)
function VariantSelect({
  type,
  config,
  onChange,
  docTypesByCategory,
  emailTemplates,
  docTemplates,
}: {
  type: SubtaskData['type']
  config: { doc_type_id?: string; email_library_id?: string; doc_library_id?: string }
  onChange: (cfg: typeof config) => void
  docTypesByCategory: Record<string, { id: string; name: string; category?: string }[]>
  emailTemplates: { id: string; name: string; subject: string }[]
  docTemplates: { id: string; name: string; template_type?: string }[]
}) {
  if (type === 'upload') {
    return (
      <Select
        value={config.doc_type_id || '__none__'}
        onValueChange={(v) => onChange({ ...config, doc_type_id: v === '__none__' ? undefined : v })}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Tipo de documento..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">(Nenhum)</SelectItem>
          {Object.entries(docTypesByCategory).map(([category, types]) => (
            <SelectGroup key={category}>
              <SelectLabel>{category}</SelectLabel>
              {types.map((dt) => (
                <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    )
  }
  if (type === 'email') {
    return (
      <Select
        value={config.email_library_id || '__none__'}
        onValueChange={(v) => onChange({ ...config, email_library_id: v === '__none__' ? undefined : v })}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Template de email..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">(Nenhum)</SelectItem>
          {emailTemplates.map((et) => (
            <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  if (type === 'generate_doc') {
    return (
      <Select
        value={config.doc_library_id || '__none__'}
        onValueChange={(v) => onChange({ ...config, doc_library_id: v === '__none__' ? undefined : v })}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Template de documento..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">(Nenhum)</SelectItem>
          {docTemplates.map((dt) => (
            <SelectItem key={dt.id} value={dt.id}>
              <span className="flex items-center gap-2">
                {dt.name}
                {dt.template_type === 'pdf' ? (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1 py-0">PDF</Badge>
                ) : (
                  <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] px-1 py-0">HTML</Badge>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  return null
}

// ─── Section: Dependências ───────────────────────────────

function SectionDependencias({
  local,
  update,
  sameTaskSubtasks,
  taskDependencyOptions,
  allSubtasksContext,
  currentTaskId,
}: {
  local: SubtaskData
  update: (data: Partial<SubtaskData>) => void
  sameTaskSubtasks: SubtaskData[]
  taskDependencyOptions?: SubtaskDependencyOption[]
  allSubtasksContext?: SubtaskContextItem[]
  currentTaskId?: string
}) {
  const siblingSubtasks = sameTaskSubtasks.filter((s) => s.id !== local.id && s.title)
  const otherSubtasks = (allSubtasksContext || []).filter(
    (ctx) => ctx.taskId !== currentTaskId && ctx.subtask.title
  )
  const hasOptions =
    siblingSubtasks.length > 0 ||
    otherSubtasks.length > 0 ||
    (taskDependencyOptions && taskDependencyOptions.length > 0)

  const currentDepValue = (() => {
    if (!local.dependency_type || local.dependency_type === 'none') return '_none'
    if (local.dependency_type === 'subtask' && local.dependency_subtask_id) {
      return `st:${local.dependency_subtask_id}`
    }
    if (local.dependency_type === 'task' && local.dependency_task_id) {
      return `tk:${local.dependency_task_id}`
    }
    return '_none'
  })()

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium mb-1">Dependências</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Bloquear esta subtarefa até que outra tarefa ou subtarefa seja concluída.
        </p>

        {!hasOptions ? (
          <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Não existem outras tarefas ou subtarefas disponíveis para criar dependências.</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Bloqueada até</Label>
              <Select
                value={currentDepValue}
                onValueChange={(v) => {
                  if (v === '_none') {
                    update({
                      dependency_type: 'none',
                      dependency_subtask_id: null,
                      dependency_task_id: null,
                    })
                  } else if (v.startsWith('st:')) {
                    update({
                      dependency_type: 'subtask',
                      dependency_subtask_id: v.slice(3),
                      dependency_task_id: null,
                    })
                  } else if (v.startsWith('tk:')) {
                    update({
                      dependency_type: 'task',
                      dependency_subtask_id: null,
                      dependency_task_id: v.slice(3),
                    })
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem bloqueio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">(Sem bloqueio)</SelectItem>
                  {siblingSubtasks.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Subtarefas desta tarefa</SelectLabel>
                      {siblingSubtasks.map((s) => (
                        <SelectItem key={`st:${s.id}`} value={`st:${s.id}`}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {otherSubtasks.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Subtarefas de outras tarefas</SelectLabel>
                      {otherSubtasks.map((ctx) => (
                        <SelectItem key={`st:${ctx.subtask.id}`} value={`st:${ctx.subtask.id}`}>
                          [{ctx.stageLabel}] {ctx.taskTitle} &rarr; {ctx.subtask.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {taskDependencyOptions && taskDependencyOptions.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Tarefas (tarefa inteira)</SelectLabel>
                      {taskDependencyOptions.map((t) => (
                        <SelectItem key={`tk:${t.taskId}`} value={`tk:${t.taskId}`}>
                          [{t.stageLabel}] {t.taskTitle}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>

            {local.dependency_type && local.dependency_type !== 'none' && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                <Lock className="h-3 w-3 mr-1" />
                Dependência activa
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section: Alertas ────────────────────────────────────

function SectionAlertas({
  local,
  updateConfig,
}: {
  local: SubtaskData
  updateConfig: (config: Partial<SubtaskData['config']>) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium mb-1">Alertas & Notificações</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Configure notificações automáticas para eventos desta subtarefa.
        </p>
        <AlertConfigEditor
          alerts={local.config.alerts}
          onChange={(alerts) => updateConfig({ alerts })}
          defaultOpen
        />
      </div>
    </div>
  )
}

// ─── Section: Proprietários (modo ad-hoc) ────────────────

// ─── External Form Config Section ────────────────────────

import type { ExternalLink as ExternalLinkType, DocumentShortcut } from '@/types/subtask'

function ExternalFormLinksSection({
  local,
  updateConfig,
  docTypes,
  docTypesByCategory,
}: {
  local: SubtaskData
  updateConfig: (config: Partial<SubtaskData['config']>) => void
  docTypes: { id: string; name: string; category?: string }[]
  docTypesByCategory: Record<string, typeof docTypes>
}) {
  const links = local.config.external_links || []
  const shortcuts = local.config.document_shortcuts || []

  const addLink = () => {
    const newLink: ExternalLinkType = { site_name: '', url: '' }
    updateConfig({ external_links: [...links, newLink] })
  }

  const updateLink = (idx: number, patch: Partial<ExternalLinkType>) => {
    const updated = links.map((l, i) => i === idx ? { ...l, ...patch } : l)
    updateConfig({ external_links: updated })
  }

  const removeLink = (idx: number) => {
    updateConfig({ external_links: links.filter((_, i) => i !== idx) })
  }

  const addShortcut = () => {
    const newShortcut: DocumentShortcut = { doc_type_id: '' }
    updateConfig({ document_shortcuts: [...shortcuts, newShortcut] })
  }

  const updateShortcut = (idx: number, patch: Partial<DocumentShortcut>) => {
    const updated = shortcuts.map((s, i) => i === idx ? { ...s, ...patch } : s)
    updateConfig({ document_shortcuts: updated })
  }

  const removeShortcut = (idx: number) => {
    updateConfig({ document_shortcuts: shortcuts.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-5">
      {/* External Links */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Links Externos</h3>
          <Button variant="outline" size="sm" onClick={addLink}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Link
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Links para sites externos (ex: portais, registos) com abertura em novo separador.
        </p>
        {links.length === 0 && (
          <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground text-center">
            Nenhum link configurado.
          </div>
        )}
        <div className="space-y-2">
          {links.map((link, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Site</Label>
                <Input
                  value={link.site_name}
                  onChange={(e) => updateLink(idx, { site_name: e.target.value })}
                  placeholder="Ex: Portal das Finanças"
                  className="text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL</Label>
                <Input
                  value={link.url}
                  onChange={(e) => updateLink(idx, { url: e.target.value })}
                  placeholder="https://..."
                  className="text-xs h-8"
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLink(idx)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Document Shortcuts */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Atalhos de Documentos</h3>
          <Button variant="outline" size="sm" onClick={addShortcut}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Documento
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Atalhos para documentos do processo (download directo se disponível).
        </p>
        {shortcuts.length === 0 && (
          <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground text-center">
            Nenhum atalho configurado.
          </div>
        )}
        <div className="space-y-2">
          {shortcuts.map((shortcut, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Documento</Label>
                <Select
                  value={shortcut.doc_type_id || '__none__'}
                  onValueChange={(v) => updateShortcut(idx, { doc_type_id: v === '__none__' ? '' : v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(Nenhum)</SelectItem>
                    {Object.entries(docTypesByCategory).map(([category, types]) => (
                      <SelectGroup key={category}>
                        <SelectLabel>{category}</SelectLabel>
                        {types.map((dt) => (
                          <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Label (opcional)</Label>
                <Input
                  value={shortcut.label || ''}
                  onChange={(e) => updateShortcut(idx, { label: e.target.value || undefined })}
                  placeholder="Override do nome..."
                  className="text-xs h-8"
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeShortcut(idx)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SectionProprietariosAdhoc({
  local,
  update,
  availableOwners,
}: {
  local: SubtaskData
  update: (data: Partial<SubtaskData>) => void
  availableOwners: { id: string; name: string; person_type: 'singular' | 'coletiva'; nif?: string | null }[]
}) {
  const selectedId = (local as any).owner_id as string | undefined

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium mb-1">Associar Proprietário</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Seleccione o proprietário para associar a esta subtarefa.
        </p>
        <OwnerSelector
          owners={availableOwners.map(o => ({
            ...o,
            nif: o.nif ?? null,
            email: null,
            phone: null,
            ownership_percentage: 0,
            is_main_contact: false,
          }))}
          selectedOwnerIds={selectedId ? [selectedId] : []}
          onChange={(ids) => update({ owner_id: ids[0] || undefined } as any)}
          placeholder="Sem proprietário associado"
        />
        {selectedId && (
          <p className="text-xs text-muted-foreground mt-2">
            A subtarefa será associada a este proprietário específico.
          </p>
        )}
      </div>
    </div>
  )
}
