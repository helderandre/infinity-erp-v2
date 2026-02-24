# PRD — Subtarefas, Tarefas FORM e Edição de Templates

**Data:** 2026-02-23
**Baseado em:** [SUBTASKS-FORM-TEMPLATES.md](SUBTASKS-FORM-TEMPLATES.md)
**Estado:** Pesquisa concluída, pronto para implementação

---

## 1. Resumo Executivo

Este PRD documenta toda a pesquisa feita na base de código para implementar:

1. **Renderizar tarefas FORM** com checklist de subtarefas na UI de processos
2. **API de toggle de subtarefas manuais** (endpoint novo)
3. **Incluir subtarefas no fetch** do detalhe do processo
4. **Editor de subtarefas** no builder de templates
5. **Novos types e constantes** para suportar subtarefas

**Contexto:** O back-end já está completo — tabelas `tpl_subtasks` e `proc_subtasks` existem (34 e 18 registos respectivamente), triggers de auto-complete activas, 2 tarefas FORM no template "Captação da Angariação".

---

## 2. Ficheiros da Base de Código Afectados

### 2.1 Ficheiros a CRIAR

| # | Ficheiro | Função |
|---|----------|--------|
| 1 | `components/processes/task-form-action.tsx` | Renderizar tarefa FORM com checklist de subtarefas, barra de progresso, toggle manual |
| 2 | `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts` | PUT — toggle de subtarefa manual (is_completed) |
| 3 | `components/templates/subtask-editor.tsx` | Editor de subtarefas dentro do dialog de edição de tarefa no template builder |
| 4 | `types/subtask.ts` | Types TypeScript: `TplSubtask`, `ProcSubtask` |

### 2.2 Ficheiros a MODIFICAR

| # | Ficheiro | Localização | Modificação |
|---|----------|-------------|-------------|
| 1 | `types/process.ts` | [types/process.ts](../../types/process.ts) | Adicionar `'FORM'` ao `ActionType`, `subtasks?: ProcSubtask[]` ao `ProcessTask` |
| 2 | `lib/constants.ts` | [lib/constants.ts](../../lib/constants.ts) L381-409 | Adicionar `FORM` a `ACTION_TYPES`, `ACTION_TYPE_LABELS`, novas constantes `CHECK_TYPE_LABELS`, `OWNER_FIELDS_SINGULAR`, `OWNER_FIELDS_COLETIVA` |
| 3 | `app/api/processes/[id]/route.ts` | [app/api/processes/[id]/route.ts](../../app/api/processes/[id]/route.ts) L56-71 | Incluir JOIN de `proc_subtasks` na query de tarefas |
| 4 | `components/processes/process-kanban-view.tsx` | [components/processes/process-kanban-view.tsx](../../components/processes/process-kanban-view.tsx) | Adicionar renderização inline de `TaskFormAction` para tarefas FORM (mesmo padrão do `TaskUploadAction`) |
| 5 | `components/processes/process-list-view.tsx` | [components/processes/process-list-view.tsx](../../components/processes/process-list-view.tsx) | Idem — renderizar `TaskFormAction` inline para tarefas FORM |
| 6 | `components/processes/process-task-card.tsx` | [components/processes/process-task-card.tsx](../../components/processes/process-task-card.tsx) L39-44 | Adicionar ícone `ClipboardList` para `FORM` no `ACTION_ICONS` |
| 7 | `components/templates/template-task-dialog.tsx` | [components/templates/template-task-dialog.tsx](../../components/templates/template-task-dialog.tsx) | Adicionar action_type `FORM` com campos `owner_type` e `form_type`, integrar `SubtaskEditor` |
| 8 | `components/templates/template-builder.tsx` | [components/templates/template-builder.tsx](../../components/templates/template-builder.tsx) | Propagar subtarefas no `TaskData`, incluir no payload de save, carregar do initialData |
| 9 | `components/templates/template-task-card.tsx` | [components/templates/template-task-card.tsx](../../components/templates/template-task-card.tsx) | Mostrar contagem de subtarefas no badge da task card |

---

## 3. Estado Actual da Base de Dados

### 3.1 Tabelas Existentes (já criadas no back-end)

**`tpl_subtasks`** (34 registos):
```
id          uuid        PK, default gen_random_uuid()
tpl_task_id uuid        NOT NULL, FK → tpl_tasks(id) ON DELETE CASCADE
title       text        NOT NULL
description text        nullable
is_mandatory boolean    default true
order_index  integer    NOT NULL, default 0
config      jsonb       default '{}'
created_at  timestamptz default now()
```

**`proc_subtasks`** (18 registos — do processo de teste):
```
id              uuid        PK, default gen_random_uuid()
proc_task_id    uuid        NOT NULL, FK → proc_tasks(id) ON DELETE CASCADE
tpl_subtask_id  uuid        nullable, FK → tpl_subtasks(id)
title           text        NOT NULL
is_mandatory    boolean     default true
is_completed    boolean     default false
completed_at    timestamptz nullable
completed_by    uuid        nullable, FK → dev_users(id)
order_index     integer     NOT NULL, default 0
config          jsonb       default '{}'
created_at      timestamptz default now()
```

### 3.2 Tarefas FORM Existentes no Template

| Task ID | Título | Stage | Config |
|---------|--------|-------|--------|
| `ee97b87c-...` | Completar dados do proprietário | Identificação Proprietários | `{ form_type: "kyc_singular", owner_type: "singular" }` |
| `51647d99-...` | Completar dados da empresa | Identificação Empresa | `{ form_type: "kyc_coletiva", owner_type: "coletiva" }` |

### 3.3 Triggers Activas (NÃO TOCAR)

| Trigger | Tabela | Descrição |
|---------|--------|-----------|
| `trg_auto_complete_form_tasks_on_owner_update` | `owners` | Verifica campos `field` e docs `document` das subtarefas FORM |
| `trg_auto_complete_tasks_on_doc_insert` | `doc_registry` | Completa tarefas UPLOAD + actualiza subtarefas `document` |
| `trg_auto_resolve_owner_id` | `doc_registry` | Preenche `owner_id` automaticamente |

---

## 4. Padrões de Implementação Existentes (Base de Código)

### 4.1 Padrão: Renderização Inline de Acção por Tipo de Tarefa

**Referência:** Como `TaskUploadAction` é renderizado no `ProcessKanbanView` e `ProcessListView`.

```tsx
// Padrão actual em process-kanban-view.tsx e process-list-view.tsx:
{task.action_type === 'UPLOAD' &&
  ['pending', 'in_progress'].includes(task.status ?? '') &&
  task.config?.doc_type_id && (
    <TaskUploadAction
      taskId={task.id}
      processId={processId}
      propertyId={propertyId}
      docTypeId={task.config.doc_type_id}
      docTypeName={task.title}
      allowedExtensions={task.config?.allowed_extensions || [...]}
      existingDocs={processDocuments}
      ownerId={task.owner_id || mainOwnerId}
      onCompleted={onTaskUpdate}
    />
  )}

// NOVO — Mesmo padrão para FORM:
{task.action_type === 'FORM' &&
  ['pending', 'in_progress'].includes(task.status ?? '') &&
  task.subtasks && (
    <TaskFormAction
      task={task}
      processId={processId}
      onSubtaskToggle={handleSubtaskToggle}
      onTaskUpdate={onTaskUpdate}
    />
  )}
```

### 4.2 Padrão: API de Actualização de Tarefa

**Referência:** `app/api/processes/[id]/tasks/[taskId]/route.ts`

```typescript
// Schema actual (Zod):
const taskUpdateSchema = z.object({
  action: z.enum(['complete', 'bypass', 'assign', 'start', 'reset', 'update_priority', 'update_due_date']),
  bypass_reason: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  task_result: z.record(z.string(), z.any()).optional(),
  priority: z.enum(['urgent', 'normal', 'low']).optional(),
  due_date: z.string().optional(),
})

// Após actualização, recalcula progresso:
if (['complete', 'bypass', 'reset'].includes(action)) {
  await recalculateProgress(id)
}
```

**Para subtarefas** — criar endpoint separado (não modificar o existente):
```
PUT /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]
Body: { is_completed: boolean }
```

### 4.3 Padrão: Query do Detalhe do Processo

**Referência:** `app/api/processes/[id]/route.ts` L56-71

```typescript
// Query ACTUAL de tarefas:
const { data: tasks } = await supabase
  .from('proc_tasks')
  .select(`
    *,
    assigned_to_user:dev_users!proc_tasks_assigned_to_fkey(id, commercial_name),
    owner:owners!proc_tasks_owner_id_fkey(id, name, person_type)
  `)
  .eq('proc_instance_id', id)
  .order('stage_order_index', { ascending: true })
  .order('order_index', { ascending: true })

// MODIFICAÇÃO NECESSÁRIA — Adicionar subtasks:
const { data: tasks } = await supabase
  .from('proc_tasks')
  .select(`
    *,
    assigned_to_user:dev_users!proc_tasks_assigned_to_fkey(id, commercial_name),
    owner:owners!proc_tasks_owner_id_fkey(id, name, person_type),
    subtasks:proc_subtasks(
      id, title, is_mandatory, is_completed,
      completed_at, completed_by, order_index, config
    )
  `)
  .eq('proc_instance_id', id)
  .order('stage_order_index', { ascending: true })
  .order('order_index', { ascending: true })
```

### 4.4 Padrão: Template Builder — Estado e Fluxo de Dados

**Referência:** `components/templates/template-builder.tsx`

**Estado actual (9 states):**
```typescript
// DnD + metadata separados:
const [items, setItems]           // Record<stageId, taskId[]>
const [containers, setContainers] // stageId[]
const [stagesData, setStagesData] // Record<stageId, StageData>
const [tasksData, setTasksData]   // Record<stageId, TaskData>
```

**Interface TaskData actual:**
```typescript
interface TaskData {
  id: string
  title: string
  description?: string
  action_type: 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL'
  is_mandatory: boolean
  priority?: 'urgent' | 'normal' | 'low'
  sla_days?: number
  assigned_role?: string
  config: Record<string, any>
}
```

**MODIFICAÇÃO NECESSÁRIA:**
```typescript
interface TaskData {
  id: string
  title: string
  description?: string
  action_type: 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL' | 'FORM'  // ← FORM
  is_mandatory: boolean
  priority?: 'urgent' | 'normal' | 'low'
  sla_days?: number
  assigned_role?: string
  config: Record<string, any>
  subtasks?: SubtaskData[]  // ← NOVO
}

interface SubtaskData {
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
```

**Fluxo de save (handleSave):**
```typescript
// Actual: stages → tasks (2 níveis)
// NOVO: stages → tasks → subtasks (3 níveis)

// No POST/PUT /api/templates:
stages: containers.map((stageId, idx) => ({
  name: stagesData[stageId].name,
  order_index: idx,
  tasks: items[stageId].map((taskId, idx) => ({
    ...tasksData[taskId],
    order_index: idx,
    subtasks: tasksData[taskId].subtasks || [],  // ← NOVO: incluir subtarefas
  }))
}))
```

### 4.5 Padrão: Template Task Dialog

**Referência:** `components/templates/template-task-dialog.tsx`

**Renderização condicional actual por action_type:**
```typescript
// UPLOAD → Select de doc_type_id
// EMAIL → Placeholder "M13"
// GENERATE_DOC → Placeholder "M13"
// MANUAL → Nenhum campo extra

// NOVO — FORM → campos owner_type + form_type + SubtaskEditor
```

**Como doc_types são carregados (padrão a seguir):**
```typescript
// Lazy load quando action_type muda para UPLOAD:
useEffect(() => {
  if (actionType === 'UPLOAD' && docTypes.length === 0) {
    fetch('/api/libraries/doc-types')
      .then(r => r.json())
      .then(setDocTypes)
  }
}, [actionType])
```

### 4.6 Padrão: DnD no Template Builder (@dnd-kit)

**Biblioteca:** `@dnd-kit/core` v6.3.1 + `@dnd-kit/sortable` v10.0.0

O template builder JÁ usa @dnd-kit para arrastar stages (horizontal) e tasks entre stages (vertical). Para subtarefas dentro do dialog, usaremos o mesmo padrão simplificado:

```typescript
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Componente sortável individual:
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

// Wrapper com reorder:
function SortableList({ items, onReorder }) {
  const handleDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = items.findIndex(i => i.id === active.id)
      const newIndex = items.findIndex(i => i.id === over.id)
      onReorder(arrayMove(items, oldIndex, newIndex))
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {items.map(item => (
          <SortableItem key={item.id} id={item.id}>
            {/* conteúdo */}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  )
}
```

### 4.7 Padrão: Ícones de Action Type

**Referência:** `components/processes/process-task-card.tsx` L39-44

```typescript
const ACTION_ICONS = {
  UPLOAD: <Upload className="h-3.5 w-3.5" />,
  EMAIL: <Mail className="h-3.5 w-3.5" />,
  GENERATE_DOC: <FileText className="h-3.5 w-3.5" />,
  MANUAL: <Circle className="h-3.5 w-3.5" />,
  // NOVO:
  FORM: <ClipboardList className="h-3.5 w-3.5" />,
}
```

---

## 5. Componentes shadcn/ui Disponíveis

Todos os componentes necessários JÁ estão instalados:

| Componente | Ficheiro | Uso |
|------------|----------|-----|
| `Checkbox` | `components/ui/checkbox.tsx` | Toggle de subtarefas manuais |
| `Collapsible` | `components/ui/collapsible.tsx` | Expandir/colapsar lista de subtarefas |
| `Progress` | `components/ui/progress.tsx` | Barra de progresso da tarefa FORM |
| `Badge` | `components/ui/badge.tsx` | Badges "Auto", "Obrig.", "Pendente" |
| `Dialog` | `components/ui/dialog.tsx` | Dialog de edição de subtarefas |
| `Select` | `components/ui/select.tsx` | Select de check_type, field_name, doc_type_id |
| `Switch` | `components/ui/switch.tsx` | Toggle is_mandatory |
| `Button` | `components/ui/button.tsx` | Acções |
| `Card` | `components/ui/card.tsx` | Container da tarefa FORM |
| `ScrollArea` | `components/ui/scroll-area.tsx` | Lista scrollable de subtarefas |

---

## 6. Snippets de Implementação Recomendados

### 6.1 Componente TaskFormAction — Estrutura Sugerida

```tsx
// components/processes/task-form-action.tsx
'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { ClipboardList, ChevronDown, ExternalLink, CheckCircle2, Circle } from 'lucide-react'
import type { ProcessTask } from '@/types/process'
import type { ProcSubtask } from '@/types/subtask'

interface TaskFormActionProps {
  task: ProcessTask & { subtasks: ProcSubtask[] }
  processId: string
  onSubtaskToggle: (subtaskId: string, completed: boolean) => Promise<void>
  onTaskUpdate: () => void
}

export function TaskFormAction({ task, processId, onSubtaskToggle, onTaskUpdate }: TaskFormActionProps) {
  const [open, setOpen] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const subtasks = task.subtasks || []
  const completed = subtasks.filter(s => s.is_completed).length
  const total = subtasks.length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  const handleToggle = async (subtaskId: string, checked: boolean) => {
    setToggling(subtaskId)
    try {
      await onSubtaskToggle(subtaskId, checked)
      onTaskUpdate()
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header com progresso */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-medium">{completed} de {total} items completos</span>
        </div>
        <span className="text-sm text-muted-foreground">{percent}%</span>
      </div>
      <Progress value={percent} className="h-2" />

      {/* Lista de subtarefas colapsável */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            <span>Subtarefas</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 pt-2">
          {subtasks.map(subtask => (
            <div key={subtask.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50">
              {subtask.config?.check_type === 'manual' ? (
                <Checkbox
                  checked={subtask.is_completed}
                  onCheckedChange={(checked) => handleToggle(subtask.id, !!checked)}
                  disabled={toggling === subtask.id}
                />
              ) : (
                subtask.is_completed
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  : <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={cn(
                "text-sm flex-1",
                subtask.is_completed && "line-through text-muted-foreground"
              )}>
                {subtask.title}
              </span>
              {subtask.config?.check_type !== 'manual' && (
                <Badge variant="outline" className="text-xs">Auto</Badge>
              )}
              {!subtask.is_mandatory && (
                <Badge variant="secondary" className="text-xs">Opcional</Badge>
              )}
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      {/* Link para ficha do proprietário */}
      {task.owner?.id && (
        <Button variant="outline" size="sm" className="w-full" asChild>
          <a href={`/dashboard/proprietarios/${task.owner.id}`} target="_blank">
            Abrir ficha do proprietário <ExternalLink className="h-3.5 w-3.5 ml-2" />
          </a>
        </Button>
      )}
    </div>
  )
}
```

### 6.2 API de Toggle de Subtarefa

```typescript
// app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string; subtaskId: string }> }
) {
  const { id, taskId, subtaskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { is_completed } = body

  // 1. Verificar que subtarefa é manual
  const { data: subtask } = await supabase
    .from('proc_subtasks')
    .select('*, proc_task:proc_tasks(id, proc_instance_id, status)')
    .eq('id', subtaskId)
    .eq('proc_task_id', taskId)
    .single()

  if (!subtask) return NextResponse.json({ error: 'Subtarefa não encontrada' }, { status: 404 })
  if (subtask.config?.check_type !== 'manual') {
    return NextResponse.json({ error: 'Apenas subtarefas manuais podem ser alteradas' }, { status: 400 })
  }

  // 2. Actualizar subtarefa
  await supabase
    .from('proc_subtasks')
    .update({
      is_completed,
      completed_at: is_completed ? new Date().toISOString() : null,
      completed_by: is_completed ? user.id : null,
    })
    .eq('id', subtaskId)

  // 3. Verificar estado da tarefa pai
  const { data: allSubtasks } = await supabase
    .from('proc_subtasks')
    .select('is_completed, is_mandatory')
    .eq('proc_task_id', taskId)

  const mandatoryComplete = allSubtasks
    ?.filter(s => s.is_mandatory)
    .every(s => s.is_completed)
  const anyComplete = allSubtasks?.some(s => s.is_completed)

  let newTaskStatus = 'pending'
  if (mandatoryComplete) newTaskStatus = 'completed'
  else if (anyComplete) newTaskStatus = 'in_progress'

  await supabase
    .from('proc_tasks')
    .update({
      status: newTaskStatus,
      completed_at: newTaskStatus === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', taskId)

  // 4. Recalcular progresso do processo
  if (['completed', 'in_progress'].includes(newTaskStatus)) {
    const { recalculateProgress } = await import('@/lib/process-engine')
    await recalculateProgress(id)
  }

  return NextResponse.json({ success: true })
}
```

### 6.3 SubtaskEditor para Template Builder

```tsx
// components/templates/subtask-editor.tsx
'use client'

import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { CHECK_TYPE_LABELS, OWNER_FIELDS_SINGULAR, OWNER_FIELDS_COLETIVA } from '@/lib/constants'

interface SubtaskData {
  id: string
  title: string
  is_mandatory: boolean
  order_index: number
  config: {
    check_type: 'field' | 'document' | 'manual'
    field_name?: string
    doc_type_id?: string
  }
}

interface SubtaskEditorProps {
  subtasks: SubtaskData[]
  ownerType: 'singular' | 'coletiva'
  docTypes: { id: string; name: string; category?: string }[]
  onChange: (subtasks: SubtaskData[]) => void
}

// Usa @dnd-kit (mesma lib do template-builder.tsx)
// Cada subtarefa é uma linha com: drag handle | título | check_type | campo/doc | mandatory | eliminar
```

---

## 7. Constantes a Adicionar

```typescript
// lib/constants.ts — ADICIONAR:

// No ACTION_TYPES (L381):
FORM: 'Preencher Formulário',

// No ACTION_TYPE_LABELS (L404):
FORM: 'Formulário',

// NOVAS constantes:
export const CHECK_TYPE_LABELS = {
  field: 'Campo do proprietário',
  document: 'Documento',
  manual: 'Verificação manual',
} as const

export const OWNER_FIELDS_SINGULAR = [
  { value: 'name', label: 'Nome completo' },
  { value: 'nif', label: 'NIF' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefone' },
  { value: 'birth_date', label: 'Data de nascimento' },
  { value: 'nationality', label: 'Nacionalidade' },
  { value: 'naturality', label: 'Naturalidade' },
  { value: 'id_doc_type', label: 'Tipo de documento' },
  { value: 'id_doc_number', label: 'Número do documento' },
  { value: 'id_doc_expiry', label: 'Validade do documento' },
  { value: 'id_doc_issued_by', label: 'Emitido por' },
  { value: 'address', label: 'Morada' },
  { value: 'postal_code', label: 'Código postal' },
  { value: 'city', label: 'Localidade' },
  { value: 'marital_status', label: 'Estado civil' },
  { value: 'marital_regime', label: 'Regime matrimonial' },
  { value: 'profession', label: 'Profissão actual' },
  { value: 'last_profession', label: 'Última profissão' },
  { value: 'is_portugal_resident', label: 'Residente em Portugal' },
  { value: 'residence_country', label: 'País de residência' },
  { value: 'is_pep', label: 'Pessoa politicamente exposta' },
  { value: 'pep_position', label: 'Cargo PEP' },
  { value: 'funds_origin', label: 'Origem dos fundos' },
] as const

export const OWNER_FIELDS_COLETIVA = [
  { value: 'name', label: 'Nome da empresa' },
  { value: 'nif', label: 'NIF/NIPC' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefone' },
  { value: 'address', label: 'Sede / Morada' },
  { value: 'legal_representative_name', label: 'Nome do representante legal' },
  { value: 'legal_representative_nif', label: 'NIF do representante legal' },
  { value: 'legal_rep_id_doc', label: 'Documento do representante legal' },
  { value: 'company_object', label: 'Objecto social' },
  { value: 'company_branches', label: 'Sucursais' },
  { value: 'legal_nature', label: 'Natureza jurídica' },
  { value: 'country_of_incorporation', label: 'País de constituição' },
  { value: 'cae_code', label: 'Código CAE' },
  { value: 'rcbe_code', label: 'Código RCBE' },
] as const
```

---

## 8. Types TypeScript a Criar/Modificar

### 8.1 CRIAR: `types/subtask.ts`

```typescript
export interface TplSubtask {
  id: string
  tpl_task_id: string
  title: string
  description: string | null
  is_mandatory: boolean
  order_index: number
  config: {
    check_type: 'field' | 'document' | 'manual'
    field_name?: string
    doc_type_id?: string
  }
}

export interface ProcSubtask {
  id: string
  proc_task_id: string
  tpl_subtask_id: string | null
  title: string
  is_mandatory: boolean
  is_completed: boolean
  completed_at: string | null
  completed_by: string | null
  order_index: number
  config: {
    check_type: 'field' | 'document' | 'manual'
    field_name?: string
    doc_type_id?: string
  }
}
```

### 8.2 MODIFICAR: `types/process.ts`

```typescript
// Linha 88 — ActionType:
export type ActionType = 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL' | 'FORM'

// Linha 19 — ProcessTask — adicionar:
import type { ProcSubtask } from './subtask'

export interface ProcessTask extends ProcTask {
  // ...campos existentes...
  subtasks?: ProcSubtask[]  // ← NOVO
}
```

---

## 9. Documentação Externa Relevante

### 9.1 @dnd-kit (já instalado — v6.3.1 + v10.0.0)

- **Docs:** https://dndkit.com/
- **Sortable:** https://docs.dndkit.com/presets/sortable
- **Padrão usado no projecto:** Multi-container (stages) + vertical lists (tasks)
- **Para subtarefas:** Single container vertical list (mais simples)

**Key API:**
```typescript
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

### 9.2 shadcn/ui Checkbox

- **Docs:** https://ui.shadcn.com/docs/components/radix/checkbox
- **Key props:** `checked`, `onCheckedChange` (recebe `boolean | 'indeterminate'`), `disabled`
- **Padrão checklist:**
```tsx
<div className="flex items-center space-x-2">
  <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
  <Label htmlFor={id}>{title}</Label>
</div>
```

### 9.3 shadcn/ui Collapsible

- **Docs:** https://ui.shadcn.com/docs/components/radix/collapsible
- **Key:** `<Collapsible open={} onOpenChange={}>`, `<CollapsibleTrigger asChild>`, `<CollapsibleContent>`

### 9.4 shadcn/ui Progress

- **Docs:** https://ui.shadcn.com/docs/components/radix/progress
- **Key:** `<Progress value={0-100} className="h-2" />`

### 9.5 Supabase Nested Selects

- **Docs:** https://supabase.com/docs/reference/javascript/select
- **Padrão já usado no projecto para relações 1:N:**
```typescript
.select(`*, subtasks:proc_subtasks(id, title, ...)`)
```

---

## 10. Estratégia de Implementação (Ordem Sugerida)

### Fase A: Fundação (Types + Constants + API)
1. Criar `types/subtask.ts`
2. Modificar `types/process.ts` — adicionar `FORM` e `subtasks`
3. Modificar `lib/constants.ts` — adicionar constantes FORM, check_type, owner_fields
4. Modificar `app/api/processes/[id]/route.ts` — JOIN de `proc_subtasks`
5. Criar `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts`

### Fase B: UI de Processos (Renderização)
6. Criar `components/processes/task-form-action.tsx` — componente de checklist
7. Modificar `components/processes/process-task-card.tsx` — ícone FORM
8. Modificar `components/processes/process-kanban-view.tsx` — renderizar TaskFormAction inline
9. Modificar `components/processes/process-list-view.tsx` — renderizar TaskFormAction inline

### Fase C: Template Builder (Edição)
10. Criar `components/templates/subtask-editor.tsx` — editor de subtarefas com DnD
11. Modificar `components/templates/template-task-dialog.tsx` — suporte a FORM + subtarefas
12. Modificar `components/templates/template-builder.tsx` — propagar subtarefas no estado e save
13. Modificar `components/templates/template-task-card.tsx` — badge de contagem de subtarefas

### Fase D: API de Templates (CRUD subtarefas)
14. Modificar `app/api/templates/route.ts` (POST) — incluir subtarefas no create
15. Modificar `app/api/templates/[id]/route.ts` (PUT/GET) — incluir subtarefas no update/fetch

---

## 11. Riscos e Considerações

| Risco | Mitigação |
|-------|-----------|
| Processos já instanciados não são afectados pela edição de templates | Documentado na spec. Informar no UI com aviso. |
| Subtarefas `field` e `document` não podem ser toggled manualmente | Validar no endpoint — `config.check_type !== 'manual'` → erro 400 |
| Recalcular progresso após toggle de subtarefa | Reutilizar `recalculateProgress()` de `lib/process-engine` |
| Performance com muitas subtarefas no fetch | Subtarefas vêm nested via Supabase JOIN — eficiente. Máximo ~18 por tarefa. |
| DnD de subtarefas conflitar com DnD do builder | Subtarefas são editadas DENTRO do dialog (modal), não no builder principal — sem conflito. |
| API de templates precisa suportar 3 níveis (stages → tasks → subtasks) | Modificar POST/PUT para iterar subtasks dentro de cada task |

---

## 12. Dados de Teste Disponíveis

- **Processo `136c9f10`**: 24 tarefas, incluindo 1 tarefa FORM com 18 subtarefas (8 já auto-completadas)
- **Template "Captação da Angariação"**: 2 tarefas FORM (singular: 18 subtarefas, coletiva: 16 subtarefas)
- **34 tpl_subtasks** no template
- **18 proc_subtasks** instanciadas no processo de teste
