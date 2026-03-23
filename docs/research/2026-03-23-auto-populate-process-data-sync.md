# PRD: Auto-Populate Process Data + Bidirectional Sync (Deals, Owners, Properties)

**Date**: 2026-03-23
**Git Commit**: `1147498`
**Branch**: `master`

---

## Problema

Quando um negócio (deal) ou angariação é submetido e gera um `proc_instances`, os dados do proprietário, imóvel e deal **já existem** nas tabelas de origem (`owners`, `dev_properties`, `deals`, `deal_clients`), mas:

1. **Não são automaticamente populados** nas tasks/subtasks do processo — o formulário externo (Imagem 02) mostra campos vazios ("—") quando os dados já existem no sistema.
2. **Alterações feitas dentro de tasks/subtasks do processo não sincronizam de volta** para as tabelas de origem (parcialmente implementado para `property`, `owner` — NÃO implementado para `deal`, `deal_client`, `deal_payment`).

---

## Objectivo

- **Auto-popular** dados de `owners`, `dev_properties`, `deals`, `deal_clients`, `deal_payments` nas subtasks de formulário ao criar o processo (ou ao aprovar com template).
- **Sincronização bidirecional**: alterações em form/field subtasks devem actualizar as tabelas de origem (`deals`, `deal_clients`, `deal_payments`, `owners`, `dev_properties`, etc.).

---

## Estado Actual do Código

### O que JÁ existe e funciona

#### 1. Form GET — Leitura de dados das entidades (PARCIAL)

**Ficheiro:** `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form/route.ts`

O GET já resolve valores de 5 entidades:

```typescript
// Linha 105-156 — switch/case por entity
switch (entity) {
  case 'property':        // ✅ dev_properties
  case 'property_specs':  // ✅ dev_property_specifications
  case 'property_internal': // ✅ dev_property_internal
  case 'owner':           // ✅ owners (via subtask.owner_id)
  case 'property_owner':  // ✅ property_owners junction
}
```

**FALTAM no GET:** `consultant`, `process`, `deal`, `deal_client`, `deal_payment`

Estes target_entities estão registados no `FormTargetEntity` type mas **não têm case no switch** do GET.

#### 2. Form PUT — Escrita de volta nas entidades (PARCIAL)

**Ficheiro:** `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form/route.ts`

O PUT já faz upsert em 5 entidades:

```typescript
// Linha 216-253 — upsert per entity
if (body.property) → UPDATE dev_properties        // ✅
if (body.property_specs) → UPSERT dev_property_specifications  // ✅
if (body.property_internal) → UPSERT dev_property_internal     // ✅
if (body.owner) → UPDATE owners                    // ✅
if (body.property_owner) → UPDATE property_owners  // ✅
```

**FALTAM no PUT:** `deal`, `deal_client`, `deal_payment`, `consultant`, `process`

#### 3. Field Registry — Campos disponíveis

**Ficheiro:** `lib/form-field-registry.ts`

O registry tem ~180+ campos registados, incluindo:

| Categoria | target_entity | Exemplos de campos | Status |
|---|---|---|---|
| Imóvel — Dados Gerais | `property` | title, listing_price, property_type | ✅ GET+PUT |
| Especificações | `property_specs` | typology, bedrooms, area_gross | ✅ GET+PUT |
| Contrato / Dados Internos | `property_internal` | commission_agreed, imi_value | ✅ GET+PUT |
| Proprietário | `owner` | name, email, nif, nationality | ✅ GET+PUT |
| Participação no Imóvel | `property_owner` | ownership_percentage, is_main_contact | ✅ GET+PUT |
| Consultor | `consultant` | commercial_name, professional_email | ❌ Só type |
| Processo | `process` | external_ref, current_status | ❌ Só type |
| Negócio — Identificação | `deal` | reference, deal_value, commission_* | ❌ Só type |
| Cliente do Negócio | `deal_client` | name, email, phone | ❌ Só type |
| Pagamento do Negócio | `deal_payment` | payment_moment, amount, is_signed | ❌ Só type |

#### 4. External Form Dialog — Exibição read-only

**Ficheiro:** `components/processes/external-form-dialog.tsx`

Resolve valores via `resolveValue()` que acede directamente aos objectos `property`, `owner`, `consultant`, `processInstance` que são passados como props. **NÃO acede a `deal`** — os dados de deal precisam ser passados como prop adicional ou resolvidos na query do processo.

#### 5. Process Detail GET — O que é carregado

**Ficheiro:** `app/api/processes/[id]/route.ts`

A query GET do processo carrega:

```
proc_instances → property (dev_properties + specs + internal + media + consultant)
             → owners (via property_owners, com roles)
             → documents (doc_registry)
             → stages + tasks + subtasks
```

**NÃO carrega:** `deals`, `deal_clients`, `deal_payments`

Apesar do `proc_instances` ter `negocio_id`, o GET não faz join com a tabela `deals`.

#### 6. Deal Submit — Criação do processo

**Ficheiro:** `app/api/deals/[id]/submit/route.ts`

```typescript
// Linha 40-55 — Cria proc_instances
const { data: proc } = await admin
  .from('proc_instances')
  .insert({
    property_id: deal.property_id,
    tpl_process_id: null,  // ← Template selecionado na aprovação
    current_status: 'pending_approval',
    process_type: 'negocio',
    requested_by: user.id,
    percent_complete: 0,
  })

// Depois liga ao deal via proc_instance_id
await admin.from('deals').update({ proc_instance_id: proc.id }).eq('id', dealId)
```

**Observação:** O `negocio_id` do `proc_instances` **não é preenchido** aqui. O link é feito pelo `deals.proc_instance_id` (inverso).

---

## Tabelas e Relações Relevantes

### Grafo de Dados

```
deals ─────────────────┐
  ├── deal_clients     │
  ├── deal_payments    │
  └── proc_instance_id ──→ proc_instances
                             ├── property_id ──→ dev_properties
                             │                    ├── dev_property_specifications (1:1)
                             │                    ├── dev_property_internal (1:1)
                             │                    └── property_owners (M:N) ──→ owners
                             ├── tpl_process_id ──→ tpl_processes
                             │                      └── tpl_stages → tpl_tasks → tpl_subtasks
                             ├── proc_tasks
                             │    └── proc_subtasks (config.target_entity → entidade de destino)
                             └── negocio_id ──→ negocios (legacy, ignorar)
```

### Schema das Tabelas de Deal

```sql
-- deals (nova tabela, renomeada de temp_deals em 2026-03-23)
deals (
  id UUID PK,
  property_id UUID FK → dev_properties,
  consultant_id UUID FK → dev_users,
  internal_colleague_id UUID FK → dev_users,
  proc_instance_id UUID FK → proc_instances,  -- ← link bidirecional
  created_by UUID FK → dev_users,
  status TEXT,  -- draft | submitted | active | completed | cancelled
  deal_type TEXT,  -- pleno | comprador_externo | pleno_agencia | angariacao_externa
  business_type TEXT,  -- venda | arrendamento | trespasse
  deal_value NUMERIC,
  deal_date DATE,
  commission_type TEXT,  -- percentage | fixed
  commission_pct NUMERIC,
  commission_total NUMERIC,
  has_share BOOLEAN,
  share_type TEXT,
  share_pct NUMERIC,
  share_amount NUMERIC,
  partner_agency_name TEXT,
  -- ... ~50 campos adicionais (ver types/deal.ts)
)

-- deal_clients
deal_clients (
  id UUID PK,
  deal_id UUID FK → deals,
  person_type TEXT,  -- singular | coletiva
  name TEXT,
  email TEXT,
  phone TEXT,
  order_index INT,
)

-- deal_payments
deal_payments (
  id UUID PK,
  deal_id UUID FK → deals,
  payment_moment TEXT,  -- cpcv | escritura | single
  payment_pct NUMERIC,
  amount NUMERIC,
  network_amount NUMERIC,
  agency_amount NUMERIC,
  consultant_amount NUMERIC,
  partner_amount NUMERIC,
  is_signed BOOLEAN,
  signed_date DATE,
  is_received BOOLEAN,
  received_date DATE,
  -- ... ~20 campos de facturação
)
```

---

## Padrões Existentes na Codebase

### Padrão 1: Form Subtask GET → Resolve valores por target_entity

```typescript
// app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form/route.ts:105-156
switch (entity) {
  case 'property': {
    const { data: row } = await admin
      .from('dev_properties')
      .select(fieldNames)
      .eq('id', propertyId)
      .single()
    data = row
    break
  }
  case 'owner': {
    if (subtask.owner_id) {
      const { data: row } = await admin
        .from('owners')
        .select(fieldNames)
        .eq('id', subtask.owner_id)
        .single()
      data = row
    }
    break
  }
  // ... etc
}

// Valores retornados com chave composta: entity__field_name
for (const f of entityFields) {
  const key = `${entity}__${f.field_name}`
  values[key] = data[f.field_name] ?? null
}
```

### Padrão 2: Form Subtask PUT → Upsert por target_entity

```typescript
// app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form/route.ts:216-253
if (body.property && Object.keys(body.property).length > 0) {
  const { error } = await admin
    .from('dev_properties')
    .update(body.property)
    .eq('id', propertyId)
}

if (body.owner && Object.keys(body.owner).length > 0 && ownerId) {
  const { error } = await admin
    .from('owners')
    .update(body.owner)
    .eq('id', ownerId)
}
```

### Padrão 3: External Form Dialog → resolveValue()

```typescript
// components/processes/external-form-dialog.tsx (resolveValue)
function resolveValue(field: ExternalFormField, property, owner, consultant, processInstance) {
  switch (field.target_entity) {
    case 'property': return property?.[field.field_name]
    case 'property_specs': return property?.dev_property_specifications?.[field.field_name]
    case 'property_internal': return property?.dev_property_internal?.[field.field_name]
    case 'owner': return owner?.[field.field_name]
    case 'consultant': return consultant?.[field.field_name]
    case 'process': return processInstance?.[field.field_name]
    // ❌ FALTA: deal, deal_client, deal_payment
  }
}
```

### Padrão 4: Process Instance GET → Carregamento de dados

```typescript
// app/api/processes/[id]/route.ts — query principal
const { data: instance } = await admin
  .from('proc_instances')
  .select(`
    *,
    dev_properties (
      *,
      dev_property_specifications (*),
      dev_property_internal (*),
      dev_property_media (*),
      consultant:dev_users!consultant_id (id, commercial_name, professional_email)
    ),
    tpl_processes (id, name),
    requested_by_user:dev_users!requested_by (id, commercial_name)
  `)
  .eq('id', processId)
  .single()

// Owners carregados separadamente
const { data: owners } = await admin
  .from('property_owners')
  .select(`
    *,
    owners (*),
    owner_role_types (*)
  `)
  .eq('property_id', instance.property_id)
```

### Padrão 5: Populate Process Tasks (Trigger Existente)

```typescript
// A função populate_process_tasks() é chamada após aprovação
// app/api/processes/[id]/approve/route.ts
await admin
  .from('proc_instances')
  .update({
    tpl_process_id: tplProcessId,
    current_status: 'active',
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  })
  .eq('id', processId)

// O trigger trg_populate_tasks copia:
// tpl_tasks → proc_tasks
// tpl_subtasks → proc_subtasks
// com owner_id, config, etc.
```

---

## Padrões Externos Documentados

### Padrão A: PostgreSQL Trigger com `pg_trigger_depth()` (Anti-Loop)

Para sincronização bidirecional sem loops infinitos:

```sql
-- Recomendado: usar WHEN clause para evitar chamada da função
CREATE TRIGGER trg_sync_task_to_entity
AFTER UPDATE ON proc_subtasks
FOR EACH ROW
WHEN (pg_trigger_depth() = 0)  -- ← Só executa na chamada original, não recursiva
EXECUTE FUNCTION sync_subtask_to_entity();
```

**Fontes:**
- [Supabase Docs — Triggers](https://supabase.com/docs/guides/database/postgres/triggers)
- [CYBERTEC — Trigger Recursion](https://www.cybertec-postgresql.com/en/dealing-with-trigger-recursion-in-postgresql/)
- [pgPedia — pg_trigger_depth()](https://pgpedia.info/p/pg_trigger_depth.html)

### Padrão B: Trigger AFTER UPDATE para sync de task_result

```sql
CREATE OR REPLACE FUNCTION sync_task_result_to_entity()
RETURNS TRIGGER AS $$
DECLARE
  v_property_id UUID;
  v_result JSONB;
BEGIN
  -- Só sincroniza quando tarefa é concluída e tem resultado
  IF NEW.status = 'completed' AND NEW.task_result IS NOT NULL
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    SELECT property_id INTO v_property_id
    FROM proc_instances
    WHERE id = NEW.proc_instance_id;

    v_result := NEW.task_result;

    -- Sync campos específicos
    IF v_result ? 'listing_price' THEN
      UPDATE dev_properties
      SET listing_price = (v_result->>'listing_price')::numeric
      WHERE id = v_property_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Fonte:** [Neon — AFTER INSERT Trigger](https://neon.com/postgresql/postgresql-triggers/postgresql-after-insert-trigger)

### Padrão C: Lógica no Application Layer (Recomendado para este projecto)

Dado que o projecto **já usa o padrão de PUT por entity** no form/route.ts, a abordagem mais consistente é **estender o PUT existente** em vez de criar triggers SQL novos:

```
Utilizador preenche form → Dynamic Form Renderer → PUT /form
  → body: { deal: { deal_value: 500000 }, deal_client: { name: "João" } }
  → Server faz UPDATE deals SET deal_value = 500000 WHERE id = dealId
  → Server faz UPDATE deal_clients SET name = 'João' WHERE id = clientId
```

**Vantagens:**
- Consistência com o padrão existente (property, owner já funcionam assim)
- Sem triggers SQL adicionais (menos complexidade)
- Log de auditoria centralizado no API route
- Validação Zod no server

---

## Ficheiros Relevantes da Codebase

### API Routes (a modificar)

| Ficheiro | O que fazer |
|---|---|
| `app/api/processes/[id]/route.ts` | Adicionar join com `deals` (via `proc_instance_id`) no GET |
| `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form/route.ts` | Adicionar cases `deal`, `deal_client`, `deal_payment` no GET switch + PUT upsert |
| `app/api/deals/[id]/submit/route.ts` | Preencher `negocio_id` no proc_instances (se coluna existir) |

### Componentes (a modificar)

| Ficheiro | O que fazer |
|---|---|
| `components/processes/external-form-dialog.tsx` | Adicionar `deal` prop + resolver valores de deal/deal_client/deal_payment |
| `components/processes/dynamic-form-renderer.tsx` | Já funciona genéricamente — sem alteração necessária |
| `app/dashboard/processos/[id]/page.tsx` | Passar dados de deal ao ExternalFormDialog |

### Types e Validação

| Ficheiro | Status |
|---|---|
| `types/subtask.ts` — FormTargetEntity | ✅ Já inclui `deal`, `deal_client`, `deal_payment` |
| `types/deal.ts` — Deal, DealClient, DealPayment | ✅ Já existe |
| `lib/form-field-registry.ts` | ✅ Já tem ~115 campos de deal registados |
| `lib/validations/template.ts` | ✅ Já valida `deal`, `deal_client`, `deal_payment` no enum |

### Ficheiros de Referência (não modificar, só consultar)

| Ficheiro | Porquê consultar |
|---|---|
| `app/api/processes/[id]/approve/route.ts` | Entender o fluxo de aprovação (onde popular dados) |
| `app/api/processes/[id]/owners/populate-tasks/route.ts` | Padrão de criação de tasks/subtasks por owner |
| `lib/process-engine.ts` | `recalculateProgress()`, `autoCompleteTasks()` |
| `components/processes/form-subtask-dialog.tsx` | Como o form dialog carrega e submete dados |
| `components/processes/field-subtask-inline.tsx` | Como campos individuais são editados inline |

---

## Resumo das Lacunas a Preencher

### Lacuna 1: Form GET não resolve `deal`, `deal_client`, `deal_payment`

O switch/case na linha 105 do `form/route.ts` precisa de 3 novos cases:

```typescript
case 'deal': {
  // Buscar deal_id via proc_instances.id → deals.proc_instance_id
  const { data: deal } = await admin
    .from('deals')
    .select(fieldNames)
    .eq('proc_instance_id', processId)
    .single()
  data = deal
  break
}
case 'deal_client': {
  // Buscar primeiro cliente (ou por index se subtask tiver config)
  const { data: client } = await admin
    .from('deal_clients')
    .select(fieldNames)
    .eq('deal_id', dealId)
    .order('order_index')
    .limit(1)
    .single()
  data = client
  break
}
case 'deal_payment': {
  // Similar pattern
}
```

### Lacuna 2: Form PUT não escreve em `deal`, `deal_client`, `deal_payment`

Adicionar 3 blocos de upsert seguindo o padrão existente:

```typescript
if (body.deal && Object.keys(body.deal).length > 0 && dealId) {
  const { error } = await admin
    .from('deals')
    .update(body.deal)
    .eq('id', dealId)
  if (error) errors.push(`deal: ${error.message}`)
}
```

### Lacuna 3: Process GET não carrega dados de deal

O `app/api/processes/[id]/route.ts` precisa buscar o deal vinculado:

```typescript
// Buscar deal vinculado ao processo
const { data: deal } = await admin
  .from('deals')
  .select('*, deal_clients(*), deal_payments(*)')
  .eq('proc_instance_id', processId)
  .maybeSingle()
```

### Lacuna 4: External Form Dialog não recebe/resolve dados de deal

O componente precisa receber `deal` como prop e resolver no `resolveValue()`:

```typescript
case 'deal': return deal?.[field.field_name]
case 'deal_client': return deal?.clients?.[0]?.[field.field_name]
case 'deal_payment': return deal?.payments?.[0]?.[field.field_name]
```

### Lacuna 5: Auto-populate de dados ao aprovar processo

Quando o processo é aprovado e as subtasks de external_form são criadas, os campos devem **já ter valores** resolvidos. Actualmente o external_form resolve valores em runtime (no GET/Dialog), o que é o comportamento correcto — **não precisa de trigger SQL para isto**.

O que precisa é que o GET do form route e o resolveValue do dialog tenham os cases de deal implementados (Lacunas 1 e 4).

---

## Decisão Arquitectural: Trigger SQL vs Application Layer

| Critério | DB Trigger | Application Layer (PUT route) |
|---|---|---|
| Consistência com codebase | ❌ Novo padrão | ✅ Padrão existente |
| Complexidade | Alta (PL/pgSQL, anti-loop) | Baixa (TypeScript, já testado) |
| Validação | Limitada | Zod completa |
| Auditoria | Precisa de log manual | Já integrada no route |
| Manutenção | Mais difícil (SQL) | Mais fácil (TypeScript) |
| Performance | Melhor (in-DB) | Aceitável (1 request) |

**Recomendação:** Estender o application layer existente (form/route.ts PUT) para suportar `deal`, `deal_client`, `deal_payment`. NÃO criar triggers SQL novos para sincronização bidirecional — o padrão já está estabelecido e funciona.

O único trigger SQL que **poderia** fazer sentido seria um trigger na tabela `deals` que preenche `proc_instances.negocio_id` automaticamente quando `deals.proc_instance_id` é definido (ou vice-versa). Mas isto também pode ser feito no submit/route.ts.

---

## Referências Externas

| Recurso | URL | Relevância |
|---|---|---|
| Supabase Triggers | https://supabase.com/docs/guides/database/postgres/triggers | Padrão de triggers |
| PostgreSQL Trigger Functions | https://www.postgresql.org/docs/current/plpgsql-trigger.html | Referência PL/pgSQL |
| Trigger Recursion Prevention | https://www.cybertec-postgresql.com/en/dealing-with-trigger-recursion-in-postgresql/ | Anti-loop patterns |
| pg_trigger_depth() | https://pgpedia.info/p/pg_trigger_depth.html | Função anti-recursão |
| Supabase DB vs Edge Functions | https://www.closefuture.io/blogs/supabase-database-vs-edge-functions | Decisão de camada |
| Workflow Patterns (Vertabelo) | https://vertabelo.com/blog/the-workflow-pattern-part-1/ | Entity state management |
| DBOS Workflow as Postgres Rows | https://www.dbos.dev/blog/why-workflows-should-be-postgres-rows | Workflow engine patterns |
