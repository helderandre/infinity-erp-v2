# SPEC — Novo Editor de Tarefas em Templates (Sheet + Subtasks Genéricas)

**Data:** 2026-02-25
**PRD:** [PRD-TEMPLATE-TASK-EDITOR.md](PRD-TEMPLATE-TASK-EDITOR.md)
**Módulo:** M07 — Templates de Processo
**Estimativa:** ~800 linhas de código novo/modificado

---

## Resumo

Substituir o `TemplateTaskDialog` (Dialog modal, 422 linhas) por um `TemplateTaskSheet` (Sheet lateral) seguindo o padrão já existente em `task-detail-sheet.tsx` do módulo de processos. Ao mesmo tempo, generalizar o sistema de subtasks: o campo `action_type` da tarefa é removido e cada subtask passa a definir o seu próprio tipo de acção (`upload`, `checklist`, `email`, `generate_doc`).

**Mudança conceptual:** Uma tarefa deixa de ter um `action_type` fixo. Passa a ser um **container de subtasks**, e cada subtask define o seu tipo.

---

## Estado Actual vs. Estado Desejado

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Editor de tarefa | Dialog (`template-task-dialog.tsx`, 422 linhas) | Sheet lateral (`template-task-sheet.tsx`) |
| Subtasks | Apenas em tarefas `FORM`, com `check_type: field\|document\|manual` | Em qualquer tarefa, com `type: upload\|checklist\|email\|generate_doc` |
| `action_type` na TaskData | Obrigatório (`UPLOAD\|EMAIL\|GENERATE_DOC\|MANUAL\|FORM`) | Removido — derivado das subtasks |
| `action_type` em `tpl_tasks` (DB) | Mantido na tabela | Mantido por retrocompatibilidade, gravado como `'COMPOSITE'` |
| Config na subtask | `{ check_type, field_name?, doc_type_id? }` | `{ doc_type_id?, email_library_id?, doc_library_id? }` (depende do `type`) |

---

## O Que NÃO Estamos a Fazer

- Migração de dados de templates existentes (os templates actuais continuam a funcionar)
- Alteração do módulo de processos/instâncias (consume `tpl_tasks.action_type` e `tpl_subtasks.config` — fica para outra spec)
- Remoção da coluna `action_type` do banco de dados
- Implementação de `useFieldArray` do react-hook-form (manter padrão existente com `useState` + callbacks)

---

## Ficheiros a Modificar/Criar/Eliminar

### Ordem de Implementação

| # | Ficheiro | Acção | Motivo |
|---|----------|-------|--------|
| 1 | `types/subtask.ts` | MODIFICAR | Actualizar `SubtaskData` com campo `type` |
| 2 | `types/template.ts` | MODIFICAR | Remover `ActionType`, actualizar `TaskData` |
| 3 | `lib/constants.ts` | MODIFICAR | Adicionar `SUBTASK_TYPE_LABELS`, `SUBTASK_TYPES` |
| 4 | `lib/validations/template.ts` | MODIFICAR | Actualizar schemas Zod |
| 5 | `components/templates/subtask-editor.tsx` | REESCREVER | Suportar todos os tipos de subtask |
| 6 | `components/templates/template-task-sheet.tsx` | CRIAR | Novo Sheet lateral |
| 7 | `components/templates/template-builder.tsx` | MODIFICAR | Trocar Dialog por Sheet, remover `action_type` de `TaskData` |
| 8 | `components/templates/template-task-card.tsx` | MODIFICAR | Actualizar badges e ícones |
| 9 | `components/templates/template-stage-column.tsx` | SEM ALTERAÇÃO | Já delega tudo via callbacks ao builder |
| 10 | `app/api/templates/route.ts` | MODIFICAR | Gravar subtasks para qualquer tarefa |
| 11 | `app/api/templates/[id]/route.ts` | MODIFICAR | Mesma lógica + apagar subtasks no PUT |
| 12 | `components/templates/template-task-dialog.tsx` | ELIMINAR | Substituído pelo Sheet |

---

## Fase 1 — Types, Constantes e Validações

### 1.1 `types/subtask.ts`

**O que fazer:** Adicionar campo `type` ao `SubtaskData`. Actualizar `TplSubtask` e `ProcSubtask` para reflectir o novo `config`.

```typescript
// ANTES (linha 33-44):
export interface SubtaskData {
  id: string
  title: string
  description?: string
  is_mandatory: boolean
  order_index: number
  config: {
    check_type: 'field' | 'document' | 'manual'
    field_name?: string
    doc_type_id?: string
  }
}

// DEPOIS:
export type SubtaskType = 'upload' | 'checklist' | 'email' | 'generate_doc'

export interface SubtaskData {
  id: string
  title: string
  description?: string
  is_mandatory: boolean
  order_index: number
  type: SubtaskType
  config: {
    doc_type_id?: string        // type === 'upload'
    email_library_id?: string   // type === 'email'
    doc_library_id?: string     // type === 'generate_doc'
    // type === 'checklist' → sem config extra
  }
}
```

Actualizar também `TplSubtask` (linha 1-13) da mesma forma — adicionar `type: string` ao interface e actualizar o `config`.

`ProcSubtask` (linha 15-30) — **NÃO alterar** nesta spec (módulo processos fica para depois). Manter retrocompatibilidade.

---

### 1.2 `types/template.ts`

**O que fazer:** Remover `ActionType`. Actualizar `TemplateTask.config`.

```typescript
// ANTES (linha 31):
export type ActionType = 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL' | 'FORM'

// DEPOIS: REMOVER esta linha.
// O conceito de action_type migra para SubtaskData.type.
```

Em `TemplateTask` (linhas 13-21), manter o `config` genérico — a tabela `tpl_tasks` continua a ter `action_type` e `config`, mas agora as subtasks é que carregam a lógica.

---

### 1.3 `lib/constants.ts`

**O que fazer:** Adicionar constantes para tipos de subtask. Manter `ACTION_TYPES` existente (usado noutros módulos).

Adicionar após `CHECK_TYPE_LABELS` (linha ~435):

```typescript
// Tipos de subtask (novo modelo)
export const SUBTASK_TYPES = [
  { type: 'upload' as const, label: 'Upload de Documento', icon: 'Upload', color: 'text-blue-500' },
  { type: 'checklist' as const, label: 'Checklist (Manual)', icon: 'CheckSquare', color: 'text-slate-500' },
  { type: 'email' as const, label: 'Envio de Email', icon: 'Mail', color: 'text-amber-500' },
  { type: 'generate_doc' as const, label: 'Gerar Documento', icon: 'FileText', color: 'text-purple-500' },
] as const

export const SUBTASK_TYPE_LABELS: Record<string, string> = {
  upload: 'Upload',
  checklist: 'Checklist',
  email: 'Email',
  generate_doc: 'Gerar Doc',
}

export const SUBTASK_TYPE_ICONS: Record<string, string> = {
  upload: 'Upload',
  checklist: 'CheckSquare',
  email: 'Mail',
  generate_doc: 'FileText',
}
```

---

### 1.4 `lib/validations/template.ts`

**O que fazer:** Reescrever `subtaskSchema` para o novo modelo com `type`. Simplificar `taskSchema` removendo `action_type` e o `.refine()` associado.

```typescript
// === subtaskSchema (REESCREVER linhas 4-16) ===
export const subtaskSchema = z.object({
  title: z.string().min(1, 'O título é obrigatório'),
  description: z.string().optional(),
  is_mandatory: z.boolean().default(true),
  order_index: z.number().int().min(0),
  type: z.enum(['upload', 'checklist', 'email', 'generate_doc'], {
    message: 'Tipo de subtarefa inválido',
  }),
  config: z
    .object({
      doc_type_id: z.string().optional(),
      email_library_id: z.string().optional(),
      doc_library_id: z.string().optional(),
    })
    .default({}),
}).refine(
  (subtask) => {
    // upload: doc_type_id obrigatório
    if (subtask.type === 'upload') return !!subtask.config?.doc_type_id
    // email: email_library_id obrigatório
    if (subtask.type === 'email') return !!subtask.config?.email_library_id
    return true
  },
  { message: 'Configuração inválida para o tipo de subtarefa', path: ['config'] }
)

// === taskSchema (REESCREVER linhas 19-54) ===
export const taskSchema = z.object({
  title: z.string().min(1, 'O título é obrigatório'),
  description: z.string().optional(),
  is_mandatory: z.boolean().default(true),
  priority: z.enum(['urgent', 'normal', 'low']).default('normal'),
  sla_days: z.number().int().positive().optional(),
  assigned_role: z.string().optional(),
  order_index: z.number().int().min(0),
  subtasks: z.array(subtaskSchema).default([]),
})
// NOTA: Removido action_type, config, e .refine()
// action_type será derivado no API como 'COMPOSITE' para retrocompatibilidade DB
```

`stageSchema` e `templateSchema` ficam **iguais** — não necessitam alteração.

Os types inferidos (linhas 74-77) actualizam-se automaticamente via `z.infer`.

---

## Fase 2 — Subtask Editor (Refactoring)

### 2.1 `components/templates/subtask-editor.tsx` — REESCREVER

**O que fazer:** Refactorizar completamente. Deixa de ser exclusivo para `FORM`/`check_type`, passa a suportar os 4 tipos de subtask genéricos. Mantém o padrão de DnD existente com `@dnd-kit`.

**Props (novo):**

```typescript
interface SubtaskEditorProps {
  subtasks: SubtaskData[]
  onChange: (subtasks: SubtaskData[]) => void
}
// NOTA: Removidos ownerType e docTypes das props.
// O componente faz lazy-load interno de docTypes e emailTemplates.
```

**Estado interno:**

```typescript
const [docTypes, setDocTypes] = useState<{ id: string; name: string; category?: string }[]>([])
const [emailTemplates, setEmailTemplates] = useState<{ id: string; name: string; subject: string }[]>([])
```

**Lazy-load:** Detectar se há subtasks de tipo `upload` ou `email` e carregar respectivamente:
- `upload` → `GET /api/libraries/doc-types`
- `email` → `GET /api/libraries/emails`

**Handler "Adicionar Subtask" — com DropdownMenu por tipo:**

```tsx
const handleAddSubtask = (type: SubtaskData['type']) => {
  onChange([
    ...subtasks,
    {
      id: crypto.randomUUID(),
      type,
      title: '',
      is_mandatory: true,
      order_index: subtasks.length,
      config: {},
    },
  ])
}
```

**Botão de adição — DropdownMenu (não Button simples):**

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm" className="w-full">
      <Plus className="mr-2 h-3.5 w-3.5" />
      Adicionar Subtask
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start" className="w-56">
    {SUBTASK_TYPES.map((st) => {
      const Icon = ICON_MAP[st.icon]
      return (
        <DropdownMenuItem key={st.type} onClick={() => handleAddSubtask(st.type)}>
          <Icon className={cn('mr-2 h-4 w-4', st.color)} />
          {st.label}
        </DropdownMenuItem>
      )
    })}
  </DropdownMenuContent>
</DropdownMenu>
```

Onde `ICON_MAP` é um objecto local:
```typescript
const ICON_MAP: Record<string, React.ElementType> = {
  Upload, CheckSquare, Mail, FileText,
}
```

**`SortableSubtaskRow` — render condicional por `type`:**

```tsx
function SortableSubtaskRow({ subtask, docTypes, docTypesByCategory, emailTemplates, onUpdate, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: subtask.id })

  return (
    <div ref={setNodeRef} style={...} className="flex items-start gap-2 rounded-md border bg-card p-3">
      {/* Drag handle */}
      <button {...attributes} {...listeners} className="mt-2 cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex-1 space-y-2">
        {/* Badge de tipo + Input de título */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="shrink-0 text-xs">
            {SUBTASK_TYPE_LABELS[subtask.type]}
          </Badge>
          <Input
            value={subtask.title}
            onChange={(e) => onUpdate(subtask.id, { title: e.target.value })}
            placeholder={getPlaceholder(subtask.type)}
            className="h-8 text-sm"
          />
        </div>

        {/* Config condicional por tipo */}
        {subtask.type === 'upload' && (
          <Select
            value={subtask.config.doc_type_id || ''}
            onValueChange={(v) => onUpdate(subtask.id, { config: { ...subtask.config, doc_type_id: v } })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Seleccionar tipo de documento..." />
            </SelectTrigger>
            <SelectContent>
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

        {subtask.type === 'email' && (
          <Select
            value={subtask.config.email_library_id || ''}
            onValueChange={(v) => onUpdate(subtask.id, { config: { ...subtask.config, email_library_id: v } })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Seleccionar template de email..." />
            </SelectTrigger>
            <SelectContent>
              {emailTemplates.map((et) => (
                <SelectItem key={et.id} value={et.id}>
                  {et.name} — {et.subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {subtask.type === 'generate_doc' && (
          <p className="text-xs text-muted-foreground italic">
            Selecção de template de documento ficará disponível em breve (M13).
          </p>
        )}

        {/* checklist: não precisa de config extra — só o título */}
      </div>

      {/* Toggle obrigatória + botão eliminar */}
      <div className="flex items-center gap-1 shrink-0">
        <Switch
          checked={subtask.is_mandatory}
          onCheckedChange={(v) => onUpdate(subtask.id, { is_mandatory: v })}
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
          onClick={() => onRemove(subtask.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
```

**Helper `getPlaceholder`:**
```typescript
function getPlaceholder(type: SubtaskData['type']): string {
  const map: Record<string, string> = {
    upload: 'Ex: Certidão Permanente',
    checklist: 'Ex: Validar NIF do proprietário',
    email: 'Ex: Pedido de documentação',
    generate_doc: 'Ex: Minuta CPCV',
  }
  return map[type] || 'Título da subtarefa'
}
```

**DnD — manter padrão exacto** do subtask-editor.tsx actual (sensors, handleDragEnd com arrayMove e re-index).

---

## Fase 3 — Template Task Sheet (Novo Componente)

### 3.1 `components/templates/template-task-sheet.tsx` — CRIAR

**O que fazer:** Criar o novo Sheet lateral. Seguir o layout de `task-detail-sheet.tsx` (header fixo + corpo scrollável + footer fixo).

**Props:**

```typescript
interface TemplateTaskSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: TaskData | null   // null = criar, TaskData = editar
  onSubmit: (data: TaskData) => void
}
```

**Estado interno:**

```typescript
const [title, setTitle] = useState('')
const [description, setDescription] = useState('')
const [isMandatory, setIsMandatory] = useState(true)
const [priority, setPriority] = useState<'urgent' | 'normal' | 'low'>('normal')
const [assignedRole, setAssignedRole] = useState('')
const [slaDays, setSlaDays] = useState<string>('')
const [subtasks, setSubtasks] = useState<SubtaskData[]>([])
```

**NOTA:** Sem `actionType` — o conceito não existe mais na tarefa.

**useEffect — reset/populate ao abrir:**

```typescript
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
```

**handleSubmit — validação e build do TaskData:**

```typescript
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
```

**Layout JSX — seguir padrão de `task-detail-sheet.tsx`:**

```tsx
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
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
      {/* Secção: Detalhes */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Detalhes</h3>
        <div className="grid grid-cols-3 gap-4">
          {/* Select: Prioridade */}
          {/* Select: Role atribuído (ASSIGNABLE_ROLES) */}
          {/* Input: SLA (dias) */}
        </div>
      </div>

      <Separator />

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
```

**Constante `ASSIGNABLE_ROLES` — mover do dialog actual:**
```typescript
const ASSIGNABLE_ROLES = [
  { value: 'Processual', label: 'Gestora Processual' },
  { value: 'Consultor', label: 'Consultor' },
  { value: 'Broker/CEO', label: 'Broker/CEO' },
] as const
```

---

## Fase 4 — Template Builder (Integração)

### 4.1 `components/templates/template-builder.tsx`

**O que fazer:**

**4.1.1 — Actualizar interface `TaskData` (linhas 30-42):**

```typescript
// ANTES:
export interface TaskData {
  id: string
  title: string
  description?: string
  action_type: 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL' | 'FORM'
  is_mandatory: boolean
  priority?: 'urgent' | 'normal' | 'low'
  sla_days?: number
  assigned_role?: string
  config: Record<string, any>
  subtasks?: SubtaskData[]
}

// DEPOIS:
export interface TaskData {
  id: string
  title: string
  description?: string
  is_mandatory: boolean
  priority?: 'urgent' | 'normal' | 'low'
  sla_days?: number
  assigned_role?: string
  subtasks: SubtaskData[]  // SEMPRE presente, array (pode ser vazio)
}
```

Campos removidos: `action_type`, `config`.

**4.1.2 — Substituir import do Dialog pelo Sheet (linha ~21):**

```typescript
// ANTES:
import { TemplateTaskDialog } from './template-task-dialog'

// DEPOIS:
import { TemplateTaskSheet } from './template-task-sheet'
```

**4.1.3 — Actualizar `handleSave` payload (linhas 398-438):**

No bloco que monta as tasks (linhas 423-437), actualizar para:

```typescript
tasks: (items[stageId] || []).map((taskId, taskIndex) => ({
  title: tasksData[taskId].title,
  description: tasksData[taskId].description,
  is_mandatory: tasksData[taskId].is_mandatory,
  priority: tasksData[taskId].priority || 'normal',
  sla_days: tasksData[taskId].sla_days,
  assigned_role: tasksData[taskId].assigned_role,
  order_index: taskIndex,
  subtasks: (tasksData[taskId].subtasks || []).map((st, sidx) => ({
    title: st.title,
    description: st.description,
    is_mandatory: st.is_mandatory,
    type: st.type,
    config: st.config,
    order_index: sidx,
  })),
})),
```

Campos removidos do payload: `action_type`, `config` (da task).

**4.1.4 — Actualizar inicialização do edit mode (useEffect ~linhas 70-120):**

Ao mapear `initialData.tpl_stages` → `tasksData`, remover `action_type` e `config` da task, e garantir que `subtasks` é sempre array:

```typescript
// Para cada task de cada stage:
const taskData: TaskData = {
  id: task.id,
  title: task.title,
  description: task.description || undefined,
  is_mandatory: task.is_mandatory,
  priority: task.priority || 'normal',
  sla_days: task.sla_days || undefined,
  assigned_role: task.assigned_role || undefined,
  subtasks: (task.tpl_subtasks || []).map((st) => ({
    id: st.id,
    title: st.title,
    description: st.description || undefined,
    is_mandatory: st.is_mandatory,
    order_index: st.order_index,
    type: st.config?.type || deriveTypeFromLegacy(st.config),
    config: st.config || {},
  })),
}
```

Adicionar helper para retrocompatibilidade com subtasks legadas:
```typescript
function deriveTypeFromLegacy(config: Record<string, any>): SubtaskData['type'] {
  if (config?.check_type === 'document' || config?.doc_type_id) return 'upload'
  if (config?.email_library_id) return 'email'
  if (config?.doc_library_id) return 'generate_doc'
  return 'checklist'
}
```

**4.1.5 — Substituir `<TemplateTaskDialog>` por `<TemplateTaskSheet>` (linhas 624-635):**

```tsx
// ANTES:
<TemplateTaskDialog
  open={taskDialogOpen}
  onOpenChange={(open) => {
    setTaskDialogOpen(open)
    if (!open) { setTaskDialogData(null); setTaskDialogStageId(null) }
  }}
  initialData={taskDialogData}
  onSubmit={taskDialogData ? handleEditTask : handleAddTask}
/>

// DEPOIS:
<TemplateTaskSheet
  open={taskDialogOpen}
  onOpenChange={(open) => {
    setTaskDialogOpen(open)
    if (!open) { setTaskDialogData(null); setTaskDialogStageId(null) }
  }}
  initialData={taskDialogData}
  onSubmit={taskDialogData ? handleEditTask : handleAddTask}
/>
```

Mesma interface de props — drop-in replacement.

---

### 4.2 `components/templates/template-task-card.tsx`

**O que fazer:** Actualizar badges e ícone. Sem `action_type`, mostrar ícones/badges baseados nas subtasks.

**4.2.1 — Remover `ACTION_ICONS` e `getTaskIcon` baseados em `action_type`.**

**4.2.2 — Novo helper para ícone principal da tarefa:**

```typescript
import { Upload, Mail, FileText, CheckSquare, Layers, GripVertical, Pencil, Trash2 } from 'lucide-react'

function getTaskIcon(subtasks: SubtaskData[]) {
  if (subtasks.length === 0) return <Layers className="h-4 w-4 text-muted-foreground" />
  if (subtasks.length === 1) {
    const iconMap: Record<string, React.ReactNode> = {
      upload: <Upload className="h-4 w-4 text-blue-500" />,
      email: <Mail className="h-4 w-4 text-amber-500" />,
      generate_doc: <FileText className="h-4 w-4 text-purple-500" />,
      checklist: <CheckSquare className="h-4 w-4 text-slate-500" />,
    }
    return iconMap[subtasks[0].type] || <Layers className="h-4 w-4 text-muted-foreground" />
  }
  // Múltiplas subtasks — ícone genérico "composite"
  return <Layers className="h-4 w-4 text-teal-500" />
}
```

**4.2.3 — Actualizar badges:**

Substituir badge de `ACTION_TYPES[task.action_type]` por contagem de subtasks por tipo:

```tsx
<div className="flex flex-wrap gap-1">
  {task.is_mandatory && <Badge variant="outline" className="text-[10px]">Obrig.</Badge>}
  {task.sla_days && <Badge variant="outline" className="text-[10px]">SLA: {task.sla_days}d</Badge>}
  {task.assigned_role && <Badge variant="outline" className="text-[10px]">{task.assigned_role}</Badge>}
  {task.subtasks.length > 0 && (
    <Badge variant="secondary" className="text-[10px]">
      {task.subtasks.length} subtask{task.subtasks.length > 1 ? 's' : ''}
    </Badge>
  )}
</div>
```

**4.2.4 — Actualizar `TemplateTaskCardProps` para usar o novo `TaskData` (sem `action_type`).**

---

## Fase 5 — APIs (Backend)

### 5.1 `app/api/templates/route.ts` — POST

**O que fazer:** Actualizar a inserção de tarefas (linhas 112-135) para não depender de `action_type` do payload. Gravar `action_type = 'COMPOSITE'` na DB por retrocompatibilidade.

**Linha 112-122 — Alteração no mapeamento de tasks:**

```typescript
// ANTES:
const tasksToInsert = stage.tasks.map((task) => ({
  tpl_stage_id: insertedStage.id,
  title: task.title,
  description: task.description || null,
  action_type: task.action_type,    // ← vem do payload
  is_mandatory: task.is_mandatory,
  sla_days: task.sla_days || null,
  assigned_role: task.assigned_role || null,
  config: task.config || {},         // ← vem do payload
  order_index: task.order_index,
}))

// DEPOIS:
const tasksToInsert = stage.tasks.map((task) => ({
  tpl_stage_id: insertedStage.id,
  title: task.title,
  description: task.description || null,
  action_type: 'COMPOSITE',         // ← valor fixo
  is_mandatory: task.is_mandatory,
  sla_days: task.sla_days || null,
  assigned_role: task.assigned_role || null,
  config: {},                        // ← vazio (config migrou para subtasks)
  order_index: task.order_index,
}))
```

**Linhas 148-172 — Inserção de subtasks:** Actualizar o mapping para incluir `type` no `config`:

```typescript
const subtasksToInsert = subtasks.map((st, idx) => ({
  tpl_task_id: insertedTasks[i].id,
  title: st.title,
  description: st.description || null,
  is_mandatory: st.is_mandatory,
  order_index: idx,
  config: {
    type: st.type,                   // NOVO: tipo da subtask
    ...st.config,                    // doc_type_id, email_library_id, etc.
  },
}))
```

**NOTA:** O campo `type` é gravado dentro de `config` (JSONB) porque a tabela `tpl_subtasks` não tem uma coluna `type` dedicada. Isto evita migração de schema.

---

### 5.2 `app/api/templates/[id]/route.ts` — PUT

**O que fazer:** Mesmas alterações que o POST. Além disso, garantir que as subtasks existentes são apagadas antes de re-inserir.

**Linha 127-141 — Apagar subtasks junto com tasks:**

Antes de apagar tasks (linha 131-134), apagar primeiro subtasks:

```typescript
if (existingStages && existingStages.length > 0) {
  const stageIds = existingStages.map((s) => s.id)

  // Buscar task IDs para apagar subtasks
  const { data: existingTasks } = await supabase
    .from('tpl_tasks')
    .select('id')
    .in('tpl_stage_id', stageIds)

  if (existingTasks && existingTasks.length > 0) {
    const taskIds = existingTasks.map((t) => t.id)
    const db = supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> }
    await (db.from('tpl_subtasks') as ReturnType<typeof supabase.from>)
      .delete()
      .in('tpl_task_id', taskIds)
  }

  // Depois apagar tasks e stages (como já faz)
  await supabase.from('tpl_tasks').delete().in('tpl_stage_id', stageIds)
  await supabase.from('tpl_stages').delete().eq('tpl_process_id', id)
}
```

**Linhas 163-173 — Inserção de tasks:** Mesma alteração que POST (`action_type: 'COMPOSITE'`, `config: {}`).

**Linhas 197-221 — Inserção de subtasks:** Mesma alteração que POST (incluir `type` no `config`).

---

### 5.3 `app/api/templates/[id]/route.ts` — GET

**O que fazer:** Nenhuma alteração necessária. O GET já retorna `tpl_subtasks(*)` que inclui o `config` com o `type` dentro.

---

## Fase 6 — Eliminar Ficheiro Antigo

### 6.1 `components/templates/template-task-dialog.tsx` — ELIMINAR

Após todas as alterações anteriores estarem funcionais e testadas, eliminar este ficheiro (422 linhas).

Verificar que não há mais nenhum import deste ficheiro no projecto:
```bash
grep -r "template-task-dialog" src/
```

---

## Verificação / Critérios de Sucesso

### Verificação Automática
- [ ] `npm run build` — sem erros de TypeScript
- [ ] Nenhum import de `template-task-dialog` no codebase
- [ ] Nenhuma referência a `action_type` no `TaskData` do builder

### Verificação Manual
- [ ] Criar template novo: adicionar fase → adicionar tarefa (abre Sheet) → adicionar subtasks de diferentes tipos → guardar → template guardado com sucesso
- [ ] Editar template existente: abrir tarefa (abre Sheet preenchido) → modificar subtasks → guardar → dados persistidos correctamente
- [ ] Drag-and-drop de subtasks dentro do Sheet funciona
- [ ] Drag-and-drop de tarefas entre fases continua a funcionar
- [ ] Selecção de tipo de documento (upload) com agrupamento por categoria funciona
- [ ] Selecção de template de email funciona
- [ ] Validação: subtask upload sem doc_type_id mostra erro
- [ ] Validação: subtask email sem email_library_id mostra erro
- [ ] Validação: tarefa sem título mostra erro
- [ ] Templates legados (com `action_type` nas tasks) carregam correctamente (retrocompatibilidade via `deriveTypeFromLegacy`)

---

## Referências

### Ficheiros de Referência (padrões a reutilizar)
- [task-detail-sheet.tsx](../../components/processes/task-detail-sheet.tsx) — Layout do Sheet
- [subtask-editor.tsx](../../components/templates/subtask-editor.tsx) — DnD pattern actual
- [property-media-gallery.tsx](../../components/properties/property-media-gallery.tsx) — Sortable list pattern

### PRD
- [PRD-TEMPLATE-TASK-EDITOR.md](PRD-TEMPLATE-TASK-EDITOR.md)
