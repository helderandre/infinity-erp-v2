# PRD: Hub Centralizado de Formulários Dinâmicos

**Data:** 2026-03-19
**Git Commit:** `65630b498236bfabf9eaaae5b5c6de691af68096`
**Branch:** `master`

## Questão de Pesquisa

Verificar viabilidade de centralizar toda a lógica de criação de formulários num único lugar no backend, permitindo:
- Definir campos centralizadamente e reutilizá-los em qualquer contexto (angariação, recrutamento, negócios, imóveis)
- Criar grupos de campos compostos (ex: morada com Mapbox, upload de fotos)
- Condicionar campos por critérios dinâmicos (ex: pessoa singular vs coletiva)
- Disparar eventos na submissão (criar processo, notificações, etc.)
- Renderizar formulários a partir de configuração, não código hard-coded

---

## Resumo Executivo

**A viabilidade é ALTA.** O projecto já tem ~70% da infraestrutura necessária:

1. **Já existe** uma tabela `tpl_form_templates` com secções/campos em JSONB
2. **Já existe** um `DynamicFormRenderer` funcional que renderiza 15+ tipos de campo a partir de config
3. **Já existe** um sistema de variáveis (`tpl_variables`) para aceder a dados de qualquer entidade
4. **Já existe** suporte a campos condicionais por tipo de pessoa (singular/coletiva) nos subtasks
5. **Já existe** o conceito de "compound fields" (address_map, media_upload, link_external)

O que **falta** é:
- Desacoplar o `DynamicFormRenderer` do contexto de processos para uso universal
- Criar uma tabela centralizada de campos reutilizáveis (hub de campos)
- Implementar o sistema de eventos de submissão
- Criar uma UI de administração para gerir campos e formulários

---

## Estruturas Existentes no Banco de Dados

### Tabelas de Templates de Formulários

#### `tpl_form_templates` — Templates de Formulário Reutilizáveis
**Ficheiro:** `types/database.ts:8937-8980`

```typescript
{
  id: string           // UUID
  name: string         // Nome do template
  description: string  // Descrição
  category: string     // 'recruitment' | 'property' | 'owner' | etc.
  is_active: boolean
  sections: JSONB      // ← Estrutura do formulário (FormSectionConfig[])
  created_by: string   // FK → dev_users
}
```

**Estrutura JSONB `sections`:**
```typescript
FormSectionConfig[] = [
  {
    title: string
    description?: string
    order_index: number
    fields: FormFieldConfig[] = [
      {
        field_name: string              // Chave do campo no DB
        label: string                   // Label na UI
        field_type: FormFieldType       // 15+ tipos suportados
        target_entity: FormTargetEntity // 'property' | 'property_specs' | 'property_internal' | 'owner' | 'property_owner'
        required?: boolean
        help_text?: string
        placeholder?: string
        options?: { value: string; label: string }[]
        options_from_constant?: string  // Referência a CONSTANTS
        min?: number
        max?: number
        width?: 'full' | 'half' | 'third'
        order_index: number
      }
    ]
  }
]
```

#### `tpl_variables` — Variáveis do Sistema (Hub de Dados)
**Ficheiro:** `types/database.ts:9172-9228`

```typescript
{
  id: string
  key: string             // ex: {{property_address}}
  label: string           // Nome para display
  category: string        // 'property' | 'owner' | 'process' | etc.
  category_color: string  // Cor para UI
  source_entity: string   // Entidade alvo
  source_table: string    // Tabela no DB
  source_column: string   // Coluna a buscar
  format_type: string     // 'text' | 'currency' | 'date' | 'custom'
  format_config: JSONB    // Config de formatação
  static_value: string    // Valor fixo (se não vem do DB)
  is_system: boolean
  is_active: boolean
  order_index: number
}
```

> **Nota:** Este sistema de variáveis já mapeia campos a tabelas/colunas do banco. É exactamente o conceito de "hub de campos" que se pretende — mas actualmente usado apenas para substituição em emails/documentos.

#### `recruitment_form_fields` — Campos do Formulário de Recrutamento
**Ficheiro:** `types/database.ts:5159-5206`

```typescript
{
  id: string
  field_key: string       // ex: 'full_name', 'nif'
  label: string           // Label PT-PT
  field_type: string      // 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'number' | 'date'
  section: string         // Agrupamento: 'personal_info', 'contact', 'documents'
  is_required: boolean
  is_visible: boolean
  is_ai_extractable: boolean  // Campo pode ser extraído por GPT-4
  placeholder: string
  options: JSONB          // Para select/checkbox
  order_index: number
}
```

#### `tpl_subtasks` — Subtarefas com Config JSONB
**Ficheiro:** `types/database.ts:9046-9118`

A config JSONB dos subtasks já suporta:
```typescript
config: {
  type: 'upload' | 'checklist' | 'email' | 'generate_doc' | 'form' | 'field' | 'schedule_event'

  // Para type = 'form':
  form_template_id?: string       // FK → tpl_form_templates
  form_title?: string
  sections?: FormSectionConfig[]  // Inline ou via template

  // Para type = 'field':
  field?: FormFieldConfig         // Campo individual
  show_current_value?: boolean
  auto_complete_on_save?: boolean

  // Multiplicação por proprietários (condicional):
  owner_scope?: 'none' | 'all_owners' | 'main_contact_only'
  person_type_filter?: 'all' | 'singular' | 'coletiva'
  has_person_type_variants?: boolean
  singular_config?: { doc_type_id?, email_library_id?, doc_library_id? }
  coletiva_config?: { doc_type_id?, email_library_id?, doc_library_id? }
}
```

### Tabelas de Recrutamento (Pipeline Completo)

| Tabela | Propósito |
|--------|-----------|
| `recruitment_candidates` | Candidato master (status pipeline) |
| `recruitment_entry_submissions` | Formulário de entrada detalhado (~30 campos) |
| `recruitment_form_fields` | Definições dos campos do formulário |
| `recruitment_interviews` | Registo de entrevistas |
| `recruitment_origin_profiles` | Experiência anterior |
| `recruitment_pain_pitch` | Objecções e fit assessment |
| `recruitment_financial_evolution` | Performance pós-entrada |
| `recruitment_budget` | Custos de campanha |
| `recruitment_onboarding` | Checklist de onboarding |
| `recruitment_stage_log` | Auditoria de mudanças de status |

### APIs de Form Templates

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/form-templates` | Listar templates activos por categoria |
| POST | `/api/form-templates` | Criar novo template |
| GET | `/api/form-templates/[id]` | Obter template específico |
| PUT | `/api/form-templates/[id]` | Actualizar template |
| DELETE | `/api/form-templates/[id]` | Eliminar template |
| POST | `/api/entry-form` | Submissão do formulário de recrutamento (multipart) |

---

## Implementações de Formulários Existentes

### Inventário de Padrões

| Padrão | Componente | Ficheiro | Características |
|--------|-----------|----------|-----------------|
| **Multi-Step Wizard** | PropertyForm | `components/properties/property-form.tsx` | 4 steps, RHF+Zod, validação por step |
| **Multi-Step Stepper** | AcquisitionFormV2 | `components/acquisitions/acquisition-form-v2.tsx` | 5 steps, draft persistence, eventos de submissão |
| **Linear Simples** | LeadForm | `components/leads/lead-form.tsx` | Single-step, RHF+Zod |
| **Condicional por Enum** | NegocioForm | `components/negocios/negocio-form.tsx` | Campos mudam por tipo (Compra/Venda/etc.), state puro |
| **Condicional Singular/Coletiva** | OwnerForm | `components/owners/owner-form.tsx` | RHF+Zod com `.refine()` |
| **Config-Driven (Dinâmico)** | DynamicFormRenderer | `components/processes/dynamic-form-renderer.tsx` | 15+ tipos de campo, renderiza de JSONB |
| **Builder DnD** | TemplateBuilder | `components/templates/template-builder.tsx` | @dnd-kit, metadata separada |
| **Builder Collapsível** | CourseBuilder | `components/training/course-builder.tsx` | Módulos/lições nested |

### DynamicFormRenderer — O Renderizador Existente
**Ficheiro:** `components/processes/dynamic-form-renderer.tsx`

Já suporta 15+ tipos de campo:

| Tipo | Componente | Descrição |
|------|-----------|-----------|
| `text` | TextFieldRenderer | Input simples |
| `textarea` | TextareaFieldRenderer | Multi-linha |
| `number` | NumberFieldRenderer | Input numérico |
| `currency` | CurrencyFieldRenderer | Input com máscara EUR |
| `percentage` | PercentageFieldRenderer | Input com máscara % |
| `select` | SelectFieldRenderer | Dropdown com `resolveOptionsFromConstant()` |
| `multiselect` | MultiselectFieldRenderer | BadgeMultiSelect |
| `checkbox` | CheckboxFieldRenderer | Toggle/checkbox |
| `date` | DateFieldRenderer | Calendar popover com date-fns |
| `email` | EmailFieldRenderer | Input com validação email |
| `phone` | PhoneFieldRenderer | Input com máscara telefone |
| `address_map` | AddressMapFieldRenderer | **Mapbox autocomplete + mapa** |
| `media_upload` | MediaUploadFieldRenderer | **Upload de imagens** |
| `rich_text` | RichTextFieldRenderer | Editor Tiptap HTML |
| `link_external` | LinkExternalFieldRenderer | Array de {site, url, data} |

**Funcionalidades:**
- Integração com react-hook-form via `Control<Record<string, unknown>>`
- Validação Zod aplicada por campo
- Badge para campos obrigatórios
- Help text
- Resolução de opções a partir de constantes via `resolveOptionsFromConstant()`
- Formatação de data com pt locale

### Validações Zod Existentes

| Ficheiro | Schemas | Linhas |
|----------|---------|--------|
| `lib/validations/property.ts` | propertySchema, propertySpecsSchema, propertyInternalSchema, propertyMediaSchema, updatePropertySchema, propertyFiltersSchema | 113 |
| `lib/validations/lead.ts` | createLeadSchema, updateLeadSchema, createNegocioSchema, updateNegocioSchema | 156 |
| `lib/validations/owner.ts` | ownerSchema (com `.refine()` para coletiva), propertyOwnerSchema | 72 |
| `lib/validations/acquisition.ts` | acquisitionSchema (full), acquisitionStep1-5Schema, ownerSchema nested | 281 |
| `lib/validations/training.ts` | createCourseSchema, createModuleSchema, createLessonSchema, createQuizSchema, etc. | 222 |

**Padrões de Validação Usados:**
- `.optional().or(z.literal(''))` — campos opcionais que podem ser string vazia
- `.refine()` — validação cross-field (ex: coletiva requer representante legal)
- `.partial()` — schemas de update (PUT)
- `.regex(uuidRegex)` — UUID sem z.uuid() (bits de versão)
- `z.coerce.number()` — coerção de string para número
- `z.discriminatedUnion()` — NÃO usado actualmente

---

## Fluxo de Criação de Angariação (Eventos de Submissão)

### Fluxo Actual

```
1. AcquisitionFormV2 (5 steps)
   │
   ├─→ POST /api/acquisitions/draft (lazy creation)
   │     ├─ Cria dev_properties (status: 'draft')
   │     ├─ Cria dev_property_specifications (vazio)
   │     ├─ Cria dev_property_internal (vazio)
   │     └─ Cria proc_instances (status: 'draft', tpl_process_id: null)
   │
   ├─→ PUT /api/acquisitions/{id}/step/{n} (saves parciais)
   │     └─ Actualiza tabelas relevantes por step
   │
   └─→ POST /api/acquisitions/{id}/finalize (submissão final)
         ├─ Valida todos os campos obrigatórios
         ├─ Faz upload de documentos pendentes
         ├─ Muda property status → 'pending_approval'
         ├─ Muda process status → 'pending_approval'
         └─ Envia notificações aos aprovadores ← EVENTO
```

### Fluxo de Aprovação (Post-Submissão)

```
POST /api/processes/{id}/approve
  ├─ Valida template existe e is_active
  ├─ Actualiza proc_instances (status: 'active', tpl_process_id)
  ├─ RPC: populate_process_tasks() — copia tarefas do template
  ├─ RPC: resolve_process_dependencies() — resolve dependências
  ├─ autoCompleteTasks() — auto-completa uploads com docs existentes
  ├─ recalculateProgress() — recalcula percentagem
  ├─ Actualiza property status → 'in_process'
  └─ Envia notificação ao requerente ← EVENTO
```

### Submissão de Negócio (Sem Eventos)

```
POST /api/negocios
  └─ Insere na tabela 'negocios'
  └─ Retorna { id }
  └─ SEM side effects, SEM notificações, SEM processo
```

### Sistema de Notificações Existente

**Ficheiro:** `lib/notifications/service.ts`

```typescript
class NotificationService {
  create(params)              // Notificação individual
  createBatch(ids[], params)  // Notificações em batch
  getUserIdsByRoles(roles[])  // Buscar users por role
}
```

| Evento | Trigger | Destinatários | Tipo |
|--------|---------|---------------|------|
| Angariação submetida | finalize | APPROVER_NOTIFICATION_ROLES | `process_created` |
| Processo aprovado | approve | `proc.requested_by` | `process_approved` |

---

## Padrões Externos Documentados

### Abordagem Recomendada: Field Config Array + react-hook-form

**Fonte:** [react-hook-form Advanced Usage](https://react-hook-form.com/advanced-usage#SmartFormComponent)

Esta é a abordagem mais adequada ao stack actual. Define campos como array de configuração e renderiza dinamicamente.

```typescript
// types/form-hub.ts
type FieldType =
  | 'text' | 'textarea' | 'number' | 'currency' | 'percentage'
  | 'select' | 'multiselect' | 'checkbox' | 'date'
  | 'email' | 'phone' | 'rich_text'
  | 'address_map' | 'media_upload' | 'link_external';

interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  options_from_constant?: string;
  group?: string;
  group_label?: string;
  group_order?: number;
  order: number;
  width?: 'full' | 'half' | 'third';
  help_text?: string;
  // Condicional
  condition?: {
    field: string;
    operator: 'eq' | 'neq' | 'in' | 'notIn';
    value: unknown;
  };
  // Validação
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}
```

### Geração Dinâmica de Schema Zod

**Fonte:** [Zod Discussions #2050](https://github.com/colinhacks/zod/discussions/2050)

```typescript
// lib/form-hub/zod-builder.ts
import { z, ZodTypeAny } from 'zod';

function buildFieldSchema(field: FieldDefinition): ZodTypeAny {
  let schema: ZodTypeAny;

  switch (field.type) {
    case 'text':
    case 'textarea':
      schema = z.string();
      if (field.validation?.minLength) schema = (schema as z.ZodString).min(field.validation.minLength);
      if (field.validation?.maxLength) schema = (schema as z.ZodString).max(field.validation.maxLength);
      break;
    case 'number':
    case 'currency':
    case 'percentage':
      schema = z.coerce.number();
      if (field.validation?.min !== undefined) schema = (schema as z.ZodNumber).min(field.validation.min);
      if (field.validation?.max !== undefined) schema = (schema as z.ZodNumber).max(field.validation.max);
      break;
    case 'select':
      schema = field.options?.length
        ? z.enum(field.options.map(o => o.value) as [string, ...string[]])
        : z.string();
      break;
    case 'checkbox':
      schema = z.boolean();
      break;
    case 'date':
      schema = z.string().refine(v => !isNaN(Date.parse(v)), { message: 'Data inválida' });
      break;
    default:
      schema = z.any();
  }

  if (!field.required) schema = schema.optional();
  return schema;
}

export function buildZodSchema(fields: FieldDefinition[]) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const field of fields) {
    shape[field.name] = field.condition
      ? buildFieldSchema({ ...field, required: false }) // condicionais são opcionais no schema
      : buildFieldSchema(field);
  }
  return z.object(shape);
}

// Validação condicional via superRefine
export function buildZodSchemaWithConditions(fields: FieldDefinition[]) {
  const base = buildZodSchema(fields);
  return base.superRefine((data, ctx) => {
    for (const field of fields) {
      if (!field.condition || !field.required) continue;
      const conditionMet = evaluateCondition(field.condition, data[field.condition.field]);
      if (conditionMet && (!data[field.name] || data[field.name] === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field.label} é obrigatório`,
          path: [field.name],
        });
      }
    }
  });
}
```

**Fonte Zod superRefine:** [zod.dev/?id=superrefine](https://zod.dev/?id=superrefine)

### Campos Condicionais com useWatch

**Fonte:** [react-hook-form useWatch](https://react-hook-form.com/api/usewatch)

```typescript
function ConditionalField({ watchField, condition, children }) {
  const value = useWatch({ name: watchField });
  if (!condition(value)) return null;
  return <>{children}</>;
}
```

### Campos Compostos — Registry Pattern

```typescript
// Registo de componentes compostos
const COMPOUND_FIELD_REGISTRY: Record<string, React.ComponentType<CompoundFieldProps>> = {
  'address_map': AddressMapPickerGroup,   // ← já existe: PropertyAddressMapPicker
  'media_upload': MediaUploadGroup,        // ← já existe: PropertyMediaUpload
  'link_external': LinkExternalGroup,      // ← já existe no DynamicFormRenderer
  'owner_search': OwnerSearchGroup,        // ← já existe parcialmente
};

function DynamicField({ field }: { field: FieldDefinition }) {
  const CompoundComponent = COMPOUND_FIELD_REGISTRY[field.type];
  if (CompoundComponent) {
    return <CompoundComponent fieldDef={field} />;
  }
  // ... render campos standard
}
```

### Eventos de Submissão — Padrão Server-Side

```typescript
// Tabela proposta: form_submission_events
{
  template_id: UUID       // FK → form_templates
  event_type: string      // 'create_process' | 'send_notification' | 'create_entity' | 'webhook'
  event_config: JSONB     // { tpl_process_id, notification_roles[], entity_type, ... }
  event_order: number     // Ordem de execução
}

// Após submissão do formulário no API:
async function executeSubmissionEvents(templateId: string, formData: Record<string, unknown>) {
  const events = await supabase
    .from('form_submission_events')
    .select('*')
    .eq('template_id', templateId)
    .order('event_order');

  for (const event of events.data) {
    switch (event.event_type) {
      case 'create_process':
        await createProcessInstance(event.event_config.tpl_process_id, formData);
        break;
      case 'send_notification':
        await notificationService.createBatch(
          await notificationService.getUserIdsByRoles(event.event_config.roles),
          { title: event.event_config.title, body: event.event_config.body }
        );
        break;
      // ...
    }
  }
}
```

### Bibliotecas Externas Avaliadas

| Biblioteca | Usa RHF? | Usa Zod? | Veredicto |
|-----------|----------|----------|-----------|
| [react-jsonschema-form](https://rjsf-team.github.io/react-jsonschema-form/docs/) | Não | Não | **Não usar** — state management próprio, incompatível |
| [uniforms](https://uniforms.tools/) | Não | Sim (bridge) | **Não usar** — state management próprio |
| [autoform/shadcn](https://github.com/vantezzen/autoform) | Sim | Sim | **Referência** — bom para schemas estáticos, não database-driven |
| [json-schema-to-zod](https://github.com/StefanTerdell/json-schema-to-zod) | N/A | Sim | **Não usar** — gera strings, não schemas runtime |

**Conclusão:** Construir internamente sobre react-hook-form + Zod + shadcn/ui, usando o `DynamicFormRenderer` existente como base.

---

## Ficheiros da Base de Código Relevantes

### Tipos e Definições

| Ficheiro | Conteúdo |
|----------|----------|
| `types/database.ts` | Schema completo Supabase (auto-gerado) |
| `types/subtask.ts:1-220` | FormFieldType, FormFieldConfig, FormSectionConfig, FormTargetEntity |
| `types/meta-form.ts:1-67` | FieldType para leads (versão simplificada) |
| `types/recruitment.ts:1-331` | Types e constantes de recrutamento |
| `types/template.ts` | Wrapper types para templates |

### Componentes de Formulário

| Ficheiro | Padrão |
|----------|--------|
| `components/processes/dynamic-form-renderer.tsx` | **Renderizador dinâmico existente** (15+ tipos) |
| `components/properties/property-form.tsx:1-659` | Multi-step wizard (4 steps) |
| `components/acquisitions/acquisition-form-v2.tsx:1-550` | Multi-step com draft + eventos |
| `components/leads/lead-form.tsx:1-174` | Linear simples |
| `components/negocios/negocio-form.tsx:1-200` | Condicional por tipo de negócio |
| `components/owners/owner-form.tsx:1-150` | Condicional singular/coletiva |
| `components/properties/property-address-map-picker.tsx` | Campo composto: Mapbox |
| `components/properties/property-media-upload.tsx` | Campo composto: upload media |

### Validações

| Ficheiro | Schemas |
|----------|---------|
| `lib/validations/property.ts` | propertySchema, propertySpecsSchema, propertyInternalSchema |
| `lib/validations/lead.ts` | createLeadSchema, createNegocioSchema |
| `lib/validations/owner.ts` | ownerSchema (com refine para coletiva) |
| `lib/validations/acquisition.ts` | acquisitionSchema (5 steps) |
| `lib/validations/training.ts` | createCourseSchema, createLessonSchema, createQuizSchema |

### APIs

| Ficheiro | Descrição |
|----------|-----------|
| `app/api/form-templates/route.ts` | CRUD de form templates |
| `app/api/form-templates/[id]/route.ts` | GET/PUT/DELETE individual |
| `app/api/entry-form/route.ts` | Submissão formulário recrutamento (multipart) |
| `app/api/acquisitions/route.ts:8-303` | Criação de angariação (com eventos) |
| `app/api/acquisitions/draft/route.ts` | Draft lazy creation |
| `app/api/acquisitions/[id]/finalize/route.ts` | Finalização + notificações |
| `app/api/processes/[id]/approve/route.ts:16-254` | Aprovação + populate tasks |

### Infra de Suporte

| Ficheiro | Descrição |
|----------|-----------|
| `lib/notifications/service.ts` | NotificationService (create, createBatch, getUserIdsByRoles) |
| `lib/process-engine.ts` | autoCompleteTasks(), recalculateProgress() |
| `lib/constants.ts` | STATUS_COLORS, labels PT-PT, constantes de opções |

---

## Arquitectura Proposta (Visão Geral)

```
┌─────────────────────────────────────────────────────────┐
│  SUPABASE (Hub Central)                                 │
│                                                         │
│  form_fields (campos reutilizáveis)                     │
│    ├─ name, label, field_type, validation, options      │
│    └─ is_system, category                               │
│                                                         │
│  form_templates (composições de campos)                 │
│    ├─ name, context, sections JSONB                     │
│    └─ FK → form_template_fields (junction)              │
│                                                         │
│  form_template_fields (junction + config por contexto)  │
│    ├─ template_id, field_id, group, order               │
│    ├─ is_required (override por template)               │
│    └─ condition_field_id, condition_operator, value      │
│                                                         │
│  form_submission_events (eventos pós-submissão)         │
│    ├─ template_id, event_type, event_config JSONB       │
│    └─ 'create_process' | 'send_notification' | etc.     │
│                                                         │
│  tpl_variables (mapeamento campo → tabela.coluna)       │
│    └─ Já existente — expandir para novos campos         │
└──────────────────────┬──────────────────────────────────┘
                       │ API: /api/form-hub/...
                       ▼
┌─────────────────────────────────────────────────────────┐
│  HOOK: useDynamicForm(templateSlug)                     │
│    ├─ Fetch field definitions + template config         │
│    ├─ Build Zod schema dinamicamente (buildZodSchema)   │
│    └─ Return { fields, zodSchema, loading }             │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  COMPONENTE: <DynamicForm>                              │
│    ├─ useForm({ resolver: zodResolver(schema) })        │
│    ├─ Agrupa campos por group_name                      │
│    ├─ Renderiza <DynamicField> por campo                │
│    │   ├─ useWatch para condicionais                    │
│    │   ├─ Standard: Input, Select, Date, etc.           │
│    │   └─ Compound: AddressMap, MediaUpload, etc.       │
│    └─ onSubmit → API executa submission events          │
└─────────────────────────────────────────────────────────┘
```

### Onde Usar

| Contexto | Template Slug (exemplo) | Campos |
|----------|------------------------|--------|
| Angariação | `angariacao-venda` | Dados imóvel + localização + proprietários + contrato |
| Recrutamento | `recrutamento-entrada` | Dados pessoais + documentos + experiência |
| Negócio Compra | `negocio-compra` | Orçamento + preferências + localização |
| Negócio Venda | `negocio-venda` | Preço + dados imóvel |
| Editar Imóvel | `imovel-edicao` | Todos os campos de imóvel |
| Proprietário Singular | `proprietario-singular` | Dados pessoais + KYC |
| Proprietário Coletiva | `proprietario-coletiva` | Dados empresa + representante |

---

## Referências Externas

| Recurso | URL |
|---------|-----|
| react-hook-form Smart Form Component | https://react-hook-form.com/advanced-usage#SmartFormComponent |
| react-hook-form useWatch | https://react-hook-form.com/api/usewatch |
| react-hook-form useFieldArray | https://react-hook-form.com/api/usefieldarray |
| Zod superRefine | https://zod.dev/?id=superrefine |
| Zod discriminatedUnion | https://zod.dev/?id=discriminated-unions |
| Zod dynamic schemas discussion | https://github.com/colinhacks/zod/discussions/2050 |
| shadcn/ui Form | https://ui.shadcn.com/docs/components/form |
| autoform/shadcn (referência) | https://github.com/vantezzen/autoform |
