# Spec: Auto-Populate Process Data + Deal Sync Bidirecional

**Data:** 2026-03-23
**PRD:** `docs/research/2026-03-23-auto-populate-process-data-sync.md`
**Abordagem:** Application Layer (estender form/route.ts PUT/GET existente)

---

## Resumo

Quando um processo é criado a partir de um deal, os campos de `deal`, `deal_clients` e `deal_payments` devem ser automaticamente resolvidos nos formulários de subtask (form e field). Alterações nesses formulários devem sincronizar de volta para as tabelas de origem. Actualmente só `property`, `property_specs`, `property_internal`, `owner` e `property_owner` são suportados.

---

## Ficheiros a Modificar

### 1. `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form/route.ts`

**O que fazer:**

#### GET — Adicionar 5 novos cases no switch (~linha 105)

Antes do switch, resolver o `dealId` a partir do `processId`:

```typescript
// Resolver dealId a partir do proc_instance_id
let dealId: string | null = null
const { data: dealRow } = await admin
  .from('deals')
  .select('id')
  .eq('proc_instance_id', processId)
  .maybeSingle()
dealId = dealRow?.id ?? null
```

Adicionar os seguintes cases no switch:

```typescript
case 'deal': {
  if (dealId) {
    const { data: row } = await admin
      .from('deals')
      .select(fieldNames)
      .eq('id', dealId)
      .single()
    data = row
  }
  break
}

case 'deal_client': {
  if (dealId) {
    // Se subtask tiver client_index no config, usar esse index
    // Senão, usar order_index = 0 (primeiro cliente)
    const clientIndex = subtask.config?.client_index ?? 0
    const { data: row } = await admin
      .from('deal_clients')
      .select(fieldNames)
      .eq('deal_id', dealId)
      .order('order_index')
      .range(clientIndex, clientIndex)
      .maybeSingle()
    data = row
  }
  break
}

case 'deal_payment': {
  if (dealId) {
    // Se subtask tiver payment_moment no config, filtrar por momento
    // Senão, usar primeiro pagamento
    const paymentMoment = subtask.config?.payment_moment
    let query = admin
      .from('deal_payments')
      .select(fieldNames)
      .eq('deal_id', dealId)
    if (paymentMoment) {
      query = query.eq('payment_moment', paymentMoment)
    }
    const { data: row } = await query.limit(1).maybeSingle()
    data = row
  }
  break
}

case 'consultant': {
  if (propertyId) {
    // Consultor vem do dev_properties.consultant_id → dev_users + dev_consultant_profiles
    const { data: prop } = await admin
      .from('dev_properties')
      .select('consultant_id')
      .eq('id', propertyId)
      .single()
    if (prop?.consultant_id) {
      const { data: row } = await admin
        .from('dev_users')
        .select(`${fieldNames}, dev_consultant_profiles(*)`)
        .eq('id', prop.consultant_id)
        .single()
      // Flatten: juntar campos de dev_users + dev_consultant_profiles
      data = row ? { ...row, ...(row.dev_consultant_profiles ?? {}) } : null
    }
  }
  break
}

case 'process': {
  const { data: row } = await admin
    .from('proc_instances')
    .select(fieldNames)
    .eq('id', processId)
    .single()
  data = row
  break
}
```

#### PUT — Adicionar 3 novos blocos de upsert (~linha 253)

```typescript
if (body.deal && Object.keys(body.deal).length > 0 && dealId) {
  const { error } = await admin
    .from('deals')
    .update(body.deal)
    .eq('id', dealId)
  if (error) errors.push(`deal: ${error.message}`)
}

if (body.deal_client && Object.keys(body.deal_client).length > 0 && dealId) {
  const clientIndex = subtask.config?.client_index ?? 0
  // Buscar o ID do cliente pelo index
  const { data: clientRow } = await admin
    .from('deal_clients')
    .select('id')
    .eq('deal_id', dealId)
    .order('order_index')
    .range(clientIndex, clientIndex)
    .maybeSingle()
  if (clientRow?.id) {
    const { error } = await admin
      .from('deal_clients')
      .update(body.deal_client)
      .eq('id', clientRow.id)
    if (error) errors.push(`deal_client: ${error.message}`)
  }
}

if (body.deal_payment && Object.keys(body.deal_payment).length > 0 && dealId) {
  const paymentMoment = subtask.config?.payment_moment
  let query = admin
    .from('deal_payments')
    .select('id')
    .eq('deal_id', dealId)
  if (paymentMoment) {
    query = query.eq('payment_moment', paymentMoment)
  }
  const { data: paymentRow } = await query.limit(1).maybeSingle()
  if (paymentRow?.id) {
    const { error } = await admin
      .from('deal_payments')
      .update(body.deal_payment)
      .eq('id', paymentRow.id)
    if (error) errors.push(`deal_payment: ${error.message}`)
  }
}
```

**Nota:** `consultant` e `process` são read-only — não adicionar PUT para eles.

---

### 2. `app/api/processes/[id]/route.ts`

**O que fazer:** Adicionar carregamento do deal vinculado ao processo no GET.

Após o carregamento de owners (~linha 398), adicionar:

```typescript
// Buscar deal vinculado ao processo
let deal = null
const { data: dealData } = await supabase
  .from('deals')
  .select('*, deal_clients(*), deal_payments(*)')
  .eq('proc_instance_id', processId)
  .maybeSingle()
deal = dealData
```

Incluir `deal` no objecto de resposta (~linha 490):

```typescript
const response = {
  instance: data,
  stages: [...],
  owners: [...],
  documents: [...],
  deal,  // ← NOVO
}
```

---

### 3. `components/processes/external-form-dialog.tsx`

**O que fazer:** Adicionar prop `deal` e resolver valores de deal/deal_client/deal_payment no `resolveValue()`.

#### Props — Adicionar `deal` (~linha 23)

```typescript
interface ExternalFormDialogProps {
  // ... props existentes
  deal?: Deal & { deal_clients?: DealClient[]; deal_payments?: DealPayment[] } | null
}
```

#### resolveValue() — Adicionar 3 cases (~linha 57)

```typescript
case 'deal':
  return deal?.[field.field_name as keyof Deal] ?? null

case 'deal_client':
  // Usar primeiro cliente (ou config.client_index se disponível)
  return deal?.deal_clients?.[0]?.[field.field_name as keyof DealClient] ?? null

case 'deal_payment': {
  // Se field tiver payment_moment no config, filtrar
  const moment = field.config?.payment_moment
  const payment = moment
    ? deal?.deal_payments?.find(p => p.payment_moment === moment)
    : deal?.deal_payments?.[0]
  return payment?.[field.field_name as keyof DealPayment] ?? null
}
```

#### Import types

```typescript
import type { Deal, DealClient, DealPayment } from '@/types/deal'
```

---

### 4. `components/processes/subtask-card-list.tsx`

**O que fazer:** Passar a prop `deal` ao `ExternalFormDialog`.

No JSX onde `ExternalFormDialog` é renderizado (~linha 441):

```tsx
<ExternalFormDialog
  // ... props existentes
  deal={deal}  // ← NOVO — vem das props do componente pai
/>
```

Também adicionar `deal` às props deste componente (recebe do page).

---

### 5. `app/dashboard/processos/[id]/page.tsx`

**O que fazer:** Passar `deal` do response da API para os componentes filhos.

O page faz fetch de `/api/processes/[id]` e recebe `{ instance, stages, owners, documents }`. Agora também recebe `deal`.

```typescript
const { instance, stages, owners, documents, deal } = await res.json()
```

Passar `deal` para o componente que renderiza as subtasks (provavelmente `SubtaskCardList` ou similar):

```tsx
<SubtaskCardList
  // ... props existentes
  deal={deal}
/>
```

---

### 6. `components/processes/form-subtask-dialog.tsx`

**O que fazer:** Nenhuma alteração necessária.

Este componente é genérico — faz `GET /form` e `PUT /form` usando a form API route. Uma vez que a route suporte deal/deal_client/deal_payment (Ficheiro 1), o dialog funciona automaticamente.

O `context` prop (linha 174) já passa `propertyId` — **não precisa de dealId** porque o form route resolve o dealId internamente via `proc_instance_id`.

---

### 7. `components/processes/field-subtask-inline.tsx`

**O que fazer:** Nenhuma alteração necessária.

Mesmo raciocínio que o form-subtask-dialog — é genérico, usa `target_entity__field_name` e chama a form API route. Funciona automaticamente após alteração da route.

---

## Ficheiros SEM Alteração (confirmado)

| Ficheiro | Razão |
|---|---|
| `lib/form-field-registry.ts` | Já tem ~115 campos de deal registados |
| `types/subtask.ts` | `FormTargetEntity` já inclui `deal`, `deal_client`, `deal_payment` |
| `types/deal.ts` | Types já completos |
| `lib/validations/template.ts` | Enum já valida as 3 entidades |
| `components/processes/dynamic-form-renderer.tsx` | Genérico, sem alteração |
| `app/api/deals/[id]/submit/route.ts` | Fluxo de submit já correcto |
| `app/api/processes/[id]/approve/route.ts` | Trigger popula tasks automaticamente |

---

## Ordem de Implementação

1. **form/route.ts GET** — Resolver dealId + adicionar 5 cases (deal, deal_client, deal_payment, consultant, process)
2. **form/route.ts PUT** — Adicionar 3 blocos de upsert (deal, deal_client, deal_payment)
3. **processes/[id]/route.ts GET** — Carregar deal + clients + payments no response
4. **external-form-dialog.tsx** — Adicionar prop deal + 3 cases no resolveValue
5. **subtask-card-list.tsx** — Passar prop deal
6. **processos/[id]/page.tsx** — Extrair deal do response e passar aos filhos

---

## Notas de Implementação

- **dealId é resolvido via `deals.proc_instance_id = processId`** — relação inversa, não precisa de coluna extra
- **deal_client usa `order_index`** para determinar qual cliente — subtask.config pode ter `client_index` para override
- **deal_payment usa `payment_moment`** para filtrar (cpcv, escritura, single) — subtask.config pode ter `payment_moment`
- **consultant e process são read-only** — não têm PUT, apenas GET para exibição
- **Sem triggers SQL** — toda a sincronização via application layer (consistente com padrão existente)
- **field-subtask-inline e form-subtask-dialog** são genéricos e funcionam automaticamente após alteração da route
