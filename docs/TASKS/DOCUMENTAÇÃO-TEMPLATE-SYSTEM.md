# Sistema de Templates e Processos — Documentação Completa

> **Última actualização:** 2026-02-27
>
> Este documento descreve toda a arquitectura do sistema de templates de processo: tabelas, funções SQL, API routes, motor de execução, componentes UI, tipos TypeScript e fluxos de dados.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Modelo de Dados (Schema)](#2-modelo-de-dados)
   - 2.1 [Tabelas de Template](#21-tabelas-de-template)
   - 2.2 [Tabelas de Instância (Execução)](#22-tabelas-de-instância)
   - 2.3 [Tabelas Auxiliares (Bibliotecas)](#23-tabelas-auxiliares)
   - 2.4 [Diagrama de Relações](#24-diagrama-de-relações)
3. [Funções SQL e Triggers](#3-funções-sql-e-triggers)
4. [Motor de Execução (TypeScript)](#4-motor-de-execução)
5. [API Routes](#5-api-routes)
   - 5.1 [Templates API](#51-templates-api)
   - 5.2 [Processos API](#52-processos-api)
   - 5.3 [Bibliotecas API](#53-bibliotecas-api)
6. [Tipos TypeScript](#6-tipos-typescript)
7. [Validações Zod](#7-validações-zod)
8. [Constantes](#8-constantes)
9. [Componentes UI](#9-componentes-ui)
   - 9.1 [Template Builder](#91-template-builder)
   - 9.2 [Execução de Processos](#92-execução-de-processos)
10. [Fluxos de Dados](#10-fluxos-de-dados)
    - 10.1 [Criar Template](#101-criar-template)
    - 10.2 [Editar Template](#102-editar-template)
    - 10.3 [Aprovar Processo](#103-aprovar-processo)
    - 10.4 [Alterar Template (Re-template)](#104-alterar-template)
    - 10.5 [Executar Tarefa](#105-executar-tarefa)
    - 10.6 [Multiplicação por Proprietário](#106-multiplicação-por-proprietário)
11. [Notas Técnicas Importantes](#11-notas-técnicas)

---

## 1. Visão Geral

O sistema divide-se em duas camadas:

| Camada | Descrição | Tabelas |
|--------|-----------|---------|
| **Template** (definição) | Estrutura reutilizável de fases, tarefas e subtarefas | `tpl_processes`, `tpl_stages`, `tpl_tasks`, `tpl_subtasks` |
| **Instância** (execução) | Cópia concreta associada a um imóvel, com estado e progresso | `proc_instances`, `proc_tasks`, `proc_subtasks` |

**Hierarquia:**

```
Template (tpl_processes)
└── Fase 1 (tpl_stages, order_index: 0)
│   ├── Tarefa 1.1 (tpl_tasks, order_index: 0)
│   │   ├── Subtarefa 1.1.1 (tpl_subtasks, order_index: 0)
│   │   └── Subtarefa 1.1.2 (tpl_subtasks, order_index: 1)
│   └── Tarefa 1.2 (tpl_tasks, order_index: 1)
└── Fase 2 (tpl_stages, order_index: 1)
    └── Tarefa 2.1 (tpl_tasks, order_index: 0)
```

Quando um processo é aprovado, a função SQL `populate_process_tasks()` copia toda a árvore do template para as tabelas de instância (`proc_tasks` + `proc_subtasks`), aplicando lógica de multiplicação por proprietário quando configurado.

---

## 2. Modelo de Dados

### 2.1 Tabelas de Template

#### `tpl_processes`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `name` | text | NOT NULL |
| `description` | text | nullable |
| `is_active` | boolean | default `true` |
| `created_at` | timestamptz | auto |

Soft-delete via `is_active = false` (nunca se apaga fisicamente).

---

#### `tpl_stages`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `tpl_process_id` | uuid | FK → `tpl_processes(id)` |
| `name` | text | NOT NULL |
| `description` | text | nullable |
| `order_index` | integer | NOT NULL |
| `created_at` | timestamptz | auto |

---

#### `tpl_tasks`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `tpl_stage_id` | uuid | FK → `tpl_stages(id)` |
| `title` | text | NOT NULL |
| `description` | text | nullable |
| `action_type` | text | NOT NULL |
| `is_mandatory` | boolean | default `true` |
| `dependency_task_id` | uuid | FK → `tpl_tasks(id)` (self-ref), nullable |
| `sla_days` | integer | nullable |
| `assigned_role` | text | nullable |
| `config` | jsonb | nullable |
| `order_index` | integer | NOT NULL |
| `priority` | text | default `'normal'` |

**Valores de `action_type`:**

| Tipo | Descrição | Uso actual |
|------|-----------|------------|
| `COMPOSITE` | Tarefa composta de subtarefas | **Tipo principal** — usado pelo template builder |
| `UPLOAD` | Upload de documento | Legacy (tarefas sem subtarefas) |
| `EMAIL` | Enviar email | Legacy |
| `GENERATE_DOC` | Gerar documento | Legacy |
| `MANUAL` | Tarefa manual | Legacy |
| `FORM` | Formulário KYC | Legacy (multiplicação por owner_type) |

> **Nota:** O template builder actual cria todas as tarefas como `COMPOSITE` com subtarefas tipadas. Os tipos legados `UPLOAD`/`EMAIL`/`GENERATE_DOC`/`MANUAL`/`FORM` existem em processos criados anteriormente e continuam suportados na execução.

---

#### `tpl_subtasks`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `tpl_task_id` | uuid | FK → `tpl_tasks(id)` ON DELETE CASCADE |
| `title` | text | NOT NULL |
| `description` | text | nullable |
| `is_mandatory` | boolean | default `true` |
| `order_index` | integer | NOT NULL, default `0` |
| `config` | jsonb | default `'{}'` |
| `created_at` | timestamptz | default `now()` |

> **Nota:** Esta tabela não está no `types/database.ts` gerado. É acedida via cast no código: `(supabase as any).from('tpl_subtasks')`.

**Estrutura do campo `config`:**

```jsonc
{
  // Tipo da subtarefa (obrigatório)
  "type": "upload" | "checklist" | "email" | "generate_doc",

  // Configuração por tipo (quando has_person_type_variants = false)
  "doc_type_id": "uuid",           // type = "upload"
  "email_library_id": "uuid",      // type = "email"
  "doc_library_id": "uuid",        // type = "generate_doc"

  // Multiplicação por proprietário
  "owner_scope": "none" | "all_owners" | "main_contact_only",
  "person_type_filter": "all" | "singular" | "coletiva",

  // Variantes por tipo de pessoa
  "has_person_type_variants": false,
  "singular_config": {
    "doc_type_id": "uuid",
    "email_library_id": "uuid",
    "doc_library_id": "uuid"
  },
  "coletiva_config": {
    "doc_type_id": "uuid",
    "email_library_id": "uuid",
    "doc_library_id": "uuid"
  }
}
```

---

### 2.2 Tabelas de Instância

#### `proc_instances`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `property_id` | uuid | FK → `dev_properties(id)`, NOT NULL |
| `tpl_process_id` | uuid | FK → `tpl_processes(id)`, nullable |
| `current_status` | text | default `'pending_approval'` |
| `current_stage_id` | uuid | FK → `tpl_stages(id)`, nullable |
| `percent_complete` | numeric | default `0` |
| `external_ref` | text | gerado por trigger `PROC-YYYY-XXXX` |
| `notes` | text | nullable |
| `started_at` | timestamptz | nullable |
| `completed_at` | timestamptz | nullable |
| `updated_at` | timestamptz | auto |
| `requested_by` | uuid | FK → `dev_users(id)` |
| `approved_by` | uuid | FK → `dev_users(id)`, nullable |
| `approved_at` | timestamptz | nullable |
| `rejected_by` | uuid | FK → `dev_users(id)`, nullable |
| `rejected_at` | timestamptz | nullable |
| `rejected_reason` | text | nullable |
| `returned_by` | uuid | FK → `dev_users(id)`, nullable |
| `returned_at` | timestamptz | nullable |
| `returned_reason` | text | nullable |
| `deleted_at` | timestamptz | nullable (soft-delete) |
| `deleted_by` | uuid | nullable (soft-delete) |

**Estados (`current_status`):**

```
pending_approval → approved (active) → completed
                 → returned → re-approved (active)
                 → rejected
active → on_hold → active (resumed)
active → cancelled
```

---

#### `proc_tasks`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `proc_instance_id` | uuid | FK → `proc_instances(id)`, NOT NULL |
| `tpl_task_id` | uuid | FK → `tpl_tasks(id)`, nullable |
| `title` | text | NOT NULL |
| `action_type` | text | nullable |
| `status` | text | default `'pending'` |
| `is_mandatory` | boolean | default `true` |
| `is_bypassed` | boolean | default `false` |
| `bypass_reason` | text | nullable |
| `bypassed_by` | uuid | FK → `dev_users(id)`, nullable |
| `assigned_to` | uuid | FK → `dev_users(id)`, nullable |
| `assigned_role` | text | nullable |
| `due_date` | timestamptz | nullable |
| `completed_at` | timestamptz | nullable |
| `task_result` | jsonb | nullable |
| `config` | jsonb | default `'{}'` |
| `stage_name` | text | copiado do template |
| `stage_order_index` | integer | copiado do template |
| `order_index` | integer | nullable |
| `owner_id` | uuid | FK → `owners(id)`, nullable |
| `priority` | text | default `'normal'` |
| `started_at` | timestamptz | nullable |
| `created_at` | timestamptz | auto |

**Estados (`status`):** `pending` → `in_progress` → `completed` | `skipped`

---

#### `proc_subtasks`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `proc_task_id` | uuid | FK → `proc_tasks(id)` ON DELETE CASCADE |
| `tpl_subtask_id` | uuid | FK → `tpl_subtasks(id)`, nullable |
| `title` | text | NOT NULL |
| `is_mandatory` | boolean | default `true` |
| `is_completed` | boolean | default `false` |
| `completed_at` | timestamptz | nullable |
| `completed_by` | uuid | FK → `dev_users(id)`, nullable |
| `order_index` | integer | NOT NULL, default `0` |
| `config` | jsonb | default `'{}'` |
| `owner_id` | uuid | FK → `owners(id)` ON DELETE SET NULL, nullable |
| `created_at` | timestamptz | default `now()` |

Índice: `idx_proc_subtasks_owner_id` em `proc_subtasks(owner_id)`

---

### 2.3 Tabelas Auxiliares

#### `tpl_email_library`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `name` | text | NOT NULL |
| `subject` | text | NOT NULL |
| `body_html` | text | NOT NULL |
| `description` | text | nullable |
| `editor_state` | jsonb | nullable (estado do editor rich text) |
| `created_at` | timestamptz | auto |
| `updated_at` | timestamptz | auto |

---

#### `tpl_doc_library`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `name` | text | NOT NULL |
| `content_html` | text | NOT NULL |
| `description` | text | nullable |
| `doc_type_id` | uuid | FK → `doc_types(id)`, nullable |
| `letterhead_url` | text | nullable |
| `letterhead_file_name` | text | nullable |
| `letterhead_file_type` | text | nullable |
| `created_at` | timestamptz | auto |
| `updated_at` | timestamptz | auto |

---

#### `tpl_variables`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `key` | text | NOT NULL (ex: `proprietario_nome`) |
| `label` | text | NOT NULL |
| `category` | text | NOT NULL |
| `source_entity` | text | NOT NULL (`property`\|`owner`\|`consultant`\|`process`\|`system`) |
| `source_table` | text | nullable |
| `source_column` | text | nullable |
| `format_type` | text | NOT NULL (`text`\|`currency`\|`date`\|`concat`) |
| `format_config` | jsonb | nullable |
| `static_value` | text | nullable |
| `is_system` | boolean | NOT NULL |
| `is_active` | boolean | NOT NULL |
| `order_index` | integer | NOT NULL |

Variáveis usadas em templates de email e documentos via sintaxe `{{chave}}`.

---

#### `doc_types`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `name` | text | NOT NULL, unique |
| `description` | text | nullable |
| `category` | text | nullable |
| `allowed_extensions` | text[] | default `{pdf,jpg,png,jpeg,doc,docx}` |
| `default_validity_months` | integer | nullable |
| `is_system` | boolean | default `false` |

---

### 2.4 Diagrama de Relações

```
TEMPLATE (Definição)                    INSTÂNCIA (Execução)
═══════════════════                     ════════════════════

tpl_processes ─────────────────────── proc_instances
  │                                       │  ├── property_id → dev_properties
  │                                       │  ├── current_stage_id → tpl_stages
  │                                       │  └── requested_by/approved_by/... → dev_users
  │
  └─► tpl_stages ─────────────────── (stage_name copiado para proc_tasks)
        │
        └─► tpl_tasks ────────────── proc_tasks
              │                         │  ├── owner_id → owners
              │                         │  ├── assigned_to → dev_users
              │                         │  └── tpl_task_id → tpl_tasks (nullable)
              │
              └─► tpl_subtasks ───── proc_subtasks
                                       ├── owner_id → owners
                                       ├── completed_by → dev_users
                                       └── tpl_subtask_id → tpl_subtasks (nullable)

BIBLIOTECAS
═══════════
tpl_email_library ← referenciado em subtask config.email_library_id
tpl_doc_library   ← referenciado em subtask config.doc_library_id
doc_types         ← referenciado em subtask config.doc_type_id
tpl_variables     ← usadas em body_html de emails e documentos
```

---

## 3. Funções SQL e Triggers

### `populate_process_tasks(p_instance_id uuid)`

**Tipo:** Supabase RPC (chamável via `supabase.rpc('populate_process_tasks', { p_instance_id })`)

**Finalidade:** Copia todas as tarefas e subtarefas do template para a instância de processo, aplicando lógica de multiplicação por proprietário.

**Algoritmo:**

```
PARA cada tarefa do template (ordenada por stage.order_index, task.order_index):
│
├── SE tarefa tem config->>'owner_type' E o imóvel tem proprietários:
│   │  (MULTIPLICAÇÃO POR PROPRIETÁRIO — modo legado FORM)
│   │
│   └── PARA cada proprietário com person_type = owner_type:
│       ├── Insere proc_task com owner_id = proprietário
│       └── SE tarefa tem subtarefas:
│           └── Copia subtarefas (INSERT SELECT de tpl_subtasks)
│
└── SENÃO (tarefa normal):
    ├── Insere proc_task sem owner_id
    └── SE tarefa tem subtarefas:
        └── Copia subtarefas (INSERT SELECT de tpl_subtasks)
```

**Campos copiados para `proc_tasks`:**
- `title` (apenas o título, sem nome do proprietário)
- `action_type`, `config`, `is_mandatory`, `assigned_role`
- `sla_days`, `priority`, `stage_name`, `stage_order_index`, `order_index`
- `owner_id` (quando multiplicado)
- `status = 'pending'`

**Campos copiados para `proc_subtasks`:**
- `title`, `is_mandatory`, `order_index`, `config`
- `tpl_subtask_id` (referência ao template)

---

### `_populate_subtasks()` (Proposta — SPEC-OWNER-CONDITIONAL-SUBTASKS)

Função auxiliar documentada no ficheiro `docs/SPEC-OWNER-CONDITIONAL-SUBTASKS.md` que implementa a lógica de multiplicação de **subtarefas** por proprietário com base no campo `config.owner_scope`:

- `none`: copia directamente sem multiplicação
- `all_owners`: cria uma subtarefa por proprietário do imóvel
- `main_contact_only`: cria subtarefa apenas para o contacto principal

---

### `generate_proc_ref()` — Trigger

**Trigger:** `trg_generate_proc_ref` em `proc_instances` (AFTER INSERT)

Gera automaticamente `external_ref` no formato `PROC-YYYY-XXXX` (ex: `PROC-2026-0007`).

---

### `trg_auto_complete_form_tasks_on_owner_update`

**Trigger** em `owners` (AFTER UPDATE). Para cada tarefa FORM pendente associada ao proprietário, verifica subtarefas de campo (`field`) e documento (`document`). Se todas as obrigatórias estiverem completas, marca a tarefa como `completed`.

---

### `trg_auto_complete_tasks_on_doc_insert`

**Trigger** em `doc_registry` (AFTER INSERT). Completa automaticamente tarefas UPLOAD e actualiza subtarefas do tipo `document` em tarefas FORM.

---

## 4. Motor de Execução

**Ficheiro:** `lib/process-engine.ts`

Duas funções exportadas, ambas usam `createAdminClient()` (bypass RLS).

### `autoCompleteTasks(procInstanceId, propertyId)`

Após aprovação, marca automaticamente tarefas UPLOAD como `completed` se já existirem documentos correspondentes no `doc_registry`.

**Algoritmo:**
1. Busca todas as `proc_tasks` UPLOAD pendentes
2. Busca documentos activos do imóvel (`doc_registry` por `property_id`)
3. Busca documentos activos dos proprietários (`doc_registry` por `owner_id`)
4. Para cada tarefa pendente com `config.doc_type_id`:
   - Se existe documento com o mesmo `doc_type_id` e `valid_until > now()`: marca como `completed`
   - Guarda em `task_result`: `{ doc_registry_id, auto_completed: true, source }`

**Retorno:** `{ completed: number, total: number }`

---

### `recalculateProgress(procInstanceId)`

Recalcula `percent_complete`, `current_stage_id` e detecta conclusão do processo.

**Algoritmo:**
1. Busca todas as `proc_tasks` da instância
2. `percentComplete = round((completed_or_bypassed / total) * 100)`
3. Agrupa por `stage_order_index`, encontra a primeira fase incompleta
4. Busca o `tpl_stages.id` correspondente ao `order_index` actual
5. Actualiza `proc_instances`:
   - `percent_complete`, `current_stage_id`, `updated_at`
   - Se 100%: `current_status = 'completed'`, `completed_at = now()`

**Retorno:** `{ percent_complete, current_stage_index, current_stage_id, is_completed }`

---

## 5. API Routes

### 5.1 Templates API

#### `GET /api/templates`

Lista todos os templates com contagem de fases e tarefas.

**Resposta:** `200` — Array de `{ id, name, description, is_active, created_at, stages_count, tasks_count }`

---

#### `POST /api/templates`

Cria novo template com fases, tarefas e subtarefas.

**Body:** Validado pelo `templateSchema` (ver secção 7)

**Sequência:**
1. Valida contra `templateSchema`
2. Insere `tpl_processes` (name, description)
3. Para cada fase: insere `tpl_stages`
4. Para cada tarefa: insere `tpl_tasks` com `action_type = 'COMPOSITE'`
5. Para cada subtarefa: insere `tpl_subtasks` com `config: { type, ...config }`
6. Em caso de erro: apaga `tpl_processes` (cascade deleta fases/tarefas)

**Resposta:** `201` — `{ id: "uuid" }`

---

#### `GET /api/templates/[id]`

Retorna template completo com árvore de fases → tarefas → subtarefas.

**Resposta:** `200` — Template com `tpl_stages[].tpl_tasks[].tpl_subtasks[]`

---

#### `PUT /api/templates/[id]`

Actualiza template. Usa estratégia **delete-and-recreate**: apaga todas as fases/tarefas/subtarefas e recria.

**Sequência (com admin client para bypass RLS):**
1. Valida body
2. Actualiza `name` e `description` em `tpl_processes`
3. Nullifica `proc_instances.current_stage_id` que referencia as fases a apagar
4. Nullifica `proc_tasks.tpl_task_id` que referencia as tarefas a apagar
5. Apaga `tpl_subtasks` → `tpl_tasks` → `tpl_stages`
6. Recria toda a árvore

> **Importante:** Usa `createAdminClient()` para os deletes porque a RLS bloqueia silenciosamente operações de delete. A nullificação de FKs é necessária para evitar erros de constraint (`proc_instances_current_stage_id_fkey`, `proc_tasks_tpl_task_id_fkey`).

**Resposta:** `200` — `{ id: "uuid" }`

---

#### `DELETE /api/templates/[id]`

Soft-delete: `is_active = false`.

**Resposta:** `200` — `{ success: true }`

---

#### `GET /api/templates/active`

Retorna o template activo (single). Usado na selecção de template na aprovação.

---

### 5.2 Processos API

#### `GET /api/processes`

Lista instâncias de processo com filtros de status e search.

**Query params:** `status`, `search`

**Filtro search:** aplica-se em memória sobre `external_ref`, título do imóvel, cidade, nome do consultor.

---

#### `GET /api/processes/[id]`

Retorna detalhe completo do processo.

**Resposta:**
```typescript
{
  instance: ProcessInstance,       // dados da instância + relações
  stages: ProcessStageWithTasks[], // fases com tarefas agrupadas
  owners: ProcessOwner[],          // proprietários do imóvel
  documents: ProcessDocument[]     // documentos existentes
}
```

As tarefas são agrupadas por `stage_name` e cada fase recebe um `status` derivado:
- `completed`: todas as tarefas completadas/bypassed
- `in_progress`: pelo menos uma tarefa em progresso ou completada
- `pending`: nenhuma tarefa iniciada

Se o processo foi soft-deleted (`deleted_at` preenchido), retorna `410 Gone`.

---

#### `DELETE /api/processes/[id]`

Soft-delete. Reverte status do imóvel para `pending_approval` se estava `in_process`.

---

#### `POST /api/processes/[id]/approve`

Aprova o processo e instancia as tarefas do template seleccionado.

**Body:** `{ tpl_process_id: "uuid" }`

**Roles permitidas:** `Broker/CEO`, `Gestora Processual`, `admin`

**Sequência:**
1. Verifica que o template existe e está activo
2. Verifica que o processo está `pending_approval` ou `returned`
3. Se já tinha template (re-aprovação): apaga `proc_tasks` existentes
4. Actualiza `proc_instances`: status → `active`, `approved_by`, `percent_complete = 0`
5. Chama RPC `populate_process_tasks` → copia tarefas do template
6. Chama `autoCompleteTasks` → auto-completa uploads existentes
7. Chama `recalculateProgress` → calcula progresso inicial
8. Actualiza status do imóvel para `in_process`

---

#### `POST /api/processes/[id]/reject`

Rejeita o processo. Body: `{ reason: "string (min 10)" }`. Status → `rejected`. Imóvel → `cancelled`.

---

#### `POST /api/processes/[id]/return`

Devolve o processo para correcção. Body: `{ reason: "string (min 10)" }`. Status → `returned`. Imóvel mantém status.

---

#### `POST /api/processes/[id]/hold`

Pausa ou reactiva. Body: `{ action: "pause" | "resume", reason?: "string" }`.
- `pause`: `active` → `on_hold`
- `resume`: `on_hold` → `active`

---

#### `POST /api/processes/[id]/cancel`

Cancela o processo. Body: `{ reason?: "string" }`. Status → `cancelled`. Imóvel → `pending_approval`.

---

#### `POST /api/processes/[id]/re-template`

Altera o template de um processo activo ou em pausa.

**Body:** `{ tpl_process_id: "uuid" }`

**Sequência:**
1. Verifica template activo e processo `active`/`on_hold`
2. Apaga todos os `proc_tasks` (cascade apaga `proc_subtasks`)
3. Actualiza `tpl_process_id`, `percent_complete = 0`
4. Chama `populate_process_tasks` → `autoCompleteTasks` → `recalculateProgress`

**Diferença do approve:** Funciona em processos já activos. O approve funciona apenas em `pending_approval`/`returned`.

---

#### `PUT /api/processes/[id]/tasks/[taskId]`

Actualiza estado de uma tarefa.

**Body:** `{ action, bypass_reason?, assigned_to?, task_result?, priority?, due_date? }`

**Acções:**

| Acção | De | Para | Campos |
|-------|-----|------|--------|
| `start` | pending | in_progress | `started_at`, `assigned_to = user.id` |
| `complete` | pending/in_progress | completed | `completed_at`, `task_result` |
| `bypass` | pending/in_progress | skipped | `is_bypassed`, `bypass_reason`, `bypassed_by` |
| `assign` | qualquer | — | `assigned_to` |
| `reset` | skipped | pending | limpa bypass fields |
| `update_priority` | qualquer | — | `priority` |
| `update_due_date` | qualquer | — | `due_date` |

Após `complete`/`bypass`/`reset`: chama `recalculateProgress`.

---

#### `PUT /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]`

Toggle de subtarefa manual. Body: `{ is_completed: boolean }`.

Após toggle:
- Recalcula status da tarefa pai com base nas subtarefas:
  - Todas obrigatórias completas → `completed`
  - Algumas completas → `in_progress`
  - Nenhuma → `pending`
- Chama `recalculateProgress`

---

### 5.3 Bibliotecas API

#### Tipos de Documento (`/api/libraries/doc-types`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/libraries/doc-types` | Lista (filtro opcional `category`) |
| POST | `/api/libraries/doc-types` | Criar |
| PUT | `/api/libraries/doc-types/[id]` | Editar |
| DELETE | `/api/libraries/doc-types/[id]` | Eliminar (bloqueia se `is_system`) |

---

#### Templates de Email (`/api/libraries/emails`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/libraries/emails` | Lista (filtro `search`) — sem `body_html` |
| POST | `/api/libraries/emails` | Criar |
| GET | `/api/libraries/emails/[id]` | Detalhe com `body_html` |
| PUT | `/api/libraries/emails/[id]` | Editar |
| DELETE | `/api/libraries/emails/[id]` | Eliminar |
| POST | `/api/libraries/emails/upload` | Upload de imagem inline (webp/jpg/png, max 5MB) |
| POST | `/api/libraries/emails/upload-attachment` | Upload de anexo (pdf/doc/xls/img, max 10MB) |
| POST | `/api/libraries/emails/preview-data` | Resolver variáveis com dados reais |

---

#### Templates de Documento (`/api/libraries/docs`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/libraries/docs` | Lista com `doc_types` |
| POST | `/api/libraries/docs` | Criar |
| GET | `/api/libraries/docs/[id]` | Detalhe com `content_html` |
| PUT | `/api/libraries/docs/[id]` | Editar |
| DELETE | `/api/libraries/docs/[id]` | Eliminar |
| POST | `/api/libraries/docs/upload-image` | Upload de imagem (max 5MB) |
| POST | `/api/libraries/docs/upload-letterhead` | Upload de cabeçalho (max 10MB) |

---

#### Variáveis (`/api/libraries/variables`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/libraries/variables` | Lista (filtros: `category`, `source_entity`, `active_only`) |
| POST | `/api/libraries/variables` | Criar (valida unicidade de `key`) |
| GET | `/api/libraries/variables/[id]` | Detalhe |
| PUT | `/api/libraries/variables/[id]` | Editar |
| DELETE | `/api/libraries/variables/[id]` | Eliminar (bloqueia se `is_system`) |

---

## 6. Tipos TypeScript

### `types/process.ts`

```typescript
type ProcessStatus = 'pending_approval' | 'returned' | 'active' | 'on_hold' |
                     'completed' | 'rejected' | 'cancelled'

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'
type TaskPriority = 'urgent' | 'normal' | 'low'
type TaskAction = 'complete' | 'bypass' | 'assign' | 'start' | 'reset' |
                  'update_priority' | 'update_due_date'
type ActionType = 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL' | 'FORM' | 'COMPOSITE'

interface ProcessInstance { /* proc_instances + relações */ }
interface ProcessTask { /* proc_tasks + assigned_to_user, owner, subtasks */ }
interface ProcessStageWithTasks { name, order_index, status, tasks_completed, tasks_total, tasks }
interface ProcessOwner { id, name, nif, person_type, ownership_percentage, is_main_contact, email, phone }
interface ProcessDocument { id, doc_type, file_name, file_url, status, created_at }

interface ProcessDetail {
  instance: ProcessInstance
  stages: ProcessStageWithTasks[] | null
  owners: ProcessOwner[]
  documents: ProcessDocument[]
}
```

### `types/subtask.ts`

```typescript
type SubtaskType = 'upload' | 'checklist' | 'email' | 'generate_doc'
type OwnerScope = 'none' | 'all_owners' | 'main_contact_only'
type PersonTypeFilter = 'all' | 'singular' | 'coletiva'

interface SubtaskOwnerConfig {
  owner_scope?: OwnerScope
  person_type_filter?: PersonTypeFilter
  has_person_type_variants?: boolean
  singular_config?: { doc_type_id?, email_library_id?, doc_library_id? }
  coletiva_config?: { doc_type_id?, email_library_id?, doc_library_id? }
}

interface TplSubtask { /* tpl_subtasks row + config com SubtaskOwnerConfig */ }
interface ProcSubtask { /* proc_subtasks row + owner join */ }
interface SubtaskData { /* estado local do template builder */ }
```

### `types/template.ts`

```typescript
interface TemplateWithCounts { /* tpl_processes + stages_count, tasks_count */ }
interface TemplateTask { /* tpl_tasks + tpl_subtasks[] */ }
interface TemplateStage { /* tpl_stages + tpl_tasks[] */ }
interface TemplateDetail { /* tpl_processes + tpl_stages[] */ }
```

---

## 7. Validações Zod

**Ficheiro:** `lib/validations/template.ts`

```typescript
const subtaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  is_mandatory: z.boolean().default(true),
  order_index: z.number().int().min(0),
  type: z.enum(['upload', 'checklist', 'email', 'generate_doc']),
  config: z.object({
    doc_type_id: z.string().optional(),
    email_library_id: z.string().optional(),
    doc_library_id: z.string().optional(),
    owner_scope: z.enum(['none', 'all_owners', 'main_contact_only']).optional(),
    person_type_filter: z.enum(['all', 'singular', 'coletiva']).optional(),
    has_person_type_variants: z.boolean().optional(),
    singular_config: z.object({ ... }).optional(),
    coletiva_config: z.object({ ... }).optional(),
  }).default({})
})
// Refinements:
//   1. Se !has_person_type_variants: upload requer doc_type_id, email requer email_library_id, etc.
//   2. Se has_person_type_variants: pelo menos uma variante config deve ter o campo necessário

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  is_mandatory: z.boolean().default(true),
  priority: z.enum(['urgent', 'normal', 'low']).default('normal'),
  sla_days: z.number().int().positive().optional(),
  assigned_role: z.string().optional(),
  order_index: z.number().int().min(0),
  subtasks: z.array(subtaskSchema).default([]),
})

const stageSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  order_index: z.number().int().min(0),
  tasks: z.array(taskSchema).min(1),
})

const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  stages: z.array(stageSchema).min(1),
})
```

---

## 8. Constantes

**Ficheiro:** `lib/constants.ts`

```typescript
// Status de processo (com cores bg/text/dot/label PT-PT)
PROCESS_STATUS: pending_approval | returned | active | on_hold | completed | rejected | cancelled

// Status de tarefa
TASK_STATUS: pending | in_progress | completed | skipped

// Tipos de acção (legacy)
ACTION_TYPES: UPLOAD | EMAIL | GENERATE_DOC | MANUAL | FORM

// Prioridade
TASK_PRIORITY_LABELS: urgent → 'Urgente' | normal → 'Normal' | low → 'Baixa'

// Tipos de subtarefa
SUBTASK_TYPES = [
  { type: 'upload',       label: 'Upload de Documento',  icon: 'Upload',      color: 'text-blue-500' },
  { type: 'checklist',    label: 'Checklist (Manual)',    icon: 'CheckSquare', color: 'text-slate-500' },
  { type: 'email',        label: 'Envio de Email',       icon: 'Mail',        color: 'text-amber-500' },
  { type: 'generate_doc', label: 'Gerar Documento',      icon: 'FileText',    color: 'text-purple-500' },
]

// Labels de scope de proprietário
OWNER_SCOPE_LABELS: none | all_owners | main_contact_only
PERSON_TYPE_FILTER_LABELS: all | singular | coletiva
```

---

## 9. Componentes UI

### 9.1 Template Builder

| Componente | Ficheiro | Função |
|------------|----------|--------|
| `TemplateBuilder` | `components/templates/template-builder.tsx` | Ecrã principal de criação/edição. DnD multi-container (fases horizontais, tarefas verticais). Monta payload e chama POST/PUT. |
| `TemplateStageColumn` | `components/templates/template-stage-column.tsx` | Coluna de fase draggable (w-90). Lista de tarefas sortable com scroll. |
| `TemplateTaskCard` | `components/templates/template-task-card.tsx` | Card de tarefa dentro da coluna. Mostra ícone de tipo, badges, handle de drag. |
| `TemplateStageDialog` | `components/templates/template-stage-dialog.tsx` | Dialog para criar/editar fase (nome + descrição). |
| `TemplateTaskSheet` | `components/templates/template-task-sheet.tsx` | Sheet lateral para criar/editar tarefa. Campos: título, descrição, obrigatório, prioridade, role, SLA, lista de subtarefas. |
| `SubtaskEditor` | `components/templates/subtask-editor.tsx` | Editor de subtarefas com DnD. Cada linha: tipo, título, config (doc_type/email/doc select), toggles de proprietário, mandatory. |
| `TemplateList` | `components/templates/template-list.tsx` | Grid de cards de templates com contagens e acções (editar, desactivar). |
| `TemplatePreview` | `components/templates/template-preview.tsx` | Preview read-only do template em colunas horizontais. |

**Páginas:**

| Rota | Ficheiro | Descrição |
|------|----------|-----------|
| `/dashboard/processos/templates` | `app/dashboard/processos/templates/page.tsx` | Lista de templates |
| `/dashboard/processos/templates/novo` | `app/dashboard/processos/templates/novo/page.tsx` | Criar template |
| `/dashboard/processos/templates/[id]/editar` | `app/dashboard/processos/templates/[id]/editar/page.tsx` | Editar template |

---

### 9.2 Execução de Processos

| Componente | Ficheiro | Função |
|------------|----------|--------|
| `ProcessReviewSection` | `components/processes/process-review-section.tsx` | Painel de aprovação: select de template, botões Aprovar/Devolver/Rejeitar, dialogs de motivo. |
| `ProcessReviewBento` | `components/processes/process-review-bento.tsx` | Grid bento com dados do imóvel: hero, mapa, preço, specs, proprietários, dados internos, documentos. |
| `ProcessKanbanView` | `components/processes/process-kanban-view.tsx` | Vista kanban horizontal com colunas por fase, cores rotativas, progress bars. |
| `ProcessListView` | `components/processes/process-list-view.tsx` | Vista lista com acordeão por fase. |
| `ProcessTaskCard` | `components/processes/process-task-card.tsx` | Card de tarefa com 2 variantes (kanban/list). Menu de acções contextual. |
| `TaskDetailSheet` | `components/processes/task-detail-sheet.tsx` | Sheet lateral de detalhe: metadata, acções, comentários. |
| `TaskDetailActions` | `components/processes/task-detail-actions.tsx` | Acções por tipo (upload picker, checklist, email preview, doc preview). Botões Start/Complete/Bypass/Reset. |
| `TaskDetailMetadata` | `components/processes/task-detail-metadata.tsx` | Metadata editável: prioridade, assignee, due date, stage, owner. |
| `TaskFormAction` | `components/processes/task-form-action.tsx` | Checklist de subtarefas com toggle, progress bar, badges de owner/tipo. |

**Páginas:**

| Rota | Ficheiro | Descrição |
|------|----------|-----------|
| `/dashboard/processos` | `app/dashboard/processos/page.tsx` | Lista de processos com tabs de status e search |
| `/dashboard/processos/[id]` | `app/dashboard/processos/[id]/page.tsx` | Detalhe do processo (review ou execução) |

---

## 10. Fluxos de Dados

### 10.1 Criar Template

```
UI (TemplateBuilder) → POST /api/templates
    ├── Validação Zod (templateSchema)
    ├── INSERT tpl_processes
    ├── INSERT tpl_stages (loop)
    ├── INSERT tpl_tasks (action_type = 'COMPOSITE')
    └── INSERT tpl_subtasks (config = { type, doc_type_id?, owner_scope?, ... })
```

### 10.2 Editar Template

```
UI (TemplateBuilder) → PUT /api/templates/[id]
    ├── Validação Zod
    ├── UPDATE tpl_processes (name, description)
    ├── Admin client:
    │   ├── Nullifica proc_instances.current_stage_id
    │   ├── Nullifica proc_tasks.tpl_task_id
    │   ├── DELETE tpl_subtasks → tpl_tasks → tpl_stages
    │   └── Re-INSERT toda a árvore
    └── Resposta 200
```

### 10.3 Aprovar Processo

```
UI (ProcessReviewSection) → POST /api/processes/[id]/approve
    ├── Verifica template activo + processo pending/returned
    ├── UPDATE proc_instances (status=active, tpl_process_id, approved_by)
    ├── RPC populate_process_tasks()
    │   ├── Copia tpl_tasks → proc_tasks
    │   └── Copia tpl_subtasks → proc_subtasks
    ├── autoCompleteTasks() → marca uploads com docs existentes
    ├── recalculateProgress() → calcula percent_complete
    ├── UPDATE dev_properties (status=in_process)
    └── Notificação ao criador
```

### 10.4 Alterar Template

```
UI (Dropdown "Alterar Template") → POST /api/processes/[id]/re-template
    ├── Verifica template activo + processo active/on_hold
    ├── DELETE proc_tasks (cascade → proc_subtasks)
    ├── UPDATE proc_instances (tpl_process_id, percent_complete=0)
    ├── RPC populate_process_tasks()
    ├── autoCompleteTasks()
    ├── recalculateProgress()
    └── Notificação ao criador
```

### 10.5 Executar Tarefa

```
UI (TaskDetailActions) → PUT /api/processes/[id]/tasks/[taskId]
    ├── { action: 'complete' }
    ├── UPDATE proc_tasks (status=completed, completed_at)
    ├── recalculateProgress()
    │   ├── Calcula percent_complete
    │   ├── Avança current_stage_id
    │   └── Se 100%: current_status=completed
    └── Notificações

UI (TaskFormAction) → PUT /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]
    ├── { is_completed: true/false }
    ├── UPDATE proc_subtasks
    ├── Recalcula status da tarefa pai:
    │   ├── Todas obrigatórias completas → completed
    │   ├── Algumas completas → in_progress
    │   └── Nenhuma → pending
    └── recalculateProgress()
```

### 10.6 Multiplicação por Proprietário

Quando uma subtarefa tem `owner_scope != 'none'`, a função `_populate_subtasks()` multiplica-a por proprietário:

```
Template:
  Subtarefa "Enviar email ao proprietário" (owner_scope: all_owners)

Imóvel com 2 proprietários (João Silva, Empresa ABC Lda):
  → proc_subtask 1: "Enviar email ao proprietário" (owner: João Silva, singular)
  → proc_subtask 2: "Enviar email ao proprietário" (owner: Empresa ABC Lda, coletiva)

Com person_type_filter = 'singular':
  → proc_subtask 1: "Enviar email ao proprietário" (owner: João Silva)
  → (Empresa ABC Lda filtrada)

Com has_person_type_variants = true:
  → proc_subtask 1 usa singular_config (ex: email template para pessoa singular)
  → proc_subtask 2 usa coletiva_config (ex: email template para empresa)
```

Na UI, cada subtarefa multiplicada mostra um **badge colorido** com o nome do proprietário:
- Singular: badge azul com ícone User
- Colectiva: badge roxo com ícone Building2
- Contacto principal: indicador adicional

---

## 11. Notas Técnicas

### Tabelas fora do `types/database.ts`

As tabelas `tpl_subtasks`, `proc_subtasks`, e algumas colunas de `proc_tasks` (como `owner_id`) foram adicionadas após a última geração de tipos. O acesso é feito via cast:

```typescript
const db = supabase as unknown as { from: typeof supabase.from }
db.from('tpl_subtasks').select('*')
```

### Validação de UUID

Usar regex em vez de `z.uuid()` porque alguns UUIDs gerados por triggers do PostgreSQL têm bits de versão zero:

```typescript
const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
z.string().regex(uuidRegex, 'UUID inválido')
```

### RLS e Admin Client

As operações de DELETE em tabelas de template (`tpl_stages`, `tpl_tasks`, `tpl_subtasks`) **requerem `createAdminClient()`** porque a RLS bloqueia silenciosamente os deletes sem retornar erro. A operação completa sem erro mas nenhum registo é apagado.

### Cascade Rules

- `tpl_subtasks.tpl_task_id` → `ON DELETE CASCADE` (apagar task apaga subtasks)
- `proc_subtasks.proc_task_id` → `ON DELETE CASCADE` (apagar task apaga subtasks)
- `proc_subtasks.owner_id` → `ON DELETE SET NULL`
- `proc_tasks.tpl_task_id` → sem cascade (deve ser nullificado manualmente antes de apagar `tpl_tasks`)
- `proc_instances.current_stage_id` → sem cascade (deve ser nullificado antes de apagar `tpl_stages`)

### Processos POST (não PUT)

Todas as acções de estado de processo (approve, reject, return, hold, cancel, re-template) usam **POST**, não PUT. Isto é intencional — cada acção é uma operação com efeitos secundários (notificações, triggers, etc.).

### Triggers existentes — NÃO recriar

- `trg_generate_proc_ref` — gera `PROC-YYYY-XXXX`
- `trg_generate_dev_property_slug` — gera slug do imóvel
- `trg_auto_complete_form_tasks_on_owner_update`
- `trg_auto_complete_tasks_on_doc_insert`
- `trg_auto_resolve_owner_id`
