# SPEC — Subtarefas Condicionais por Tipo de Proprietário

**Data:** 2026-02-27
**Baseado em:** [PRD-OWNER-CONDITIONAL-SUBTASKS.md](PRD-OWNER-CONDITIONAL-SUBTASKS.md)

---

## Índice de Alterações

| # | Ficheiro | Acção | Complexidade |
|---|----------|-------|--------------|
| 1 | `types/subtask.ts` | MODIFICAR | Baixa |
| 2 | `types/process.ts` | MODIFICAR | Baixa |
| 3 | `lib/constants.ts` | MODIFICAR | Baixa |
| 4 | `lib/validations/template.ts` | MODIFICAR | Média |
| 5 | `components/templates/subtask-editor.tsx` | MODIFICAR | Alta |
| 6 | `components/templates/template-builder.tsx` | MODIFICAR | Baixa |
| 7 | `components/processes/task-form-action.tsx` | MODIFICAR | Média |
| 8 | `app/api/processes/[id]/route.ts` | MODIFICAR | Baixa |
| 9 | **Supabase** — Migração `proc_subtasks` | CRIAR (SQL) | Média |
| 10 | **Supabase** — Função `populate_process_tasks()` | MODIFICAR (SQL) | Alta |

**Nota:** Os ficheiros `app/api/templates/route.ts` e `app/api/templates/[id]/route.ts` **NÃO precisam de alteração** — já fazem spread do `config` inteiro (`{ type: st.type, ...(st.config || {}) }`), logo os novos campos passam automaticamente para a BD.

---

## 1. `types/subtask.ts`

**Acção:** Adicionar tipos de owner scope + estender interfaces existentes

### O que fazer:

1. Adicionar os novos tipos `OwnerScope` e `PersonTypeFilter` no topo do ficheiro
2. Adicionar interface `SubtaskOwnerConfig` com os campos de multiplicação
3. Estender o `config` de `TplSubtask`, `ProcSubtask` e `SubtaskData` com os novos campos
4. Adicionar `owner_id` e `owner` (join) ao `ProcSubtask`

### Código:

```typescript
export type SubtaskType = 'upload' | 'checklist' | 'email' | 'generate_doc'

// NOVO — Tipos de multiplicação por proprietário
export type OwnerScope = 'none' | 'all_owners' | 'main_contact_only'
export type PersonTypeFilter = 'all' | 'singular' | 'coletiva'

// NOVO — Configuração de proprietário para subtarefas
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

export interface TplSubtask {
  id: string
  tpl_task_id: string
  title: string
  description: string | null
  is_mandatory: boolean
  order_index: number
  config: {
    type?: SubtaskType
    doc_type_id?: string
    email_library_id?: string
    doc_library_id?: string
    // Legacy fields (retrocompatibilidade)
    check_type?: 'field' | 'document' | 'manual'
    field_name?: string
  } & SubtaskOwnerConfig  // ← NOVO: merge com owner config
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
    type?: SubtaskType
    check_type?: 'field' | 'document' | 'manual'
    field_name?: string
    doc_type_id?: string
    email_library_id?: string
    doc_library_id?: string
  } & SubtaskOwnerConfig  // ← NOVO: merge com owner config
  // NOVO — Owner associado (quando multiplicada por proprietário)
  owner_id?: string | null
  owner?: {
    id: string
    name: string
    person_type: 'singular' | 'coletiva'
  } | null
}

// Usado no template builder (estado local)
export interface SubtaskData {
  id: string
  title: string
  description?: string
  is_mandatory: boolean
  order_index: number
  type: SubtaskType
  config: {
    doc_type_id?: string        // type === 'upload'
    email_library_id?: string   // type === 'email'
    doc_library_id?: string     // type === 'generate_doc'
    // type === 'checklist' → sem config extra
  } & SubtaskOwnerConfig  // ← NOVO: merge com owner config
}
```

---

## 2. `types/process.ts`

**Acção:** Nenhuma alteração directa necessária.

O `ProcessTask` já importa `ProcSubtask` de `types/subtask.ts` (linha 2: `import type { ProcSubtask } from './subtask'`), e usa-o na linha 66 (`subtasks?: ProcSubtask[]`). Como estendemos `ProcSubtask` no passo anterior com `owner_id` e `owner`, o tipo propaga automaticamente.

**Verificação:** Confirmar que a query do `GET /api/processes/[id]` inclui o JOIN de `owners` nas subtarefas (ver passo 8).

---

## 3. `lib/constants.ts`

**Acção:** Adicionar labels PT-PT para os novos campos de owner scope e person type filter.

### O que fazer:

Adicionar **após a linha 461** (depois de `SUBTASK_TYPE_ICONS`), antes dos campos `OWNER_FIELDS_SINGULAR`:

```typescript
// Labels de Owner Scope para subtarefas (PT-PT)
export const OWNER_SCOPE_LABELS: Record<string, string> = {
  none: 'Sem multiplicação',
  all_owners: 'Todos os proprietários',
  main_contact_only: 'Apenas contacto principal',
}

// Labels de filtro por tipo de pessoa (PT-PT)
export const PERSON_TYPE_FILTER_LABELS: Record<string, string> = {
  all: 'Todos os tipos',
  singular: 'Apenas Pessoa Singular',
  coletiva: 'Apenas Pessoa Colectiva',
}
```

---

## 4. `lib/validations/template.ts`

**Acção:** Estender `subtaskSchema` com os novos campos de owner no `config`.

### O que fazer:

1. Adicionar os campos `owner_scope`, `person_type_filter`, `has_person_type_variants`, `singular_config` e `coletiva_config` ao objecto `config` dentro do `subtaskSchema`
2. Adicionar um segundo `.refine()` para validar que quando `has_person_type_variants` é true, as configurações variantes são fornecidas conforme o tipo da subtarefa

### Código:

Substituir o `config` object (linhas 13-19) por:

```typescript
    config: z
      .object({
        doc_type_id: z.string().optional(),
        email_library_id: z.string().optional(),
        doc_library_id: z.string().optional(),
        // Novos campos — multiplicação por proprietário
        owner_scope: z.enum(['none', 'all_owners', 'main_contact_only']).optional(),
        person_type_filter: z.enum(['all', 'singular', 'coletiva']).optional(),
        has_person_type_variants: z.boolean().optional(),
        singular_config: z
          .object({
            doc_type_id: z.string().optional(),
            email_library_id: z.string().optional(),
            doc_library_id: z.string().optional(),
          })
          .optional(),
        coletiva_config: z
          .object({
            doc_type_id: z.string().optional(),
            email_library_id: z.string().optional(),
            doc_library_id: z.string().optional(),
          })
          .optional(),
      })
      .default({}),
```

O `.refine()` existente (linhas 21-32) para validação tipo→config continua a funcionar. Adicionar um **segundo** `.refine()` encadeado para validar variantes:

```typescript
  .refine(
    (subtask) => {
      // Se has_person_type_variants está activo, validar que as variantes têm a config necessária por tipo
      if (!subtask.config?.has_person_type_variants) return true
      if (!subtask.config?.owner_scope || subtask.config.owner_scope === 'none') return true

      const type = subtask.type
      if (type === 'upload') {
        return (
          !!subtask.config.singular_config?.doc_type_id ||
          !!subtask.config.coletiva_config?.doc_type_id
        )
      }
      if (type === 'email') {
        return (
          !!subtask.config.singular_config?.email_library_id ||
          !!subtask.config.coletiva_config?.email_library_id
        )
      }
      if (type === 'generate_doc') {
        return (
          !!subtask.config.singular_config?.doc_library_id ||
          !!subtask.config.coletiva_config?.doc_library_id
        )
      }
      return true
    },
    {
      message: 'Quando variantes por tipo de pessoa estão activas, configure pelo menos uma variante',
      path: ['config'],
    }
  )
```

**Nota sobre o refine existente:** Quando `has_person_type_variants` é true, o campo base (ex: `doc_type_id`) deixa de ser obrigatório — as variantes substituem-no. O primeiro `.refine()` (linhas 21-32) precisa de um ajuste:

```typescript
  .refine(
    (subtask) => {
      // Se tem variantes por tipo, a config base não é obrigatória
      if (subtask.config?.has_person_type_variants && subtask.config?.owner_scope && subtask.config.owner_scope !== 'none') {
        return true
      }
      // upload: doc_type_id obrigatório
      if (subtask.type === 'upload') return !!subtask.config?.doc_type_id
      // email: email_library_id obrigatório
      if (subtask.type === 'email') return !!subtask.config?.email_library_id
      // generate_doc: doc_library_id obrigatório
      if (subtask.type === 'generate_doc') return !!subtask.config?.doc_library_id
      return true
    },
    { message: 'Configuração inválida para o tipo de subtarefa', path: ['config'] }
  )
```

---

## 5. `components/templates/subtask-editor.tsx`

**Acção:** Adicionar secção de configuração de proprietário no `SortableSubtaskRow` + badges visuais.

Esta é a alteração mais complexa da UI.

### O que fazer:

1. Importar `Users` e `Building2` do lucide-react
2. Importar `OWNER_SCOPE_LABELS` e `PERSON_TYPE_FILTER_LABELS` do constants
3. Importar `Label` do shadcn/ui
4. Adicionar secção colapsável de "Proprietário" dentro do `SortableSubtaskRow`, **após** a secção de config por tipo (linha 203) e **antes** do div de toggle obrigatória + eliminar (linha 206)
5. Adicionar badges visuais de multiplicação no header da row
6. Quando `has_person_type_variants` está activo, esconder o select base e mostrar dois selects (singular/colectiva)

### Estrutura da nova secção:

Dentro do `<div className="flex-1 min-w-0 space-y-2">` (linha 123), após todos os selects condicionais (após linha 203 `{/* checklist: não precisa de config extra — só o título */}`), adicionar:

```tsx
{/* Secção de configuração por proprietário */}
{(() => {
  const ownerScope = subtask.config.owner_scope
  const isMultiplied = ownerScope && ownerScope !== 'none'

  return (
    <div className="space-y-2 pt-1">
      {/* Badges visuais (quando multiplicação activa) */}
      {isMultiplied && (
        <div className="flex gap-1 flex-wrap">
          <Badge variant="outline" className="text-[10px] h-5 bg-blue-50 text-blue-700 border-blue-200">
            <Users className="h-3 w-3 mr-1" />
            {ownerScope === 'main_contact_only' ? 'Contacto Principal' : 'Por Proprietário'}
          </Badge>
          {subtask.config.person_type_filter && subtask.config.person_type_filter !== 'all' && (
            <Badge variant="outline" className="text-[10px] h-5">
              {subtask.config.person_type_filter === 'singular' ? 'Singular' : 'Colectiva'}
            </Badge>
          )}
          {subtask.config.has_person_type_variants && (
            <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-200">
              S/C
            </Badge>
          )}
        </div>
      )}

      {/* Toggle: Repetir por proprietário */}
      <div className="flex items-center gap-2">
        <Switch
          checked={!!isMultiplied}
          onCheckedChange={(checked) => {
            onUpdate(subtask.id, {
              config: {
                ...subtask.config,
                owner_scope: checked ? 'all_owners' : 'none',
                person_type_filter: checked ? 'all' : undefined,
                has_person_type_variants: checked ? undefined : undefined,
                singular_config: checked ? subtask.config.singular_config : undefined,
                coletiva_config: checked ? subtask.config.coletiva_config : undefined,
              },
            })
          }}
          className="scale-75"
        />
        <Label className="text-xs text-muted-foreground cursor-pointer">
          Repetir por proprietário
        </Label>
      </div>

      {/* Opções condicionais (visíveis quando multiplicação activa) */}
      {isMultiplied && (
        <div className="pl-4 border-l-2 border-muted space-y-2">
          {/* Select: Aplicar a que tipo de proprietário */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Aplicar a</Label>
            <Select
              value={subtask.config.person_type_filter || 'all'}
              onValueChange={(v) =>
                onUpdate(subtask.id, {
                  config: { ...subtask.config, person_type_filter: v as any },
                })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os proprietários</SelectItem>
                <SelectItem value="singular">Apenas Pessoa Singular</SelectItem>
                <SelectItem value="coletiva">Apenas Pessoa Colectiva</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Toggle: Apenas contacto principal */}
          <div className="flex items-center gap-2">
            <Switch
              checked={ownerScope === 'main_contact_only'}
              onCheckedChange={(checked) =>
                onUpdate(subtask.id, {
                  config: {
                    ...subtask.config,
                    owner_scope: checked ? 'main_contact_only' : 'all_owners',
                  },
                })
              }
              className="scale-75"
            />
            <Label className="text-[10px] text-muted-foreground">
              Apenas contacto principal
            </Label>
          </div>

          {/* Toggle: Config diferente por tipo de pessoa (só para tipos com config: upload, email, generate_doc) */}
          {subtask.type !== 'checklist' && (
            <>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!subtask.config.has_person_type_variants}
                  onCheckedChange={(checked) =>
                    onUpdate(subtask.id, {
                      config: {
                        ...subtask.config,
                        has_person_type_variants: checked || undefined,
                        singular_config: checked ? (subtask.config.singular_config || {}) : undefined,
                        coletiva_config: checked ? (subtask.config.coletiva_config || {}) : undefined,
                        // Quando activa variantes, limpar o campo base
                        ...(checked ? {
                          doc_type_id: undefined,
                          email_library_id: undefined,
                          doc_library_id: undefined,
                        } : {}),
                      },
                    })
                  }
                  className="scale-75"
                />
                <Label className="text-[10px] text-muted-foreground">
                  Configuração diferente por tipo de pessoa
                </Label>
              </div>

              {/* Variantes singular/colectiva */}
              {subtask.config.has_person_type_variants && (
                <div className="space-y-2 pl-2">
                  {/* Variante Singular */}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">
                      Pessoa Singular
                    </Label>
                    {/* Renderizar o select correcto com base no subtask.type */}
                    {/* (usar a mesma lógica dos selects base, mas apontar para singular_config) */}
                    {renderVariantSelect(subtask, 'singular', docTypes, docTypesByCategory, emailTemplates, docTemplates, onUpdate)}
                  </div>

                  {/* Variante Colectiva */}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">
                      Pessoa Colectiva
                    </Label>
                    {renderVariantSelect(subtask, 'coletiva', docTypes, docTypesByCategory, emailTemplates, docTemplates, onUpdate)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
})()}
```

### Helper function `renderVariantSelect`:

Adicionar **fora** do componente `SortableSubtaskRow` (helper no ficheiro):

```tsx
function renderVariantSelect(
  subtask: SubtaskData,
  variant: 'singular' | 'coletiva',
  docTypes: { id: string; name: string; category?: string }[],
  docTypesByCategory: Record<string, typeof docTypes>,
  emailTemplates: { id: string; name: string; subject: string }[],
  docTemplates: { id: string; name: string }[],
  onUpdate: (id: string, data: Partial<SubtaskData>) => void
) {
  const variantKey = variant === 'singular' ? 'singular_config' : 'coletiva_config'
  const currentConfig = subtask.config[variantKey] || {}

  const updateVariant = (field: string, value: string) => {
    onUpdate(subtask.id, {
      config: {
        ...subtask.config,
        [variantKey]: { ...currentConfig, [field]: value },
      },
    })
  }

  if (subtask.type === 'upload') {
    return (
      <Select
        value={currentConfig.doc_type_id || ''}
        onValueChange={(v) => updateVariant('doc_type_id', v)}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Tipo de documento..." />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(docTypesByCategory).map(([category, types]) => (
            <SelectGroup key={category}>
              <SelectLabel>{category}</SelectLabel>
              {types.map((dt) => (
                <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (subtask.type === 'email') {
    return (
      <Select
        value={currentConfig.email_library_id || ''}
        onValueChange={(v) => updateVariant('email_library_id', v)}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Template de email..." />
        </SelectTrigger>
        <SelectContent>
          {emailTemplates.map((et) => (
            <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (subtask.type === 'generate_doc') {
    return (
      <Select
        value={currentConfig.doc_library_id || ''}
        onValueChange={(v) => updateVariant('doc_library_id', v)}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Template de documento..." />
        </SelectTrigger>
        <SelectContent>
          {docTemplates.map((dt) => (
            <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return null
}
```

### Alteração no select base:

Quando `has_person_type_variants` está activo, os selects base (doc_type, email, generate_doc) nas linhas 138-201 devem ser **escondidos**. Envolver cada bloco de select com:

```tsx
{subtask.type === 'upload' && !subtask.config.has_person_type_variants && (
  // ... select existente ...
)}

{subtask.type === 'email' && !subtask.config.has_person_type_variants && (
  // ... select existente ...
)}

{subtask.type === 'generate_doc' && !subtask.config.has_person_type_variants && (
  // ... select existente ...
)}
```

### Novos imports necessários:

```typescript
import { Users } from 'lucide-react'               // adicionar ao import existente
import { Label } from '@/components/ui/label'
import { OWNER_SCOPE_LABELS, PERSON_TYPE_FILTER_LABELS } from '@/lib/constants'
```

---

## 6. `components/templates/template-builder.tsx`

**Acção:** Estender o mapeamento de subtarefas na inicialização para incluir os novos campos de owner.

### O que fazer:

No `useEffect` de inicialização (linhas 139-151), estender o mapeamento de cada subtarefa para preservar os campos de owner config ao carregar um template existente.

### Código:

Substituir o bloco de mapeamento de subtasks (linhas 139-151) por:

```typescript
subtasks: tplSubtasks.map((st) => ({
  id: st.id,
  title: st.title,
  description: st.description || undefined,
  is_mandatory: st.is_mandatory ?? true,
  order_index: st.order_index ?? 0,
  type: st.config?.type || deriveTypeFromLegacy(st.config || {}),
  config: {
    doc_type_id: st.config?.doc_type_id,
    email_library_id: st.config?.email_library_id,
    doc_library_id: st.config?.doc_library_id,
    // NOVO — Preservar campos de owner config
    owner_scope: st.config?.owner_scope,
    person_type_filter: st.config?.person_type_filter,
    has_person_type_variants: st.config?.has_person_type_variants,
    singular_config: st.config?.singular_config,
    coletiva_config: st.config?.coletiva_config,
  },
})),
```

---

## 7. `components/processes/task-form-action.tsx`

**Acção:** Mostrar badge de owner associado em cada subtarefa instanciada.

### O que fazer:

Na secção de renderização de cada subtarefa (dentro do `.map()`, linhas 115-181), adicionar um badge com o nome e tipo do proprietário quando a `proc_subtask` tem `owner_id` preenchido.

### Código:

Após o título da subtarefa (linha 163 `{subtask.title}`) e antes dos badges existentes (linha 167), adicionar:

```tsx
{/* Badge de proprietário (quando subtarefa multiplicada) */}
{subtask.owner && (
  <Badge
    variant="outline"
    className={cn(
      'text-[10px] px-1.5 py-0 shrink-0',
      subtask.owner.person_type === 'singular'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-purple-50 text-purple-700 border-purple-200'
    )}
  >
    {subtask.owner.person_type === 'singular' ? '👤' : '🏢'}{' '}
    {subtask.owner.name}
  </Badge>
)}
```

### Novos imports:

Nenhum novo import necessário — já importa `Badge` e `cn`.

### Nota sobre dados:

Para que `subtask.owner` esteja disponível, a query da API (passo 8) precisa de incluir o JOIN. O `ProcSubtask` type (passo 1) já inclui o campo `owner`.

---

## 8. `app/api/processes/[id]/route.ts`

**Acção:** Estender a query de subtarefas para incluir o JOIN com `owners`.

### O que fazer:

No `GET` handler (linha 233-248), na query de `proc_tasks`, estender o select de `subtasks:proc_subtasks` para incluir `owner_id` e o JOIN a `owners`.

### Código:

Substituir (linhas 240-243):

```
subtasks:proc_subtasks(
  id, title, is_mandatory, is_completed,
  completed_at, completed_by, order_index, config
)
```

Por:

```
subtasks:proc_subtasks(
  id, title, is_mandatory, is_completed,
  completed_at, completed_by, order_index, config,
  owner_id,
  owner:owners!proc_subtasks_owner_id_fkey(id, name, person_type)
)
```

**Nota:** O nome da FK constraint (`proc_subtasks_owner_id_fkey`) deve corresponder ao que é criado na migração (passo 9). Se o Supabase gerar um nome diferente, ajustar aqui.

---

## 9. Migração SQL — `proc_subtasks` (Supabase)

**Acção:** CRIAR migração para adicionar `owner_id` à tabela `proc_subtasks`.

### Onde executar:

Via MCP Supabase (`execute_sql`) ou no Dashboard do Supabase (SQL Editor).

### SQL:

```sql
-- Migração: Adicionar owner_id a proc_subtasks
-- Para suportar multiplicação de subtarefas por proprietário

-- 1. Adicionar coluna
ALTER TABLE proc_subtasks
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES owners(id) ON DELETE SET NULL;

-- 2. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_proc_subtasks_owner_id
  ON proc_subtasks(owner_id);

-- 3. Comentário
COMMENT ON COLUMN proc_subtasks.owner_id IS
  'Proprietário associado (quando subtarefa é multiplicada por owner via tpl_subtasks.config.owner_scope)';
```

---

## 10. Função SQL — `populate_process_tasks()` (Supabase)

**Acção:** MODIFICAR a função RPC para incluir lógica de fan-out de subtarefas.

### Contexto:

A função actual (ver PRD Apêndice A) copia subtarefas literalmente:

```sql
INSERT INTO proc_subtasks (proc_task_id, tpl_subtask_id, title, is_mandatory, order_index, config)
SELECT v_new_task_id, st.id, st.title, st.is_mandatory, st.order_index, st.config
FROM tpl_subtasks st WHERE st.tpl_task_id = v_task.tpl_task_id
ORDER BY st.order_index;
```

Este bloco aparece **duas vezes** no código (uma para tarefas com `owner_type`, outra para tarefas normais).

### O que fazer:

Substituir **ambos** os blocos de cópia literal de subtarefas por uma chamada a uma nova lógica de fan-out. A lógica deve:

1. Para cada `tpl_subtask`, verificar `config->>'owner_scope'`
2. Se `owner_scope` é null ou `'none'` → copiar literalmente (comportamento actual)
3. Se `owner_scope` é `'all_owners'` ou `'main_contact_only'`:
   - Se a `proc_task` pai **já tem** `owner_id` (tarefa já multiplicada) → herdar o owner_id, **sem re-multiplicar**
   - Se a `proc_task` pai **não tem** `owner_id` → fazer fan-out sobre os owners do imóvel, aplicando filtros de `person_type_filter` e `owner_scope`
4. Quando `has_person_type_variants` é true → resolver o config correcto (singular_config ou coletiva_config) baseado no `person_type` do owner

### SQL completo:

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
  -- NOVO: variáveis para fan-out de subtarefas
  v_subtask RECORD;
  v_sub_owner RECORD;
  v_owner_scope text;
  v_person_filter text;
  v_has_variants boolean;
  v_resolved_config jsonb;
  v_sub_order int;
BEGIN
  -- Buscar template e imóvel
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
      -- Multiplicação por owner ao nível da TAREFA (lógica existente)
      FOR v_owner IN
        SELECT po.owner_id, o.name AS owner_name, o.person_type
        FROM property_owners po
        JOIN owners o ON o.id = po.owner_id
        WHERE po.property_id = v_property_id
          AND o.person_type = v_owner_type
        ORDER BY po.is_main_contact DESC, o.name
      LOOP
        INSERT INTO proc_tasks (
          proc_instance_id, tpl_task_id, title, action_type, config,
          is_mandatory, assigned_role, sla_days, priority,
          stage_name, stage_order_index, order_index, owner_id, status
        ) VALUES (
          p_instance_id, v_task.tpl_task_id,
          v_task.title || ' — ' || v_owner.owner_name,
          v_task.action_type, v_task.config,
          v_task.is_mandatory, v_task.assigned_role, v_task.sla_days,
          COALESCE(v_task.priority, 'normal'),
          v_task.stage_name, v_task.stage_order, v_task.task_order,
          v_owner.owner_id, 'pending'
        )
        RETURNING id INTO v_new_task_id;

        IF v_task.has_subtasks THEN
          -- NOVO: usar lógica de fan-out em vez de cópia literal
          -- A tarefa-pai já tem owner_id → subtarefas herdam (sem re-multiplicar)
          PERFORM _populate_subtasks(
            v_new_task_id,
            v_task.tpl_task_id,
            v_property_id,
            v_owner.owner_id  -- owner_id da tarefa-pai
          );
        END IF;
      END LOOP;
    ELSE
      -- Tarefa normal (sem multiplicação por owner)
      INSERT INTO proc_tasks (
        proc_instance_id, tpl_task_id, title, action_type, config,
        is_mandatory, assigned_role, sla_days, priority,
        stage_name, stage_order_index, order_index, status
      ) VALUES (
        p_instance_id, v_task.tpl_task_id,
        v_task.title,
        v_task.action_type, v_task.config,
        v_task.is_mandatory, v_task.assigned_role, v_task.sla_days,
        COALESCE(v_task.priority, 'normal'),
        v_task.stage_name, v_task.stage_order, v_task.task_order,
        'pending'
      )
      RETURNING id INTO v_new_task_id;

      IF v_task.has_subtasks THEN
        -- NOVO: usar lógica de fan-out
        -- Tarefa-pai não tem owner_id → subtarefas podem fazer fan-out
        PERFORM _populate_subtasks(
          v_new_task_id,
          v_task.tpl_task_id,
          v_property_id,
          NULL  -- sem owner_id pai
        );
      END IF;
    END IF;
  END LOOP;
END;
$function$;
```

### Nova função auxiliar `_populate_subtasks`:

```sql
CREATE OR REPLACE FUNCTION public._populate_subtasks(
  p_proc_task_id uuid,
  p_tpl_task_id uuid,
  p_property_id uuid,
  p_parent_owner_id uuid  -- owner_id da proc_task pai (NULL se tarefa não multiplicada)
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_subtask RECORD;
  v_sub_owner RECORD;
  v_owner_scope text;
  v_person_filter text;
  v_has_variants boolean;
  v_resolved_config jsonb;
  v_sub_order int;
  v_loop_idx int;
BEGIN
  FOR v_subtask IN
    SELECT * FROM tpl_subtasks
    WHERE tpl_task_id = p_tpl_task_id
    ORDER BY order_index
  LOOP
    v_owner_scope := v_subtask.config->>'owner_scope';
    v_person_filter := COALESCE(v_subtask.config->>'person_type_filter', 'all');
    v_has_variants := COALESCE((v_subtask.config->>'has_person_type_variants')::boolean, false);

    IF v_owner_scope IS NOT NULL AND v_owner_scope != 'none' THEN
      -- === Fan-out: subtarefa multiplicada por proprietário ===

      IF p_parent_owner_id IS NOT NULL THEN
        -- A tarefa-pai já está associada a um owner → herdar sem re-multiplicar
        -- Verificar se o owner pai passa os filtros
        SELECT o.person_type INTO v_person_filter
        FROM owners o WHERE o.id = p_parent_owner_id;

        -- Resolver config para o owner pai
        v_resolved_config := v_subtask.config;
        IF v_has_variants THEN
          IF v_person_filter = 'singular' AND v_subtask.config ? 'singular_config' THEN
            v_resolved_config := v_subtask.config || (v_subtask.config->'singular_config');
          ELSIF v_person_filter = 'coletiva' AND v_subtask.config ? 'coletiva_config' THEN
            v_resolved_config := v_subtask.config || (v_subtask.config->'coletiva_config');
          END IF;
        END IF;

        INSERT INTO proc_subtasks (
          proc_task_id, tpl_subtask_id, title, is_mandatory,
          order_index, config, owner_id
        ) VALUES (
          p_proc_task_id, v_subtask.id, v_subtask.title,
          v_subtask.is_mandatory, v_subtask.order_index,
          v_resolved_config, p_parent_owner_id
        );

      ELSE
        -- Tarefa-pai NÃO tem owner → fan-out sobre os owners do imóvel
        v_loop_idx := 0;
        FOR v_sub_owner IN
          SELECT po.owner_id, o.name, o.person_type, po.is_main_contact
          FROM property_owners po
          JOIN owners o ON o.id = po.owner_id
          WHERE po.property_id = p_property_id
            AND (v_person_filter = 'all' OR o.person_type = v_person_filter)
            AND (v_owner_scope != 'main_contact_only' OR po.is_main_contact = true)
          ORDER BY po.is_main_contact DESC, o.name
        LOOP
          v_loop_idx := v_loop_idx + 1;

          -- Resolver config (se tem variantes por tipo de pessoa)
          v_resolved_config := v_subtask.config;
          IF v_has_variants THEN
            IF v_sub_owner.person_type = 'singular' AND v_subtask.config ? 'singular_config' THEN
              v_resolved_config := v_subtask.config || (v_subtask.config->'singular_config');
            ELSIF v_sub_owner.person_type = 'coletiva' AND v_subtask.config ? 'coletiva_config' THEN
              v_resolved_config := v_subtask.config || (v_subtask.config->'coletiva_config');
            END IF;
          END IF;

          INSERT INTO proc_subtasks (
            proc_task_id, tpl_subtask_id, title, is_mandatory,
            order_index, config, owner_id
          ) VALUES (
            p_proc_task_id,
            v_subtask.id,
            v_subtask.title || ' — ' || v_sub_owner.name,
            v_subtask.is_mandatory,
            v_subtask.order_index * 100 + v_loop_idx,
            v_resolved_config,
            v_sub_owner.owner_id
          );
        END LOOP;
      END IF;

    ELSE
      -- === Subtarefa normal (sem fan-out) — cópia literal ===
      INSERT INTO proc_subtasks (
        proc_task_id, tpl_subtask_id, title, is_mandatory,
        order_index, config
      ) VALUES (
        p_proc_task_id, v_subtask.id, v_subtask.title,
        v_subtask.is_mandatory, v_subtask.order_index, v_subtask.config
      );
    END IF;
  END LOOP;
END;
$function$;
```

---

## Ordem de Implementação

### Fase 1 — Base de Dados (executar primeiro, sem impacto no código existente)
1. **Passo 9** — Migração: `ALTER TABLE proc_subtasks ADD COLUMN owner_id`
2. **Passo 10** — Criar `_populate_subtasks()` + actualizar `populate_process_tasks()`

### Fase 2 — Types e Validações (sem impacto na UI existente)
3. **Passo 1** — `types/subtask.ts` — Estender tipos
4. **Passo 3** — `lib/constants.ts` — Adicionar labels
5. **Passo 4** — `lib/validations/template.ts` — Estender schema

### Fase 3 — Template Builder UI
6. **Passo 5** — `components/templates/subtask-editor.tsx` — Toggles + selects
7. **Passo 6** — `components/templates/template-builder.tsx` — Preservar campos na init

### Fase 4 — UI de Processo Instanciado
8. **Passo 8** — `app/api/processes/[id]/route.ts` — JOIN owners nas subtarefas
9. **Passo 7** — `components/processes/task-form-action.tsx` — Badge de owner

---

## Retrocompatibilidade

| Cenário | Comportamento |
|---------|---------------|
| Templates existentes sem `owner_scope` | Tratado como `undefined` → cópia literal (sem mudança) |
| `proc_subtasks` existentes sem `owner_id` | `NULL` → sem associação a proprietário |
| Tarefa com `owner_type` + subtarefas sem `owner_scope` | Subtarefas copiadas para cada proc_task (comportamento actual) |
| Tarefa com `owner_type` + subtarefas com `owner_scope` | Herdam o owner da proc_task pai (sem re-multiplicação) |
| APIs de templates (POST/PUT) | Já fazem spread do config → campos novos passam automaticamente |

---

## Cenários de Teste

| # | Cenário | Config | Resultado Esperado |
|---|---------|--------|--------------------|
| T1 | Template existente sem novos campos | `config: { type: 'upload', doc_type_id: '...' }` | Sem regressão — cópia literal |
| T2 | Subtarefa multiplicada para todos | `owner_scope: 'all_owners', person_type_filter: 'all'` (3 owners) | 3 proc_subtasks, uma por owner |
| T3 | Subtarefa apenas singulares | `owner_scope: 'all_owners', person_type_filter: 'singular'` (2 singulares + 1 colectivo) | 2 proc_subtasks |
| T4 | Subtarefa apenas contacto principal | `owner_scope: 'main_contact_only'` | 1 proc_subtask |
| T5 | Variantes S/C | `has_person_type_variants: true` com `singular_config.email_library_id` e `coletiva_config.email_library_id` | Cada proc_subtask tem o email_library_id correcto |
| T6 | Tarefa com owner_type + subtarefa com owner_scope | Tarefa: `owner_type: 'singular'`, Subtarefa: `owner_scope: 'all_owners'` | Herda owner da proc_task pai, sem re-multiplicar |
| T7 | 0 owners | `owner_scope: 'all_owners'` | 0 proc_subtasks criadas (loop vazio) |
| T8 | Re-aprovação (devolução + novo template) | Template diferente | Tarefas antigas eliminadas, novas populadas correctamente |
