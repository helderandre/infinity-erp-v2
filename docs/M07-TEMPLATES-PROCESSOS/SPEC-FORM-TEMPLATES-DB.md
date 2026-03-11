# SPEC — Form Templates em DB + Localização Mapbox + Upload de Imagens

**Data:** 2026-03-10
**Resumo:** Extensão do sistema de subtarefas form/field com 3 capacidades: templates de formulário armazenados na base de dados, campo composto de localização com Mapbox, e campo de upload de imagens do imóvel.

---

## 1. Templates de Formulário na Base de Dados

### 1.1 Tabela `tpl_form_templates`

```sql
CREATE TABLE tpl_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,              -- 'Imóvel', 'Proprietário', 'Geral', etc.
  is_active BOOLEAN DEFAULT true,
  sections JSONB NOT NULL DEFAULT '[]',  -- FormSectionConfig[]
  created_by UUID REFERENCES dev_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

- RLS activo: leitura para autenticados (apenas activos), gestão via service role
- Índice em `(is_active, category)`

### 1.2 API CRUD

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/form-templates` | Listar templates activos (filtro opcional `?category=`) |
| POST | `/api/form-templates` | Criar template (`{ name, description, category, sections }`) |
| GET | `/api/form-templates/[id]` | Obter template por ID |
| PUT | `/api/form-templates/[id]` | Actualizar template |
| DELETE | `/api/form-templates/[id]` | Soft delete (`is_active = false`) |

### 1.3 Referência em Subtarefas

O campo `form_template_id` foi adicionado ao config das subtarefas:

```typescript
// types/subtask.ts — em TplSubtask.config, ProcSubtask.config, SubtaskData.config
form_template_id?: string  // referência a tpl_form_templates.id
```

**Resolução no API:** O endpoint `GET /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form` resolve `form_template_id` automaticamente — se existe, busca as secções da tabela `tpl_form_templates` e substitui no config antes de retornar ao cliente.

### 1.4 UI — Template Selector

No `subtask-config-dialog.tsx`, quando `type === 'form'`:
- Toggle "Usar template de formulário" (Switch)
- Se activo: dropdown Select com templates agrupados por categoria
- Se desactivo: FormFieldPicker inline (comportamento anterior)

### 1.5 Validação

A validação Zod aceita subtarefas `form` em 3 estados:
1. `form_template_id` definido (template da DB)
2. `sections` com campos configurados (inline)
3. Sem config (será configurado depois)

---

## 2. Campo `address_map` — Localização com Mapbox

### 2.1 Novo FormFieldType

```typescript
export type FormFieldType = ... | 'address_map'
```

### 2.2 Comportamento

O `address_map` é um **campo composto** que renderiza o `PropertyAddressMapPicker` existente dentro do `DynamicFormRenderer`. Um único campo no formulário expande-se em 6 sub-campos:

| Sub-campo | Tipo | Visível |
|-----------|------|---------|
| `address_street` | text | Sim (via autocomplete) |
| `postal_code` | text | Sim (auto-preenchido) |
| `city` | text | Sim (auto-preenchido) |
| `zone` | text | Sim (auto-preenchido) |
| `latitude` | number | Não (hidden, auto) |
| `longitude` | number | Não (hidden, auto) |

### 2.3 Componente

**Ficheiro:** `components/processes/address-map-field-renderer.tsx`

- Wrapper do `PropertyAddressMapPicker` para react-hook-form
- Usa `useFormContext()` para aceder ao form
- Callbacks `form.setValue()` actualizam os 6 sub-campos
- Largura sempre `col-span-12` (full width)

### 2.4 Schema Zod

Em `buildZodSchema()`, quando `field_type === 'address_map'`:
- Cria 6 schemas: `z.string().optional().nullable()` para text, `z.coerce.number().optional().nullable()` para lat/lng
- Keys: `${entity}__address_street`, `${entity}__postal_code`, etc.

### 2.5 API — Expansão de Campos

No `GET /api/.../form`, campos `address_map` são expandidos para os 6 sub-campos antes de fazer SELECT à base de dados. No agrupamento por entidade, os valores voltam automaticamente para `property.city`, `property.address_street`, etc.

### 2.6 Registry

```typescript
// lib/form-field-registry.ts
{
  field_name: 'location',
  label: 'Localização do Imóvel (Mapbox)',
  field_type: 'address_map',
  target_entity: 'property',
  category: 'Imóvel — Localização',
}
```

Os campos individuais (city, zone, address_street, postal_code) continuam disponíveis na categoria `Imóvel — Localização (Campos Individuais)`.

---

## 3. Campo `media_upload` — Upload de Imagens

### 3.1 Novo FormFieldType

```typescript
export type FormFieldType = ... | 'media_upload'
```

### 3.2 Comportamento

O `media_upload` integra o sistema de upload de imagens existente (`PropertyMediaUpload` + `PropertyMediaGallery`) dentro do formulário dinâmico. Os uploads vão directamente para `/api/properties/{propertyId}/media` — não passam pelo PUT do formulário.

### 3.3 Componente

**Ficheiro:** `components/processes/media-upload-field-renderer.tsx`

- Recebe `context.propertyId` do `DynamicFormRenderer`
- Mostra `PropertyMediaUpload` (upload com crop, compress, WebP)
- Mostra `PropertyMediaGallery` (galeria com drag-to-reorder)
- Badge com contagem de imagens
- Validação visual de mínimo de imagens (`field.min`)

### 3.4 Context Prop

O `DynamicFormRenderer` agora aceita `context?: { propertyId?: string }`:

```typescript
<DynamicFormRenderer
  sections={sections}
  defaultValues={values}
  onSubmit={handleSubmit}
  context={{ propertyId }}
/>
```

O `FormSubtaskDialog` obtém `propertyId` do response do API (`data.property_id`) e passa-o ao renderer.

### 3.5 Schema e Agrupamento

- No `buildZodSchema()`: `media_upload` cria `z.coerce.number().optional().nullable()` (armazena contagem)
- No `handleSubmit`: campos `media_upload` são ignorados no agrupamento (uploads já foram directos)
- No API PUT: campos de media não são escritos nas tabelas

### 3.6 Registry

```typescript
// lib/form-field-registry.ts
{
  field_name: 'media',
  label: 'Fotografias do Imóvel',
  field_type: 'media_upload',
  target_entity: 'property',
  category: 'Imóvel — Media',
}
```

---

## Ficheiros Criados

| Ficheiro | Descrição |
|----------|-----------|
| `app/api/form-templates/route.ts` | GET + POST form templates |
| `app/api/form-templates/[id]/route.ts` | GET + PUT + DELETE form templates |
| `components/processes/address-map-field-renderer.tsx` | Renderer Mapbox para DynamicFormRenderer |
| `components/processes/media-upload-field-renderer.tsx` | Renderer upload imagens para DynamicFormRenderer |

## Ficheiros Modificados

| Ficheiro | Alterações |
|----------|------------|
| `types/subtask.ts` | +`address_map`, `media_upload` em FormFieldType; +`form_template_id` nos configs |
| `lib/validations/template.ts` | +`form_template_id`, +novos field_types no enum, validação form mais permissiva |
| `lib/form-field-registry.ts` | +entry `address_map` (Localização Mapbox), +entry `media_upload` (Media), campos individuais movidos |
| `components/processes/dynamic-form-renderer.tsx` | +`context` prop, +2 renderers, +buildZodSchema para address_map/media_upload, +ignore media no submit |
| `components/processes/form-subtask-dialog.tsx` | +`propertyId` state, +passa context ao renderer |
| `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form/route.ts` | +resolução form_template_id, +expansão address_map, +retorno property_id |
| `components/templates/subtask-config-dialog.tsx` | +FormTemplateSelector, +toggle template vs inline |
| `types/database.ts` | Regenerado com tabela `tpl_form_templates` |

## Migração de Base de Dados

- `create_tpl_form_templates` — cria tabela, índice e políticas RLS
