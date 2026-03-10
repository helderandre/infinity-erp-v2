# PRD — Tipos de Processo (Angariação, Compra, Venda)

**Data:** 2026-03-10
**Objectivo:** Adicionar `process_type` a processos e templates para distinguir Angariação, Compra e Venda, com referências sequenciais por tipo (PROC-ANG-YYYY-XXXX, PROC-VND-YYYY-XXXX, PROC-COMP-YYYY-XXXX).

---

## 1. Estado Actual do Sistema

### 1.1 Base de Dados — O Que Existe Hoje

**Tabela `proc_instances`** — sem coluna `process_type`:
```
id, property_id, tpl_process_id, external_ref, current_status,
current_stage_id, percent_complete, started_at, completed_at,
updated_at, requested_by, approved_by, approved_at, returned_at,
returned_reason, rejected_at, rejected_reason, notes,
returned_by, rejected_by, deleted_at, deleted_by,
negocio_id, last_completed_step
```

**Tabela `tpl_processes`** — sem coluna `process_type`:
```
id, name, description, is_active, created_at
```

**Sequência actual:** `proc_ref_seq_global` (last_value: 37, incremento global)

**Trigger actual:** `trg_generate_proc_ref` → `generate_proc_ref()`:
```sql
-- Gera: PROC-YYYY-XXXX (sem tipo)
DECLARE
    year_text TEXT;
    seq_val INT;
BEGIN
    IF NEW.external_ref IS NOT NULL THEN
        RETURN NEW;
    END IF;
    year_text := TO_CHAR(NOW(), 'YYYY');
    seq_val := nextval('proc_ref_seq_global');
    NEW.external_ref := 'PROC-' || year_text || '-' || LPAD(seq_val::text, 4, '0');
    RETURN NEW;
END;
```

**Dados existentes:**
- 37 processos criados (PROC-2026-0001 a PROC-2026-0037)
- 5 templates (1 activo: "Processo de Angariações")
- Todos os processos são de angariação (único tipo actual)

### 1.2 Tipos de Processo Pretendidos

| Tipo | Prefixo | Templates | Descrição |
|------|---------|-----------|-----------|
| `angariacao` | `ANG` | 1 tipo de template | Captação documental de imóvel |
| `venda` | `VND` | ~4 tipos de template | Processo de venda (normal, golden visa, etc.) |
| `compra` | `COMP` | ~4 tipos de template | Processo de compra (normal, crédito, etc.) |

**Formato da referência:** `PROC-{PREFIXO}-{ANO}-{SEQ_POR_TIPO}`
- `PROC-ANG-2026-0001`
- `PROC-VND-2026-0001`
- `PROC-COMP-2026-0001`

---

## 2. Ficheiros Afectados

### 2.1 Base de Dados (Migração SQL)

| Ficheiro | Alteração |
|----------|-----------|
| Nova migração SQL | ADD COLUMN `process_type` em `proc_instances` e `tpl_processes` |
| Nova migração SQL | CREATE TABLE `ref_counters` para sequências por tipo |
| Nova migração SQL | REPLACE FUNCTION `generate_proc_ref()` com prefixo por tipo |
| Nova migração SQL | Migrar dados existentes (marcar como `angariacao`) |

### 2.2 Backend (API Routes)

| Ficheiro | Alteração |
|----------|-----------|
| [app/api/processes/route.ts](app/api/processes/route.ts) | Adicionar filtro `process_type` na query; receber `process_type` no body |
| [app/api/processes/[id]/route.ts](app/api/processes/[id]/route.ts) | Retornar `process_type` no detalhe |
| [app/api/processes/[id]/approve/route.ts](app/api/processes/[id]/approve/route.ts) | Validar que template é do mesmo tipo do processo |
| [app/api/templates/route.ts](app/api/templates/route.ts) | Adicionar `process_type` na criação e listagem; filtrar por tipo |
| [app/api/templates/[id]/route.ts](app/api/templates/[id]/route.ts) | Retornar e actualizar `process_type` |

### 2.3 Frontend (Páginas e Componentes)

| Ficheiro | Alteração |
|----------|-----------|
| [app/dashboard/processos/page.tsx](app/dashboard/processos/page.tsx) | Tabs ou Select para filtrar por `process_type` |
| [app/dashboard/processos/templates/page.tsx](app/dashboard/processos/templates/page.tsx) | Filtrar templates por tipo |
| [components/processes/process-task-card.tsx](components/processes/process-task-card.tsx) | Badge de tipo no card |
| [components/templates/template-builder.tsx](components/templates/template-builder.tsx) | Select de `process_type` obrigatório |
| [components/layout/app-sidebar.tsx](components/layout/app-sidebar.tsx) | Sub-itens por tipo (Angariações, Vendas, Compras) |

### 2.4 Types e Validações

| Ficheiro | Alteração |
|----------|-----------|
| [types/process.ts](types/process.ts) | Adicionar `ProcessType`, actualizar `ProcessInstance` |
| [types/database.ts](types/database.ts) | Regenerar (ou adicionar manualmente `process_type`) |
| [lib/validations/template.ts](lib/validations/template.ts) | Adicionar `process_type` ao `templateSchema` |
| [lib/constants.ts](lib/constants.ts) | Adicionar `PROCESS_TYPE_CONFIG` com labels, cores, prefixos |

---

## 3. Plano de Migração SQL

### 3.1 Tabela de Contadores (padrão gapless — recomendado)

**Fonte:** [PostgreSQL Gapless Counter Pattern](https://github.com/kimmobrunfeldt/howto-everything/blob/master/postgres-gapless-counter-for-invoice-purposes.md)

```sql
-- Tabela de contadores: uma linha por prefixo+ano
CREATE TABLE ref_counters (
  prefix TEXT NOT NULL,
  year   INT  NOT NULL,
  counter INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, year)
);

-- Seed: migrar contagem actual para ANG-2026
INSERT INTO ref_counters (prefix, year, counter)
VALUES ('ANG', 2026, 37);
```

**Porquê este padrão:**
- Sequências gapless por tipo e por ano (reset automático no novo ano)
- Sem conflitos de concorrência (INSERT ON CONFLICT usa lock implícito na row)
- Cada tipo tem a sua própria numeração independente
- Simples de adicionar novos tipos no futuro

### 3.2 Adicionar Coluna `process_type`

```sql
-- Em proc_instances
ALTER TABLE proc_instances
ADD COLUMN process_type TEXT NOT NULL DEFAULT 'angariacao';

-- Em tpl_processes
ALTER TABLE tpl_processes
ADD COLUMN process_type TEXT NOT NULL DEFAULT 'angariacao';

-- Constraint para valores válidos
ALTER TABLE proc_instances
ADD CONSTRAINT chk_process_type
CHECK (process_type IN ('angariacao', 'venda', 'compra'));

ALTER TABLE tpl_processes
ADD CONSTRAINT chk_tpl_process_type
CHECK (process_type IN ('angariacao', 'venda', 'compra'));

-- Índice para queries filtradas por tipo
CREATE INDEX idx_proc_instances_type ON proc_instances (process_type);
CREATE INDEX idx_tpl_processes_type ON tpl_processes (process_type);
```

### 3.3 Nova Função `generate_proc_ref()`

```sql
CREATE OR REPLACE FUNCTION generate_proc_ref()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix TEXT;
  v_year   INT;
  v_counter INT;
BEGIN
  -- Se já tem referência, não faz nada
  IF NEW.external_ref IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Determinar prefixo pelo tipo de processo
  v_prefix := CASE NEW.process_type
    WHEN 'angariacao' THEN 'ANG'
    WHEN 'venda'      THEN 'VND'
    WHEN 'compra'     THEN 'COMP'
    ELSE 'GEN'
  END;

  v_year := EXTRACT(YEAR FROM NOW())::INT;

  -- Upsert atómico: incrementa e retorna o novo valor
  INSERT INTO ref_counters (prefix, year, counter)
  VALUES (v_prefix, v_year, 1)
  ON CONFLICT (prefix, year)
  DO UPDATE SET counter = ref_counters.counter + 1
  RETURNING counter INTO v_counter;

  -- Formato: PROC-ANG-2026-0001
  NEW.external_ref := 'PROC-' || v_prefix || '-' || v_year || '-' || LPAD(v_counter::TEXT, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**O trigger `trg_generate_proc_ref` já existe** — a função é substituída in-place (CREATE OR REPLACE).

### 3.4 Migrar Dados Existentes

```sql
-- Marcar processos existentes como angariação
UPDATE proc_instances SET process_type = 'angariacao' WHERE process_type IS NULL;

-- Marcar templates existentes como angariação
UPDATE tpl_processes SET process_type = 'angariacao' WHERE process_type IS NULL;

-- (Opcional) Renomear referências existentes: PROC-2026-0001 → PROC-ANG-2026-0001
UPDATE proc_instances
SET external_ref = REPLACE(external_ref, 'PROC-', 'PROC-ANG-')
WHERE external_ref LIKE 'PROC-20%'
  AND external_ref NOT LIKE 'PROC-ANG-%'
  AND external_ref NOT LIKE 'PROC-VND-%'
  AND external_ref NOT LIKE 'PROC-COMP-%';
```

---

## 4. Alterações no Backend (API Routes)

### 4.1 `GET /api/processes` — Filtro por tipo

Trecho actual em [app/api/processes/route.ts:17-63](app/api/processes/route.ts#L17-L63):
```typescript
const search = searchParams.get('search') || ''
const status = searchParams.get('status') || ''
```

**Adicionar:**
```typescript
const search = searchParams.get('search') || ''
const status = searchParams.get('status') || ''
const processType = searchParams.get('process_type') || ''  // ← NOVO

// ... query existente ...

if (processType) {
  query = query.eq('process_type', processType)  // ← NOVO
}
```

### 4.2 `POST /api/templates` — Incluir tipo

Trecho actual em [app/api/templates/route.ts:73-78](app/api/templates/route.ts#L73-L78):
```typescript
const { name, description, stages } = parsed.data

const { data: process, error: processError } = await supabase
  .from('tpl_processes')
  .insert({ name, description })
```

**Alterar para:**
```typescript
const { name, description, process_type, stages } = parsed.data  // ← NOVO

const { data: process, error: processError } = await supabase
  .from('tpl_processes')
  .insert({ name, description, process_type })  // ← NOVO
```

### 4.3 `GET /api/templates` — Filtro por tipo

Adicionar `process_type` ao select e permitir filtro:
```typescript
const { searchParams } = new URL(request.url)
const processType = searchParams.get('process_type') || ''

let query = supabase
  .from('tpl_processes')
  .select(`id, name, description, is_active, created_at, process_type, ...`)

if (processType) {
  query = query.eq('process_type', processType)
}
```

### 4.4 `POST /api/processes/[id]/approve` — Validar tipo

Em [app/api/processes/[id]/approve/route.ts](app/api/processes/[id]/approve/route.ts), após buscar o template, validar que o tipo é compatível:
```typescript
// Após buscar template e processo:
if (template.process_type !== process.process_type) {
  return NextResponse.json(
    { error: 'O template seleccionado não é compatível com este tipo de processo' },
    { status: 400 }
  )
}
```

---

## 5. Alterações no Frontend

### 5.1 Constantes — `PROCESS_TYPE_CONFIG`

Adicionar em [lib/constants.ts](lib/constants.ts):
```typescript
export const PROCESS_TYPES = {
  angariacao: {
    label: 'Angariação',
    prefix: 'ANG',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    icon: 'FileSearch',      // Lucide icon name
    description: 'Captação e validação documental de imóveis',
  },
  venda: {
    label: 'Venda',
    prefix: 'VND',
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    icon: 'HandCoins',
    description: 'Processo de venda de imóvel',
  },
  compra: {
    label: 'Compra',
    prefix: 'COMP',
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
    icon: 'ShoppingCart',
    description: 'Processo de compra de imóvel',
  },
} as const

export type ProcessType = keyof typeof PROCESS_TYPES
```

### 5.2 Types — Actualizar `ProcessInstance`

Em [types/process.ts](types/process.ts):
```typescript
export type ProcessType = 'angariacao' | 'venda' | 'compra'

export interface ProcessInstance extends ProcInstance {
  process_type: ProcessType  // ← NOVO
  property?: Pick<DevProperty, ...> & { ... }
  // ... resto igual
}
```

### 5.3 Validação Zod — Adicionar ao `templateSchema`

Em [lib/validations/template.ts](lib/validations/template.ts):
```typescript
export const templateSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  description: z.string().optional(),
  process_type: z.enum(['angariacao', 'venda', 'compra'], {  // ← NOVO
    required_error: 'Tipo de processo obrigatório',
  }),
  stages: z.array(stageSchema).min(1, 'Pelo menos 1 fase'),
})
```

### 5.4 Página de Processos — Tabs por Tipo

**Padrão:** Tabs de tipo no topo + tabs de status em baixo (já existentes)

Em [app/dashboard/processos/page.tsx](app/dashboard/processos/page.tsx):
```tsx
import { PROCESS_TYPES, type ProcessType } from '@/lib/constants'

// Estado
const [activeType, setActiveType] = useState<ProcessType | 'all'>('all')

// UI — Adicionar acima dos status tabs
<Tabs value={activeType} onValueChange={setActiveType}>
  <TabsList>
    <TabsTrigger value="all">Todos</TabsTrigger>
    {Object.entries(PROCESS_TYPES).map(([key, config]) => (
      <TabsTrigger key={key} value={key}>
        <span className={`mr-1.5 h-2 w-2 rounded-full ${config.dot}`} />
        {config.label}
      </TabsTrigger>
    ))}
  </TabsList>
</Tabs>

// Fetch — Passar tipo como parâmetro
const url = `/api/processes?${params}`
// Adicionar: if (activeType !== 'all') params.append('process_type', activeType)
```

### 5.5 Template Builder — Select de Tipo

Em [components/templates/template-builder.tsx](components/templates/template-builder.tsx):
```tsx
<FormField
  control={form.control}
  name="process_type"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Tipo de Processo</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar tipo..." />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {Object.entries(PROCESS_TYPES).map(([key, config]) => (
            <SelectItem key={key} value={key}>
              {config.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 5.6 Sidebar — Sub-navegação por Tipo (Opcional)

Duas abordagens possíveis:

**Opção A — Collapsible (recomendada):**
```tsx
{
  title: 'Processos',
  icon: ClipboardList,
  items: [
    { title: 'Todos', url: '/dashboard/processos' },
    { title: 'Angariações', url: '/dashboard/processos?type=angariacao' },
    { title: 'Vendas', url: '/dashboard/processos?type=venda' },
    { title: 'Compras', url: '/dashboard/processos?type=compra' },
  ],
}
```

**Opção B — Mesma URL, filtro por tabs (mais simples):**
Manter um único link "Processos" e usar as tabs na página para filtrar.

### 5.7 Badge de Tipo nos Cards de Processo

```tsx
// Componente reutilizável
function ProcessTypeBadge({ type }: { type: ProcessType }) {
  const config = PROCESS_TYPES[type]
  return (
    <Badge variant="secondary" className={cn(config.bg, config.text, 'text-xs')}>
      {config.label}
    </Badge>
  )
}
```

---

## 6. Padrões de Referência

### 6.1 PostgreSQL — Counter Table (Gapless Sequences)

**Fonte:** [kimmobrunfeldt/postgres-gapless-counter](https://github.com/kimmobrunfeldt/howto-everything/blob/master/postgres-gapless-counter-for-invoice-purposes.md)

O padrão `INSERT ... ON CONFLICT DO UPDATE` garante atomicidade sem locks explícitos:
```sql
INSERT INTO ref_counters (prefix, year, counter)
VALUES ('ANG', 2026, 1)
ON CONFLICT (prefix, year)
DO UPDATE SET counter = ref_counters.counter + 1
RETURNING counter INTO v_counter;
```
- Cada combinação `(prefix, year)` tem um row lock implícito
- Novos anos criam linhas automaticamente
- Sem gaps na numeração

### 6.2 Next.js App Router — Filtro por Query Params

**Fonte:** [Next.js Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)

**Padrão escolhido:** Single route com tabs de tipo (não sub-rotas por tipo).

Razão: todos os tipos partilham a mesma UI (stepper, tarefas, progresso). Usar query params (`?type=angariacao`) é mais simples e evita duplicação de páginas.

```
app/dashboard/processos/
├── page.tsx                    ← listagem com tabs de tipo
├── templates/page.tsx          ← templates com filtro de tipo
└── [id]/page.tsx               ← detalhe (lê tipo do processo)
```

### 6.3 shadcn/ui Tabs + Badge Pattern

**Fonte:** [shadcn Tabs](https://ui.shadcn.com/docs/components/radix/tabs)

```tsx
<Tabs defaultValue="all" onValueChange={(v) => setType(v as ProcessType | 'all')}>
  <TabsList>
    <TabsTrigger value="all">
      Todos <Badge variant="secondary" className="ml-1.5">{counts.total}</Badge>
    </TabsTrigger>
    <TabsTrigger value="angariacao">
      <span className="mr-1.5 h-2 w-2 rounded-full bg-amber-500" />
      Angariações <Badge variant="secondary" className="ml-1.5">{counts.angariacao}</Badge>
    </TabsTrigger>
    {/* ... */}
  </TabsList>
</Tabs>
```

### 6.4 Padrão da Base de Código — Filtro por Tipo (existente em Leads)

O módulo de Leads já usa um padrão similar para filtrar por `lead_type`:

Em `app/api/leads/route.ts`:
```typescript
if (lead_type) {
  query = query.eq('lead_type', lead_type)
}
```

E no frontend com tabs:
```tsx
<TabsTrigger value="buyer">Comprador</TabsTrigger>
<TabsTrigger value="seller">Vendedor</TabsTrigger>
```

**Seguir exactamente este padrão** para `process_type`.

---

## 7. Trechos de Código Relevantes (Actual)

### 7.1 API Listagem de Processos — [app/api/processes/route.ts](app/api/processes/route.ts)

```typescript
// Linha 17-19: Parâmetros actuais (sem process_type)
const search = searchParams.get('search') || ''
const status = searchParams.get('status') || ''

// Linha 21-53: Query actual (sem process_type no select nem filtro)
let query = supabase
  .from('proc_instances')
  .select(`
    id, external_ref, current_status, percent_complete, ...
    tpl_processes ( id, name ),
    ...
  `)
  .is('deleted_at', null)
```

### 7.2 API Criação de Template — [app/api/templates/route.ts](app/api/templates/route.ts)

```typescript
// Linha 73: Destructuring actual (sem process_type)
const { name, description, stages } = parsed.data

// Linha 76-78: Insert actual (sem process_type)
const { data: process } = await supabase
  .from('tpl_processes')
  .insert({ name, description })
```

### 7.3 API Listagem de Templates — [app/api/templates/route.ts](app/api/templates/route.ts)

```typescript
// Linha 10-14: Select actual (sem process_type)
const { data: templates } = await supabase
  .from('tpl_processes')
  .select(`id, name, description, is_active, created_at, tpl_stages (id, tpl_tasks (id))`)
```

### 7.4 Validação de Template — [lib/validations/template.ts](lib/validations/template.ts)

```typescript
// Schema actual (sem process_type)
export const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  stages: z.array(stageSchema).min(1),
})
```

### 7.5 Type ProcessInstance — [types/process.ts:36-53](types/process.ts#L36-L53)

```typescript
// Sem process_type
export interface ProcessInstance extends ProcInstance {
  property?: Pick<DevProperty, 'id' | 'title' | ...> & { ... }
  requested_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
  // ...
}
```

### 7.6 Trigger SQL Actual — `generate_proc_ref()`

```sql
-- Formato actual: PROC-YYYY-XXXX (sem tipo)
-- Sequência global: proc_ref_seq_global (last_value: 37)
NEW.external_ref := 'PROC-' || year_text || '-' || LPAD(seq_val::text, 4, '0');
```

---

## 8. Ordem de Implementação Recomendada

### Passo 1 — Migração SQL (DB)
1. Criar tabela `ref_counters`
2. Adicionar coluna `process_type` em `proc_instances` e `tpl_processes`
3. Migrar dados existentes (tudo como `angariacao`)
4. Renomear referências existentes (PROC-2026-XXXX → PROC-ANG-2026-XXXX)
5. Seed `ref_counters` com contador actual (ANG, 2026, 37)
6. Substituir função `generate_proc_ref()` com novo formato
7. Adicionar constraints CHECK e índices

### Passo 2 — Types e Validações
1. Regenerar `types/database.ts` ou adicionar `process_type` manualmente
2. Adicionar `ProcessType` em `types/process.ts`
3. Adicionar `process_type` ao `templateSchema` em `lib/validations/template.ts`
4. Adicionar `PROCESS_TYPES` config em `lib/constants.ts`

### Passo 3 — Backend (API Routes)
1. `GET /api/templates` — retornar e filtrar por `process_type`
2. `POST /api/templates` — receber e guardar `process_type`
3. `PUT /api/templates/[id]` — actualizar `process_type`
4. `GET /api/processes` — filtrar por `process_type`
5. `POST /api/processes/[id]/approve` — validar compatibilidade tipo template ↔ processo

### Passo 4 — Frontend
1. `lib/constants.ts` — adicionar `PROCESS_TYPES` config
2. `components/templates/template-builder.tsx` — Select de tipo obrigatório
3. `app/dashboard/processos/templates/page.tsx` — filtro por tipo
4. `app/dashboard/processos/page.tsx` — tabs de tipo
5. Cards de processo — badge de tipo
6. (Opcional) Sidebar — sub-itens por tipo

---

## 9. Riscos e Considerações

| Risco | Mitigação |
|-------|-----------|
| Referências antigas (PROC-2026-XXXX) quebram URLs/links | Renomear na migração; busca por `external_ref` continua a funcionar |
| Template sem tipo associado a processo de outro tipo | Validação no approve: `template.process_type === process.process_type` |
| Novos processos sem `process_type` | `DEFAULT 'angariacao'` + constraint CHECK |
| Sequência partilhada pode ter gaps após migração | Counter table é independente; seed com valor correcto |
| Frontend com cache de dados antigos | Invalidar cache após migração (refetch) |

---

## 10. Resumo de Impacto

| Área | Ficheiros | Complexidade |
|------|-----------|--------------|
| **SQL (migração)** | 1 ficheiro | Média (trigger + counter table + migração de dados) |
| **Types/Validações** | 3 ficheiros | Baixa (adicionar campo + enum) |
| **Backend APIs** | 4-5 ficheiros | Baixa (adicionar filtro + campo) |
| **Frontend** | 4-5 ficheiros | Média (tabs, select, badge) |
| **Total** | ~13 ficheiros | **Média** — maioria são adições simples |
