# SPEC — Subtarefas, Tarefas FORM e Edição de Templates

**Data:** 2026-02-23
**Baseado em:** [PRD-APRIMORAMENTO-SUBTASKS.md](PRD-APRIMORAMENTO-SUBTASKS.md)
**Estado:** Pronto para implementação
**Dependências:** M06 (Processos ✅), M07 (Templates ✅)

---

## Resumo

Implementar suporte a **subtarefas** e ao novo action_type **FORM** em toda a stack frontend:

1. Types e constantes para FORM + subtarefas
2. API: fetch de subtarefas no detalhe do processo + toggle manual
3. UI de processos: renderizar tarefas FORM com checklist
4. API de templates: CRUD com subtarefas (3º nível)
5. UI de templates: editor de subtarefas no builder

**Back-end já pronto:** tabelas `tpl_subtasks` (34 registos) e `proc_subtasks` (18 registos), triggers de auto-complete activas.

---

## Ficheiros a CRIAR (5)

| # | Ficheiro | Função |
|---|----------|--------|
| 1 | `types/subtask.ts` | Types TypeScript: `TplSubtask`, `ProcSubtask`, `SubtaskData` |
| 2 | `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts` | PUT — toggle de subtarefa manual |
| 3 | `components/processes/task-form-action.tsx` | Renderizar tarefa FORM com checklist, progresso, toggle |
| 4 | `components/templates/subtask-editor.tsx` | Editor de subtarefas com DnD no dialog de tarefa |

## Ficheiros a MODIFICAR (10)

| # | Ficheiro | Modificação |
|---|----------|-------------|
| 5 | `types/process.ts` | Adicionar `'FORM'` ao ActionType, `subtasks` ao ProcessTask |
| 6 | `lib/constants.ts` | FORM em ACTION_TYPES/LABELS, novas constantes CHECK_TYPE, OWNER_FIELDS |
| 7 | `lib/validations/template.ts` | Adicionar `'FORM'` ao enum, schema de subtarefas |
| 8 | `app/api/processes/[id]/route.ts` | JOIN de `proc_subtasks` na query de tarefas |
| 9 | `components/processes/process-task-card.tsx` | Ícone `ClipboardList` para FORM |
| 10 | `components/processes/process-kanban-view.tsx` | Renderizar `TaskFormAction` inline para tarefas FORM |
| 11 | `components/processes/process-list-view.tsx` | Renderizar `TaskFormAction` inline para tarefas FORM |
| 12 | `components/templates/template-task-dialog.tsx` | Secção FORM: owner_type + form_type + SubtaskEditor |
| 13 | `components/templates/template-builder.tsx` | `subtasks` no TaskData, propagar no save, carregar do initialData |
| 14 | `app/api/templates/route.ts` + `app/api/templates/[id]/route.ts` | Inserir/ler subtarefas (3º nível: stages → tasks → subtasks) |

---

## Detalhe por Ficheiro

---

### 1. `types/subtask.ts` — CRIAR

Criar ficheiro com types para subtarefas de template e de instância.

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

// Usado no template builder (estado local)
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
```

---

### 2. `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts` — CRIAR

Endpoint PUT para toggle de subtarefa manual. Lógica:

1. Autenticação (supabase.auth.getUser)
2. Validar que subtarefa existe e pertence à tarefa
3. Validar que `config.check_type === 'manual'` (rejeitar 400 se não)
4. Actualizar `proc_subtasks`: `is_completed`, `completed_at`, `completed_by`
5. Verificar todas as subtarefas da tarefa pai:
   - Todas obrigatórias completas → `proc_tasks.status = 'completed'`
   - Alguma completa → `proc_tasks.status = 'in_progress'`
   - Nenhuma → `proc_tasks.status = 'pending'`
6. Chamar `recalculateProgress(processId)` de `@/lib/process-engine`
7. Retornar `{ success: true, taskStatus: newStatus }`

```typescript
// Body esperado:
{ "is_completed": boolean }

// Respostas:
// 200 — { success: true, taskStatus: "in_progress" | "completed" | "pending" }
// 400 — { error: "Apenas subtarefas manuais podem ser alteradas" }
// 401 — { error: "Não autorizado" }
// 404 — { error: "Subtarefa não encontrada" }
```

Seguir o padrão de `app/api/processes/[id]/tasks/[taskId]/route.ts` para estrutura, auth e error handling.

---

### 3. `components/processes/task-form-action.tsx` — CRIAR

Componente client-side que renderiza uma tarefa FORM com checklist de subtarefas.

**Props:**
```typescript
interface TaskFormActionProps {
  task: ProcessTask & { subtasks: ProcSubtask[] }
  processId: string
  onSubtaskToggle: (subtaskId: string, completed: boolean) => Promise<void>
  onTaskUpdate: () => void
}
```

**Estrutura visual:**
- Header: ícone `ClipboardList` + "X de Y items completos" + percentagem
- `<Progress>` bar (h-2)
- `<Collapsible>` com lista de subtarefas (aberto por defeito)
- Cada subtarefa:
  - `check_type === 'manual'` → `<Checkbox>` interactivo
  - `check_type === 'field' | 'document'` → ícone `CheckCircle2` (completo) ou `Circle` (pendente), NÃO interactivo
  - Título com `line-through` se completo
  - Badge "Auto" para field/document
  - Badge "Opcional" se `!is_mandatory`
- Botão "Abrir ficha do proprietário" → link para `/dashboard/proprietarios/{owner.id}` (se `task.owner?.id` existe)

**Componentes shadcn usados:** Checkbox, Collapsible, Progress, Badge, Button

**Estado local:**
- `open` (boolean) — colapsável aberto/fechado
- `toggling` (string | null) — ID da subtarefa a ser toggled (loading state)

---

### 4. `components/templates/subtask-editor.tsx` — CRIAR

Editor de subtarefas para usar dentro do `template-task-dialog.tsx`. Usa @dnd-kit para reordenar.

**Props:**
```typescript
interface SubtaskEditorProps {
  subtasks: SubtaskData[]
  ownerType: 'singular' | 'coletiva'
  docTypes: { id: string; name: string; category?: string }[]
  onChange: (subtasks: SubtaskData[]) => void
}
```

**Funcionalidades:**
- Lista sortable de subtarefas com `@dnd-kit/sortable` (verticalListSortingStrategy)
- Cada linha: drag handle (`GripVertical`) | título (Input) | check_type (Select) | campo condicional | mandatory (Switch) | eliminar (Trash2)
- Campo condicional por check_type:
  - `field` → Select com campos de `OWNER_FIELDS_SINGULAR` ou `OWNER_FIELDS_COLETIVA` (conforme `ownerType`)
  - `document` → Select com `docTypes` (agrupados por category)
  - `manual` → nenhum campo extra
- Botão "Adicionar subtarefa" no final (gera ID com `crypto.randomUUID()`)
- Actualiza `order_index` automaticamente após reorder

**Componentes shadcn usados:** Input, Select, Switch, Button, ScrollArea
**Dependências:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities (já instalados)

---

### 5. `types/process.ts` — MODIFICAR

**Linha 88** — Adicionar FORM ao ActionType:
```typescript
// DE:
export type ActionType = 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL'

// PARA:
export type ActionType = 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL' | 'FORM'
```

**Topo do ficheiro** — Adicionar import:
```typescript
import type { ProcSubtask } from './subtask'
```

**Interface ProcessTask (linha ~19-30)** — Adicionar campo subtasks:
```typescript
export interface ProcessTask extends ProcTask {
  // ... campos existentes ...
  subtasks?: ProcSubtask[]  // ← NOVO
}
```

---

### 6. `lib/constants.ts` — MODIFICAR

**`ACTION_TYPES` (~L381)** — Adicionar FORM:
```typescript
export const ACTION_TYPES = {
  UPLOAD: 'Carregar Documento',
  EMAIL: 'Enviar Email',
  GENERATE_DOC: 'Gerar Documento',
  MANUAL: 'Verificação Manual',
  FORM: 'Preencher Formulário',     // ← NOVO
} as const
```

**`ACTION_TYPE_LABELS` (~L404)** — Adicionar FORM:
```typescript
export const ACTION_TYPE_LABELS = {
  UPLOAD: 'Upload',
  EMAIL: 'Email',
  GENERATE_DOC: 'Documento',
  MANUAL: 'Manual',
  FORM: 'Formulário',               // ← NOVO
} as const
```

**Novas constantes** — Adicionar após ACTION_TYPE_LABELS:
```typescript
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

### 7. `lib/validations/template.ts` — MODIFICAR

**taskSchema (L4-31)** — Adicionar FORM ao enum e schema de subtarefas:

```typescript
// Schema para uma subtarefa do template
export const subtaskSchema = z.object({
  title: z.string().min(1, 'O título é obrigatório'),
  description: z.string().optional(),
  is_mandatory: z.boolean().default(true),
  order_index: z.number().int().min(0),
  config: z.object({
    check_type: z.enum(['field', 'document', 'manual']),
    field_name: z.string().optional(),
    doc_type_id: z.string().optional(),
  }).default({ check_type: 'manual' }),
})

export const taskSchema = z
  .object({
    title: z.string().min(1, 'O título é obrigatório'),
    description: z.string().optional(),
    action_type: z.enum(['UPLOAD', 'EMAIL', 'GENERATE_DOC', 'MANUAL', 'FORM'], {  // ← FORM
      message: 'Tipo de acção inválido',
    }),
    is_mandatory: z.boolean().default(true),
    sla_days: z.number().int().positive().optional(),
    assigned_role: z.string().optional(),
    config: z.record(z.string(), z.any()).default({}),
    order_index: z.number().int().min(0),
    subtasks: z.array(subtaskSchema).optional(),  // ← NOVO
  })
  .refine(
    (task) => {
      if (task.action_type === 'UPLOAD') {
        return !!task.config?.doc_type_id
      }
      // FORM: owner_type obrigatório no config
      if (task.action_type === 'FORM') {
        return !!task.config?.owner_type
      }
      return true
    },
    {
      message: 'Config inválido para o tipo de acção',
      path: ['config'],
    }
  )
```

Adicionar type inferido:
```typescript
export type SubtaskFormData = z.infer<typeof subtaskSchema>
```

---

### 8. `app/api/processes/[id]/route.ts` — MODIFICAR

**Query de tarefas (~L56-68)** — Adicionar JOIN de `proc_subtasks`:

```typescript
// DE:
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

// PARA:
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

As subtarefas virão nested em cada tarefa via relação FK `proc_subtasks.proc_task_id → proc_tasks.id`. O Supabase ordena automaticamente pela PK, mas devemos garantir ordem por `order_index` — para isso, adicionar `.order` na subtask relation NÃO é suportado no nested select do Supabase. Portanto, ordenar no client-side após o fetch:

```typescript
// Após o fetch, ordenar subtarefas de cada tarefa:
if (tasks) {
  tasks.forEach((task: any) => {
    if (task.subtasks) {
      task.subtasks.sort((a: any, b: any) => a.order_index - b.order_index)
    }
  })
}
```

---

### 9. `components/processes/process-task-card.tsx` — MODIFICAR

**ACTION_ICONS (~L39-44)** — Adicionar FORM:

```typescript
// DE:
const ACTION_ICONS = {
  UPLOAD: <Upload className="h-3.5 w-3.5" />,
  EMAIL: <Mail className="h-3.5 w-3.5" />,
  GENERATE_DOC: <FileText className="h-3.5 w-3.5" />,
  MANUAL: <Circle className="h-3.5 w-3.5" />,
}

// PARA:
import { ClipboardList } from 'lucide-react'  // adicionar ao import

const ACTION_ICONS = {
  UPLOAD: <Upload className="h-3.5 w-3.5" />,
  EMAIL: <Mail className="h-3.5 w-3.5" />,
  GENERATE_DOC: <FileText className="h-3.5 w-3.5" />,
  MANUAL: <Circle className="h-3.5 w-3.5" />,
  FORM: <ClipboardList className="h-3.5 w-3.5" />,  // ← NOVO
}
```

**Opcional** — Se a tarefa FORM tiver subtarefas, mostrar contagem inline no card:
```tsx
// No badge area, após action type badge:
{task.action_type === 'FORM' && task.subtasks && (
  <span className="text-xs text-muted-foreground">
    {task.subtasks.filter(s => s.is_completed).length}/{task.subtasks.length}
  </span>
)}
```

---

### 10. `components/processes/process-kanban-view.tsx` — MODIFICAR

Adicionar renderização inline de `TaskFormAction` para tarefas FORM, seguindo o mesmo padrão do `TaskUploadAction`.

**Imports** — Adicionar:
```typescript
import { TaskFormAction } from './task-form-action'
```

**Após o bloco TaskUploadAction (~L88-103)** — Adicionar:
```tsx
{task.action_type === 'FORM' &&
  ['pending', 'in_progress'].includes(task.status ?? '') &&
  task.subtasks && task.subtasks.length > 0 && (
    <TaskFormAction
      task={task as any}
      processId={processId}
      onSubtaskToggle={handleSubtaskToggle}
      onTaskUpdate={onTaskUpdate}
    />
  )}
```

**Adicionar handler `handleSubtaskToggle`** — No componente pai ou passado via props:
```typescript
const handleSubtaskToggle = async (subtaskId: string, completed: boolean) => {
  const res = await fetch(
    `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtaskId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: completed }),
    }
  )
  if (!res.ok) throw new Error('Erro ao actualizar subtarefa')
}
```

**Nota:** O `handleSubtaskToggle` precisa do `taskId` — como é renderizado dentro do loop de tasks, o taskId vem do contexto do loop. Passar como closure ou extrair para um wrapper.

---

### 11. `components/processes/process-list-view.tsx` — MODIFICAR

Mesma alteração que o kanban-view. Adicionar renderização inline de `TaskFormAction`.

**Imports** — Adicionar:
```typescript
import { TaskFormAction } from './task-form-action'
```

**Após o bloco TaskUploadAction** — Adicionar o mesmo bloco FORM (igual ao ponto 10).

---

### 12. `components/templates/template-task-dialog.tsx` — MODIFICAR

Adicionar suporte ao action_type FORM no dialog de edição de tarefa.

**Estado local** — Adicionar:
```typescript
const [ownerType, setOwnerType] = useState<'singular' | 'coletiva'>(
  initialData?.config?.owner_type || 'singular'
)
const [formType, setFormType] = useState<string>(
  initialData?.config?.form_type || 'kyc_singular'
)
const [subtasks, setSubtasks] = useState<SubtaskData[]>(
  initialData?.subtasks || []
)
```

**Renderização condicional (~L184-224)** — Adicionar secção FORM após MANUAL:
```tsx
{actionType === 'FORM' && (
  <div className="space-y-4">
    {/* Select owner_type */}
    <div className="space-y-2">
      <Label>Tipo de proprietário</Label>
      <Select value={ownerType} onValueChange={(v) => setOwnerType(v as any)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="singular">Pessoa Singular</SelectItem>
          <SelectItem value="coletiva">Pessoa Colectiva</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {/* Select form_type */}
    <div className="space-y-2">
      <Label>Tipo de formulário</Label>
      <Select value={formType} onValueChange={setFormType}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="kyc_singular">KYC Singular</SelectItem>
          <SelectItem value="kyc_coletiva">KYC Colectiva</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {/* Editor de subtarefas */}
    <SubtaskEditor
      subtasks={subtasks}
      ownerType={ownerType}
      docTypes={docTypes}
      onChange={setSubtasks}
    />
  </div>
)}
```

**Submit (handleSave ~L101-123)** — Incluir subtarefas e config FORM:
```typescript
// Para FORM, adicionar ao config:
if (actionType === 'FORM') {
  config.owner_type = ownerType
  config.form_type = formType
}

// Incluir subtarefas no retorno:
onSave({
  ...taskData,
  subtasks: actionType === 'FORM' ? subtasks : undefined,
})
```

**Carregar docTypes** — Expandir o lazy load para também carregar quando `actionType === 'FORM'`:
```typescript
useEffect(() => {
  if (['UPLOAD', 'FORM'].includes(actionType) && docTypes.length === 0) {
    fetch('/api/libraries/doc-types')
      .then(r => r.json())
      .then(setDocTypes)
  }
}, [actionType])
```

---

### 13. `components/templates/template-builder.tsx` — MODIFICAR

**Interface TaskData (~L50-59)** — Adicionar FORM e subtasks:
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
```

**Carregar initialData** — Quando editando template existente, popular subtasks do fetch:
```typescript
// No useEffect de carregamento do template (ou onde initialData é processada):
// Ao mapear tasks do servidor para TaskData, incluir subtarefas:
const taskData: TaskData = {
  ...task,
  subtasks: task.tpl_subtasks || [],  // ← mapear do nome da relação
}
```

**handleSave** — Incluir subtarefas no payload:
```typescript
stages: containers.map((stageId, idx) => ({
  name: stagesData[stageId].name,
  description: stagesData[stageId].description,
  order_index: idx,
  tasks: items[stageId].map((taskId, tidx) => ({
    ...tasksData[taskId],
    order_index: tidx,
    subtasks: tasksData[taskId].subtasks?.map((st, sidx) => ({
      ...st,
      order_index: sidx,
    })) || [],  // ← NOVO: incluir subtarefas
  }))
}))
```

**Callback do dialog** — Quando o dialog retorna TaskData com subtasks, guardar no tasksData:
```typescript
// No handler de save do TemplateTaskDialog:
setTasksData(prev => ({
  ...prev,
  [taskId]: { ...returnedTask, subtasks: returnedTask.subtasks || [] }
}))
```

---

### 14. `app/api/templates/route.ts` + `app/api/templates/[id]/route.ts` — MODIFICAR

#### POST em `route.ts` (~L111-135) — Inserir subtarefas após tasks:

```typescript
// Após inserir tasks com sucesso:
const { data: insertedTasks } = await supabase
  .from('tpl_tasks')
  .select('id, order_index')
  .eq('tpl_stage_id', insertedStage.id)
  .order('order_index')

// Para cada task que tem subtarefas:
for (let i = 0; i < stage.tasks.length; i++) {
  const task = stage.tasks[i]
  if (task.subtasks && task.subtasks.length > 0 && insertedTasks?.[i]) {
    const subtasksToInsert = task.subtasks.map((st, idx) => ({
      tpl_task_id: insertedTasks[i].id,
      title: st.title,
      description: st.description || null,
      is_mandatory: st.is_mandatory,
      order_index: idx,
      config: st.config || {},
    }))

    const { error: subtasksError } = await supabase
      .from('tpl_subtasks')
      .insert(subtasksToInsert)

    if (subtasksError) {
      await supabase.from('tpl_processes').delete().eq('id', process.id)
      return NextResponse.json(
        { error: `Erro ao criar subtarefas: ${subtasksError.message}` },
        { status: 500 }
      )
    }
  }
}
```

**Nota:** O insert de tasks é feito em batch (array), portanto o `select` retorna-os na mesma ordem do array. Mapear por `order_index` para garantir correspondência.

#### GET em `[id]/route.ts` (~L14-24) — Incluir subtarefas no select:

```typescript
// DE:
.select(`
  *,
  tpl_stages (
    *,
    tpl_tasks (*)
  )
`)

// PARA:
.select(`
  *,
  tpl_stages (
    *,
    tpl_tasks (
      *,
      tpl_subtasks (*)
    )
  )
`)
```

E ordenar subtarefas no sort (~L31-38):
```typescript
data.tpl_stages.forEach((stage: any) => {
  if (stage.tpl_tasks) {
    stage.tpl_tasks.sort((a: any, b: any) => a.order_index - b.order_index)
    stage.tpl_tasks.forEach((task: any) => {
      if (task.tpl_subtasks) {
        task.tpl_subtasks.sort((a: any, b: any) => a.order_index - b.order_index)
      }
    })
  }
})
```

#### PUT em `[id]/route.ts` (~L135-177) — Mesmo padrão do POST:

As subtarefas são apagadas automaticamente via `ON DELETE CASCADE` quando se apagam as tasks. Portanto, o fluxo delete-and-recreate já trata a limpeza. Basta adicionar a inserção de subtarefas após inserir cada batch de tasks (mesmo código do POST).

---

## Componente `template-task-card.tsx` — MODIFICAR (bonus)

Mostrar contagem de subtarefas no badge da task card no builder.

**Após os badges existentes** — Adicionar:
```tsx
{task.subtasks && task.subtasks.length > 0 && (
  <Badge variant="outline" className="text-xs">
    {task.subtasks.length} subtarefas
  </Badge>
)}
```

---

## Ordem de Implementação

### Fase A — Fundação (Types + Constants + Validação)
1. Criar `types/subtask.ts`
2. Modificar `types/process.ts` — FORM + subtasks
3. Modificar `lib/constants.ts` — novas constantes
4. Modificar `lib/validations/template.ts` — FORM + subtaskSchema

### Fase B — APIs
5. Modificar `app/api/processes/[id]/route.ts` — JOIN subtasks
6. Criar `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts`
7. Modificar `app/api/templates/route.ts` (POST) — inserir subtarefas
8. Modificar `app/api/templates/[id]/route.ts` (GET + PUT) — ler/escrever subtarefas

### Fase C — UI de Processos
9. Criar `components/processes/task-form-action.tsx`
10. Modificar `components/processes/process-task-card.tsx` — ícone FORM
11. Modificar `components/processes/process-kanban-view.tsx` — renderizar FORM
12. Modificar `components/processes/process-list-view.tsx` — renderizar FORM

### Fase D — UI de Templates
13. Criar `components/templates/subtask-editor.tsx`
14. Modificar `components/templates/template-task-dialog.tsx` — secção FORM
15. Modificar `components/templates/template-builder.tsx` — subtasks no estado e save
16. Modificar `components/templates/template-task-card.tsx` — badge subtarefas (bonus)

---

## Riscos e Considerações

| Risco | Mitigação |
|-------|-----------|
| Processos já instanciados não são afectados pela edição de templates | Comportamento intencional. UI pode avisar "Apenas novos processos serão afectados". |
| Subtarefas `field` e `document` não podem ser toggled manualmente | Validar no endpoint (check_type !== 'manual' → 400) |
| Recalcular progresso após toggle | Reutilizar `recalculateProgress()` de `lib/process-engine` |
| Batch insert de tasks retorna por ordem | Garantir correspondência via `order_index` |
| DnD de subtarefas conflitar com DnD do builder | Subtarefas editadas DENTRO do dialog (modal) — sem conflito |
| Nested select de subtarefas no Supabase | Supabase suporta 3 níveis de nesting sem problema |

---

## Dados de Teste

- **Processo `136c9f10`**: 24 tarefas, 1 FORM com 18 subtarefas (8 auto-completadas)
- **Template "Captação da Angariação"**: 2 tarefas FORM (singular: 18 subtarefas, coletiva: 16 subtarefas)
- **34 `tpl_subtasks`** no template
- **18 `proc_subtasks`** instanciadas
