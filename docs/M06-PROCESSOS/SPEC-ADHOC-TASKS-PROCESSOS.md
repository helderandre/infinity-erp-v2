# SPEC: Tarefas Ad-hoc em Processos Activos

> **Módulo:** M06 — Processos
> **Data:** 2026-03-11
> **Tipo:** Especificação de Implementação
> **Estado:** Planeado

---

## 1. Resumo Executivo

Permitir que utilizadores com roles **Admin**, **Broker/CEO** e **Gestora Processual** criem tarefas e subtarefas directamente dentro de um processo activo, sem necessidade de navegar ao editor de templates. Os componentes do editor de templates são reutilizados no contexto do processo, mas a lógica de associação de proprietários é simplificada — em vez de regras abstractas (`owner_scope`, `person_type_filter`), o utilizador selecciona directamente os proprietários vinculados ao imóvel/processo.

---

## 2. Motivação

### Problema Actual

- As tarefas de um processo são exclusivamente geradas a partir de templates (trigger `populate_process_tasks`)
- Não existe mecanismo para criar tarefas ad-hoc durante o ciclo de vida de um processo
- Situações imprevistas (documentos adicionais, verificações extra, comunicações especiais) exigem workarounds manuais
- Apenas processos com template aprovado têm tarefas — processos com necessidades não previstas no template ficam incompletos

### Solução

Criar um fluxo de criação de tarefas ad-hoc dentro da página de detalhe do processo, reutilizando os componentes existentes do editor de templates (`SubtaskEditor`, `SubtaskConfigDialog`, `FormFieldPicker`, `AlertConfigEditor`), adaptados ao contexto de execução.

---

## 3. Roles e Permissões

### Roles Autorizados

| Role | Criar Tarefas | Criar Subtarefas | Remover Tarefas Ad-hoc | Remover Subtarefas Ad-hoc |
|------|--------------|-----------------|----------------------|-------------------------|
| Admin | Sim | Sim | Sim | Sim |
| Broker/CEO | Sim | Sim | Sim | Sim |
| Gestora Processual | Sim | Sim | Sim | Sim |
| Consultor | Não | Não | Não | Não |
| Outros | Não | Não | Não | Não |

### Verificação de Permissão

**Frontend:**
```typescript
const ADHOC_TASK_ROLES = ['admin', 'Broker/CEO', 'Gestora Processual']
const canCreateAdhocTask = user?.role?.name && ADHOC_TASK_ROLES.includes(user.role.name)
```

**Backend (API):** Verificação obrigatória antes de qualquer operação — fetch do role via `dev_users` + `user_roles` + `roles`.

---

## 4. Arquitectura de Dados

### 4.1 Schema Existente (Sem Migrações Necessárias)

A tabela `proc_tasks` já suporta tarefas ad-hoc:

| Coluna | Comportamento Ad-hoc |
|--------|---------------------|
| `tpl_task_id` | `NULL` (não vem de template) |
| `proc_instance_id` | FK obrigatória ao processo |
| `title` | Definido pelo utilizador |
| `action_type` | `COMPOSITE` (múltiplas subtarefas) ou tipo específico |
| `stage_name` | Seleccionado pelo utilizador (fase existente) |
| `stage_order_index` | Copiado da fase seleccionada |
| `order_index` | `max(order_index) + 1` na fase |
| `owner_id` | Proprietário seleccionado directamente (opcional) |
| `config` | `{}` ou config de alertas |
| `status` | `pending` (por defeito) |

A tabela `proc_subtasks` já suporta subtarefas ad-hoc:

| Coluna | Comportamento Ad-hoc |
|--------|---------------------|
| `tpl_subtask_id` | `NULL` (não vem de template) |
| `proc_task_id` | FK obrigatória à tarefa ad-hoc ou existente |
| `owner_id` | Proprietário seleccionado directamente (opcional) |
| `config` | Config do tipo (doc_type_id, email_library_id, etc.) |

### 4.2 Identificação de Tarefas Ad-hoc

Uma tarefa ad-hoc é identificada por: **`tpl_task_id IS NULL`**

Não é necessário um campo `is_adhoc` adicional — a condição é derivada do schema existente.

### 4.3 Relação com Proprietários

**Template (actual):**
```
tpl_subtask.config.owner_scope = 'all_owners'
  → trigger _populate_subtasks() cria N subtarefas (1 por proprietário)
```

**Ad-hoc (novo):**
```
Utilizador selecciona proprietário(s) directamente na UI
  → API cria subtarefa(s) com owner_id preenchido
  → Sem fan-out automático — cada associação é explícita
```

---

## 5. API Endpoints

### 5.1 `POST /api/processes/[id]/tasks` — Criar Tarefa Ad-hoc

**Ficheiro:** `app/api/processes/[id]/tasks/route.ts` (novo POST handler)

**Request Body (Zod Schema):**

```typescript
const createAdhocTaskSchema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  description: z.string().optional(),
  stage_name: z.string().min(1, 'Fase obrigatória'),
  stage_order_index: z.number().int().min(0),
  is_mandatory: z.boolean().default(true),
  priority: z.enum(['urgent', 'normal', 'low']).default('normal'),
  assigned_role: z.string().optional(),
  assigned_to: z.string().regex(/^[0-9a-f-]{36}$/).optional(),
  sla_days: z.number().int().positive().optional(),
  owner_id: z.string().regex(/^[0-9a-f-]{36}$/).optional(),
  dependency_proc_task_id: z.string().regex(/^[0-9a-f-]{36}$/).optional(),
  alerts_config: z.any().optional(),
  subtasks: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    is_mandatory: z.boolean().default(true),
    order_index: z.number().int().min(0),
    priority: z.enum(['urgent', 'normal', 'low']).default('normal'),
    assigned_role: z.string().optional(),
    sla_days: z.number().int().positive().optional(),
    owner_id: z.string().regex(/^[0-9a-f-]{36}$/).optional(),
    dependency_type: z.enum(['none', 'subtask', 'task']).default('none'),
    dependency_proc_subtask_id: z.string().optional().nullable(),
    dependency_proc_task_id: z.string().optional().nullable(),
    config: z.object({
      type: z.enum(['upload', 'checklist', 'email', 'generate_doc', 'form', 'field']),
      doc_type_id: z.string().optional(),
      email_library_id: z.string().optional(),
      doc_library_id: z.string().optional(),
      sections: z.any().optional(),
      field: z.any().optional(),
    }),
  })).default([]),
})
```

**Lógica:**

1. Autenticar utilizador → verificar role autorizado
2. Validar processo existe e status é `active` ou `on_hold`
3. Validar `stage_name` existe nas fases do processo
4. Se `owner_id` fornecido, validar que é proprietário vinculado ao imóvel do processo
5. Se `dependency_proc_task_id` fornecido, validar que pertence ao mesmo processo
6. Calcular `order_index` = `max(order_index WHERE stage_name = X) + 1`
7. Determinar `action_type`:
   - Se `subtasks.length === 0` → `MANUAL`
   - Se `subtasks.length === 1` → tipo da subtarefa (UPLOAD, EMAIL, etc.)
   - Se `subtasks.length > 1` → `COMPOSITE`
8. Calcular `due_date` = `now() + sla_days` (se fornecido)
9. Determinar `is_blocked` com base em `dependency_proc_task_id`
10. INSERT `proc_tasks` com `tpl_task_id = NULL`
11. Para cada subtarefa:
    - Calcular `due_date` individual
    - Determinar `is_blocked`
    - INSERT `proc_subtasks` com `tpl_subtask_id = NULL`
12. Chamar `recalculateProgress(processId)` de `lib/process-engine.ts`
13. Registar actividade: `logTaskActivity({ type: 'task_created', ... })`
14. Retornar tarefa criada com subtarefas

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "title": "...",
  "subtasks": [...]
}
```

### 5.2 `POST /api/processes/[id]/tasks/[taskId]/subtasks` — Adicionar Subtarefa a Tarefa Existente

**Ficheiro:** `app/api/processes/[id]/tasks/[taskId]/subtasks/route.ts` (adicionar POST handler)

Permite adicionar subtarefas a qualquer tarefa (template ou ad-hoc).

**Request Body:** Mesmo shape de um elemento do array `subtasks` do endpoint anterior.

**Lógica:** Semelhante ao anterior mas inserindo numa tarefa já existente. Actualizar `action_type` da tarefa-pai se necessário (MANUAL → tipo da subtarefa, ou COMPOSITE).

### 5.3 `DELETE /api/processes/[id]/tasks/[taskId]` — Remover Tarefa Ad-hoc

**Condição:** Apenas tarefas ad-hoc (`tpl_task_id IS NULL`) podem ser removidas. Tarefas de template não podem ser removidas (apenas bypassed).

**Lógica:**
1. Autenticar utilizador → verificar role autorizado
2. Validar processo existe e status é `active` ou `on_hold`
3. Verificar `tpl_task_id IS NULL` — se for tarefa de template, retornar `403`
4. Verificar se outras tarefas dependem desta (`dependency_proc_task_id = taskId`):
   - Se sim, retornar `409 Conflict` com mensagem: "Existem tarefas que dependem desta tarefa. Remova as dependências primeiro."
5. Registar actividade **antes** da eliminação (para preservar o título e metadados)
6. Eliminar `proc_subtasks` associadas (CASCADE)
7. Eliminar `proc_tasks`
8. Chamar `recalculateProgress(processId)`
9. Retornar `200 OK`

**Response:**
```json
{
  "message": "Tarefa removida com sucesso",
  "deleted_task_id": "uuid",
  "deleted_subtask_count": 3
}
```

### 5.4 `DELETE /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]` — Remover Subtarefa Ad-hoc

**Condição:** Apenas subtarefas ad-hoc (`tpl_subtask_id IS NULL`) podem ser removidas. Subtarefas de template não podem ser removidas.

**Lógica:**
1. Autenticar utilizador → verificar role autorizado
2. Validar processo existe e status é `active` ou `on_hold`
3. Validar subtarefa pertence à tarefa e ao processo
4. Verificar `tpl_subtask_id IS NULL` — se for subtarefa de template, retornar `403`
5. Verificar se outras subtarefas dependem desta (`dependency_proc_subtask_id = subtaskId`):
   - Se sim, retornar `409 Conflict`
6. Registar actividade antes da eliminação
7. Eliminar `proc_subtasks`
8. Actualizar `action_type` da tarefa-pai se necessário:
   - Se restam 0 subtarefas → `MANUAL`
   - Se resta 1 subtarefa → tipo dessa subtarefa
   - Se restam 2+ → manter `COMPOSITE`
9. Chamar `recalculateProgress(processId)`
10. Retornar `200 OK`

**Response:**
```json
{
  "message": "Subtarefa removida com sucesso",
  "deleted_subtask_id": "uuid",
  "remaining_subtask_count": 2
}
```

---

## 6. Componentes

### 6.1 Componentes Reutilizados (Sem Alterações)

| Componente | Ficheiro | Uso |
|-----------|----------|-----|
| `SubtaskEditor` | `components/templates/subtask-editor.tsx` | Lista arrastável de subtarefas com seleção de tipo |
| `FormFieldPicker` | `components/templates/form-field-picker.tsx` | Configuração de campos form/field |
| `AlertConfigEditor` | `components/templates/alert-config-editor.tsx` | Configuração de alertas |

### 6.2 Componente Modificado: `SubtaskConfigDialog`

**Ficheiro:** `components/templates/subtask-config-dialog.tsx`

**Alteração:** Adicionar prop `mode: 'template' | 'adhoc'` (default: `'template'`).

Quando `mode === 'adhoc'`:
- A secção **Proprietários** (`SectionProprietarios`) é substituída por uma secção **Associar Proprietário** com um `<Select>` dos proprietários vinculados ao processo
- Os campos `owner_scope`, `person_type_filter`, `has_person_type_variants` são ocultados
- Em vez disso, mostra-se um selector simples com os proprietários disponíveis

**Props adicionais para modo adhoc:**
```typescript
interface SubtaskConfigDialogProps {
  // ... props existentes
  mode?: 'template' | 'adhoc'
  availableOwners?: ProcessOwner[]  // proprietários do processo (modo adhoc)
}
```

### 6.3 Novo Componente: `AdHocTaskSheet`

**Ficheiro:** `components/processes/adhoc-task-sheet.tsx`

**Responsabilidade:** Sheet lateral para criação de tarefas ad-hoc dentro de um processo.

**Props:**
```typescript
interface AdHocTaskSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  processId: string
  stages: ProcessStageWithTasks[]
  owners: ProcessOwner[]
  existingTasks: ProcessTask[]
  preselectedStage?: { name: string; order_index: number }
  onTaskCreated: () => void  // callback para refresh
}
```

**Layout (3 secções de navegação lateral):**

```
┌─────────────────────────────────────────────────┐
│  Nova Tarefa                              [X]   │
├──────┬──────────────────────────────────────────┤
│      │                                          │
│  📋  │  Título: [___________________________]   │
│      │  Descrição: [________________________]   │
│  📝  │                                          │
│      │  Fase: [▼ Seleccionar fase ]             │
│  🔔  │  Prioridade: [▼ Normal ]                 │
│      │  Responsável: [▼ Role ]                  │
│      │  SLA (dias): [___]                       │
│      │                                          │
│      │  Obrigatória: [Toggle]                   │
│      │                                          │
│      │  ── Proprietário (opcional) ──           │
│      │  [▼ Seleccionar proprietário(s) ]        │
│      │                                          │
│      │  ── Dependência (opcional) ──            │
│      │  [▼ Tarefa bloqueante ]                  │
│      │                                          │
├──────┼──────────────────────────────────────────┤
│      │  [Cancelar]           [Criar Tarefa]     │
└──────┴──────────────────────────────────────────┘
```

**Secção Subtarefas (tab 2):** Reutiliza `<SubtaskEditor>` directamente.

**Secção Alertas (tab 3):** Reutiliza `<AlertConfigEditor>` directamente.

### 6.4 Novo Componente: `OwnerSelector`

**Ficheiro:** `components/processes/owner-selector.tsx`

**Responsabilidade:** Multi-select de proprietários vinculados ao processo.

```typescript
interface OwnerSelectorProps {
  owners: ProcessOwner[]
  selectedOwnerIds: string[]
  onChange: (ids: string[]) => void
  multiple?: boolean  // default: false (single select)
}
```

**UI:** Popover com Command (padrão shadcn combobox) mostrando:
- Nome do proprietário
- Badge `Singular` / `Colectiva`
- NIF (se disponível)
- Checkbox para selecção (se multiple)

### 6.5 Indicador Visual de Tarefa Ad-hoc

**Ficheiro:** `components/processes/process-task-card.tsx` (modificação)

Quando `task.tpl_task_id === null`, mostrar um badge discreto:
- Badge com ícone `Zap` (Lucide) + texto "Ad-hoc"
- Cor: `bg-violet-100 text-violet-700`
- Posicionado ao lado dos badges de tipo existentes

---

## 7. Fluxo do Utilizador

### 7.1 Criar Tarefa Ad-hoc

```
1. Utilizador abre detalhe do processo (pipeline)
   ↓
2. Vê botão "Nova Tarefa" na barra de ferramentas
   (apenas visível para roles autorizados)
   OU
   Clica "+" no fundo de uma coluna de fase (kanban)
   ↓
3. AdHocTaskSheet abre (pré-selecciona fase se clicado na coluna)
   ↓
4. Preenche dados da tarefa:
   - Título (obrigatório)
   - Fase (obrigatório, dropdown com fases do processo)
   - Prioridade, Role, SLA (opcionais)
   - Proprietário(s) associado(s) (opcional)
   - Dependência de outra tarefa (opcional)
   ↓
5. Navega para tab "Subtarefas":
   - Clica "Adicionar subtarefa" → dropdown com tipos
   - Configura cada subtarefa (upload, checklist, email, etc.)
   - Para cada subtarefa pode associar proprietário específico
   ↓
6. Opcionalmente configura Alertas
   ↓
7. Clica "Criar Tarefa"
   ↓
8. API cria tarefa + subtarefas
   ↓
9. Toast "Tarefa criada com sucesso"
   ↓
10. Pipeline actualiza — nova tarefa aparece na fase com badge "Ad-hoc"
```

### 7.2 Adicionar Subtarefa a Tarefa Existente

```
1. Utilizador abre detalhe de uma tarefa (TaskDetailSheet)
   ↓
2. Vê botão "Adicionar Subtarefa" abaixo da lista de subtarefas
   (apenas visível para roles autorizados)
   ↓
3. Dropdown abre com tipos de subtarefa
   ↓
4. SubtaskConfigDialog abre em modo 'adhoc'
   ↓
5. Configura e guarda
   ↓
6. API insere subtarefa
   ↓
7. Lista de subtarefas actualiza
```

### 7.3 Remover Tarefa Ad-hoc

```
1. Utilizador vê tarefa ad-hoc no pipeline (identificada pelo badge "Ad-hoc")
   ↓
2. Clica no menu de acções (⋯) da tarefa
   ↓
3. Opção "Remover tarefa" visível (apenas para roles autorizados E tpl_task_id IS NULL)
   ↓
4. ConfirmDialog abre:
   Título: "Remover tarefa"
   Descrição: "Tem a certeza de que pretende remover a tarefa «{título}»?
               Esta acção é irreversível e irá remover {N} subtarefa(s) associada(s)."
   Botão: "Remover" (variant destructive)
   ↓
5. Se confirmado → DELETE /api/processes/[id]/tasks/[taskId]
   ↓
6. Se existem dependências → toast.error("Existem tarefas que dependem desta tarefa.")
   ↓
7. Se sucesso → toast.success("Tarefa removida com sucesso")
   ↓
8. Pipeline actualiza — tarefa desaparece da fase
```

### 7.4 Remover Subtarefa Ad-hoc

```
1. Utilizador abre detalhe de uma tarefa (TaskDetailSheet)
   ↓
2. Na lista de subtarefas, subtarefas ad-hoc (tpl_subtask_id IS NULL)
   mostram ícone de remoção (Trash2) ao lado
   (apenas visível para roles autorizados)
   ↓
3. Clica no ícone de remoção
   ↓
4. ConfirmDialog abre:
   Título: "Remover subtarefa"
   Descrição: "Tem a certeza de que pretende remover a subtarefa «{título}»?"
   Botão: "Remover" (variant destructive)
   ↓
5. Se confirmado → DELETE /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]
   ↓
6. Se existem dependências → toast.error("Existem subtarefas que dependem desta.")
   ↓
7. Se sucesso → toast.success("Subtarefa removida com sucesso")
   ↓
8. Lista de subtarefas actualiza
```

---

## 8. Contexto de Dependências

### Mapeamento Template → Processo

O `SubtaskEditor` e o `SubtaskConfigDialog` esperam um contexto de dependências para permitir seleccionar tarefas/subtarefas bloqueantes. No contexto ad-hoc, este mapeamento usa IDs reais de `proc_tasks`:

```typescript
// Construir contexto de dependências a partir dos dados do processo
const buildDependencyContext = (stages: ProcessStageWithTasks[]) => {
  const allTasks = stages.flatMap(s => s.tasks)
  const taskDependencyOptions = stages.map(stage => ({
    label: stage.name,
    tasks: stage.tasks.map(t => ({
      id: t.id,
      title: t.title,
    }))
  }))

  const allSubtasksContext = allTasks.flatMap(t =>
    (t.subtasks || []).map(s => ({
      id: s.id,
      title: s.title,
      taskId: t.id,
      taskTitle: t.title,
    }))
  )

  return { taskDependencyOptions, allSubtasksContext }
}
```

---

## 9. Impacto no Motor de Progresso

### `recalculateProgress()` (lib/process-engine.ts)

**Sem alterações necessárias.** A função já:
- Busca todos os `proc_tasks` do processo (independente de `tpl_task_id`)
- Calcula peso por tarefa baseado em subtarefas completadas
- Actualiza `percent_complete` e `current_stage_id`

Tarefas ad-hoc são automaticamente incluídas no cálculo.

### `autoCompleteTasks()` (lib/process-engine.ts)

Funciona normalmente com tarefas ad-hoc do tipo UPLOAD — verifica se já existe documento do tipo no `doc_registry`.

---

## 10. Registo de Actividade

Todas as operações sobre tarefas e subtarefas ad-hoc geram registos em `proc_task_activities`. Os registos são inseridos **antes** de eliminações (para preservar metadados) e **após** criações e conclusões.

### 10.1 Novos Tipos de Actividade

Adicionar a `proc_task_activities.activity_type`:

| Tipo | Descrição | Quando | Prioridade |
|------|-----------|--------|-----------|
| `task_created` | Tarefa ad-hoc criada | Ao criar tarefa via API | Alta |
| `task_deleted` | Tarefa ad-hoc removida | Ao remover tarefa via API | Alta |
| `subtask_added` | Subtarefa ad-hoc adicionada | Ao adicionar subtarefa a tarefa existente | Média |
| `subtask_deleted` | Subtarefa ad-hoc removida | Ao remover subtarefa via API | Média |
| `adhoc_task_completed` | Tarefa ad-hoc concluída | Quando todas as subtarefas são concluídas | Alta |
| `adhoc_subtask_completed` | Subtarefa ad-hoc concluída | Ao marcar subtarefa como concluída | Média |
| `adhoc_subtask_reverted` | Subtarefa ad-hoc revertida | Ao reverter conclusão de subtarefa | Baixa |

**Nota:** Os tipos `completed`, `started`, `status_change` já existentes no sistema continuam a ser usados normalmente para tarefas ad-hoc. Os tipos acima são **adicionais** para capturar eventos específicos do ciclo de vida ad-hoc.

### 10.2 Metadados por Evento

#### Criação de Tarefa

```json
{
  "activity_type": "task_created",
  "description": "Tarefa ad-hoc \"Verificação CPCV\" criada na fase \"Documentação\"",
  "metadata": {
    "is_adhoc": true,
    "stage_name": "Documentação",
    "subtask_count": 3,
    "subtask_types": ["upload", "checklist", "email"],
    "owner_id": "uuid-or-null",
    "owner_name": "João Silva",
    "created_by_role": "Gestora Processual",
    "priority": "normal",
    "is_mandatory": true
  }
}
```

#### Remoção de Tarefa

```json
{
  "activity_type": "task_deleted",
  "description": "Tarefa ad-hoc \"Verificação CPCV\" removida da fase \"Documentação\"",
  "metadata": {
    "is_adhoc": true,
    "deleted_task_title": "Verificação CPCV",
    "stage_name": "Documentação",
    "deleted_subtask_count": 3,
    "task_status_at_deletion": "pending",
    "deleted_by_role": "Broker/CEO",
    "reason": "Já não aplicável"
  }
}
```

#### Adição de Subtarefa

```json
{
  "activity_type": "subtask_added",
  "description": "Subtarefa \"Certidão Predial\" (upload) adicionada à tarefa \"Documentos Adicionais\"",
  "metadata": {
    "is_adhoc": true,
    "subtask_title": "Certidão Predial",
    "subtask_type": "upload",
    "parent_task_title": "Documentos Adicionais",
    "parent_task_id": "uuid",
    "owner_id": "uuid-or-null",
    "owner_name": "Maria Santos",
    "added_by_role": "Gestora Processual"
  }
}
```

#### Remoção de Subtarefa

```json
{
  "activity_type": "subtask_deleted",
  "description": "Subtarefa \"Certidão Predial\" removida da tarefa \"Documentos Adicionais\"",
  "metadata": {
    "is_adhoc": true,
    "deleted_subtask_title": "Certidão Predial",
    "subtask_type": "upload",
    "parent_task_title": "Documentos Adicionais",
    "parent_task_id": "uuid",
    "subtask_status_at_deletion": "pending",
    "remaining_subtask_count": 2,
    "deleted_by_role": "Admin"
  }
}
```

#### Conclusão de Tarefa Ad-hoc

```json
{
  "activity_type": "adhoc_task_completed",
  "description": "Tarefa ad-hoc \"Verificação CPCV\" concluída (3/3 subtarefas)",
  "metadata": {
    "is_adhoc": true,
    "task_title": "Verificação CPCV",
    "stage_name": "Documentação",
    "total_subtasks": 3,
    "completed_subtasks": 3,
    "duration_hours": 48,
    "completed_by_role": "Gestora Processual"
  }
}
```

#### Conclusão de Subtarefa Ad-hoc

```json
{
  "activity_type": "adhoc_subtask_completed",
  "description": "Subtarefa \"Certidão Predial\" (upload) concluída na tarefa \"Documentos Adicionais\"",
  "metadata": {
    "is_adhoc": true,
    "subtask_title": "Certidão Predial",
    "subtask_type": "upload",
    "parent_task_title": "Documentos Adicionais",
    "parent_task_id": "uuid",
    "task_result": { "file_url": "https://...", "doc_registry_id": "uuid" },
    "progress_after": "2/3",
    "completed_by_role": "Gestora Processual"
  }
}
```

#### Reversão de Subtarefa Ad-hoc

```json
{
  "activity_type": "adhoc_subtask_reverted",
  "description": "Subtarefa \"Certidão Predial\" revertida para pendente na tarefa \"Documentos Adicionais\"",
  "metadata": {
    "is_adhoc": true,
    "subtask_title": "Certidão Predial",
    "subtask_type": "upload",
    "parent_task_title": "Documentos Adicionais",
    "parent_task_id": "uuid",
    "reverted_by_role": "Admin",
    "progress_after": "1/3"
  }
}
```

### 10.3 Lógica de Conclusão Automática de Tarefa

Quando a última subtarefa de uma tarefa ad-hoc é concluída, a tarefa-pai deve ser automaticamente marcada como `completed`. Esta lógica já existe no sistema para tarefas de template, mas deve gerar um registo adicional `adhoc_task_completed` para tarefas ad-hoc:

```typescript
// Após marcar subtarefa como concluída
const allSubtasks = await getSubtasksForTask(taskId)
const allCompleted = allSubtasks.every(s => s.is_completed)

if (allCompleted && task.tpl_task_id === null) {
  // Marcar tarefa como completed
  await updateTaskStatus(taskId, 'completed')

  // Registar actividade específica ad-hoc
  await logTaskActivity({
    proc_task_id: taskId,
    user_id: userId,
    activity_type: 'adhoc_task_completed',
    description: `Tarefa ad-hoc "${task.title}" concluída (${allSubtasks.length}/${allSubtasks.length} subtarefas)`,
    metadata: {
      is_adhoc: true,
      task_title: task.title,
      stage_name: task.stage_name,
      total_subtasks: allSubtasks.length,
      completed_subtasks: allSubtasks.length,
    }
  })

  // Recalcular progresso do processo
  await recalculateProgress(task.proc_instance_id)
}
```

### 10.4 Timeline de Actividades

Os novos tipos de actividade aparecem na timeline do processo e na timeline da tarefa (tabs `activity` e `timeline` no `TaskDetailSheet`). Para garantir boa visualização:

| Tipo | Ícone | Cor | Visível em |
|------|-------|-----|-----------|
| `task_created` | `Plus` | violet-600 | Timeline processo + tarefa |
| `task_deleted` | `Trash2` | red-600 | Timeline processo |
| `subtask_added` | `ListPlus` | violet-600 | Timeline tarefa |
| `subtask_deleted` | `ListMinus` | red-600 | Timeline tarefa |
| `adhoc_task_completed` | `CheckCircle2` | emerald-600 | Timeline processo + tarefa |
| `adhoc_subtask_completed` | `CircleCheck` | emerald-500 | Timeline tarefa |
| `adhoc_subtask_reverted` | `RotateCcw` | amber-600 | Timeline tarefa |

---

## 11. Constantes e Labels

### Adicionar a `lib/constants.ts`

```typescript
// Roles que podem gerir tarefas ad-hoc (criar, remover)
export const ADHOC_TASK_ROLES = ['admin', 'Broker/CEO', 'Gestora Processual'] as const

// Labels para actividades ad-hoc (adicionar ao TASK_ACTIVITY_TYPE_CONFIG existente)
export const TASK_ACTIVITY_TYPE_CONFIG = {
  // ... existentes ...

  // Criação
  task_created: {
    icon: 'Plus',
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    label: 'Tarefa criada',
  },
  subtask_added: {
    icon: 'ListPlus',
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    label: 'Subtarefa adicionada',
  },

  // Remoção
  task_deleted: {
    icon: 'Trash2',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Tarefa removida',
  },
  subtask_deleted: {
    icon: 'ListMinus',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Subtarefa removida',
  },

  // Conclusão ad-hoc
  adhoc_task_completed: {
    icon: 'CheckCircle2',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    label: 'Tarefa ad-hoc concluída',
  },
  adhoc_subtask_completed: {
    icon: 'CircleCheck',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-100',
    label: 'Subtarefa ad-hoc concluída',
  },
  adhoc_subtask_reverted: {
    icon: 'RotateCcw',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'Subtarefa ad-hoc revertida',
  },
}
```

---

## 12. Plano de Implementação (Ordem)

### Fase 1 — Backend (API)

| Passo | Descrição | Ficheiro | Estimativa |
|-------|-----------|----------|-----------|
| 1.1 | Criar endpoint POST `/api/processes/[id]/tasks` | `app/api/processes/[id]/tasks/route.ts` | — |
| 1.2 | Adicionar POST handler para subtarefas | `app/api/processes/[id]/tasks/[taskId]/subtasks/route.ts` | — |
| 1.3 | Adicionar DELETE handler para tarefas ad-hoc | `app/api/processes/[id]/tasks/[taskId]/route.ts` | — |
| 1.4 | Adicionar DELETE handler para subtarefas ad-hoc | `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts` | — |
| 1.5 | Adicionar tipos de actividade e constantes | `lib/constants.ts` | — |
| 1.6 | Lógica de conclusão automática com registo ad-hoc | `lib/process-engine.ts` ou inline na API | — |

### Fase 2 — Componentes Base

| Passo | Descrição | Ficheiro |
|-------|-----------|----------|
| 2.1 | Criar `OwnerSelector` | `components/processes/owner-selector.tsx` |
| 2.2 | Adicionar prop `mode` ao `SubtaskConfigDialog` | `components/templates/subtask-config-dialog.tsx` |
| 2.3 | Criar `AdHocTaskSheet` | `components/processes/adhoc-task-sheet.tsx` |

### Fase 3 — Integração na Página

| Passo | Descrição | Ficheiro |
|-------|-----------|----------|
| 3.1 | Adicionar estado e botão "Nova Tarefa" na página de processo | `app/dashboard/processos/[id]/page.tsx` |
| 3.2 | Adicionar botão "+" nas colunas kanban | `app/dashboard/processos/[id]/page.tsx` |
| 3.3 | Adicionar badge ad-hoc + opção "Remover" no `ProcessTaskCard` | `components/processes/process-task-card.tsx` |
| 3.4 | Adicionar "Adicionar Subtarefa" + ícone "Remover" no `TaskDetailSheet` / `SubtaskCardBase` | `components/processes/task-detail-sheet.tsx`, `subtask-card-base.tsx` |

### Fase 4 — Refinamentos

| Passo | Descrição |
|-------|-----------|
| 4.1 | Testes manuais end-to-end |
| 4.2 | Verificar cálculo de progresso com tarefas ad-hoc |
| 4.3 | Verificar dependências entre tarefas ad-hoc e template |

---

## 13. Ficheiros Envolvidos (Resumo)

### Novos
- `app/api/processes/[id]/tasks/route.ts` (POST handler)
- `components/processes/adhoc-task-sheet.tsx`
- `components/processes/owner-selector.tsx`

### Modificados
- `components/templates/subtask-config-dialog.tsx` — prop `mode`
- `components/processes/process-task-card.tsx` — badge ad-hoc + opção "Remover tarefa"
- `components/processes/task-detail-sheet.tsx` — botão "Adicionar Subtarefa"
- `components/processes/subtask-card-base.tsx` — ícone "Remover subtarefa" para ad-hoc
- `app/dashboard/processos/[id]/page.tsx` — estado + botões
- `app/api/processes/[id]/tasks/[taskId]/route.ts` — DELETE handler
- `app/api/processes/[id]/tasks/[taskId]/subtasks/route.ts` — POST handler
- `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts` — DELETE handler
- `lib/constants.ts` — constantes + tipos de actividade ad-hoc

### Reutilizados (sem alterações)
- `components/templates/subtask-editor.tsx`
- `components/templates/form-field-picker.tsx`
- `components/templates/alert-config-editor.tsx`
- `lib/process-engine.ts`

---

## 14. Restrições e Regras de Negócio

1. **Apenas processos activos ou em pausa** — não é possível criar/remover tarefas em processos `draft`, `pending_approval`, `completed`, `rejected` ou `cancelled`
2. **Tarefas ad-hoc são identificadas por** `tpl_task_id IS NULL` — não requerem campo adicional
3. **Apenas tarefas/subtarefas ad-hoc podem ser removidas** — tarefas de template podem apenas ser bypassed, subtarefas de template não podem ser removidas
4. **Remoção bloqueada por dependências** — não se pode remover uma tarefa/subtarefa da qual outras dependem; o utilizador deve primeiro remover as dependências
5. **Proprietários disponíveis** — apenas os vinculados ao imóvel do processo via `property_owners`
6. **Dependências** — tarefas ad-hoc podem depender de tarefas de template e vice-versa
7. **Progresso** — tarefas ad-hoc contam para o `percent_complete` do processo
8. **Sem fan-out automático** — a associação de proprietários é explícita (sem `owner_scope`)
9. **Auditoria obrigatória** — toda criação, remoção, conclusão e reversão registada em `proc_task_activities`
10. **Conclusão automática** — quando todas as subtarefas de uma tarefa ad-hoc são concluídas, a tarefa-pai é automaticamente marcada como `completed` e gera registo `adhoc_task_completed`
11. **Confirmação obrigatória** — remoções de tarefas e subtarefas exigem confirmação via `ConfirmDialog` (AlertDialog) com mensagem descritiva

---

## 15. Desvios de Implementação

> Secção adicionada após implementação (2026-03-11). Documenta diferenças entre a especificação original e a implementação real.

### 15.1 Ficheiros Modificados vs Especificação

| Especificação | Implementação Real | Motivo |
|--------------|-------------------|--------|
| `subtask-card-base.tsx` — ícone "Remover subtarefa" | `subtask-card-list.tsx` — wrapper com delete overlay por subtarefa | Não existe `subtask-card-base.tsx`. O `SubtaskCardList` renderiza cada tipo de card (checklist, upload, email, etc.) e foi o local correcto para adicionar o overlay de remoção com hover |
| `task-detail-sheet.tsx` — botão "Adicionar Subtarefa" | `task-detail-actions.tsx` — botão no painel de acções | A lógica de subtarefas está em `TaskDetailActions`, não directamente no `TaskDetailSheet`. O botão "Adicionar Subtarefa" foi colocado junto ao `SubtaskCardList` |
| Botão "+" no fundo de colunas kanban | Não implementado | O botão "Nova Tarefa" na toolbar do pipeline (já implementado) cobre este caso. Adicionar botão por coluna exigiria alterações significativas ao layout kanban com valor incremental mínimo |

### 15.2 Props Threading

O `canDeleteAdhoc` e `onTaskDelete` são threaded pela cadeia:
```
page.tsx → ProcessKanbanView / ProcessListView → ProcessTaskCard
```

O `canDeleteAdhocSubtask` e `onDeleteSubtask` são threaded por:
```
TaskDetailActions → SubtaskCardList → wrapper div com Trash2 overlay
```

### 15.3 Subtarefa Add — Diferenças do Fluxo

A especificação menciona um "dropdown com tipos de subtarefa" antes de abrir o `SubtaskConfigDialog`. A implementação abre directamente o `SubtaskConfigDialog` em modo `adhoc` — o tipo de subtarefa é seleccionado dentro do diálogo (já suportado nativamente pelo componente). Isto simplifica o fluxo e reutiliza melhor o componente existente.

O botão "Adicionar Subtarefa" aparece também em tarefas do tipo `MANUAL` e `UPLOAD`/`EMAIL` (não apenas `COMPOSITE`/`FORM`), permitindo transformar qualquer tarefa em composta via ad-hoc.

### 15.4 Subtarefa Delete — Ad-hoc Badge Overlay

As subtarefas ad-hoc mostram um pequeno badge "Ad-hoc" (com ícone `Zap`) que aparece ao fazer hover, junto ao botão de remoção (`Trash2`). Ambos aparecem com `opacity-0 group-hover:opacity-100` para manter a UI limpa.

### 15.5 Conclusão Automática de Tarefa Ad-hoc

A lógica de conclusão automática (`adhoc_task_completed`) **não foi implementada inline** nas APIs de subtask toggle — esta lógica já é tratada pelo handler PUT existente em `tasks/[taskId]/route.ts` que verifica se todas as subtarefas foram concluídas. O registo de actividade `adhoc_task_completed` não é emitido separadamente; em vez disso, o tipo `completed` standard é utilizado (já existente).

### 15.6 Constante `ADHOC_TASK_ROLES`

A constante foi definida com `as const` para garantir type-safety:
```typescript
export const ADHOC_TASK_ROLES = ['admin', 'Broker/CEO', 'Gestora Processual'] as const
```

### 15.7 SubtaskConfigDialog — Props em Modo Adhoc

Em modo `adhoc`, as props `docTypes`, `docTypesByCategory`, `emailTemplates`, `docTemplates` e `sameTaskSubtasks` são passadas como arrays/objectos vazios, pois a selecção de bibliotecas de templates não se aplica ao contexto de execução ad-hoc. O utilizador define o tipo da subtarefa directamente.
