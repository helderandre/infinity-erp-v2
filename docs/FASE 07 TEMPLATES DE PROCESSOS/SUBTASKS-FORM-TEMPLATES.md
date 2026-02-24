# SPEC — Subtarefas, Tarefas FORM e Edição de Templates

**Data:** 2026-02-23
**Tipo:** Nova Funcionalidade
**Prioridade:** Alta
**Dependências:** M06 (Processos), M07 (Templates)

---

## 1. O Que Foi Implementado no Back-End

### 1.1 Novas Tabelas

#### `tpl_subtasks` — Subtarefas de template

```sql
CREATE TABLE tpl_subtasks (
  id uuid PRIMARY KEY,
  tpl_task_id uuid NOT NULL REFERENCES tpl_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_mandatory boolean DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  config jsonb DEFAULT '{}'
  -- config: { "check_type": "field"|"document"|"manual", "field_name": "...", "doc_type_id": "..." }
);
```

#### `proc_subtasks` — Subtarefas instanciadas

```sql
CREATE TABLE proc_subtasks (
  id uuid PRIMARY KEY,
  proc_task_id uuid NOT NULL REFERENCES proc_tasks(id) ON DELETE CASCADE,
  tpl_subtask_id uuid REFERENCES tpl_subtasks(id),
  title text NOT NULL,
  is_mandatory boolean DEFAULT true,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES dev_users(id),
  order_index integer NOT NULL DEFAULT 0,
  config jsonb DEFAULT '{}'
);
```

### 1.2 Novo action_type: `FORM`

Além de `UPLOAD`, `MANUAL` e `EMAIL`, existe agora `FORM`. Uma tarefa FORM representa "completar os dados de um proprietário" e tem subtarefas que funcionam como checklist.

**Tipos de subtarefa (via `config.check_type`):**

| check_type | Descrição | Auto-complete |
|------------|-----------|---------------|
| `field` | Campo da tabela `owners` (ex: `birth_date`, `nif`) | ✅ Trigger no UPDATE de `owners` verifica se campo está preenchido |
| `document` | Documento em `doc_registry` (ex: CC, Branqueamento) | ✅ Trigger verifica se doc existe para aquele `owner_id` |
| `manual` | Verificação manual pela equipa | ❌ Requer tick manual |

### 1.3 Triggers Activas

| Trigger | Tabela | Quando | O que faz |
|---------|--------|--------|-----------|
| `trg_auto_complete_form_tasks_on_owner_update` | `owners` | AFTER UPDATE | Para cada tarefa FORM pendente do owner, verifica subtarefas `field` e `document`. Se todas obrigatórias completas → tarefa = `completed`. Se algumas completas → tarefa = `in_progress`. |
| `trg_auto_complete_tasks_on_doc_insert` | `doc_registry` | AFTER INSERT | Completa tarefas UPLOAD + actualiza subtarefas `document` das tarefas FORM |
| `trg_auto_resolve_owner_id` | `doc_registry` | BEFORE INSERT | Preenche `owner_id` se doc de proprietário sem owner_id |

### 1.4 Template "Captação da Angariação" — Novas Tarefas

**Fase "Identificação Proprietários"** (singular):

| # | Tarefa existente | Tipo | owner_type |
|---|-----------------|------|------------|
| 0 | Doc Identificação (CC) | UPLOAD | singular |
| 1 | Verificar morada | MANUAL | — |
| 2 | Verificar nacionalidade | MANUAL | — |
| 3 | Comprovativo Estado Civil | UPLOAD | singular |
| 4 | Ficha Branqueamento | UPLOAD | singular |
| **10** | **Completar dados do proprietário** | **FORM** ⭐ | **singular** |

→ 18 subtarefas: 15 campos KYC + 3 docs

**Fase "Identificação Empresa"** (coletiva):

| # | Tarefa existente | Tipo | owner_type |
|---|-----------------|------|------------|
| 0-4 | (uploads empresa existentes) | UPLOAD | coletiva |
| **10** | **Completar dados da empresa** | **FORM** ⭐ | **coletiva** |

→ 16 subtarefas: 11 campos empresariais + 5 docs

### 1.5 Como a Instanciação Funciona

A function `populate_process_tasks` agora:

1. Cria tarefas normais (UPLOAD, MANUAL, EMAIL) como antes
2. **Tarefas com `owner_type`** → multiplica por proprietário (como antes)
3. **Tarefas FORM** → multiplica por proprietário + **copia subtarefas** de `tpl_subtasks` para `proc_subtasks`
4. Título inclui nome do proprietário: "Completar dados do proprietário — João Silva"

**Exemplo com 2 proprietários (João singular + Empresa XPTO coletiva):**

```
Fase "Identificação Proprietários":
  - Doc Identificação (CC) — João Silva         [UPLOAD]
  - Comprovativo Estado Civil — João Silva       [UPLOAD]
  - Ficha Branqueamento — João Silva             [UPLOAD]
  - Completar dados do proprietário — João Silva [FORM] → 18 subtarefas

Fase "Identificação Empresa":
  - Certidão Permanente — Empresa XPTO           [UPLOAD]
  - Pacto Social — Empresa XPTO                  [UPLOAD]
  - Ata poderes venda — Empresa XPTO             [UPLOAD]
  - RCBE — Empresa XPTO                          [UPLOAD]
  - Ficha Branqueamento Emp. — Empresa XPTO      [UPLOAD]
  - Completar dados da empresa — Empresa XPTO    [FORM] → 16 subtarefas
```

---

## 2. O Que o Frontend Precisa Implementar

### 2.1 Renderizar Tarefas FORM na UI de Processos

**Ficheiro:** `components/processes/process-tasks-section.tsx`

A tarefa FORM deve renderizar de forma diferente das UPLOAD e MANUAL:

- Mostrar uma **barra de progresso** com base nas subtarefas (ex: "8/16 completas")
- Mostrar a **lista de subtarefas** como checklist expandível
- Cada subtarefa mostra: título, estado (✅/⬜), se é obrigatória
- As subtarefas `field` e `document` com auto-complete mostram badge "Auto"
- As subtarefas `manual` têm checkbox interactivo

**Query para buscar subtarefas:**

```typescript
const { data: subtasks } = await supabase
  .from('proc_subtasks')
  .select('*')
  .eq('proc_task_id', taskId)
  .order('order_index')
```

### 2.2 API para Toggle de Subtarefa Manual

**Novo endpoint:** `PUT /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]`

```typescript
// Body:
{ "is_completed": true }

// Lógica:
// 1. Actualizar proc_subtasks.is_completed e completed_at
// 2. Verificar se todas as subtarefas obrigatórias estão completas
// 3. Se sim → proc_tasks.status = 'completed'
// 4. Se não mas tem progresso → proc_tasks.status = 'in_progress'
// 5. Recalcular progresso do processo
```

### 2.3 API para Buscar Processo com Subtarefas

**Modificar:** `GET /api/processes/[id]`

Ao retornar as `proc_tasks`, incluir as subtarefas:

```typescript
const { data: tasks } = await supabase
  .from('proc_tasks')
  .select(`
    *,
    owner:owners(id, name, person_type),
    subtasks:proc_subtasks(
      id, title, is_mandatory, is_completed, 
      completed_at, order_index, config
    )
  `)
  .eq('proc_instance_id', processId)
  .order('stage_order_index')
  .order('order_index')
```

### 2.4 Componente Sugerido: `TaskFormAction`

**Novo ficheiro:** `components/processes/task-form-action.tsx`

```tsx
interface TaskFormActionProps {
  task: ProcessTask & { subtasks: ProcSubtask[] }
  processId: string
  onSubtaskToggle: (subtaskId: string, completed: boolean) => void
}
```

**Estrutura visual sugerida:**

```
┌─────────────────────────────────────────────────────┐
│ 📋 Completar dados do proprietário — João Silva      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 44%             │
│ 8 de 18 items completos                              │
│                                                      │
│ ▼ Dados Pessoais (campos KYC)                        │
│   ✅ Nome completo              [Auto]               │
│   ✅ NIF                        [Auto]               │
│   ✅ Data de nascimento          [Auto]               │
│   ⬜ Tipo de documento           [Pendente]           │
│   ⬜ Número do documento         [Pendente]           │
│   ...                                                │
│                                                      │
│ ▼ Documentação                                       │
│   ✅ Cartão de Cidadão           [Auto] 📎           │
│   ⬜ Ficha de Branqueamento      [Pendente]           │
│   ○ Comprovativo Estado Civil    [Opcional]           │
│                                                      │
│ [Abrir ficha do proprietário ↗]                      │
└─────────────────────────────────────────────────────┘
```

Notas visuais:
- Subtarefas auto-completadas (field/document): mostrar badge "Auto" e não permitir toggle manual
- Subtarefas manuais: checkbox interactivo
- Subtarefas document: se não completada, pode mostrar botão de upload inline
- Botão "Abrir ficha do proprietário" → navega para `/dashboard/proprietarios/[ownerId]` ou abre modal de edição

### 2.5 Edição de Templates — Suporte a Subtarefas

**Ficheiro:** componente de edição de templates (ex: `components/templates/template-editor.tsx`)

A UI de edição de templates deve permitir:

1. **Criar tarefa FORM** — ao seleccionar action_type `FORM`, mostrar:
   - Select de `owner_type` (`singular` / `coletiva`)
   - Select de `form_type` (`kyc_singular` / `kyc_coletiva` / `custom`)
   
2. **Gerir subtarefas** — dentro de cada tarefa (não apenas FORM, qualquer tipo pode ter subtarefas):
   - Lista de subtarefas com drag-and-drop para reordenar
   - Botão "Adicionar subtarefa"
   - Cada subtarefa: título, obrigatória (toggle), check_type (select), campo/doc_type

3. **Subtarefas por check_type:**

| check_type | Campos no formulário de edição |
|------------|-------------------------------|
| `field` | Título + Select de `field_name` (lista de colunas da tabela `owners`) |
| `document` | Título + Select de `doc_type_id` (lista de doc_types filtrada por categoria) |
| `manual` | Título apenas |

**Lista de field_names disponíveis para `check_type: field`:**

Pessoa Singular:
```
name, nif, email, phone, birth_date, nationality, naturality,
id_doc_type, id_doc_number, id_doc_expiry, id_doc_issued_by,
address, postal_code, city, marital_status, marital_regime,
profession, last_profession, is_portugal_resident, residence_country,
is_pep, pep_position, funds_origin
```

Pessoa Colectiva:
```
name, nif, email, phone, address,
legal_representative_name, legal_representative_nif, legal_rep_id_doc,
company_object, company_branches, legal_nature,
country_of_incorporation, cae_code, rcbe_code
```

**API necessária para subtarefas de template:**

```
GET  /api/templates/[id]/tasks/[taskId]/subtasks     → lista subtarefas
POST /api/templates/[id]/tasks/[taskId]/subtasks     → criar subtarefa
PUT  /api/templates/[id]/tasks/[taskId]/subtasks/[id] → editar subtarefa
DELETE /api/templates/[id]/tasks/[taskId]/subtasks/[id] → apagar
PUT  /api/templates/[id]/tasks/[taskId]/subtasks/reorder → reordenar
```

---

## 3. Types TypeScript a Adicionar/Actualizar

### Novo: `types/subtask.ts`

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
    field_name?: string      // para check_type = 'field'
    doc_type_id?: string     // para check_type = 'document'
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

### Actualizar: `types/process.ts`

```typescript
export interface ProcessTask {
  // ... campos existentes ...
  action_type: 'UPLOAD' | 'MANUAL' | 'EMAIL' | 'FORM'  // ← FORM adicionado
  owner_id: string | null
  owner?: { id: string; name: string; person_type: 'singular' | 'coletiva' }
  subtasks?: ProcSubtask[]  // ← novo
}
```

---

## 4. Constantes Sugeridas

### `lib/constants.ts`

```typescript
export const ACTION_TYPE_LABELS: Record<string, string> = {
  UPLOAD: 'Carregar Documento',
  MANUAL: 'Verificação Manual',
  EMAIL: 'Enviar Email',
  FORM: 'Preencher Formulário',
}

export const ACTION_TYPE_ICONS: Record<string, string> = {
  UPLOAD: 'Upload',       // lucide: Upload
  MANUAL: 'CheckSquare',  // lucide: CheckSquare
  EMAIL: 'Mail',           // lucide: Mail
  FORM: 'ClipboardList',  // lucide: ClipboardList
}

export const CHECK_TYPE_LABELS: Record<string, string> = {
  field: 'Campo do proprietário',
  document: 'Documento',
  manual: 'Verificação manual',
}

// Campos KYC por tipo de proprietário (para select no editor de templates)
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
]

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
]
```

---

## 5. Mapa de Ficheiros

### Ficheiros a CRIAR

| # | Ficheiro | Função |
|---|----------|--------|
| 1 | `components/processes/task-form-action.tsx` | Renderizar tarefa FORM com checklist de subtarefas |
| 2 | `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts` | PUT toggle subtarefa manual |
| 3 | `app/api/templates/[id]/tasks/[taskId]/subtasks/route.ts` | CRUD subtarefas de template |
| 4 | `components/templates/subtask-editor.tsx` | Editor de subtarefas no editor de templates |
| 5 | `types/subtask.ts` | Types de TplSubtask e ProcSubtask |

### Ficheiros a MODIFICAR

| # | Ficheiro | Modificação |
|---|----------|-------------|
| 1 | `components/processes/process-tasks-section.tsx` | Renderizar FORM com `TaskFormAction`, incluir subtasks no fetch |
| 2 | `app/api/processes/[id]/route.ts` | JOIN de `proc_subtasks` na query de tarefas |
| 3 | `components/templates/template-editor.tsx` | Suporte a action_type FORM + gestão de subtarefas |
| 4 | `lib/constants.ts` | ACTION_TYPE_LABELS, OWNER_FIELDS_*, CHECK_TYPE_LABELS |
| 5 | `types/process.ts` | Adicionar `FORM` ao action_type + `subtasks` array |

---

## 6. Fluxo de Auto-Complete (Resumo Visual)

```
Gestora preenche dados do proprietário (PUT /api/owners/[id])
  │
  ├─ Trigger AFTER UPDATE em owners
  │   │
  │   ├─ Busca proc_tasks FORM do owner_id com status pending/in_progress
  │   │
  │   ├─ Para cada subtarefa check_type = 'field':
  │   │   └─ Verifica se owners.{field_name} está preenchido → is_completed
  │   │
  │   ├─ Para cada subtarefa check_type = 'document':
  │   │   └─ Verifica se doc_registry tem doc do owner → is_completed
  │   │
  │   ├─ Se TODAS obrigatórias completas → tarefa = 'completed'
  │   │   Se ALGUMAS completas → tarefa = 'in_progress'
  │   │
  │   └─ Recalcula percent_complete do processo
  │
  └─ UI actualiza ao fazer refetch do processo
```

```
Gestora faz upload de documento do proprietário
  │
  ├─ INSERT doc_registry (trigger auto_resolve preenche owner_id)
  │
  ├─ Trigger AFTER INSERT em doc_registry
  │   ├─ Completa tarefas UPLOAD correspondentes
  │   └─ (subtarefas 'document' das tarefas FORM serão actualizadas
  │       no próximo UPDATE do owner, ou podem ser verificadas
  │       via lógica adicional no frontend/API)
  │
  └─ Recalcula progresso
```

---

## 7. Dados de Teste Actuais

O processo `136c9f10` (Thaylane, singular) foi repopulado com:
- 24 tarefas no total (incluindo a nova FORM)
- 1 tarefa FORM com 18 subtarefas
- 8 subtarefas já auto-completadas (name, nif, birth_date, nationality, address, is_portugal_resident, is_pep, funds_origin + CC upload)
- Tarefa FORM em status `in_progress`

---

## 8. Notas Importantes

1. **Subtarefas são genéricas** — qualquer tarefa (não só FORM) pode ter subtarefas. Isto permite no futuro adicionar checklists a tarefas MANUAL ou UPLOAD.

2. **A trigger de auto-complete em owners usa SQL dinâmico** (`EXECUTE format(...)`) para verificar campos. Isto funciona bem para os campos simples. Para campos array (`funds_origin`), verifica se o array não está vazio.

3. **Campos booleanos** (`is_pep`, `is_portugal_resident`): são considerados "preenchidos" quando não são NULL. `false` é um valor válido.

4. **Subtarefas de document na tarefa FORM vs tarefas UPLOAD separadas**: As subtarefas `document` dentro da tarefa FORM servem como **indicador visual** de que o documento existe. As tarefas UPLOAD separadas são as que realmente exigem o upload. Ambas são auto-completadas pelas mesmas triggers.

5. **Edição de templates**: Quando o utilizador adiciona ou remove subtarefas no template, os processos **já instanciados** não são afectados (as proc_subtasks já foram copiadas). Apenas novos processos terão as subtarefas actualizadas.
