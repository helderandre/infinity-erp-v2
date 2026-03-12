# SPEC — Tipos de Processo (process_type)

**Data:** 2026-03-10
**PRD:** [PRD-PROCESS-TYPES.md](PRD-PROCESS-TYPES.md)
**Objectivo:** Adicionar `process_type` (`angariacao` | `negocio`) a processos e templates, com referências sequenciais por tipo.

---

## Resumo das Alterações

| Área | Ficheiros novos | Ficheiros modificados |
|------|-----------------|----------------------|
| SQL (Migração) | — | Via Supabase MCP `execute_sql` |
| Types | — | 2 (`types/process.ts`, `types/database.ts`) |
| Validações | — | 1 (`lib/validations/template.ts`) |
| Constantes | — | 1 (`lib/constants.ts`) |
| Backend APIs | — | 7 ficheiros |
| Frontend | — | 4 ficheiros |
| **Total** | **0** | **~15 ficheiros** |

---

## FASE 1 — Migração SQL (Supabase)

Executar via `execute_sql` (MCP SupabaseInfinity). Uma única migração com todas as alterações.

### O que fazer:

1. **Criar tabela `ref_counters`** — contadores gapless por tipo+ano

```sql
CREATE TABLE ref_counters (
  prefix TEXT NOT NULL,
  year   INT  NOT NULL,
  counter INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, year)
);

-- Seed com contador actual (37 processos angariação em 2026)
INSERT INTO ref_counters (prefix, year, counter) VALUES ('ANG', 2026, 37);
```

2. **Adicionar coluna `process_type`** em `proc_instances` e `tpl_processes`

```sql
ALTER TABLE proc_instances
ADD COLUMN process_type TEXT NOT NULL DEFAULT 'angariacao';

ALTER TABLE tpl_processes
ADD COLUMN process_type TEXT NOT NULL DEFAULT 'angariacao';

ALTER TABLE proc_instances
ADD CONSTRAINT chk_process_type
CHECK (process_type IN ('angariacao', 'negocio'));

ALTER TABLE tpl_processes
ADD CONSTRAINT chk_tpl_process_type
CHECK (process_type IN ('angariacao', 'negocio'));

CREATE INDEX idx_proc_instances_type ON proc_instances (process_type);
CREATE INDEX idx_tpl_processes_type ON tpl_processes (process_type);
```

3. **Migrar dados existentes** — marcar tudo como `angariacao` + renomear referências

```sql
-- Dados já têm DEFAULT 'angariacao', mas para segurança:
UPDATE proc_instances SET process_type = 'angariacao' WHERE process_type IS NULL;
UPDATE tpl_processes SET process_type = 'angariacao' WHERE process_type IS NULL;

-- Renomear referências: PROC-2026-XXXX → PROC-ANG-2026-XXXX
UPDATE proc_instances
SET external_ref = REPLACE(external_ref, 'PROC-', 'PROC-ANG-')
WHERE external_ref LIKE 'PROC-20%'
  AND external_ref NOT LIKE 'PROC-ANG-%'
  AND external_ref NOT LIKE 'PROC-NEG-%';
```

4. **Substituir função `generate_proc_ref()`** — novo formato com prefixo por tipo

```sql
CREATE OR REPLACE FUNCTION generate_proc_ref()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix TEXT;
  v_year   INT;
  v_counter INT;
BEGIN
  IF NEW.external_ref IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_prefix := CASE NEW.process_type
    WHEN 'angariacao' THEN 'ANG'
    WHEN 'negocio'    THEN 'NEG'
    ELSE 'GEN'
  END;

  v_year := EXTRACT(YEAR FROM NOW())::INT;

  INSERT INTO ref_counters (prefix, year, counter)
  VALUES (v_prefix, v_year, 1)
  ON CONFLICT (prefix, year)
  DO UPDATE SET counter = ref_counters.counter + 1
  RETURNING counter INTO v_counter;

  NEW.external_ref := 'PROC-' || v_prefix || '-' || v_year || '-' || LPAD(v_counter::TEXT, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

O trigger `trg_generate_proc_ref` já existe — a função é substituída in-place.

### Verificação:
- `SELECT * FROM ref_counters;` → deve ter 1 linha: `(ANG, 2026, 37)`
- `SELECT external_ref FROM proc_instances LIMIT 5;` → deve mostrar `PROC-ANG-2026-XXXX`
- `SELECT process_type FROM tpl_processes;` → todos devem ser `angariacao`

---

## FASE 2 — Types e Validações

### Ficheiro: `types/process.ts`

**O que fazer:** Adicionar tipo `ProcessType` e campo `process_type` à interface `ProcessInstance`.

```typescript
// Adicionar no topo (após imports)
export type ProcessType = 'angariacao' | 'negocio'

// Adicionar à interface ProcessInstance (que extends ProcInstance):
// O campo virá do DB via ProcInstance, mas declarar explicitamente para clareza:
export interface ProcessInstance extends ProcInstance {
  process_type: ProcessType  // ← NOVO
  property?: Pick<DevProperty, ...> & { ... }
  // ... resto igual
}
```

### Ficheiro: `types/database.ts`

**O que fazer:** Regenerar via `npx supabase gen types typescript` ou adicionar manualmente `process_type: string` às interfaces de `proc_instances` e `tpl_processes` (Row, Insert, Update).

**Opção rápida (manual):** Adicionar `process_type: string` em:
- `proc_instances.Row`
- `proc_instances.Insert` (com `?` — tem DEFAULT)
- `proc_instances.Update` (com `?`)
- `tpl_processes.Row`
- `tpl_processes.Insert` (com `?`)
- `tpl_processes.Update` (com `?`)

**Opção recomendada:** Regenerar via MCP `generate_typescript_types` e substituir ficheiro.

### Ficheiro: `lib/validations/template.ts`

**O que fazer:** Adicionar `process_type` ao `templateSchema`.

```typescript
// templateSchema actual:
export const templateSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  description: z.string().optional(),
  stages: z.array(stageSchema).min(1, 'Pelo menos 1 fase'),
})

// Alterar para:
export const templateSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  description: z.string().optional(),
  process_type: z.enum(['angariacao', 'negocio'], {
    required_error: 'Tipo de processo obrigatório',
  }),
  stages: z.array(stageSchema).min(1, 'Pelo menos 1 fase'),
})
```

### Ficheiro: `lib/constants.ts`

**O que fazer:** Adicionar objecto `PROCESS_TYPES` com config de labels, cores e prefixos por tipo.

```typescript
export const PROCESS_TYPES = {
  angariacao: {
    label: 'Angariação',
    prefix: 'ANG',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    icon: 'FileSearch',
    description: 'Captação e validação documental de imóveis',
  },
  negocio: {
    label: 'Negócio',
    prefix: 'NEG',
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    icon: 'Handshake',
    description: 'Processo de negócio de imóvel',
  },
} as const

export type ProcessType = keyof typeof PROCESS_TYPES
```

---

## FASE 3 — Backend (API Routes)

### Ficheiro: `app/api/templates/route.ts`

**GET — Adicionar `process_type` ao select e permitir filtro:**

```typescript
// Linha ~10-14: Adicionar process_type ao select
const { data: templates } = await supabase
  .from('tpl_processes')
  .select(`id, name, description, is_active, created_at, process_type, tpl_stages (id, tpl_tasks(id))`)
//                                                        ^^^^^^^^^^^^^ NOVO

// Adicionar filtro por query param (antes da query):
const { searchParams } = new URL(request.url)
const processType = searchParams.get('process_type') || ''

// Após montar a query, antes de executar:
if (processType) {
  query = query.eq('process_type', processType)
}
```

**POST — Incluir `process_type` no insert:**

```typescript
// Linha ~73: Adicionar process_type ao destructuring
const { name, description, process_type, stages } = parsed.data
//                          ^^^^^^^^^^^^^ NOVO

// Linha ~76-78: Incluir no insert
const { data: process } = await supabase
  .from('tpl_processes')
  .insert({ name, description, process_type })
//                              ^^^^^^^^^^^^^ NOVO
```

**Incluir `process_type` no retorno do GET** (no mapeamento):

```typescript
// No .map() que calcula stages_count e tasks_count, incluir:
return {
  ...template,
  process_type: template.process_type,  // ← garantir que é passado
  stages_count,
  tasks_count,
}
```

### Ficheiro: `app/api/templates/[id]/route.ts`

**GET — Já retorna `*` (todos os campos), logo `process_type` virá automaticamente.**

**PUT — Incluir `process_type` na actualização:**

```typescript
// Na secção que actualiza name/description em tpl_processes:
const { error: updateError } = await supabase
  .from('tpl_processes')
  .update({ name, description, process_type })
//                              ^^^^^^^^^^^^^ NOVO
  .eq('id', id)
```

### Ficheiro: `app/api/processes/route.ts`

**GET — Adicionar filtro `process_type` e incluir no select:**

```typescript
// Linha ~17-18: Adicionar process_type aos params
const processType = searchParams.get('process_type') || ''  // ← NOVO

// Linha ~21: Adicionar process_type ao select
let query = supabase
  .from('proc_instances')
  .select(`
    id, external_ref, current_status, percent_complete, process_type,
    ...
  `)
//  ^^^^^^^^^^^^^ NOVO no select

// Após filtros existentes (status, search), adicionar:
if (processType) {
  query = query.eq('process_type', processType)
}
```

### Ficheiro: `app/api/processes/[id]/route.ts`

**GET — Já usa `*` (all columns), logo `process_type` virá automaticamente.** Nada a alterar.

### Ficheiro: `app/api/processes/[id]/approve/route.ts`

**Adicionar validação de compatibilidade tipo template ↔ processo:**

```typescript
// Após buscar template (que já verifica is_active), adicionar:
// Buscar process_type do template
// O template já é fetched ~linha 120, adicionar process_type ao select

// Após buscar proc_instance (~linha 140), adicionar validação:
if (template.process_type !== procInstance.process_type) {
  return NextResponse.json(
    { error: 'O template seleccionado não é compatível com este tipo de processo' },
    { status: 400 }
  )
}
```

**Nota:** O select do template precisa incluir `process_type`. Verificar se usa `*` ou campos específicos.

### Ficheiro: `app/api/acquisitions/route.ts`

**Incluir `process_type` na criação de proc_instances:**

```typescript
// Linha ~249-255: Adicionar process_type ao insert
const { data: procInstance } = await supabase
  .from('proc_instances')
  .insert({
    property_id: property.id,
    tpl_process_id: null,
    process_type: 'angariacao',  // ← NOVO (hardcoded para angariações)
    current_status: 'draft',     // ou 'pending_approval'
    requested_by: user.id,
  })
```

**Nota:** Este endpoint é específico de angariações. Quando se criarem fluxos de negócio, terão os seus próprios endpoints.

### Ficheiro: `app/api/acquisitions/draft/route.ts`

**Mesmo que acima — incluir `process_type: 'angariacao'` no insert de proc_instances (~linha 77).**

---

## FASE 4 — Frontend

### Ficheiro: `lib/constants.ts`

Já coberto na FASE 2 (`PROCESS_TYPES` config).

### Ficheiro: `components/templates/template-builder.tsx`

**O que fazer:** Adicionar Select de `process_type` obrigatório nos campos do topo (ao lado de Nome e Descrição).

```typescript
// Estado: Adicionar (~linha 87-88, junto com name/description)
const [processType, setProcessType] = useState<string>(initialData?.process_type || '')

// UI: Adicionar Select após os campos Nome e Descrição (~linha 522-544)
// Dentro do grid md:grid-cols-2, transformar em md:grid-cols-3 ou adicionar nova row:
<div className="space-y-2">
  <Label>Tipo de Processo *</Label>
  <Select value={processType} onValueChange={setProcessType}>
    <SelectTrigger>
      <SelectValue placeholder="Seleccionar tipo..." />
    </SelectTrigger>
    <SelectContent>
      {Object.entries(PROCESS_TYPES).map(([key, config]) => (
        <SelectItem key={key} value={key}>
          {config.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

// Payload: Incluir no save (~linha 446-483)
const payload = {
  name,
  description,
  process_type: processType,  // ← NOVO
  stages: [...],
}

// Validação: Impedir save se processType estiver vazio
// Adicionar check no handler de save:
if (!processType) {
  toast.error('Seleccione o tipo de processo')
  return
}
```

### Ficheiro: `app/dashboard/processos/page.tsx`

**O que fazer:** Adicionar tabs de tipo de processo ACIMA das tabs de status existentes.

```typescript
// Imports:
import { PROCESS_TYPES } from '@/lib/constants'

// Estado (~junto com search, statusFilter):
const [activeType, setActiveType] = useState<string>('all')

// Fetch: Passar process_type como parâmetro
// Em loadProcesses(), adicionar ao URL:
const params = new URLSearchParams()
if (search) params.append('search', search)
if (statusFilter) params.append('status', statusFilter)
if (activeType !== 'all') params.append('process_type', activeType)  // ← NOVO

// UI: Adicionar Tabs de tipo ANTES das tabs de status
<Tabs value={activeType} onValueChange={(v) => setActiveType(v)}>
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

// Reload quando activeType mudar:
useEffect(() => { loadProcesses() }, [activeType, ...])
```

### Ficheiro: `app/dashboard/processos/templates/page.tsx`

**O que fazer:** Adicionar filtro por tipo nos templates (Select ou Tabs).

```typescript
// Imports:
import { PROCESS_TYPES } from '@/lib/constants'

// Estado:
const [typeFilter, setTypeFilter] = useState<string>('all')

// Filtro frontend (templates list é pequena):
const filteredTemplates = templates.filter(t => {
  const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase())
  const matchesType = typeFilter === 'all' || t.process_type === typeFilter
  return matchesSearch && matchesType
})

// UI: Adicionar Select de tipo junto ao search
<Select value={typeFilter} onValueChange={setTypeFilter}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Tipo" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Todos os tipos</SelectItem>
    {Object.entries(PROCESS_TYPES).map(([key, config]) => (
      <SelectItem key={key} value={key}>{config.label}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Mostrar badge de tipo em cada template card:**

```typescript
// No componente de template card/list item, adicionar badge:
import { PROCESS_TYPES } from '@/lib/constants'

const config = PROCESS_TYPES[template.process_type as keyof typeof PROCESS_TYPES]
// Render:
<Badge variant="secondary" className={cn(config?.bg, config?.text, 'text-xs')}>
  {config?.label || template.process_type}
</Badge>
```

### Ficheiro: `components/processes/process-task-card.tsx` (OPCIONAL)

**O que fazer:** Mostrar badge de tipo no card de processo (se relevante na listagem).

Nota: O card de processo na listagem já mostra template name e status. Se o tipo ficar visível nas tabs, pode não ser necessário no card individual. Avaliar após implementação.

---

## Fora de Âmbito (NÃO FAZER)

- Sub-rotas no sidebar por tipo (manter um único link "Processos" com tabs)
- Fluxos de criação de processo de Venda/Compra (virão em PRDs dedicados)
- Novos templates para Venda/Compra (apenas a infra de tipos, não o conteúdo)
- Alteração do fluxo de angariação existente (continua igual, apenas com `process_type: 'angariacao'`)
- Migração do componente `AcquisitionDialog` (permanece igual — angariações)

---

## Ordem de Execução

| Passo | O quê | Dependência |
|-------|-------|-------------|
| 1 | Migração SQL (ref_counters + coluna + trigger + dados) | Nenhuma |
| 2 | Regenerar `types/database.ts` | Passo 1 |
| 3 | Actualizar `types/process.ts` | Passo 2 |
| 4 | Actualizar `lib/constants.ts` (PROCESS_TYPES) | Nenhuma |
| 5 | Actualizar `lib/validations/template.ts` | Nenhuma |
| 6 | Backend: `app/api/templates/route.ts` (GET+POST) | Passos 2, 5 |
| 7 | Backend: `app/api/templates/[id]/route.ts` (PUT) | Passos 2, 5 |
| 8 | Backend: `app/api/processes/route.ts` (GET) | Passo 2 |
| 9 | Backend: `app/api/processes/[id]/approve/route.ts` | Passo 2 |
| 10 | Backend: `app/api/acquisitions/route.ts` + `draft/route.ts` | Passo 2 |
| 11 | Frontend: `template-builder.tsx` (Select tipo) | Passos 4, 5 |
| 12 | Frontend: `processos/page.tsx` (Tabs tipo) | Passos 4, 8 |
| 13 | Frontend: `processos/templates/page.tsx` (filtro + badge) | Passos 4, 6 |

---

## Verificação Final

### Automatizada:
- [ ] `npm run build` — sem erros de tipo
- [ ] Criar template com `process_type: 'negocio'` → confirmar que grava correctamente
- [ ] Criar angariação → `external_ref` deve ser `PROC-ANG-2026-XXXX`
- [ ] GET `/api/processes?process_type=angariacao` → retorna só angariações
- [ ] GET `/api/templates?process_type=negocio` → retorna só templates de negócio
- [ ] Aprovar processo de angariação com template de negócio → deve retornar 400

### Manual:
- [ ] Tabs de tipo na página de processos filtram correctamente
- [ ] Select de tipo no template builder é obrigatório
- [ ] Badge de tipo aparece na listagem de templates
- [ ] Referências antigas renomeadas (`PROC-ANG-2026-XXXX`) aparecem correctamente
- [ ] Novos processos geram referência com prefixo correcto
