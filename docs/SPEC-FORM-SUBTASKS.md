# SPEC — Subtarefas Form & Field

**Data:** 2026-03-10
**PRD:** [PRD-FORM-SUBTASKS.md](PRD-FORM-SUBTASKS.md)
**Resumo:** Adicionar 2 novos tipos de subtarefa (`form` e `field`) ao sistema de templates e processos, permitindo edição de dados de imóveis/proprietários directamente no fluxo processual.

---

## Visão Geral das Alterações

- **6 ficheiros a modificar**
- **7 ficheiros a criar**
- **0 migrações de base de dados** (config vive em JSONB existente)

---

## FASE 1 — Types, Registry, Constants, Validação

### 1.1 `types/subtask.ts` — Adicionar tipos form/field

**Estado actual (linha 3):**
```typescript
export type SubtaskType = 'upload' | 'checklist' | 'email' | 'generate_doc'
```

**O que fazer:**

1. Expandir `SubtaskType` union para incluir `'form' | 'field'`:
```typescript
export type SubtaskType = 'upload' | 'checklist' | 'email' | 'generate_doc' | 'form' | 'field'
```

2. Adicionar novos tipos **depois** da interface `SubtaskOwnerConfig` (após linha 24):
```typescript
// ═══════════════════════════════════════════════
// Tipos para subtarefas Form & Field
// ═══════════════════════════════════════════════

export type FormTargetEntity =
  | 'property'           // dev_properties
  | 'property_specs'     // dev_property_specifications
  | 'property_internal'  // dev_property_internal
  | 'owner'              // owners (via property_owners junction)
  | 'property_owner'     // property_owners (ownership_percentage, is_main_contact)

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'date'
  | 'email'
  | 'phone'

export interface FormFieldConfig {
  field_name: string
  label: string
  field_type: FormFieldType
  target_entity: FormTargetEntity
  required?: boolean
  help_text?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  options_from_constant?: string
  min?: number
  max?: number
  width?: 'full' | 'half' | 'third'
  order_index: number
}

export interface FormSectionConfig {
  title: string
  description?: string
  fields: FormFieldConfig[]
  order_index: number
}

export interface FormSubtaskConfig {
  type: 'form'
  form_title?: string
  sections: FormSectionConfig[]
}

export interface FieldSubtaskConfig {
  type: 'field'
  field: FormFieldConfig
  show_current_value?: boolean
  auto_complete_on_save?: boolean
}
```

3. Expandir `TplSubtask.config` (linha 43-52) — adicionar campos opcionais form/field ao tipo existente:
```typescript
config: {
  type?: SubtaskType
  doc_type_id?: string
  email_library_id?: string
  doc_library_id?: string
  check_type?: 'field' | 'document' | 'manual'
  field_name?: string
  alerts?: AlertsConfig
  // Form subtask config
  form_title?: string
  sections?: FormSectionConfig[]
  // Field subtask config (campo único)
  field?: FormFieldConfig
  show_current_value?: boolean
  auto_complete_on_save?: boolean
} & SubtaskOwnerConfig
```

4. Expandir `ProcSubtask.config` (linha 88-97) — mesmos campos adicionais:
```typescript
config: {
  type?: SubtaskType
  check_type?: 'field' | 'document' | 'manual'
  field_name?: string
  doc_type_id?: string
  email_library_id?: string
  doc_library_id?: string
  rendered?: Record<string, unknown>
  // Form subtask config
  form_title?: string
  sections?: FormSectionConfig[]
  // Field subtask config
  field?: FormFieldConfig
  show_current_value?: boolean
  auto_complete_on_save?: boolean
  [key: string]: unknown
} & SubtaskOwnerConfig
```

5. Expandir `SubtaskData.config` (linha 116-122) — mesmos campos:
```typescript
config: {
  doc_type_id?: string
  email_library_id?: string
  doc_library_id?: string
  alerts?: AlertsConfig
  // Form subtask config
  form_title?: string
  sections?: FormSectionConfig[]
  // Field subtask config
  field?: FormFieldConfig
  show_current_value?: boolean
  auto_complete_on_save?: boolean
} & SubtaskOwnerConfig
```

---

### 1.2 `lib/form-field-registry.ts` — CRIAR (novo ficheiro)

**Criar em:** `lib/form-field-registry.ts`

**O que fazer:** Copiar o registry completo do PRD secção 4 (linhas 468-883). Este ficheiro exporta:

- `FieldRegistryEntry` interface
- `FIELD_REGISTRY: FieldRegistryEntry[]` — catálogo de ~35 campos agrupados por categoria
- `getFieldsByCategory()` — helper que agrupa por `category`
- `getRegistryField(fieldName, targetEntity)` — lookup por campo

**Categorias definidas:**
- Imóvel — Dados Gerais (8 campos: title, description, listing_price, property_type, business_type, property_condition, energy_certificate, external_ref)
- Imóvel — Localização (4 campos: city, zone, address_street, postal_code)
- Especificações (12 campos: typology, bedrooms, bathrooms, area_gross, area_util, construction_year, parking_spaces, has_elevator, solar_orientation, views, equipment, features)
- Contrato / Dados Internos (7 campos: commission_agreed, commission_type, contract_regime, contract_expiry, imi_value, condominium_fee, internal_notes)
- Proprietário — Identificação (8 campos: name, email, phone, nif, nationality, marital_status, address, person_type)
- Proprietário — Empresa (2 campos: legal_representative_name, legal_representative_nif)
- Participação no Imóvel (2 campos: ownership_percentage, is_main_contact)

**Importações necessárias:** Importar `FormFieldType` e `FormTargetEntity` de `@/types/subtask`.

**Nota:** NÃO importar constantes (`PROPERTY_TYPES`, etc.) neste ficheiro — o `options_from_constant` é uma string que será resolvida em runtime pelo renderer.

---

### 1.3 `lib/constants.ts` — Adicionar form e field aos SUBTASK_TYPES

**Modificar linhas 556-561** — Adicionar 2 entries ao array `SUBTASK_TYPES`:
```typescript
export const SUBTASK_TYPES = [
  { type: 'upload' as const, label: 'Upload de Documento', icon: 'Upload', color: 'text-blue-500' },
  { type: 'checklist' as const, label: 'Checklist (Manual)', icon: 'CheckSquare', color: 'text-slate-500' },
  { type: 'email' as const, label: 'Envio de Email', icon: 'Mail', color: 'text-amber-500' },
  { type: 'generate_doc' as const, label: 'Gerar Documento', icon: 'FileText', color: 'text-purple-500' },
  { type: 'form' as const, label: 'Formulário (multi-campo)', icon: 'ClipboardList', color: 'text-teal-500' },
  { type: 'field' as const, label: 'Campo Único (inline)', icon: 'TextCursorInput', color: 'text-cyan-500' },
] as const
```

**Modificar linhas 563-572** — Adicionar labels ao `SUBTASK_TYPE_LABELS`:
```typescript
export const SUBTASK_TYPE_LABELS: Record<string, string> = {
  upload: 'Upload',
  checklist: 'Checklist',
  email: 'Email',
  generate_doc: 'Gerar Doc',
  form: 'Formulário',
  field: 'Campo',
  // Legacy
  manual: 'Checklist',
  field: 'Campo',    // nota: colisão com legacy — manter apenas 'Campo'
  document: 'Documento',
}
```

**Modificar linhas 574-579** — Adicionar ícones ao `SUBTASK_TYPE_ICONS`:
```typescript
export const SUBTASK_TYPE_ICONS: Record<string, string> = {
  upload: 'Upload',
  checklist: 'CheckSquare',
  email: 'Mail',
  generate_doc: 'FileText',
  form: 'ClipboardList',
  field: 'TextCursorInput',
}
```

**Nota sobre colisão:** O `SUBTASK_TYPE_LABELS` já tem `field: 'Campo'` como legacy check_type. O novo tipo `field` usa o mesmo label, por isso não há conflito prático. Se necessário, renomear o legacy para `check_field` internamente.

---

### 1.4 `lib/validations/template.ts` — Expandir validação Zod

**Modificar linha 11** — Expandir enum de tipos:
```typescript
type: z.enum(['upload', 'checklist', 'email', 'generate_doc', 'form', 'field'], {
  message: 'Tipo de subtarefa inválido',
}),
```

**Modificar linhas 22-46** — Expandir schema do `config` object para incluir campos form/field:
```typescript
config: z
  .object({
    doc_type_id: z.string().optional(),
    email_library_id: z.string().optional(),
    doc_library_id: z.string().optional(),
    // Owner config
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
    // Form config (type === 'form')
    form_title: z.string().optional(),
    sections: z.array(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      order_index: z.number().int().min(0),
      fields: z.array(z.object({
        field_name: z.string().min(1),
        label: z.string().min(1),
        field_type: z.enum([
          'text', 'textarea', 'number', 'currency', 'percentage',
          'select', 'multiselect', 'checkbox', 'date', 'email', 'phone',
        ]),
        target_entity: z.enum([
          'property', 'property_specs', 'property_internal',
          'owner', 'property_owner',
        ]),
        required: z.boolean().optional(),
        help_text: z.string().optional(),
        placeholder: z.string().optional(),
        options: z.array(z.object({
          value: z.string(),
          label: z.string(),
        })).optional(),
        options_from_constant: z.string().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        width: z.enum(['full', 'half', 'third']).optional(),
        order_index: z.number().int().min(0),
      })).min(1),
    })).optional(),
    // Field config (type === 'field')
    field: z.object({
      field_name: z.string().min(1),
      label: z.string().min(1),
      field_type: z.enum([
        'text', 'textarea', 'number', 'currency', 'percentage',
        'select', 'multiselect', 'checkbox', 'date', 'email', 'phone',
      ]),
      target_entity: z.enum([
        'property', 'property_specs', 'property_internal',
        'owner', 'property_owner',
      ]),
      required: z.boolean().optional(),
      help_text: z.string().optional(),
      placeholder: z.string().optional(),
      options: z.array(z.object({
        value: z.string(),
        label: z.string(),
      })).optional(),
      options_from_constant: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      width: z.enum(['full', 'half', 'third']).optional(),
      order_index: z.number().int().min(0),
    }).optional(),
    show_current_value: z.boolean().optional(),
    auto_complete_on_save: z.boolean().optional(),
  })
  .default({}),
```

**Modificar primeiro `.refine()` (linhas 48-63)** — Adicionar validação para form e field:
```typescript
.refine(
  (subtask) => {
    if (subtask.config?.has_person_type_variants && subtask.config?.owner_scope && subtask.config.owner_scope !== 'none') {
      return true
    }
    if (subtask.type === 'upload') return !!subtask.config?.doc_type_id
    if (subtask.type === 'email') return !!subtask.config?.email_library_id
    if (subtask.type === 'generate_doc') return !!subtask.config?.doc_library_id
    // Form: precisa de sections com pelo menos 1 campo
    if (subtask.type === 'form') {
      const sections = subtask.config?.sections
      return !!sections && sections.length > 0 && sections.every(s => s.fields.length > 0)
    }
    // Field: precisa de campo com field_name e target_entity
    if (subtask.type === 'field') {
      const field = subtask.config?.field
      return !!field && !!field.field_name && !!field.target_entity && !!field.field_type
    }
    return true
  },
  { message: 'Configuração inválida para o tipo de subtarefa', path: ['config'] }
)
```

---

## FASE 2 — Dynamic Form Renderer + Resolução de Opções

### 2.1 `lib/form-options-resolver.ts` — CRIAR (novo ficheiro)

**Criar em:** `lib/form-options-resolver.ts`

**O que fazer:** Função que resolve `options_from_constant` para arrays de `{ value, label }`:

```typescript
import {
  PROPERTY_TYPES, BUSINESS_TYPES, PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES, TYPOLOGIES, CONTRACT_REGIMES,
  SOLAR_ORIENTATIONS, VIEWS, EQUIPMENT, FEATURES,
  MARITAL_STATUS,
} from '@/lib/constants'

const CONSTANT_MAP: Record<string, readonly string[] | { value: string; label: string }[]> = {
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES,
  TYPOLOGIES,
  CONTRACT_REGIMES,
  SOLAR_ORIENTATIONS,
  VIEWS,
  EQUIPMENT,
  FEATURES,
  MARITAL_STATUS,
}

export function resolveOptionsFromConstant(
  constantName?: string
): { value: string; label: string }[] {
  if (!constantName) return []
  const constant = CONSTANT_MAP[constantName]
  if (!constant) return []
  // Se já é array de objects { value, label }
  if (typeof constant[0] === 'object') return constant as { value: string; label: string }[]
  // Se é array de strings, converter
  return (constant as readonly string[]).map(s => ({ value: s, label: s }))
}
```

**Nota:** Verificar no `lib/constants.ts` o formato exacto de cada constante (string[] vs { value, label }[]) e adaptar o mapping. Algumas constantes como `PROPERTY_TYPES` podem já ser arrays de objects — nesse caso passam directamente.

---

### 2.2 `components/processes/dynamic-form-renderer.tsx` — CRIAR (novo ficheiro)

**Criar em:** `components/processes/dynamic-form-renderer.tsx`

**O que fazer:** Componente central que renderiza formulários dinâmicos a partir de `FormSectionConfig[]`. Segue o padrão descrito no PRD secção 5.

**Responsabilidades:**
1. Receber `sections`, `defaultValues`, `onSubmit`, `isSubmitting`
2. Gerar schema Zod dinamicamente com `buildZodSchema(sections)` — chave composta `${target_entity}__${field_name}`
3. Usar `react-hook-form` + `zodResolver`
4. Renderizar secções como `Card` com `CardHeader`/`CardContent`
5. Renderizar campos num grid `grid-cols-12` com colSpan baseado em `width`
6. Agrupar valores por `target_entity` no submit antes de chamar `onSubmit`

**ComponentMap — field renderers inline neste ficheiro:**
- `TextFieldRenderer` — `<Input>` simples
- `TextareaFieldRenderer` — `<Textarea>`
- `NumberFieldRenderer` — `<Input type="number">`
- `CurrencyFieldRenderer` — `<Input type="number">` com prefixo `€`
- `PercentageFieldRenderer` — `<Input type="number">` com sufixo `%`
- `SelectFieldRenderer` — `<Select>` com resolução de opções via `resolveOptionsFromConstant`
- `MultiselectFieldRenderer` — checkboxes com badges (mesmo padrão de `property-form.tsx` linhas 571-652)
- `CheckboxFieldRenderer` — `<Checkbox>` com label
- `DateFieldRenderer` — `<DatePicker>` (Calendar + Popover, padrão shadcn)
- `EmailFieldRenderer` — `<Input type="email">`
- `PhoneFieldRenderer` — `<Input type="tel">`

**Interface exportada:**
```typescript
interface FieldRendererProps {
  field: FormFieldConfig
  name: string
  control: Control<any>
}
```

**Padrão de cada renderer:** Usar `<FormField>` + `<FormItem>` + `<FormLabel>` + `<FormControl>` + `<FormMessage>` do shadcn/ui Form. Ver PRD secção 5.2 para exemplos exactos.

**Exportar:** `DynamicFormRenderer`, `FIELD_COMPONENTS`, `FieldRendererProps`, `buildZodSchema`

---

## FASE 3 — API Endpoint (GET + PUT)

### 3.1 `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form/route.ts` — CRIAR (novo ficheiro)

**Criar em:** `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form/route.ts`

**O que fazer:** Endpoint com GET e PUT para carregar e guardar dados de formulário.

#### GET — Carregar dados actuais

1. Receber `params: { id, taskId, subtaskId }`
2. Buscar `proc_subtasks` por `subtaskId` → obter `config` e `owner_id`
3. Buscar `proc_instances` por `id` → obter `property_id`
4. Extrair todos os campos da config:
   - Se `config.type === 'form'`: `fields = config.sections.flatMap(s => s.fields)`
   - Se `config.type === 'field'`: `fields = [config.field]`
5. Determinar entidades únicas: `new Set(fields.map(f => f.target_entity))`
6. Para cada entidade, fazer SELECT apenas dos campos necessários:
   - `property` → `SELECT field_names FROM dev_properties WHERE id = property_id`
   - `property_specs` → `SELECT field_names FROM dev_property_specifications WHERE property_id = ...`
   - `property_internal` → `SELECT field_names FROM dev_property_internal WHERE property_id = ...`
   - `owner` → `SELECT field_names FROM owners WHERE id = subtask.owner_id`
   - `property_owner` → `SELECT field_names FROM property_owners WHERE property_id = ... AND owner_id = ...`
7. Montar objecto `values` com chaves `${target_entity}__${field_name}`
8. Retornar `{ values, config }`

**Padrão de auth:** Usar `createClient()` do `@/lib/supabase/server` (com cookies).

#### PUT — Upsert dados

1. Receber body agrupado por entidade: `{ property: {...}, property_specs: {...}, ... }`
2. Buscar `property_id` do `proc_instances`
3. Para cada entidade com dados:
   - `property` → `supabase.from('dev_properties').update(body.property).eq('id', propertyId)`
   - `property_specs` → `supabase.from('dev_property_specifications').upsert({ property_id: propertyId, ...body.property_specs })`
   - `property_internal` → `supabase.from('dev_property_internal').upsert({ property_id: propertyId, ...body.property_internal })`
   - `owner` → buscar `owner_id` da subtask, `supabase.from('owners').update(body.owner).eq('id', owner_id)`
   - `property_owner` → `supabase.from('property_owners').update(body.property_owner).eq('property_id', propertyId).eq('owner_id', owner_id)`
4. Retornar `{ success: true }`

**Padrão seguido:** Mesmo padrão de `app/api/properties/[id]/route.ts` (PUT) — verificar `Object.keys(body.entity).length > 0` antes de cada operação.

---

## FASE 4 — Componentes de Execução (Processo Activo)

### 4.1 `components/processes/form-subtask-dialog.tsx` — CRIAR (novo ficheiro)

**Criar em:** `components/processes/form-subtask-dialog.tsx`

**O que fazer:** Modal Sheet que renderiza formulário completo para subtarefas tipo `form`.

**Responsabilidades:**
1. Receber props: `subtask: ProcSubtask`, `processId`, `taskId`, `open`, `onOpenChange`, `onCompleted`
2. No mount (ou quando `open` muda para true): `GET /api/processes/{processId}/tasks/{taskId}/subtasks/{subtask.id}/form` → carregar `values` e `config`
3. Extrair `sections` de `config.sections`
4. Renderizar `<Sheet>` com:
   - `SheetHeader` com título (`config.form_title` ou subtask.title)
   - `SheetContent` com `<DynamicFormRenderer>` passando `sections`, `defaultValues`, `onSubmit`
5. No `onSubmit`: `PUT /api/processes/{processId}/tasks/{taskId}/subtasks/{subtask.id}/form` → chamar `onCompleted()` em caso de sucesso
6. Loading state: Skeleton enquanto carrega dados
7. Se subtarefa já concluída (`is_completed`): mostrar dados em read-only com botão "Editar novamente"

**Padrão seguido:** Mesmo padrão de `components/documents/document-upload-dialog.tsx` — Dialog controlado externamente, estado interno, cleanup on close.

---

### 4.2 `components/processes/field-subtask-inline.tsx` — CRIAR (novo ficheiro)

**Criar em:** `components/processes/field-subtask-inline.tsx`

**O que fazer:** Componente inline que renderiza um campo único dentro do card da subtarefa.

**Responsabilidades:**
1. Receber props: `subtask: ProcSubtask`, `processId`, `taskId`, `onCompleted`
2. Extrair `config.field` (FormFieldConfig) e opções (`show_current_value`, `auto_complete_on_save`)
3. No mount: `GET .../form` → carregar valor actual do campo
4. **Estado pendente/editing:** Renderizar input inline usando o mesmo renderer do `FIELD_COMPONENTS` + botão "Guardar"
5. **Ao guardar:** `PUT .../form` com `{ [field.target_entity]: { [field.field_name]: value } }` → toast success → se `auto_complete_on_save !== false`, chamar `onCompleted()`
6. **Estado concluído:** Mostrar valor formatado + botão "Editar"

**Renderização:** Usar `useForm` do react-hook-form com 1 campo apenas. Reutilizar os field renderers exportados de `dynamic-form-renderer.tsx`.

**Layout:** Compacto, dentro de `div` com `border rounded-md p-3` — NÃO abrir modal.

---

### 4.3 `components/processes/subtask-card-list.tsx` — MODIFICAR

**Ficheiro:** `components/processes/subtask-card-list.tsx`

**O que modificar:**

1. **Imports (topo do ficheiro):** Adicionar imports:
```typescript
import { FormSubtaskDialog } from './form-subtask-dialog'
import { FieldSubtaskInline } from './field-subtask-inline'
```

2. **State (dentro do componente, ~linha 48-51):** Adicionar state para o form dialog:
```typescript
const [openFormSubtask, setOpenFormSubtask] = useState<ProcSubtask | null>(null)
```

3. **`getSubtaskType` (linhas 68-75):** Já retorna `config.type` como string — os novos tipos `'form'` e `'field'` serão resolvidos automaticamente. Não é preciso alterar.

4. **`renderCard` switch (linhas 132-183):** Adicionar 2 cases antes do `default`:
```typescript
case 'form':
  return (
    <SubtaskCardChecklist
      key={subtask.id}
      subtask={subtask}
      onToggle={async () => setOpenFormSubtask(subtask)}
      isFormTrigger
    />
  )
case 'field':
  return (
    <SubtaskCardField
      key={subtask.id}
      subtask={subtask}
      processId={processId}
      taskId={task.id}
      onCompleted={async () => {
        await onSubtaskToggle(task.id, subtask.id, true)
        onTaskUpdate()
      }}
    />
  )
```

**Nota sobre o case `form`:** Inicialmente, podemos reutilizar `SubtaskCardChecklist` como wrapper visual (mostra ícone + título + badge) e ao clicar abre o `FormSubtaskDialog`. Alternativamente, criar um componente `SubtaskCardForm` dedicado — depende da complexidade desejada. A abordagem mais simples é tratar o card `form` como um checklist que ao invés de toggle, abre o dialog.

**Abordagem recomendada para `form`:** Criar um wrapper leve `SubtaskCardForm` que usa `SubtaskCardBase` e mostra botão "Preencher" que abre o dialog. Ver secção 4.5.

5. **Render do FormSubtaskDialog (após o `SubtaskDocSheet`, ~linha 268):**
```typescript
{openFormSubtask && (
  <FormSubtaskDialog
    subtask={openFormSubtask}
    processId={processId}
    taskId={task.id}
    open={!!openFormSubtask}
    onOpenChange={(v) => { if (!v) setOpenFormSubtask(null) }}
    onCompleted={async () => {
      await onSubtaskToggle(task.id, openFormSubtask.id, true)
      onTaskUpdate()
      setOpenFormSubtask(null)
    }}
  />
)}
```

---

### 4.4 `components/processes/subtask-card-base.tsx` — MODIFICAR (mínimo)

**Ficheiro:** `components/processes/subtask-card-base.tsx`

**O que modificar:** Nada estrutural. O `SubtaskCardBase` já é genérico — recebe `icon`, `typeLabel`, e `children`. Os novos tipos passam os seus próprios ícones e labels via props.

Se necessário, apenas garantir que o componente permite `children` com altura variável (para o `field` inline que pode ser mais alto que um checklist normal).

---

### 4.5 `components/processes/subtask-card-form.tsx` — CRIAR (novo ficheiro)

**Criar em:** `components/processes/subtask-card-form.tsx`

**O que fazer:** Card específico para subtarefas tipo `form`.

**Responsabilidades:**
1. Usa `SubtaskCardBase` com ícone `ClipboardList` e typeLabel "Formulário"
2. **Estado pendente:** Mostra botão "Preencher Formulário" que chama `onOpenSheet(subtask)`
3. **Estado concluído:** Mostra badge "Preenchido" + botão "Reverter" + botão "Editar" (re-abre o dialog)
4. Respeita `is_blocked` (desactiva botão)

**Props:**
```typescript
interface SubtaskCardFormProps {
  subtask: ProcSubtask
  onOpenSheet: (subtask: ProcSubtask) => void
  onRevert: (subtaskId: string) => void
}
```

---

### 4.6 `components/processes/subtask-card-field.tsx` — CRIAR (novo ficheiro)

**Criar em:** `components/processes/subtask-card-field.tsx`

**O que fazer:** Card específico para subtarefas tipo `field` — wrapper que integra `SubtaskCardBase` + `FieldSubtaskInline`.

**Responsabilidades:**
1. Usa `SubtaskCardBase` com ícone `TextCursorInput` e typeLabel "Campo"
2. No `children` do CardBase: renderiza `<FieldSubtaskInline>` directamente — o input fica **dentro** do card
3. Respeita `is_blocked` (desactiva edição)

**Props:**
```typescript
interface SubtaskCardFieldProps {
  subtask: ProcSubtask
  processId: string
  taskId: string
  onCompleted: () => Promise<void>
}
```

---

## FASE 5 — Template Builder (Config UI)

### 5.1 `components/templates/form-field-picker.tsx` — CRIAR (novo ficheiro)

**Criar em:** `components/templates/form-field-picker.tsx`

**O que fazer:** Componente que permite seleccionar campos do registry. Funciona em dois modos:

#### Modo `form` (multi-field com secções):
1. Lado esquerdo: categorias do registry (accordion ou lista)
2. Lado direito: campos disponíveis com checkboxes
3. Parte inferior: campos seleccionados organizados por secções, com drag-to-reorder
4. Botão "+ Nova Secção" para criar secções
5. Cada campo tem botão ⚙️ (config: required, width, placeholder, help_text) e 🗑️ (remover)

#### Modo `field` (single-field):
1. Search input para filtrar campos
2. Lista de campos por categoria com radio buttons (apenas 1 seleccionável)
3. Ao seleccionar: mostrar opções inline (show_current_value, auto_complete_on_save, required, placeholder)

**Props:**
```typescript
interface FormFieldPickerProps {
  mode: 'form' | 'field'
  // Modo form:
  sections?: FormSectionConfig[]
  onSectionsChange?: (sections: FormSectionConfig[]) => void
  // Modo field:
  field?: FormFieldConfig | null
  onFieldChange?: (field: FormFieldConfig | null) => void
  // Opções do field:
  showCurrentValue?: boolean
  onShowCurrentValueChange?: (v: boolean) => void
  autoCompleteOnSave?: boolean
  onAutoCompleteOnSaveChange?: (v: boolean) => void
}
```

**Importações necessárias:** `FIELD_REGISTRY`, `getFieldsByCategory` de `@/lib/form-field-registry`

---

### 5.2 `components/templates/subtask-config-dialog.tsx` — MODIFICAR

**Ficheiro:** `components/templates/subtask-config-dialog.tsx`

**O que modificar:**

1. **Imports (topo):** Adicionar:
```typescript
import { ClipboardList, TextCursorInput } from 'lucide-react'
import { FormFieldPicker } from './form-field-picker'
```

2. **`TYPE_ICONS` (linha 65-70):** Adicionar:
```typescript
const TYPE_ICONS: Record<string, React.ElementType> = {
  upload: Upload,
  checklist: CheckSquare,
  email: Mail,
  generate_doc: FileText,
  form: ClipboardList,
  field: TextCursorInput,
}
```

3. **Secção "Dados" do painel direito:** Adicionar renderização condicional para quando `local.type === 'form'` ou `local.type === 'field'`:

**Para `form`:** Após os selectors existentes (doc_type, email_template, doc_template), adicionar:
```tsx
{local.type === 'form' && (
  <div className="space-y-3">
    <Label>Título do Formulário (opcional)</Label>
    <Input
      value={local.config.form_title || ''}
      onChange={(e) => updateConfig({ form_title: e.target.value })}
      placeholder="Ex: Completar Dados do Imóvel"
    />
    <Separator />
    <Label>Campos do Formulário</Label>
    <FormFieldPicker
      mode="form"
      sections={local.config.sections || []}
      onSectionsChange={(sections) => updateConfig({ sections })}
    />
  </div>
)}
```

**Para `field`:** Após os selectors existentes, adicionar:
```tsx
{local.type === 'field' && (
  <div className="space-y-3">
    <Label>Campo a Vincular</Label>
    <FormFieldPicker
      mode="field"
      field={local.config.field || null}
      onFieldChange={(field) => updateConfig({ field: field || undefined })}
      showCurrentValue={local.config.show_current_value ?? true}
      onShowCurrentValueChange={(v) => updateConfig({ show_current_value: v })}
      autoCompleteOnSave={local.config.auto_complete_on_save ?? true}
      onAutoCompleteOnSaveChange={(v) => updateConfig({ auto_complete_on_save: v })}
    />
  </div>
)}
```

4. **Validação de tipos `form`/`field` não precisam de doc_type_id/email_library_id:** Garantir que os blocos de validação existentes (que verificam `doc_type_id` para upload, etc.) NÃO se aplicam aos novos tipos. Os refinements em `template.ts` já tratam disso, mas verificar se a UI mostra avisos de "config em falta" para form/field — nesse caso, adicionar lógica para considerar `sections` e `field` como "config válida".

---

### 5.3 `components/templates/subtask-editor.tsx` — MODIFICAR

**Ficheiro:** `components/templates/subtask-editor.tsx`

**O que modificar:**

1. **`ICON_MAP` (linha 54-59):** Adicionar ícones:
```typescript
const ICON_MAP: Record<string, React.ElementType> = {
  Upload,
  CheckSquare,
  Mail,
  FileText,
  ClipboardList,     // form
  TextCursorInput,   // field
}
```

2. **Imports (topo):** Adicionar `ClipboardList, TextCursorInput` ao import do lucide-react.

3. **Dropdown "Add Subtask" (procurar onde se renderiza `SUBTASK_TYPES.map`):** Os novos tipos já aparecem automaticamente porque são lidos do array `SUBTASK_TYPES` de `lib/constants.ts`. Apenas garantir que os ícones são resolvidos correctamente via `ICON_MAP[type.icon]`.

4. **Feature indicators (badges de config):** Para tipos `form` e `field`, mostrar badge visual adicional:
   - `form`: mostrar contagem de campos (ex: "6 campos") se `config.sections` existir
   - `field`: mostrar nome do campo seleccionado se `config.field` existir

---

## Resumo dos Ficheiros

### Ficheiros a CRIAR (7):

| # | Ficheiro | Fase | Descrição |
|---|----------|------|-----------|
| 1 | `lib/form-field-registry.ts` | 1 | Catálogo de ~35 campos editáveis por entidade |
| 2 | `lib/form-options-resolver.ts` | 2 | Resolve `options_from_constant` para arrays de opções |
| 3 | `components/processes/dynamic-form-renderer.tsx` | 2 | Renderer dinâmico com componentMap + Zod schema builder |
| 4 | `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form/route.ts` | 3 | GET (dados actuais) + PUT (upsert multi-tabela) |
| 5 | `components/processes/form-subtask-dialog.tsx` | 4 | Sheet/Dialog para formulário completo (tipo `form`) |
| 6 | `components/processes/field-subtask-inline.tsx` | 4 | Input inline dentro do card (tipo `field`) |
| 7 | `components/templates/form-field-picker.tsx` | 5 | Picker de campos do registry (modo multi + single) |

### Ficheiros a MODIFICAR (6):

| # | Ficheiro | Fase | O que muda |
|---|----------|------|------------|
| 1 | `types/subtask.ts` | 1 | +2 tipos no union, +7 interfaces/types, expandir config das 3 interfaces |
| 2 | `lib/constants.ts` | 1 | +2 entries em SUBTASK_TYPES, SUBTASK_TYPE_LABELS, SUBTASK_TYPE_ICONS |
| 3 | `lib/validations/template.ts` | 1 | +2 tipos no enum, +sections/field no config schema, +2 cases no refine |
| 4 | `components/processes/subtask-card-list.tsx` | 4 | +2 imports, +1 state, +2 cases no switch, +1 dialog render |
| 5 | `components/templates/subtask-config-dialog.tsx` | 5 | +2 ícones, +renderização condicional form/field no painel "Dados" |
| 6 | `components/templates/subtask-editor.tsx` | 5 | +2 ícones no ICON_MAP, +badges de info para form/field |

### Ficheiros de REFERÊNCIA (não modificar):

| Ficheiro | Padrão útil |
|----------|-------------|
| `components/properties/property-form.tsx` | Multi-section form com react-hook-form + zod |
| `app/api/properties/[id]/route.ts` | Upsert por entidade (property + specs + internal) |
| `components/documents/document-upload-dialog.tsx` | Dialog controlado com estado interno |

### Ficheiros NÃO mencionados no PRD mas que podem precisar de ajuste:

| Ficheiro | Possível ajuste |
|----------|-----------------|
| `components/processes/subtask-card-base.tsx` | Nenhum — já genérico |
| `components/processes/task-detail-actions.tsx` | Nenhum — delega ao subtask-card-list |

---

## Ordem de Implementação Recomendada

1. **types/subtask.ts** → Tipos base (tudo depende disto)
2. **lib/form-field-registry.ts** → Registry de campos
3. **lib/constants.ts** → Labels e ícones
4. **lib/validations/template.ts** → Validação Zod
5. **lib/form-options-resolver.ts** → Resolver de opções
6. **components/processes/dynamic-form-renderer.tsx** → Renderer central
7. **app/api/.../form/route.ts** → API GET + PUT
8. **components/processes/form-subtask-dialog.tsx** → Dialog do form
9. **components/processes/field-subtask-inline.tsx** → Inline do field
10. **components/processes/subtask-card-form.tsx** → Card do form
11. **components/processes/subtask-card-field.tsx** → Card do field
12. **components/processes/subtask-card-list.tsx** → Integrar novos cards
13. **components/templates/form-field-picker.tsx** → Picker no builder
14. **components/templates/subtask-config-dialog.tsx** → Config UI
15. **components/templates/subtask-editor.tsx** → Ícones e badges

---

## Riscos e Decisões

| Decisão | Razão |
|---------|-------|
| Config vive em JSONB, sem migração | Flexibilidade; validação por Zod no API |
| Chave composta `entity__field` no form state | Evita colisão entre campos de entidades diferentes |
| `image_upload` excluído do FormFieldType (v1) | PRD lista mas é complexo; usar subtarefa upload separada |
| Sem campos condicionais (v1) | Complexidade desnecessária; PRD secção 14 confirma fora de escopo |
| Reutilizar FIELD_COMPONENTS entre form e field | DRY; mesmos renderers, diferente wrapper |
