# PRD — Subtarefas Condicionais por Tipo de Proprietário

**Data:** 2026-02-27
**Autor:** Claude Code (pesquisa + arquitectura)
**Módulo:** Templates de Processo + Instâncias de Processo

---

## 1. Contexto e Problema

### 1.1 Situação Actual

O sistema de templates de processo já suporta **multiplicação de tarefas por proprietário** ao nível de `tpl_tasks`. A função `populate_process_tasks()` no Supabase verifica `config->>'owner_type'` e, quando preenchido, cria uma `proc_task` para cada proprietário cujo `person_type` corresponda.

**Limitações actuais:**

| Limitação | Impacto |
|-----------|---------|
| A multiplicação opera ao nível da **tarefa** (`tpl_tasks`), não da **subtarefa** (`tpl_subtasks`) | Não é possível ter uma tarefa com subtarefas que variam por tipo de proprietário |
| Não existe distinção singular/colectiva ao nível das subtarefas | Emails e documentos diferentes para pessoa singular vs colectiva não são suportados |
| Não existe filtro "apenas contacto principal" | Tarefas que deveriam ir só ao contacto principal vão a todos |
| A multiplicação actual usa `owner_type` fixo (`'singular'` OU `'coletiva'`) | Não há opção "todos os proprietários independentemente do tipo" |
| As subtarefas são copiadas literalmente para `proc_subtasks` sem transformação | Não há fan-out de subtarefas por proprietário |

### 1.2 O que se Pretende

Ao criar um template de processo, o utilizador deve poder configurar cada **subtarefa** com:

1. **Multiplicar por proprietário** — Toggle que indica se a subtarefa deve ser replicada para cada proprietário do imóvel
2. **Filtro por tipo de pessoa** — Se multiplicada, se aplica a todos, apenas singulares, ou apenas colectivos
3. **Apenas contacto principal** — Se multiplicada, se aplica apenas ao proprietário marcado como contacto principal
4. **Configuração diferenciada por tipo** — Para emails e documentos, permitir seleccionar templates diferentes para singular e colectiva (ex: email A para singular, email B para colectiva)

**Exemplo concreto:**
> "Enviar email de pedido de documentação" — multiplicar por cada proprietário.
> Se singular → usar template de email "Pedido Docs Singular".
> Se colectiva → usar template de email "Pedido Docs Empresa".

---

## 2. Pesquisa — Estado Actual do Código

### 2.1 Função `populate_process_tasks()` (Supabase RPC)

Existem **duas versões** da função:

1. **Trigger version** (dispara em INSERT no `proc_instances`) — versão legacy
2. **RPC version** `populate_process_tasks(p_instance_id uuid)` — chamada explicitamente na aprovação

A **versão RPC** (a que é usada) faz:

```
Para cada tpl_task do template:
  Se config->>'owner_type' IS NOT NULL:
    Para cada owner do imóvel com person_type = owner_type:
      INSERT proc_task com título "Tarefa — NomeOwner", owner_id = owner.id
      Se tem tpl_subtasks → copia literal para proc_subtasks
  Senão:
    INSERT proc_task normal (sem owner_id)
    Se tem tpl_subtasks → copia literal para proc_subtasks
```

**Problema chave:** As subtarefas são sempre copiadas literalmente — sem nenhuma transformação condicional.

### 2.2 Schema Actual das Tabelas

#### `tpl_subtasks`
| Coluna | Tipo | Nota |
|--------|------|------|
| id | uuid | PK |
| tpl_task_id | uuid | FK → tpl_tasks |
| title | text | NOT NULL |
| description | text | |
| is_mandatory | boolean | default true |
| order_index | integer | NOT NULL |
| config | jsonb | default '{}' |
| created_at | timestamptz | |

#### `proc_subtasks`
| Coluna | Tipo | Nota |
|--------|------|------|
| id | uuid | PK |
| proc_task_id | uuid | FK → proc_tasks |
| tpl_subtask_id | uuid | FK → tpl_subtasks |
| title | text | NOT NULL |
| is_mandatory | boolean | default true |
| is_completed | boolean | default false |
| completed_at | timestamptz | |
| completed_by | uuid | |
| order_index | integer | NOT NULL |
| config | jsonb | default '{}' |
| created_at | timestamptz | |

**Nota:** `proc_subtasks` **NÃO tem** `owner_id` — não há como saber a que proprietário pertence uma subtarefa instanciada.

#### `proc_tasks`
| Coluna | Tipo | Nota |
|--------|------|------|
| id | uuid | PK |
| proc_instance_id | uuid | FK |
| tpl_task_id | uuid | FK |
| title | text | |
| status | text | default 'pending' |
| action_type | text | |
| config | jsonb | default '{}' |
| owner_id | uuid | **Já existe** — FK → owners |
| priority | text | default 'normal' |
| ... | ... | (outros campos) |

#### `tpl_tasks`
| Coluna | Tipo | Nota |
|--------|------|------|
| id | uuid | PK |
| tpl_stage_id | uuid | FK |
| title | text | |
| action_type | text | |
| config | jsonb | Contém `owner_type` para multiplicação |
| priority | text | default 'normal' |
| assigned_role | text | |
| sla_days | integer | |
| ... | ... | |

### 2.3 TypeScript Types Actuais

```typescript
// types/subtask.ts
export interface SubtaskData {
  id: string
  title: string
  description?: string
  is_mandatory: boolean
  order_index: number
  type: SubtaskType  // 'upload' | 'checklist' | 'email' | 'generate_doc'
  config: {
    doc_type_id?: string
    email_library_id?: string
    doc_library_id?: string
  }
}
```

### 2.4 Template Builder UI Actual

- [subtask-editor.tsx](../components/templates/subtask-editor.tsx) — Editor de subtarefas com DnD (384 linhas)
- [template-task-sheet.tsx](../components/templates/template-task-sheet.tsx) — Sheet lateral para editar tarefa + subtarefas (223 linhas)
- [template-builder.tsx](../components/templates/template-builder.tsx) — Builder principal com fases e tarefas (652 linhas)

O `SortableSubtaskRow` actual renderiza:
1. Badge de tipo + Input de título
2. Select condicional por tipo (doc_type, email_template, doc_template)
3. Switch obrigatória + botão eliminar

**Não existe nenhum toggle de multiplicação ou condição por tipo de pessoa ao nível da subtarefa.**

### 2.5 Ficheiros que Serão Afectados

| Ficheiro | Tipo de Alteração |
|----------|-------------------|
| `components/templates/subtask-editor.tsx` | **UI** — Adicionar toggles de multiplicação e condição |
| `components/templates/template-task-sheet.tsx` | **UI** — Pode precisar de ajuste de layout |
| `types/subtask.ts` | **Types** — Extender `SubtaskData` e `TplSubtask` com campos de condição |
| `lib/validations/template.ts` | **Validação** — Extender `subtaskSchema` com campos novos |
| `lib/constants.ts` | **Constantes** — Labels PT-PT para os novos campos |
| `app/api/templates/route.ts` | **API** — Garantir passthrough dos novos campos no config |
| `app/api/templates/[id]/route.ts` | **API** — Idem para edição |
| `app/api/processes/[id]/approve/route.ts` | **API** — Nenhuma alteração necessária (chama RPC) |
| `lib/process-engine.ts` | **Engine** — `autoCompleteTasks` pode precisar de ajuste para subtarefas com owner |
| `components/processes/process-tasks-section.tsx` | **UI** — Mostrar owner associado à subtarefa |
| `components/processes/task-detail-actions.tsx` | **UI** — Completar subtarefa com contexto de owner |
| **Supabase** — Função `populate_process_tasks()` | **SQL** — Lógica de fan-out de subtarefas |
| **Supabase** — Migração `proc_subtasks` | **SQL** — Adicionar `owner_id` |

---

## 3. Pesquisa — Padrões da Indústria

### 3.1 BPMN Multi-Instance Activity

O padrão canónico em BPM para "uma tarefa por participante" é o **Multi-Instance Activity**. Funciona como um `forEach` no motor de processos.

**Camunda 8 (Zeebe):**
```xml
<bpmn:userTask id="UploadDocs" name="Upload Documentos">
  <bpmn:multiInstanceLoopCharacteristics isSequential="false">
    <zeebe:loopCharacteristics
      inputCollection="= owners"
      inputElement="owner"
      outputCollection="results"
      outputElement="= result" />
  </bpmn:multiInstanceLoopCharacteristics>
</bpmn:userTask>
```

**Propriedades-chave:**
- `inputCollection` — array de entidades (ex: `owners`)
- `inputElement` — variável local em cada instância (ex: `owner`)
- `isSequential="false"` — todas as instâncias correm em paralelo
- Cada instância recebe `loopCounter` (posição 1-indexed)

**Fonte:** [Camunda 8 Multi-instance Docs](https://docs.camunda.io/docs/components/modeler/bpmn/multi-instance/)

### 3.2 Exclusive Gateway (XOR) para Condição por Tipo

Para `singular` vs `coletiva`, o padrão BPMN é o **Exclusive Gateway**:

```
[Gateway: Tipo Owner?]
  ├── person_type == 'singular' → [Upload CC/BI]
  └── person_type == 'coletiva' → [Upload Certidão Comercial]
  → [Merge] → [Continuar]
```

**Fonte:** [Camunda Exclusive Gateway](https://docs.camunda.io/docs/components/modeler/bpmn/exclusive-gateways/)

### 3.3 Workflow Pattern WCP-14 — Multiple Instances with a priori Run-Time Knowledge

Este padrão formal descreve exactamente o nosso caso: no momento do design (template) não sabemos quantos proprietários existirão, mas no momento da execução (aprovação) o número é conhecido.

**Fonte:** [Workflow Patterns WCP-14](http://www.workflowpatterns.com/patterns/control/multiple_instance/wcp14.php)

### 3.4 Fan-Out/Fan-In em Workflow Engines

**Temporal (TypeScript):**
```typescript
const owners = await getPropertyOwners(propertyId)
const tasks = owners.map(owner =>
  executeChild('ownerDocumentWorkflow', {
    args: [{ propertyId, owner }],
    workflowId: `owner-docs-${propertyId}-${owner.id}`,
  })
)
await Promise.all(tasks)
```

**Dapr Workflows:**
```typescript
for (const owner of owners) {
  tasks.push(ctx.callActivity(createOwnerDocumentTask, {
    ownerId: owner.id,
    requiredDocs: owner.person_type === 'singular'
      ? SINGULAR_DOCS : COLETIVA_DOCS,
  }))
}
const results = yield ctx.whenAll(tasks)
```

**Fontes:**
- [Temporal Fan-out Patterns](https://community.temporal.io/t/long-running-workflow-with-significant-fan-out-of-child-workflows/17975)
- [Dapr Workflow Fan-out/Fan-in](https://docs.dapr.io/developing-applications/building-blocks/workflow/workflow-patterns/)

### 3.5 n8n — Split/Loop

n8n usa um nó "Split Out" que converte 1 item com array em N itens separados. O insight relevante: **separar a decisão de split (configuração) da acção por item (nós subsequentes)**. No nosso caso, `tpl_subtasks.config` codifica tanto a decisão de split (`multiplied_by`) quanto a acção por tipo (`doc_type_id` por `person_type`).

**Fonte:** [n8n Splitting with Conditionals](https://docs.n8n.io/flow-logic/splitting/)

### 3.6 JSON Schema Conditional Validation

O padrão `if/then/else` do JSON Schema Draft 7+ é aplicável à validação do `config`:

```json
{
  "if": { "properties": { "type": { "const": "upload" } } },
  "then": { "required": ["doc_type_id"] }
}
```

Em Zod, isto traduz-se em `.refine()` com verificação condicional — exactamente o que já usamos.

**Fonte:** [JSON Schema Conditionals](https://json-schema.org/understanding-json-schema/reference/conditionals)

### 3.7 React Hook Form — Conditional Fields com `watch()`

O padrão para renderizar campos condicionais sem `useEffect`:

```tsx
const multipliedBy = watch('config.multiplied_by')
return (
  <>
    <Switch checked={multipliedBy === 'owners'} ... />
    {multipliedBy === 'owners' && (
      <Select {...register('config.person_type_filter')} />
    )}
  </>
)
```

**Fonte:** [Conditionally Render Fields (echobind.com)](https://echobind.com/post/conditionally-render-fields-using-react-hook-form)

### 3.8 Veeva Vault — Participant Groups

Veeva Vault (pharma document management) usa "participant groups" onde tarefas de workflow são atribuídas a grupos dinâmicos que se expandem por entidade em runtime. O template referencia `owners` (o grupo) e em runtime resolve os proprietários reais.

**Fonte:** [Veeva Vault Workflow Configuration](https://platform.veevavault.help/en/gr/50498/)

---

## 4. Arquitectura Proposta

### 4.1 Modelo Conceptual

A multiplicação e condição devem operar ao nível da **subtarefa** (não da tarefa), porque:

1. Uma tarefa como "Documentação do Proprietário" pode ter subtarefas que variam por tipo
2. Manter a tarefa como container e multiplicar subtarefas dá melhor UX no stepper
3. Evita duplicação desnecessária de tarefas inteiras quando só uma subtarefa varia

**Porém**, o sistema actual já multiplica **tarefas** por owner via `config.owner_type` em `tpl_tasks`. Esta funcionalidade deve ser preservada e estendida.

### 4.2 Dois Níveis de Multiplicação

| Nível | Onde Configura | Efeito em Runtime |
|-------|----------------|-------------------|
| **Tarefa** (`tpl_tasks.config`) | Já existe — `owner_type` | Cria N `proc_tasks`, uma por owner matching |
| **Subtarefa** (`tpl_subtasks.config`) | **NOVO** — `owner_scope` + `person_type_filter` | Cria N `proc_subtasks` dentro de cada `proc_task` |

### 4.3 Novos Campos no `config` de `tpl_subtasks`

```typescript
interface SubtaskConfig {
  // --- Campos existentes ---
  type?: SubtaskType
  doc_type_id?: string
  email_library_id?: string
  doc_library_id?: string

  // --- NOVOS: Multiplicação por proprietário ---
  owner_scope?: 'none' | 'all_owners' | 'main_contact_only'
  // 'none' (default) → subtarefa normal, sem multiplicação
  // 'all_owners' → uma instância por cada proprietário
  // 'main_contact_only' → apenas para o contacto principal

  // --- NOVO: Filtro por tipo de pessoa ---
  person_type_filter?: 'all' | 'singular' | 'coletiva'
  // Só relevante quando owner_scope !== 'none'
  // 'all' (default) → aplica a todos os proprietários
  // 'singular' → apenas proprietários pessoa singular
  // 'coletiva' → apenas proprietários pessoa colectiva

  // --- NOVO: Configuração diferenciada por tipo de pessoa ---
  has_person_type_variants?: boolean
  // Quando true, permite configurar valores diferentes para singular e colectiva

  // Variantes para pessoa singular (quando has_person_type_variants = true)
  singular_config?: {
    doc_type_id?: string
    email_library_id?: string
    doc_library_id?: string
  }
  // Variantes para pessoa colectiva (quando has_person_type_variants = true)
  coletiva_config?: {
    doc_type_id?: string
    email_library_id?: string
    doc_library_id?: string
  }
}
```

### 4.4 Exemplos de Configuração

**Exemplo 1:** Upload de CC — para cada proprietário singular
```json
{
  "type": "upload",
  "doc_type_id": "uuid-cartao-cidadao",
  "owner_scope": "all_owners",
  "person_type_filter": "singular"
}
```

**Exemplo 2:** Upload de Certidão Permanente — para cada proprietário colectivo
```json
{
  "type": "upload",
  "doc_type_id": "uuid-certidao-permanente",
  "owner_scope": "all_owners",
  "person_type_filter": "coletiva"
}
```

**Exemplo 3:** Email diferente por tipo — para todos os proprietários
```json
{
  "type": "email",
  "owner_scope": "all_owners",
  "person_type_filter": "all",
  "has_person_type_variants": true,
  "singular_config": {
    "email_library_id": "uuid-email-singular"
  },
  "coletiva_config": {
    "email_library_id": "uuid-email-empresa"
  }
}
```

**Exemplo 4:** Checklist apenas para contacto principal
```json
{
  "type": "checklist",
  "owner_scope": "main_contact_only",
  "person_type_filter": "all"
}
```

**Exemplo 5:** Subtarefa normal (sem multiplicação)
```json
{
  "type": "upload",
  "doc_type_id": "uuid-caderneta-predial"
}
```
*(Sem `owner_scope` → comportamento actual mantido)*

### 4.5 Migração SQL — `proc_subtasks`

```sql
ALTER TABLE proc_subtasks
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES owners(id) NULL;

CREATE INDEX IF NOT EXISTS idx_proc_subtasks_owner_id
  ON proc_subtasks(owner_id);

COMMENT ON COLUMN proc_subtasks.owner_id IS
  'Proprietário associado (quando subtarefa é multiplicada por owner)';
```

### 4.6 Lógica de População — Extensão do `populate_process_tasks()`

A lógica de cópia de subtarefas no RPC actual:

```sql
-- ACTUAL (cópia literal):
INSERT INTO proc_subtasks (proc_task_id, tpl_subtask_id, title, is_mandatory, order_index, config)
SELECT v_new_task_id, st.id, st.title, st.is_mandatory, st.order_index, st.config
FROM tpl_subtasks st
WHERE st.tpl_task_id = v_task.tpl_task_id
ORDER BY st.order_index;
```

**Deve ser substituída por lógica condicional:**

```sql
-- NOVA LÓGICA (pseudocódigo):
FOR v_subtask IN (SELECT * FROM tpl_subtasks WHERE tpl_task_id = v_task.tpl_task_id ORDER BY order_index)
LOOP
  v_owner_scope := v_subtask.config->>'owner_scope';
  v_person_filter := COALESCE(v_subtask.config->>'person_type_filter', 'all');
  v_has_variants := COALESCE((v_subtask.config->>'has_person_type_variants')::boolean, false);

  IF v_owner_scope IS NOT NULL AND v_owner_scope != 'none' THEN
    -- Fan-out: uma proc_subtask por proprietário matching
    FOR v_owner IN (
      SELECT po.owner_id, o.name, o.person_type, po.is_main_contact
      FROM property_owners po
      JOIN owners o ON o.id = po.owner_id
      WHERE po.property_id = v_property_id
        AND (v_person_filter = 'all' OR o.person_type = v_person_filter)
        AND (v_owner_scope != 'main_contact_only' OR po.is_main_contact = true)
      ORDER BY po.is_main_contact DESC, o.name
    )
    LOOP
      -- Resolver config (se tem variantes por tipo)
      v_resolved_config := v_subtask.config;
      IF v_has_variants THEN
        IF v_owner.person_type = 'singular' AND v_subtask.config ? 'singular_config' THEN
          v_resolved_config := v_subtask.config || (v_subtask.config->'singular_config');
        ELSIF v_owner.person_type = 'coletiva' AND v_subtask.config ? 'coletiva_config' THEN
          v_resolved_config := v_subtask.config || (v_subtask.config->'coletiva_config');
        END IF;
      END IF;

      INSERT INTO proc_subtasks (
        proc_task_id, tpl_subtask_id, title, is_mandatory, order_index, config, owner_id
      ) VALUES (
        v_new_task_id,
        v_subtask.id,
        v_subtask.title || ' — ' || v_owner.name,
        v_subtask.is_mandatory,
        v_subtask.order_index * 100 + v_loop_idx,
        v_resolved_config || jsonb_build_object('owner_id', v_owner.owner_id, 'owner_person_type', v_owner.person_type),
        v_owner.owner_id
      );
    END LOOP;
  ELSE
    -- Subtarefa normal (sem fan-out)
    INSERT INTO proc_subtasks (
      proc_task_id, tpl_subtask_id, title, is_mandatory, order_index, config
    ) VALUES (
      v_new_task_id, v_subtask.id, v_subtask.title, v_subtask.is_mandatory, v_subtask.order_index, v_subtask.config
    );
  END IF;
END LOOP;
```

### 4.7 Interacção com Multiplicação de Tarefas

Quando uma **tarefa** (`tpl_tasks`) tem `config.owner_type` E as suas **subtarefas** têm `owner_scope`:

**Cenário:** Tarefa com `owner_type: 'singular'` → já cria 1 `proc_task` por owner singular.
Subtarefa dentro dessa tarefa com `owner_scope: 'all_owners'`:

**Regra:** Se a tarefa-pai já está associada a um owner específico (via `owner_type`), as subtarefas com `owner_scope` devem operar **apenas sobre esse owner** (não re-multiplicar). Ou seja, o `owner_id` da `proc_task` já define o contexto.

**Algoritmo:**
```
Se proc_task.owner_id IS NOT NULL:
  → subtarefas com owner_scope herdam o owner_id da tarefa-pai
  → person_type_filter e has_person_type_variants avaliam contra o owner da tarefa
Se proc_task.owner_id IS NULL:
  → subtarefas com owner_scope fazem fan-out sobre todos os owners do imóvel
```

---

## 5. Design da UI — Template Builder

### 5.1 Alterações no `SortableSubtaskRow`

Após a secção de configuração por tipo (doc_type select, email select, etc.), adicionar uma **secção colapsável** de configuração de proprietário:

```
┌─────────────────────────────────────────────────────┐
│ [≡] [Upload] [Certidão Cidadão____________________] │
│                                                     │
│     [Tipo Documento: Cartão de Cidadão       ▾ ]    │
│                                                     │
│  ─ ─ ─ Proprietário ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                     │
│     [⚬] Repetir por proprietário                    │
│                                                     │
│     ┌ Quando activo: ─────────────────────────────┐ │
│     │ Aplicar a: [Todos os proprietários     ▾ ]  │ │
│     │ [⚬] Apenas contacto principal               │ │
│     │                                             │ │
│     │ [⚬] Config diferente por tipo de pessoa     │ │
│     │                                             │ │
│     │ ┌ Quando activo: ────────────────────────┐  │ │
│     │ │ Singular: [Cartão de Cidadão       ▾ ] │  │ │
│     │ │ Colectiva: [Cert. Permanente       ▾ ] │  │ │
│     │ └────────────────────────────────────────┘  │ │
│     └─────────────────────────────────────────────┘ │
│                                                     │
│                              [Obrig.] [🗑]          │
└─────────────────────────────────────────────────────┘
```

### 5.2 Lógica dos Toggles

```
1. Toggle "Repetir por proprietário" (owner_scope)
   ├── OFF → owner_scope = 'none' (ou undefined)
   └── ON →
       ├── Select "Aplicar a" (person_type_filter)
       │   ├── "Todos os proprietários" → 'all'
       │   ├── "Apenas Singulares" → 'singular'
       │   └── "Apenas Colectivos" → 'coletiva'
       │
       ├── Toggle "Apenas contacto principal"
       │   ├── OFF → owner_scope = 'all_owners'
       │   └── ON → owner_scope = 'main_contact_only'
       │
       └── Toggle "Config diferente por tipo de pessoa" (has_person_type_variants)
           ├── OFF → usa a configuração base (doc_type_id, email_library_id, etc.)
           └── ON → mostra dois selects:
               ├── "Para Pessoa Singular" → singular_config.{doc_type_id|email_library_id|doc_library_id}
               └── "Para Pessoa Colectiva" → coletiva_config.{doc_type_id|email_library_id|doc_library_id}
```

**Nota:** Quando `has_person_type_variants = true`, o select "base" (fora das variantes) é escondido — os selects dentro das variantes substituem-no.

### 5.3 Indicadores Visuais

Subtarefas com multiplicação activa devem ter **badges visuais**:

```tsx
{subtask.config.owner_scope && subtask.config.owner_scope !== 'none' && (
  <div className="flex gap-1">
    <Badge variant="outline" className="text-[10px] h-5 bg-blue-50 text-blue-700">
      <Users className="h-3 w-3 mr-1" />
      {subtask.config.owner_scope === 'main_contact_only' ? 'Principal' : 'Por Proprietário'}
    </Badge>
    {subtask.config.person_type_filter && subtask.config.person_type_filter !== 'all' && (
      <Badge variant="outline" className="text-[10px] h-5">
        {subtask.config.person_type_filter === 'singular' ? 'Singular' : 'Colectiva'}
      </Badge>
    )}
    {subtask.config.has_person_type_variants && (
      <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-700">
        S/C
      </Badge>
    )}
  </div>
)}
```

---

## 6. Design da UI — Processo Instanciado

### 6.1 Subtarefas com Owner na Vista de Processo

Nas `proc_subtasks` instanciadas que têm `owner_id`, mostrar o nome e tipo do proprietário:

```
┌─ Tarefa: Documentação dos Proprietários ─────────┐
│                                                   │
│  ☐ Upload CC — João Silva          [Singular] 👤 │
│  ☐ Upload CC — Maria Santos        [Singular] 👤 │
│  ☐ Upload Cert. Perm. — Empresa X  [Colectiva] 🏢│
│  ☑ Validar NIF (normal)                          │
│                                                   │
└───────────────────────────────────────────────────┘
```

### 6.2 Auto-Complete de Subtarefas com Owner

O `autoCompleteTasks` em [process-engine.ts](../lib/process-engine.ts) opera ao nível de `proc_tasks`. Para subtarefas com `owner_id`, deve verificar se o owner já tem o documento requerido:

```typescript
// Extensão futura (não obrigatória para MVP):
// Verificar doc_registry por owner_id + doc_type_id para auto-completar proc_subtasks
```

---

## 7. Alterações TypeScript

### 7.1 `types/subtask.ts` — Extensão

```typescript
export type OwnerScope = 'none' | 'all_owners' | 'main_contact_only'
export type PersonTypeFilter = 'all' | 'singular' | 'coletiva'

export interface SubtaskOwnerConfig {
  owner_scope?: OwnerScope
  person_type_filter?: PersonTypeFilter
  has_person_type_variants?: boolean
  singular_config?: {
    doc_type_id?: string
    email_library_id?: string
    doc_library_id?: string
  }
  coletiva_config?: {
    doc_type_id?: string
    email_library_id?: string
    doc_library_id?: string
  }
}

export interface SubtaskData {
  id: string
  title: string
  description?: string
  is_mandatory: boolean
  order_index: number
  type: SubtaskType
  config: {
    doc_type_id?: string
    email_library_id?: string
    doc_library_id?: string
  } & SubtaskOwnerConfig
}

export interface ProcSubtask {
  // ... campos existentes ...
  owner_id?: string | null  // NOVO
  owner?: {                 // NOVO (join)
    id: string
    name: string
    person_type: 'singular' | 'coletiva'
  } | null
}
```

### 7.2 `lib/validations/template.ts` — Extensão

```typescript
export const subtaskSchema = z
  .object({
    title: z.string().min(1, 'O título é obrigatório'),
    description: z.string().optional(),
    is_mandatory: z.boolean().default(true),
    order_index: z.number().int().min(0),
    type: z.enum(['upload', 'checklist', 'email', 'generate_doc']),
    config: z.object({
      doc_type_id: z.string().optional(),
      email_library_id: z.string().optional(),
      doc_library_id: z.string().optional(),
      // NOVOS campos
      owner_scope: z.enum(['none', 'all_owners', 'main_contact_only']).optional(),
      person_type_filter: z.enum(['all', 'singular', 'coletiva']).optional(),
      has_person_type_variants: z.boolean().optional(),
      singular_config: z.object({
        doc_type_id: z.string().optional(),
        email_library_id: z.string().optional(),
        doc_library_id: z.string().optional(),
      }).optional(),
      coletiva_config: z.object({
        doc_type_id: z.string().optional(),
        email_library_id: z.string().optional(),
        doc_library_id: z.string().optional(),
      }).optional(),
    }).default({}),
  })
  .refine(/* ... validações existentes + novas ... */)
```

### 7.3 `lib/constants.ts` — Labels PT-PT

```typescript
export const OWNER_SCOPE_LABELS: Record<string, string> = {
  none: 'Sem multiplicação',
  all_owners: 'Todos os proprietários',
  main_contact_only: 'Apenas contacto principal',
}

export const PERSON_TYPE_FILTER_LABELS: Record<string, string> = {
  all: 'Todos os tipos',
  singular: 'Apenas Pessoa Singular',
  coletiva: 'Apenas Pessoa Colectiva',
}
```

---

## 8. Plano de Implementação

### Fase 1 — Base de Dados (Supabase)

1. **Migração:** Adicionar `owner_id` a `proc_subtasks`
2. **Actualizar `populate_process_tasks()`:** Nova lógica de fan-out de subtarefas
3. **Testar:** Com templates existentes (retrocompatibilidade)

### Fase 2 — Types e Validações (TypeScript)

1. Extender `types/subtask.ts`
2. Extender `lib/validations/template.ts`
3. Adicionar constantes PT-PT

### Fase 3 — Template Builder UI

1. Adicionar toggles no `SortableSubtaskRow` (subtask-editor.tsx)
2. Adicionar badges visuais de multiplicação
3. Lógica de selects condicionais (singular/coletiva configs)
4. Testar criação e edição de templates

### Fase 4 — APIs

1. Garantir passthrough dos novos campos em POST/PUT `/api/templates`
2. Garantir que GET retorna os novos campos no config

### Fase 5 — UI de Processo Instanciado

1. Mostrar `owner` associado em `proc_subtasks`
2. Ícone e badge por tipo (User/Building2)
3. Ajustar task-detail-actions para contexto de owner

### Fase 6 — Testes e QA

1. Testar com 0 owners, 1 owner singular, 1 colectivo, mix
2. Testar contacto principal only
3. Testar variantes singular/colectiva
4. Testar re-aprovação (limpeza + repopulação)
5. Testar retrocompatibilidade com templates existentes

---

## 9. Considerações de Retrocompatibilidade

| Cenário | Comportamento |
|---------|---------------|
| Templates existentes sem novos campos | `owner_scope` = undefined → tratado como `'none'` → subtarefas copiadas literalmente (comportamento actual) |
| `proc_subtasks` existentes sem `owner_id` | NULL → sem associação a proprietário (como antes) |
| Tarefa com `owner_type` + subtarefas sem `owner_scope` | Subtarefas copiadas para cada `proc_task` duplicada (comportamento actual mantido) |
| Tarefa com `owner_type` + subtarefas com `owner_scope` | Subtarefas herdam o owner da `proc_task` pai (sem re-multiplicação) |

---

## 10. Fontes e Referências

| Recurso | URL |
|---------|-----|
| Camunda 8 Multi-instance | https://docs.camunda.io/docs/components/modeler/bpmn/multi-instance/ |
| Camunda Exclusive Gateway | https://docs.camunda.io/docs/components/modeler/bpmn/exclusive-gateways/ |
| Workflow Pattern WCP-14 | http://www.workflowpatterns.com/patterns/control/multiple_instance/wcp14.php |
| SpiffWorkflow Multi-instance | https://spiff-arena.readthedocs.io/en/latest/reference/bpmn/multiinstance_tasks.html |
| Temporal Fan-out Patterns | https://community.temporal.io/t/long-running-workflow-with-significant-fan-out-of-child-workflows/17975 |
| Dapr Workflow Fan-out/Fan-in | https://docs.dapr.io/developing-applications/building-blocks/workflow/workflow-patterns/ |
| n8n Splitting with Conditionals | https://docs.n8n.io/flow-logic/splitting/ |
| JSON Schema Conditionals | https://json-schema.org/understanding-json-schema/reference/conditionals |
| PostgreSQL JSONB Documentation | https://www.postgresql.org/docs/current/datatype-json.html |
| React Hook Form Conditional Fields | https://echobind.com/post/conditionally-render-fields-using-react-hook-form |
| Veeva Vault Workflow Config | https://platform.veevavault.help/en/gr/50498/ |
| Red Hat PAM Dynamic Tasks | https://docs.redhat.com/en/documentation/red_hat_process_automation_manager/7.0/html/designing_and_building_cases_for_case_management/case-management-adding-dynamic-tasks-using-api-proc |

---

## Apêndice A — Função SQL Actual `populate_process_tasks()`

```sql
CREATE OR REPLACE FUNCTION public.populate_process_tasks(p_instance_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_tpl_process_id uuid;
  v_property_id uuid;
  v_task RECORD;
  v_owner RECORD;
  v_owner_type text;
  v_new_task_id uuid;
BEGIN
  SELECT tpl_process_id, property_id
  INTO v_tpl_process_id, v_property_id
  FROM proc_instances WHERE id = p_instance_id;

  IF v_tpl_process_id IS NULL THEN
    RAISE EXCEPTION 'Instância % não encontrada ou sem template', p_instance_id;
  END IF;

  FOR v_task IN
    SELECT
      t.id AS tpl_task_id, t.title, t.action_type, t.config,
      t.is_mandatory, t.assigned_role, t.sla_days, t.priority,
      t.order_index AS task_order,
      s.name AS stage_name, s.order_index AS stage_order,
      t.config->>'owner_type' AS owner_type,
      EXISTS(SELECT 1 FROM tpl_subtasks st WHERE st.tpl_task_id = t.id) AS has_subtasks
    FROM tpl_tasks t
    JOIN tpl_stages s ON t.tpl_stage_id = s.id
    WHERE s.tpl_process_id = v_tpl_process_id
    ORDER BY s.order_index, t.order_index
  LOOP
    v_owner_type := v_task.owner_type;

    IF v_owner_type IS NOT NULL AND v_property_id IS NOT NULL THEN
      FOR v_owner IN
        SELECT po.owner_id, o.name AS owner_name, o.person_type
        FROM property_owners po
        JOIN owners o ON o.id = po.owner_id
        WHERE po.property_id = v_property_id
          AND o.person_type = v_owner_type
        ORDER BY po.is_main_contact DESC, o.name
      LOOP
        INSERT INTO proc_tasks (...) VALUES (...)
        RETURNING id INTO v_new_task_id;

        IF v_task.has_subtasks THEN
          -- CÓPIA LITERAL (sem condições):
          INSERT INTO proc_subtasks (proc_task_id, tpl_subtask_id, title, is_mandatory, order_index, config)
          SELECT v_new_task_id, st.id, st.title, st.is_mandatory, st.order_index, st.config
          FROM tpl_subtasks st
          WHERE st.tpl_task_id = v_task.tpl_task_id
          ORDER BY st.order_index;
        END IF;
      END LOOP;
    ELSE
      INSERT INTO proc_tasks (...) VALUES (...)
      RETURNING id INTO v_new_task_id;

      IF v_task.has_subtasks THEN
        -- CÓPIA LITERAL (sem condições):
        INSERT INTO proc_subtasks (proc_task_id, tpl_subtask_id, title, is_mandatory, order_index, config)
        SELECT v_new_task_id, st.id, st.title, st.is_mandatory, st.order_index, st.config
        FROM tpl_subtasks st
        WHERE st.tpl_task_id = v_task.tpl_task_id
        ORDER BY st.order_index;
      END IF;
    END IF;
  END LOOP;
END;
$function$;
```

---

## Apêndice B — Cenários de Teste

### B.1 Cenário: Imóvel com 2 owners singulares + 1 colectivo

Template subtarefa: `owner_scope: 'all_owners', person_type_filter: 'all'`
**Resultado esperado:** 3 proc_subtasks (uma por owner)

### B.2 Cenário: Apenas singulares

Template subtarefa: `owner_scope: 'all_owners', person_type_filter: 'singular'`
**Resultado esperado:** 2 proc_subtasks (apenas os singulares)

### B.3 Cenário: Apenas contacto principal

Template subtarefa: `owner_scope: 'main_contact_only', person_type_filter: 'all'`
**Resultado esperado:** 1 proc_subtask (o contacto principal)

### B.4 Cenário: Config diferenciada por tipo

Template subtarefa: `owner_scope: 'all_owners', has_person_type_variants: true`
- singular_config: `{ email_library_id: 'email-singular-uuid' }`
- coletiva_config: `{ email_library_id: 'email-empresa-uuid' }`

**Resultado esperado:**
- Owner singular → proc_subtask com config contendo email_library_id do singular
- Owner colectivo → proc_subtask com config contendo email_library_id do colectiva

### B.5 Cenário: Tarefa com owner_type + subtarefa com owner_scope

Tarefa: `config.owner_type: 'singular'` (já cria proc_task por singular)
Subtarefa: `owner_scope: 'all_owners'` (não re-multiplicar)

**Resultado esperado:** Cada proc_task (por singular) tem 1 proc_subtask com o owner_id herdado da proc_task pai.

### B.6 Cenário: Template existente sem novos campos

**Resultado esperado:** Comportamento idêntico ao actual. Sem regressão.
