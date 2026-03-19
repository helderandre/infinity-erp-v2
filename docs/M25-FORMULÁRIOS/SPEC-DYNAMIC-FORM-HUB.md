# SPEC: Hub Centralizado de Formulários Dinâmicos

**Data:** 2026-03-19
**PRD:** `docs/M25-FORMULÁRIOS/2026-03-19-PRD-DYNAMIC-FORM-HUB.md`
**Branch:** `master`

---

## Resumo

Centralizar a lógica de formulários dinâmicos num hub reutilizável, desacoplando o `DynamicFormRenderer` existente do contexto de processos. Criar catálogo de campos no DB, sistema de eventos de submissão, e UI de administração.

**O que já existe e funciona:**
- `DynamicFormRenderer` com 15 tipos de campo + `buildZodSchema()` (589 linhas)
- `tpl_form_templates` com JSONB sections no DB
- `lib/form-field-registry.ts` com ~80 campos pré-configurados em código
- `lib/form-options-resolver.ts` para resolver opções de constantes
- APIs CRUD de form templates (`/api/form-templates`)
- Renderers compostos: `AddressMapFieldRenderer`, `MediaUploadFieldRenderer`, `RichTextFieldRenderer`, `LinkExternalFieldRenderer`

**O que falta:**
1. Catálogo de campos no DB (mover de código para tabela)
2. Suporte a campos condicionais no renderer
3. Sistema de eventos de submissão
4. Hook `useDynamicForm(slug)` para uso universal
5. Componente `<DynamicForm>` desacoplado de processos
6. UI de administração para campos e templates

---

## O Que NÃO Fazer

- **NÃO** substituir formulários hard-coded existentes (PropertyForm, LeadForm, etc.) nesta fase
- **NÃO** usar junction tables — manter JSONB sections no `tpl_form_templates` (já funciona)
- **NÃO** instalar bibliotecas externas de forms — construir sobre RHF + Zod + shadcn existentes
- **NÃO** alterar o fluxo de processos/subtasks existente
- **NÃO** alterar APIs existentes de form-templates — criar endpoints novos no namespace `/api/form-hub/`

---

## Fase 1 — Database & Types

### 1.1 Migração SQL: Tabela `form_hub_fields`

**Acção:** Executar via Supabase MCP (`apply_migration`)

```sql
-- Catálogo centralizado de campos reutilizáveis
CREATE TABLE form_hub_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,  -- FormFieldType: text, textarea, number, currency, select, etc.
  target_entity TEXT,        -- FormTargetEntity: property, property_specs, owner, etc. (NULL = genérico)
  category TEXT NOT NULL,    -- Agrupamento UI: "Imóvel — Dados Gerais", "Proprietário", etc.

  -- Opções para selects
  options JSONB,             -- [{ value, label }] estático
  options_from_constant TEXT, -- Referência a constante: "PROPERTY_TYPES", "BUSINESS_TYPES", etc.

  -- Validação sugerida
  default_placeholder TEXT,
  default_help_text TEXT,
  suggested_min NUMERIC,
  suggested_max NUMERIC,
  default_width TEXT DEFAULT 'full',  -- 'full' | 'half' | 'third'

  -- Condicional (quando este campo deve aparecer)
  condition_config JSONB,    -- { field: string, operator: 'eq'|'neq'|'in'|'notIn', value: any }

  -- Meta
  is_system BOOLEAN DEFAULT false,  -- Campos do sistema (não editáveis)
  is_active BOOLEAN DEFAULT true,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_form_hub_fields_category ON form_hub_fields(category);
CREATE INDEX idx_form_hub_fields_target ON form_hub_fields(target_entity);
CREATE INDEX idx_form_hub_fields_active ON form_hub_fields(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE form_hub_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "form_hub_fields_read" ON form_hub_fields FOR SELECT USING (true);
CREATE POLICY "form_hub_fields_write" ON form_hub_fields FOR ALL USING (
  auth.uid() IN (SELECT id FROM dev_users WHERE role_id IN (SELECT id FROM roles WHERE name IN ('Broker/CEO', 'Office Manager')))
);
```

### 1.2 Migração SQL: Tabela `form_submission_events`

**Acção:** Executar via Supabase MCP (`apply_migration`)

```sql
-- Eventos disparados após submissão de um formulário
CREATE TABLE form_submission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES tpl_form_templates(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,   -- 'create_process' | 'send_notification' | 'create_entity' | 'webhook' | 'update_status'
  event_config JSONB NOT NULL DEFAULT '{}',
  event_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_form_events_template ON form_submission_events(template_id);

-- RLS
ALTER TABLE form_submission_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "form_events_read" ON form_submission_events FOR SELECT USING (true);
CREATE POLICY "form_events_write" ON form_submission_events FOR ALL USING (
  auth.uid() IN (SELECT id FROM dev_users WHERE role_id IN (SELECT id FROM roles WHERE name IN ('Broker/CEO', 'Office Manager')))
);
```

**Estrutura de `event_config` por tipo:**

```typescript
// create_process
{ tpl_process_id: string }

// send_notification
{ roles: string[], title: string, body: string, type: string }

// create_entity
{ entity_type: 'lead' | 'property' | 'owner', field_mapping: Record<string, string> }

// update_status
{ entity_type: string, entity_id_field: string, status: string }

// webhook
{ url: string, method: 'POST' | 'PUT', headers?: Record<string, string> }
```

### 1.3 Migração SQL: Adicionar `slug` e `context` ao `tpl_form_templates`

**Acção:** Executar via Supabase MCP (`apply_migration`)

```sql
-- Adicionar slug e context ao tpl_form_templates para uso universal
ALTER TABLE tpl_form_templates
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS context TEXT DEFAULT 'general';
  -- context: 'general' | 'acquisition' | 'recruitment' | 'property' | 'lead' | 'owner'

CREATE UNIQUE INDEX idx_form_templates_slug ON tpl_form_templates(slug) WHERE slug IS NOT NULL;
```

### 1.4 Seed: Migrar campos do `form-field-registry.ts` para DB

**Acção:** Executar via Supabase MCP (`execute_sql`)

Gerar INSERT statements a partir do conteúdo actual de `lib/form-field-registry.ts`. Cada `FieldRegistryEntry` torna-se uma row em `form_hub_fields` com `is_system = true`.

```sql
-- Exemplo (gerar para todos os ~80 campos do registry)
INSERT INTO form_hub_fields (field_name, label, field_type, target_entity, category, options_from_constant, default_placeholder, suggested_min, is_system)
VALUES
  ('title', 'Título do Anúncio', 'text', 'property', 'Imóvel — Dados Gerais', NULL, 'Ex: T3 renovado com terraço em Lisboa', NULL, true),
  ('description', 'Descrição', 'rich_text', 'property', 'Imóvel — Dados Gerais', NULL, NULL, NULL, true),
  ('listing_price', 'Preço de Venda/Arrendamento', 'currency', 'property', 'Imóvel — Dados Gerais', NULL, NULL, 0, true),
  ('property_type', 'Tipo de Imóvel', 'select', 'property', 'Imóvel — Dados Gerais', 'PROPERTY_TYPES', NULL, NULL, true)
  -- ... restantes campos do FIELD_REGISTRY
;
```

### 1.5 Types: `types/form-hub.ts`

**Acção:** CRIAR ficheiro novo

```typescript
// types/form-hub.ts
import type { FormFieldType, FormTargetEntity, FormSectionConfig } from './subtask'

// ═══════════════════════════════════════════════
// Catálogo de Campos (DB: form_hub_fields)
// ═══════════════════════════════════════════════

export interface FormHubField {
  id: string
  field_name: string
  label: string
  field_type: FormFieldType
  target_entity: FormTargetEntity | null
  category: string
  options: { value: string; label: string }[] | null
  options_from_constant: string | null
  default_placeholder: string | null
  default_help_text: string | null
  suggested_min: number | null
  suggested_max: number | null
  default_width: 'full' | 'half' | 'third'
  condition_config: FieldCondition | null
  is_system: boolean
  is_active: boolean
  order_index: number
  created_at: string
  updated_at: string
}

// ═══════════════════════════════════════════════
// Campos Condicionais
// ═══════════════════════════════════════════════

export interface FieldCondition {
  field: string          // Nome do campo a observar (field_name ou target_entity__field_name)
  operator: 'eq' | 'neq' | 'in' | 'notIn' | 'exists' | 'empty'
  value: unknown         // Valor(es) para comparar
}

// ═══════════════════════════════════════════════
// Template de Formulário (Enhanced tpl_form_templates)
// ═══════════════════════════════════════════════

export interface FormTemplate {
  id: string
  name: string
  slug: string | null
  description: string | null
  category: string | null
  context: FormContext
  sections: FormSectionConfig[]
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export type FormContext =
  | 'general'
  | 'acquisition'
  | 'recruitment'
  | 'property'
  | 'lead'
  | 'owner'

// ═══════════════════════════════════════════════
// Eventos de Submissão (DB: form_submission_events)
// ═══════════════════════════════════════════════

export type FormEventType =
  | 'create_process'
  | 'send_notification'
  | 'create_entity'
  | 'update_status'
  | 'webhook'

export interface FormSubmissionEvent {
  id: string
  template_id: string
  event_type: FormEventType
  event_config: Record<string, unknown>
  event_order: number
  is_active: boolean
  created_at: string
}

// ═══════════════════════════════════════════════
// Props do componente DynamicForm (universal)
// ═══════════════════════════════════════════════

export interface DynamicFormProps {
  /** Slug do template para fetch automático */
  templateSlug?: string
  /** Ou sections inline (sem fetch) */
  sections?: FormSectionConfig[]
  /** Valores iniciais */
  defaultValues?: Record<string, unknown>
  /** Callback de submissão — recebe dados agrupados por target_entity */
  onSubmit: (values: Record<string, Record<string, unknown>>, rawValues: Record<string, unknown>) => Promise<void>
  /** Estado de loading */
  isSubmitting?: boolean
  /** Label do botão de submit */
  submitLabel?: string
  /** ID do form (para submit externo) */
  formId?: string
  /** Esconder botão de submit */
  hideSubmitButton?: boolean
  /** Contexto para campos compostos (propertyId, etc.) */
  context?: { propertyId?: string; [key: string]: unknown }
  /** Modo leitura */
  readOnly?: boolean
  /** Classe extra para o form */
  className?: string
}

// ═══════════════════════════════════════════════
// Hook useDynamicForm return type
// ═══════════════════════════════════════════════

export interface UseDynamicFormReturn {
  /** Secções do template */
  sections: FormSectionConfig[]
  /** Schema Zod gerado */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zodSchema: any
  /** Template completo */
  template: FormTemplate | null
  /** Loading state */
  isLoading: boolean
  /** Erro */
  error: string | null
}
```

### 1.6 Validações: `lib/validations/form-hub.ts`

**Acção:** CRIAR ficheiro novo

```typescript
import { z } from 'zod'

// ── Validação de Campo do Catálogo ──────────────
export const formHubFieldSchema = z.object({
  field_name: z.string().min(1, 'Nome do campo é obrigatório'),
  label: z.string().min(1, 'Label é obrigatória'),
  field_type: z.enum([
    'text', 'textarea', 'number', 'currency', 'percentage',
    'select', 'multiselect', 'checkbox', 'date',
    'email', 'phone', 'rich_text',
    'address_map', 'media_upload', 'link_external',
  ]),
  target_entity: z.enum(['property', 'property_specs', 'property_internal', 'owner', 'property_owner']).nullable().optional(),
  category: z.string().min(1, 'Categoria é obrigatória'),
  options: z.array(z.object({ value: z.string(), label: z.string() })).nullable().optional(),
  options_from_constant: z.string().nullable().optional(),
  default_placeholder: z.string().nullable().optional(),
  default_help_text: z.string().nullable().optional(),
  suggested_min: z.coerce.number().nullable().optional(),
  suggested_max: z.coerce.number().nullable().optional(),
  default_width: z.enum(['full', 'half', 'third']).default('full'),
  condition_config: z.object({
    field: z.string(),
    operator: z.enum(['eq', 'neq', 'in', 'notIn', 'exists', 'empty']),
    value: z.any(),
  }).nullable().optional(),
})

export type FormHubFieldInput = z.infer<typeof formHubFieldSchema>

// ── Validação de Template ───────────────────────
export const formTemplateSchema = z.object({
  name: z.string().min(1, 'Nome do template é obrigatório'),
  slug: z.string()
    .min(1, 'Slug é obrigatório')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  context: z.enum(['general', 'acquisition', 'recruitment', 'property', 'lead', 'owner']).default('general'),
  sections: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    order_index: z.number(),
    fields: z.array(z.object({
      field_name: z.string().min(1),
      label: z.string().min(1),
      field_type: z.string().min(1),
      target_entity: z.string().min(1),
      required: z.boolean().optional(),
      help_text: z.string().optional(),
      placeholder: z.string().optional(),
      options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
      options_from_constant: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      width: z.enum(['full', 'half', 'third']).optional(),
      order_index: z.number(),
      condition: z.object({
        field: z.string(),
        operator: z.enum(['eq', 'neq', 'in', 'notIn', 'exists', 'empty']),
        value: z.any(),
      }).optional(),
    })),
  })).min(1, 'Mínimo 1 secção'),
})

// ── Validação de Evento de Submissão ────────────
export const formEventSchema = z.object({
  template_id: z.string().min(1),
  event_type: z.enum(['create_process', 'send_notification', 'create_entity', 'update_status', 'webhook']),
  event_config: z.record(z.unknown()),
  event_order: z.number().default(0),
  is_active: z.boolean().default(true),
})
```

---

## Fase 2 — Backend (API Routes)

### 2.1 `app/api/form-hub/fields/route.ts`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- `GET` — Lista campos do catálogo `form_hub_fields`
  - Query params: `?category=`, `?target_entity=`, `?field_type=`, `?search=`, `?active_only=true`
  - Ordenar por `category`, `order_index`
  - Permissão: qualquer user autenticado pode ler
- `POST` — Cria novo campo no catálogo
  - Validar com `formHubFieldSchema`
  - Permissão: roles com `settings` permission
  - Retorna campo criado

```typescript
// Padrão a seguir (mesmo do /api/form-templates/route.ts)
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { formHubFieldSchema } from '@/lib/validations/form-hub'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const targetEntity = searchParams.get('target_entity')
  const search = searchParams.get('search')

  let query = supabase
    .from('form_hub_fields')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('order_index')

  if (category) query = query.eq('category', category)
  if (targetEntity) query = query.eq('target_entity', targetEntity)
  if (search) query = query.or(`field_name.ilike.%${search}%,label.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  // ... validar auth + permissão settings
  // ... validar body com formHubFieldSchema
  // ... inserir em form_hub_fields
  // ... retornar campo criado
}
```

### 2.2 `app/api/form-hub/fields/[id]/route.ts`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- `GET` — Obter campo por ID
- `PUT` — Actualizar campo (validar com `formHubFieldSchema.partial()`)
  - Campos `is_system = true` não podem ser eliminados, mas podem ter label/placeholder editados
- `DELETE` — Soft delete (`is_active = false`)

### 2.3 `app/api/form-hub/templates/route.ts`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- `GET` — Lista templates com suporte a `?context=`, `?slug=`, `?category=`
  - Inclui contagem de `form_submission_events` por template
  - Ordenar por `updated_at DESC`
- `POST` — Criar template com slug, context, sections
  - Validar com `formTemplateSchema`
  - Inserir em `tpl_form_templates` (tabela existente, com novos campos slug + context)
  - Retornar template criado

### 2.4 `app/api/form-hub/templates/[idOrSlug]/route.ts`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Resolver `idOrSlug`: se parece UUID → buscar por `id`, senão → buscar por `slug`
- `GET` — Template completo com `form_submission_events` associados
- `PUT` — Actualizar template
- `DELETE` — Soft delete (`is_active = false`)

```typescript
// Resolver idOrSlug
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUUID = uuidRegex.test(idOrSlug)

let query = supabase.from('tpl_form_templates').select('*, form_submission_events(*)')
query = isUUID ? query.eq('id', idOrSlug) : query.eq('slug', idOrSlug)
const { data } = await query.eq('is_active', true).single()
```

### 2.5 `app/api/form-hub/templates/[idOrSlug]/events/route.ts`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- `GET` — Lista eventos de submissão do template
- `POST` — Criar evento de submissão
  - Validar com `formEventSchema`
  - Inserir em `form_submission_events`
- `PUT` — Actualizar evento (por `event_id` no body)
- `DELETE` — Eliminar evento (por `event_id` no searchParams)

### 2.6 `app/api/form-hub/submit/route.ts`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- `POST` — Submissão universal de formulário
  - Body: `{ template_id: string, data: Record<string, Record<string, unknown>> }`
  - Buscar template + eventos associados
  - Executar eventos em ordem (`event_order`)
  - Retornar resultado

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NotificationService } from '@/lib/notifications/service'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()
  const { template_id, data: formData } = body

  // 1. Buscar template + eventos
  const admin = createAdminClient()
  const { data: events } = await admin
    .from('form_submission_events')
    .select('*')
    .eq('template_id', template_id)
    .eq('is_active', true)
    .order('event_order')

  // 2. Executar eventos
  const results = []
  for (const event of events ?? []) {
    const result = await executeEvent(event, formData, user.id, admin)
    results.push({ event_type: event.event_type, result })
  }

  return NextResponse.json({ success: true, events_executed: results })
}

async function executeEvent(event, formData, userId, admin) {
  switch (event.event_type) {
    case 'create_process':
      // Criar proc_instances com tpl_process_id do event_config
      break
    case 'send_notification':
      // Usar NotificationService.createBatch
      break
    case 'create_entity':
      // Inserir na tabela indicada (lead, property, owner)
      break
    case 'update_status':
      // Actualizar status de entidade
      break
    case 'webhook':
      // fetch() para URL configurada
      break
  }
}
```

### 2.7 `lib/form-hub/event-executor.ts`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Exporta `executeSubmissionEvents(templateId, formData, userId)`
- Cada handler por tipo de evento:
  - `handleCreateProcess(config, formData, userId, admin)` — cria `proc_instances`
  - `handleSendNotification(config, formData, userId, admin)` — usa `NotificationService`
  - `handleCreateEntity(config, formData, admin)` — insere em tabela destino
  - `handleUpdateStatus(config, formData, admin)` — update status
  - `handleWebhook(config, formData)` — fetch externo
- Retorna array de resultados

---

## Fase 3 — Hook e Componente Universal

### 3.1 `hooks/use-dynamic-form.ts`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Hook `useDynamicForm(templateSlug: string)` que:
  1. Faz fetch do template por slug via `/api/form-hub/templates/${slug}`
  2. Gera o schema Zod dinamicamente com `buildZodSchema(sections)`
  3. Retorna `{ sections, zodSchema, template, isLoading, error }`

```typescript
'use client'

import { useState, useEffect, useMemo } from 'react'
import type { FormSectionConfig } from '@/types/subtask'
import type { FormTemplate, UseDynamicFormReturn } from '@/types/form-hub'
import { buildZodSchema } from '@/lib/form-hub/zod-builder'

export function useDynamicForm(templateSlug: string): UseDynamicFormReturn {
  const [template, setTemplate] = useState<FormTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTemplate() {
      try {
        setIsLoading(true)
        const res = await fetch(`/api/form-hub/templates/${templateSlug}`)
        if (!res.ok) throw new Error('Template não encontrado')
        const data = await res.json()
        setTemplate(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar template')
      } finally {
        setIsLoading(false)
      }
    }
    if (templateSlug) fetchTemplate()
  }, [templateSlug])

  const sections = template?.sections ?? []
  const zodSchema = useMemo(() => buildZodSchema(sections), [sections])

  return { sections, zodSchema, template, isLoading, error }
}
```

### 3.2 `lib/form-hub/zod-builder.ts`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Exporta `buildZodSchema(sections)` — **extraído** do `DynamicFormRenderer`
- Exporta `evaluateCondition(condition, value)` — avalia se um campo condicional deve ser visível
- Exporta `buildZodSchemaWithConditions(sections)` — schema com `superRefine` para campos condicionais

```typescript
import { z, type ZodTypeAny } from 'zod'
import type { FormSectionConfig, FormFieldConfig } from '@/types/subtask'
import type { FieldCondition } from '@/types/form-hub'

/**
 * Avalia se uma condição é satisfeita
 */
export function evaluateCondition(condition: FieldCondition, fieldValue: unknown): boolean {
  switch (condition.operator) {
    case 'eq': return fieldValue === condition.value
    case 'neq': return fieldValue !== condition.value
    case 'in': return Array.isArray(condition.value) && condition.value.includes(fieldValue)
    case 'notIn': return Array.isArray(condition.value) && !condition.value.includes(fieldValue)
    case 'exists': return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
    case 'empty': return fieldValue === null || fieldValue === undefined || fieldValue === ''
    default: return true
  }
}

/**
 * Constrói schema Zod a partir de secções de formulário.
 * Extraído do DynamicFormRenderer existente.
 */
export function buildZodSchema(sections: FormSectionConfig[]): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {}

  for (const section of sections) {
    for (const field of section.fields) {
      // address_map expande para 6 sub-campos
      if (field.field_type === 'address_map') {
        const entity = field.target_entity
        shape[`${entity}__address_street`] = z.string().optional().nullable()
        shape[`${entity}__postal_code`] = z.string().optional().nullable()
        shape[`${entity}__city`] = z.string().optional().nullable()
        shape[`${entity}__zone`] = z.string().optional().nullable()
        shape[`${entity}__latitude`] = z.coerce.number().optional().nullable()
        shape[`${entity}__longitude`] = z.coerce.number().optional().nullable()
        continue
      }

      if (field.field_type === 'media_upload') {
        shape[`${field.target_entity}__${field.field_name}`] = z.coerce.number().optional().nullable()
        continue
      }

      if (field.field_type === 'link_external') {
        shape[`${field.target_entity}__${field.field_name}`] = z.array(
          z.object({
            site_name: z.string().min(1, 'Nome do site é obrigatório'),
            url: z.string().url('URL inválido').min(1, 'Link é obrigatório'),
            published_at: z.string().optional().default(''),
          })
        ).default([])
        continue
      }

      let fieldSchema: ZodTypeAny
      switch (field.field_type) {
        case 'number':
        case 'currency':
        case 'percentage': {
          let numSchema = z.coerce.number()
          if (field.min !== undefined) numSchema = numSchema.min(field.min)
          if (field.max !== undefined) numSchema = numSchema.max(field.max)
          fieldSchema = field.required ? numSchema : numSchema.optional().nullable()
          break
        }
        case 'checkbox':
          fieldSchema = z.boolean().default(false)
          break
        case 'multiselect':
          fieldSchema = z.array(z.string()).default([])
          break
        case 'date':
          fieldSchema = field.required
            ? z.string().min(1, `${field.label} é obrigatório`)
            : z.string().optional().nullable()
          break
        default:
          fieldSchema = field.required
            ? z.string().min(1, `${field.label} é obrigatório`)
            : z.string().optional().nullable()
      }

      shape[`${field.target_entity}__${field.field_name}`] = fieldSchema
    }
  }

  return z.object(shape)
}
```

### 3.3 `components/form-hub/dynamic-form.tsx`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Componente `<DynamicForm>` — versão universal do `DynamicFormRenderer`
- Aceita `templateSlug` (fetch automático) OU `sections` (inline)
- Suporte a campos condicionais via `useWatch` + `evaluateCondition`
- Reutiliza os mesmos field renderers existentes (importa de `components/processes/`)

```typescript
'use client'

import { useMemo, useCallback } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form, FormField, FormItem, FormLabel, FormControl,
  FormDescription, FormMessage,
} from '@/components/ui/form'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildZodSchema, evaluateCondition } from '@/lib/form-hub/zod-builder'
import { useDynamicForm } from '@/hooks/use-dynamic-form'
import { FIELD_COMPONENTS } from '@/components/processes/dynamic-form-renderer'
import type { FormSectionConfig, FormFieldConfig } from '@/types/subtask'
import type { DynamicFormProps, FieldCondition } from '@/types/form-hub'
import type { Control } from 'react-hook-form'

// ── Campo Condicional ──────────────────────────
function ConditionalFieldWrapper({
  condition,
  control,
  children,
}: {
  condition?: FieldCondition | null
  control: Control<Record<string, unknown>>
  children: React.ReactNode
}) {
  // Se não tem condição, renderiza sempre
  if (!condition) return <>{children}</>

  const watchedValue = useWatch({ control, name: condition.field })
  const shouldShow = evaluateCondition(condition, watchedValue)
  if (!shouldShow) return null
  return <>{children}</>
}

// ── Componente Principal ───────────────────────
export function DynamicForm({
  templateSlug,
  sections: inlineSections,
  defaultValues = {},
  onSubmit,
  isSubmitting,
  submitLabel = 'Guardar',
  formId,
  hideSubmitButton,
  context,
  readOnly,
  className,
}: DynamicFormProps) {
  // Se tem slug, buscar template; senão usar sections inline
  const { sections: fetchedSections, isLoading } = useDynamicForm(templateSlug ?? '')
  const sections = inlineSections ?? fetchedSections

  const schema = useMemo(() => buildZodSchema(sections), [sections])

  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const mediaFieldKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const section of sections) {
      for (const f of section.fields) {
        if (f.field_type === 'media_upload') {
          keys.add(`${f.target_entity}__${f.field_name}`)
        }
      }
    }
    return keys
  }, [sections])

  const handleSubmit = useCallback(async (values: Record<string, unknown>) => {
    const grouped: Record<string, Record<string, unknown>> = {}
    for (const [key, value] of Object.entries(values)) {
      if (mediaFieldKeys.has(key)) continue
      const [entity, ...fieldParts] = key.split('__')
      const fieldName = fieldParts.join('__')
      if (!grouped[entity]) grouped[entity] = {}
      grouped[entity][fieldName] = value
    }
    await onSubmit(grouped, values)
  }, [onSubmit, mediaFieldKeys])

  if (templateSlug && isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn('space-y-6', className)}
      >
        <div className={readOnly ? 'pointer-events-none' : undefined}>
          {sections
            .sort((a, b) => a.order_index - b.order_index)
            .map((section) => (
              <Card key={`${section.title}-${section.order_index}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  {section.description && (
                    <CardDescription>{section.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-12 gap-4">
                    {section.fields
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((field) => {
                        const key = `${field.target_entity}__${field.field_name}`
                        const Component = FIELD_COMPONENTS[field.field_type]
                        if (!Component) return null

                        const isComposite = ['address_map', 'media_upload', 'link_external'].includes(field.field_type)
                        const colSpan = isComposite ? 'col-span-12' :
                          field.width === 'third' ? 'col-span-12 sm:col-span-4' :
                          field.width === 'half' ? 'col-span-12 sm:col-span-6' :
                          'col-span-12'

                        // Suporte a campo condicional
                        const condition = (field as FormFieldConfig & { condition?: FieldCondition }).condition

                        return (
                          <ConditionalFieldWrapper
                            key={key}
                            condition={condition}
                            control={form.control}
                          >
                            <div className={colSpan}>
                              <Component
                                field={field}
                                name={key}
                                control={form.control}
                                {...(isComposite ? { context } : {})}
                              />
                            </div>
                          </ConditionalFieldWrapper>
                        )
                      })}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>

        {!hideSubmitButton && !readOnly && (
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A guardar...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        )}
      </form>
    </Form>
  )
}
```

### 3.4 MODIFICAR: `components/processes/dynamic-form-renderer.tsx`

**Acção:** MODIFICAR ficheiro existente

**O que fazer:**
1. **Extrair** `buildZodSchema()` para `lib/form-hub/zod-builder.ts` (já criado em 3.2)
2. **Importar** `buildZodSchema` de `@/lib/form-hub/zod-builder` em vez de ter inline
3. **Exportar** `FIELD_COMPONENTS` para ser reutilizado pelo `<DynamicForm>`
4. **Manter** o componente `DynamicFormRenderer` inalterado para não quebrar processos existentes

```typescript
// Antes (inline):
function buildZodSchema(sections: FormSectionConfig[]) { ... }

// Depois (importado):
import { buildZodSchema } from '@/lib/form-hub/zod-builder'

// Exportar FIELD_COMPONENTS (já é usado em field-subtask-inline.tsx)
export const FIELD_COMPONENTS: Record<FormFieldType, React.ComponentType<FieldRendererProps>> = {
  text: TextFieldRenderer,
  textarea: TextareaFieldRenderer,
  // ... (manter igual)
}
```

---

## Fase 4 — UI de Administração

### 4.1 `app/dashboard/formularios/page.tsx`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Página principal do hub de formulários
- Header hero (seguir padrão de `app/dashboard/definicoes/page.tsx`)
- 2 tabs: **Templates** | **Catálogo de Campos**
- Tab Templates:
  - Listagem de `tpl_form_templates` (todos os contexts)
  - Card por template com: nome, slug, context badge, nº campos, nº eventos, data actualização
  - Filtro por context (Select)
  - Botão "Novo Template"
  - Click → `/dashboard/formularios/[id]/editar`
- Tab Catálogo:
  - Listagem de `form_hub_fields` agrupados por `category`
  - Cada campo mostra: label, field_type badge, target_entity, is_system badge
  - Search por nome/label
  - Botão "Novo Campo"
  - Inline edit via Dialog

### 4.2 `app/dashboard/formularios/[id]/editar/page.tsx`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Página de edição de template de formulário
- Breadcrumbs: Formulários > [Nome do Template] > Editar
- Layout com 2 painéis:
  - **Esquerda (70%):** Editor de secções e campos (drag-to-reorder)
  - **Direita (30%):** Picker de campos do catálogo (buscar em `form_hub_fields`)
- Arrastar campo do picker para adicionar ao template
- Cada campo no editor pode:
  - Reordenar (grip handle + @dnd-kit)
  - Editar overrides (required, width, placeholder, help_text)
  - Configurar condição (field + operator + value)
  - Remover
- Botão "Guardar" → PUT `/api/form-hub/templates/[id]`
- Secção "Eventos de Submissão" abaixo do editor:
  - Lista de eventos configurados
  - Botão "Adicionar Evento"
  - Dialog para configurar evento (tipo + config)

### 4.3 `app/dashboard/formularios/novo/page.tsx`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Formulário de criação de novo template
- Campos: name, slug (auto-gerado a partir do nome), description, context, category
- Após criar → redirecionar para `/dashboard/formularios/[id]/editar`

### 4.4 `app/dashboard/formularios/[id]/preview/page.tsx`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Preview do formulário usando `<DynamicForm sections={template.sections} />`
- Renderiza o formulário em modo interactivo (sem submissão real)
- Mostra resultado do submit em JSON (para debug)

### 4.5 `components/form-hub/field-picker.tsx`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Painel lateral com campos do catálogo (`form_hub_fields`)
- Agrupados por `category` (collapsible)
- Search input no topo
- Cada campo mostrável como card compacto com:
  - Label, field_type icon/badge, target_entity
- Arrastável (source para @dnd-kit)
- Double-click ou botão "+" para adicionar ao template

### 4.6 `components/form-hub/template-section-editor.tsx`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Editor de secções do template
- Cada secção é um Card colapsável com:
  - Header com título editável + botão eliminar
  - Lista de campos com drag-to-reorder (@dnd-kit)
  - Botão "Adicionar Secção"
- Cada campo na secção mostra:
  - Label, field_type badge, width selector, required toggle
  - Botão de configuração avançada (abre Dialog)
  - Botão eliminar

### 4.7 `components/form-hub/field-config-dialog.tsx`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Dialog para configurar detalhes de um campo dentro de um template
- Tabs: **Geral** | **Validação** | **Condição**
- Tab Geral: label, placeholder, help_text, width, required
- Tab Validação: min, max, minLength, maxLength, pattern
- Tab Condição: field (dropdown dos outros campos), operator (select), value (input dinâmico)

### 4.8 `components/form-hub/event-config-dialog.tsx`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Dialog para configurar um evento de submissão
- Select do event_type com descrição
- Formulário dinâmico por tipo:
  - `create_process` → Select do template de processo (`tpl_processes`)
  - `send_notification` → Multi-select de roles, campos título e corpo
  - `create_entity` → Select entity_type, mapeamento de campos
  - `update_status` → Entity type, campo ID, novo status
  - `webhook` → URL, método, headers

### 4.9 `hooks/use-form-hub-fields.ts`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Hook `useFormHubFields(filters?)` — fetch e cache dos campos do catálogo
- SWR ou useState+useEffect pattern (seguir padrão do projecto)
- Retorna `{ fields, isLoading, error, refetch }`
- Agrupa campos por category para o picker

### 4.10 `hooks/use-form-hub-template.ts`

**Acção:** CRIAR ficheiro novo

**O que faz:**
- Hook `useFormHubTemplate(id)` — fetch e gestão de um template específico
- Retorna `{ template, events, isLoading, error, updateTemplate, addEvent, removeEvent }`
- Métodos para CRUD de eventos associados

---

## Fase 5 — Integrações e Modificações

### 5.1 MODIFICAR: `components/layout/app-sidebar.tsx`

**Acção:** MODIFICAR ficheiro existente

**O que fazer:**
- Adicionar link "Formulários" ao grupo **Builder** do sidebar
- Ícone: `FileText` ou `FormInput` do lucide-react
- Path: `/dashboard/formularios`
- Permissão: `settings` module

```typescript
// No grupo "Builder", adicionar:
{
  title: 'Formulários',
  url: '/dashboard/formularios',
  icon: FileInput,
}
```

### 5.2 MODIFICAR: `components/layout/breadcrumbs.tsx`

**Acção:** MODIFICAR ficheiro existente

**O que fazer:**
- Adicionar mapeamento para as novas rotas de formulários:

```typescript
// No segmentLabels ou equivalente:
'formularios': 'Formulários',
'editar': 'Editar',
'novo': 'Novo',
'preview': 'Pré-visualização',
```

### 5.3 MODIFICAR: `types/subtask.ts`

**Acção:** MODIFICAR ficheiro existente

**O que fazer:**
- Adicionar campo `condition` opcional ao `FormFieldConfig`:

```typescript
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
  // ← NOVO: suporte a campos condicionais
  condition?: {
    field: string
    operator: 'eq' | 'neq' | 'in' | 'notIn' | 'exists' | 'empty'
    value: unknown
  }
}
```

### 5.4 MODIFICAR: `lib/form-field-registry.ts`

**Acção:** MODIFICAR ficheiro existente

**O que fazer:**
- Adicionar comentário deprecation no topo:

```typescript
/**
 * @deprecated Usar form_hub_fields no banco de dados.
 * Este ficheiro é mantido como fallback enquanto a migração não está completa.
 * Ver: /api/form-hub/fields
 */
```

- Manter o conteúdo existente inalterado para backwards compatibility

---

## Estrutura de Ficheiros (Resumo)

### Ficheiros a CRIAR (16 ficheiros)

```
types/form-hub.ts                                          ← Types centrais
lib/validations/form-hub.ts                                ← Schemas Zod
lib/form-hub/zod-builder.ts                                ← buildZodSchema extraído
lib/form-hub/event-executor.ts                             ← Execução de eventos
hooks/use-dynamic-form.ts                                  ← Hook universal
hooks/use-form-hub-fields.ts                               ← Hook catálogo campos
hooks/use-form-hub-template.ts                             ← Hook template + eventos
components/form-hub/dynamic-form.tsx                       ← Componente universal
components/form-hub/field-picker.tsx                       ← Picker de campos (admin)
components/form-hub/template-section-editor.tsx             ← Editor de secções (admin)
components/form-hub/field-config-dialog.tsx                 ← Config de campo (admin)
components/form-hub/event-config-dialog.tsx                 ← Config de evento (admin)
app/api/form-hub/fields/route.ts                           ← API campos
app/api/form-hub/fields/[id]/route.ts                      ← API campo individual
app/api/form-hub/templates/route.ts                        ← API templates
app/api/form-hub/templates/[idOrSlug]/route.ts             ← API template individual
app/api/form-hub/templates/[idOrSlug]/events/route.ts      ← API eventos
app/api/form-hub/submit/route.ts                           ← API submissão universal
app/dashboard/formularios/page.tsx                         ← Página principal
app/dashboard/formularios/novo/page.tsx                    ← Criar template
app/dashboard/formularios/[id]/editar/page.tsx             ← Editar template
app/dashboard/formularios/[id]/preview/page.tsx            ← Preview formulário
```

### Ficheiros a MODIFICAR (4 ficheiros)

```
components/processes/dynamic-form-renderer.tsx             ← Extrair buildZodSchema, exportar FIELD_COMPONENTS
components/layout/app-sidebar.tsx                          ← Adicionar link Formulários
components/layout/breadcrumbs.tsx                          ← Adicionar labels formulários
types/subtask.ts                                           ← Adicionar condition ao FormFieldConfig
lib/form-field-registry.ts                                 ← Adicionar deprecation notice
```

### Migrações SQL (3 migrações)

```
1. CREATE TABLE form_hub_fields                            ← Catálogo de campos
2. CREATE TABLE form_submission_events                     ← Eventos de submissão
3. ALTER TABLE tpl_form_templates ADD slug, context        ← Novos campos
4. INSERT INTO form_hub_fields (seed)                      ← Dados iniciais do registry
```

---

## Critérios de Sucesso

### Verificação Automática:
- [ ] `npm run build` passa sem erros
- [ ] `npm run lint` passa sem erros
- [ ] Types TypeScript consistentes (sem `any` desnecessário)

### Verificação Manual:
- [ ] Página `/dashboard/formularios` mostra templates e catálogo de campos
- [ ] Criar novo template com slug → template aparece na listagem
- [ ] Adicionar campos do catálogo ao template via picker
- [ ] Drag-to-reorder funciona em secções e campos
- [ ] Configurar campo condicional → campo aparece/esconde no preview
- [ ] Configurar evento de submissão → evento executa ao submeter preview
- [ ] `<DynamicForm templateSlug="xxx" />` renderiza formulário correctamente
- [ ] `useDynamicForm("xxx")` retorna sections + zodSchema
- [ ] Campo `address_map` funciona no formulário universal (Mapbox)
- [ ] Campo `media_upload` funciona no formulário universal (R2)
- [ ] Formulário existente de processos (`DynamicFormRenderer`) continua a funcionar

---

## Ordem de Implementação Recomendada

1. **Fase 1** — Database + Types + Validações (fundação)
2. **Fase 3.2** — `zod-builder.ts` (extrair do renderer existente)
3. **Fase 3.4** — Modificar `DynamicFormRenderer` (importar zod-builder, exportar FIELD_COMPONENTS)
4. **Fase 2.1-2.4** — APIs de campos e templates
5. **Fase 3.1** — Hook `useDynamicForm`
6. **Fase 3.3** — Componente `<DynamicForm>`
7. **Fase 2.5-2.7** — APIs de eventos e submissão + event-executor
8. **Fase 4** — UI de administração
9. **Fase 5** — Integrações no sidebar/breadcrumbs
