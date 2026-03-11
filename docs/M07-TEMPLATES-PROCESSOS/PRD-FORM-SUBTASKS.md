# PRD — Subtarefas de Formulário e Campo (Form + Field Subtask Types)

**Data:** 2026-03-10
**Objectivo:** Permitir criar formulários configuráveis e campos individuais como subtarefas dentro de templates de processo, para que utilizadores não técnicos possam editar informações de imóveis, proprietários e dados de angariação directamente a partir do fluxo processual.

---

## 1. Resumo Executivo

Hoje o sistema de templates suporta 4 tipos de subtarefas: `upload`, `checklist`, `email`, `generate_doc`. Este PRD propõe adicionar **2 novos tipos**:

| Tipo | Descrição | UX |
|------|-----------|-----|
| **`form`** | Formulário completo com N campos agrupados em secções | Abre **Sheet/Dialog** com múltiplos campos organizados em Cards |
| **`field`** | Campo único vinculado a uma coluna específica do DB | Input **inline no card** da subtarefa — sem modal, edição directa |

### Quando usar cada um

- **`form`** — "Completar Dados do Imóvel" (10 campos), "Confirmar Dados do Proprietário" (6 campos), tarefas que agrupam informação relacionada
- **`field`** — "Preencher Preço de Venda" (1 input €), "Confirmar NIF" (1 input texto), "Marcar Elevador" (1 checkbox) — tarefas atómicas, rápidas de completar

Os dois tipos partilham a mesma infraestrutura (field registry, renderer, API de upsert) mas diferem na UX de execução.

---

## 2. Arquivos da Base de Código Afectados

### 2.1 Types & Validações (Modificar)

| Ficheiro | O que mudar |
|----------|-------------|
| [types/subtask.ts](types/subtask.ts) | Adicionar `'form'` e `'field'` ao `SubtaskType`, criar `FormFieldConfig`, `FormSubtaskConfig`, `FieldSubtaskConfig` |
| [lib/validations/template.ts](lib/validations/template.ts) | Adicionar validação Zod para `type: 'form'` (sections) e `type: 'field'` (single field config) |
| [lib/constants.ts](lib/constants.ts) | Adicionar `form` e `field` ao `SUBTASK_TYPES`, labels, ícones |

### 2.2 Template Builder (Modificar)

| Ficheiro | O que mudar |
|----------|-------------|
| [components/templates/subtask-config-dialog.tsx](components/templates/subtask-config-dialog.tsx) | Nova secção de configuração para `type: 'form'` — field picker visual |
| [components/templates/subtask-editor.tsx](components/templates/subtask-editor.tsx) | Ícone + label para tipo `form` |

### 2.3 Execução de Processo (Modificar)

| Ficheiro | O que mudar |
|----------|-------------|
| [components/processes/task-detail-actions.tsx](components/processes/task-detail-actions.tsx) | Renderizar `form` (abre modal) e `field` (inline input) |
| [components/processes/subtask-card-base.tsx](components/processes/subtask-card-base.tsx) | Ícone + visual para `form` e `field`; modo inline para `field` |
| [components/processes/subtask-card-list.tsx](components/processes/subtask-card-list.tsx) | Lógica de abertura do modal (`form`) e toggle inline (`field`) |

### 2.4 Novos Ficheiros (Criar)

| Ficheiro | Propósito |
|----------|-----------|
| `components/processes/form-subtask-dialog.tsx` | **Modal** — renderiza formulário completo (modo `form`) |
| `components/processes/field-subtask-inline.tsx` | **Inline** — renderiza campo único dentro do card (modo `field`) |
| `components/processes/dynamic-form-renderer.tsx` | **Renderer** — mapeia `FormFieldConfig[]` → campos react-hook-form + shadcn (usado por ambos os modos) |
| `components/templates/form-field-picker.tsx` | **Picker no builder** — UI para seleccionar campos (modo `form`: multi-field, modo `field`: single-field) |
| `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form/route.ts` | **API** — GET (dados actuais) + PUT (upsert) — serve ambos os modos |
| `lib/form-field-registry.ts` | **Registry** — catálogo de todos os campos disponíveis por entidade |

### 2.5 Ficheiros de Referência (Padrões a Seguir)

| Ficheiro | Padrão útil |
|----------|-------------|
| [components/properties/property-form.tsx](components/properties/property-form.tsx) | Padrão de formulário multi-secção com react-hook-form + zod |
| [components/owners/owner-form.tsx](components/owners/owner-form.tsx) | Campos condicionais (singular/coletiva), validação dinâmica |
| [lib/validations/property.ts](lib/validations/property.ts) | Schema de 3 tabelas separadas (property + specs + internal) |
| [app/api/properties/[id]/route.ts](app/api/properties/[id]/route.ts) | Padrão upsert: `{ property, specifications, internal }` separados |
| [components/templates/subtask-config-dialog.tsx](components/templates/subtask-config-dialog.tsx) | Split layout Nav+Content para configuração de subtarefas |
| [components/documents/document-upload-dialog.tsx](components/documents/document-upload-dialog.tsx) | Padrão Dialog com estado interno + cleanup on close |

---

## 3. Modelo de Dados

### 3.1 Novos SubtaskTypes

```typescript
// types/subtask.ts — ANTES
export type SubtaskType = 'upload' | 'checklist' | 'email' | 'generate_doc'

// types/subtask.ts — DEPOIS
export type SubtaskType = 'upload' | 'checklist' | 'email' | 'generate_doc' | 'form' | 'field'
```

**Diferença conceptual:**

| | `form` | `field` |
|---|---|---|
| **Campos** | N campos em secções | 1 campo único |
| **UX** | Abre Sheet/Dialog | Input inline no card |
| **Config** | `sections: FormSectionConfig[]` | `field: FormFieldConfig` (singular) |
| **Completar** | Guardar todo o formulário | Guardar o valor + auto-complete |
| **Uso típico** | Etapas de preenchimento bulk | Confirmações pontuais |

### 3.2 Estrutura da Config para `type: 'form'`

```typescript
// types/subtask.ts — novos tipos

/**
 * Entidades que podem ser editadas via formulário.
 * Cada target_entity mapeia para tabelas específicas no Supabase.
 */
export type FormTargetEntity =
  | 'property'           // dev_properties
  | 'property_specs'     // dev_property_specifications
  | 'property_internal'  // dev_property_internal
  | 'owner'              // owners (via property_owners junction)
  | 'property_owner'     // property_owners (ownership_percentage, is_main_contact)

/**
 * Tipos de campo suportados pelo renderer dinâmico.
 * Mapeiam 1:1 para componentes shadcn/ui.
 */
export type FormFieldType =
  | 'text'        // Input
  | 'textarea'    // Textarea
  | 'number'      // Input type=number
  | 'currency'    // Input com formatação €
  | 'percentage'  // Input com sufixo %
  | 'select'      // Select com opções
  | 'multiselect' // Multi-select com checkboxes/badges
  | 'checkbox'    // Checkbox boolean
  | 'date'        // DatePicker (Calendar + Popover)
  | 'email'       // Input type=email
  | 'phone'       // Input type=tel
  | 'image_upload' // Upload de imagens (reutilizar PropertyMediaUpload)

/**
 * Definição de um campo dentro do formulário dinâmico.
 * Armazenado em tpl_subtasks.config.form_fields[].
 */
export interface FormFieldConfig {
  /** Nome da coluna na tabela (ex: 'title', 'listing_price', 'bedrooms') */
  field_name: string
  /** Label visível ao utilizador (PT-PT) */
  label: string
  /** Tipo do campo — determina componente renderizado */
  field_type: FormFieldType
  /** Entidade alvo — determina tabela para upsert */
  target_entity: FormTargetEntity
  /** Campo obrigatório? */
  required?: boolean
  /** Texto de ajuda abaixo do campo */
  help_text?: string
  /** Placeholder do input */
  placeholder?: string
  /** Opções para select/multiselect (value + label) */
  options?: { value: string; label: string }[]
  /** Para selects que usam opções de constantes existentes (ex: 'PROPERTY_TYPES') */
  options_from_constant?: string
  /** Validação numérica */
  min?: number
  max?: number
  /** Largura no grid: 'full' (12 cols), 'half' (6 cols), 'third' (4 cols) */
  width?: 'full' | 'half' | 'third'
  /** Ordem de exibição */
  order_index: number
}

/**
 * Secção visual que agrupa campos (ex: "Dados Gerais", "Localização").
 * Renderizada como Card com título.
 */
export interface FormSectionConfig {
  /** Título da secção (PT-PT) */
  title: string
  /** Descrição opcional */
  description?: string
  /** Campos dentro desta secção */
  fields: FormFieldConfig[]
  /** Ordem de exibição */
  order_index: number
}

/**
 * Config completa para subtarefa tipo 'form' (formulário completo).
 * Armazenada em tpl_subtasks.config.
 */
export interface FormSubtaskConfig {
  type: 'form'
  /** Título do modal/sheet (ex: "Editar Dados do Imóvel") */
  form_title?: string
  /** Secções do formulário */
  sections: FormSectionConfig[]
  /**
   * owner_scope herdado — se 'all_owners', mostra formulário
   * para cada proprietário (campos com target_entity 'owner')
   */
  owner_scope?: OwnerScope
  // ... restantes campos SubtaskOwnerConfig
}

/**
 * Config completa para subtarefa tipo 'field' (campo único inline).
 * Armazenada em tpl_subtasks.config.
 */
export interface FieldSubtaskConfig {
  type: 'field'
  /** O campo único a editar */
  field: FormFieldConfig
  /**
   * Mostrar valor actual ao lado do input?
   * Útil para o utilizador ver o que já está preenchido.
   */
  show_current_value?: boolean
  /**
   * Auto-completar a subtarefa quando o campo é guardado?
   * Default: true — guardar = marcar subtarefa como concluída.
   */
  auto_complete_on_save?: boolean
  /** owner_scope para campos de proprietário */
  owner_scope?: OwnerScope
  // ... restantes campos SubtaskOwnerConfig
}
```

### 3.3 Exemplo de Config Armazenada no DB

```jsonc
// tpl_subtasks.config para uma subtarefa "Completar Dados do Imóvel"
{
  "type": "form",
  "form_title": "Completar Informações do Imóvel",
  "sections": [
    {
      "title": "Dados Gerais",
      "order_index": 0,
      "fields": [
        {
          "field_name": "title",
          "label": "Título do Anúncio",
          "field_type": "text",
          "target_entity": "property",
          "required": true,
          "placeholder": "Ex: T3 com vista mar em Cascais",
          "width": "full",
          "order_index": 0
        },
        {
          "field_name": "listing_price",
          "label": "Preço",
          "field_type": "currency",
          "target_entity": "property",
          "required": true,
          "min": 0,
          "width": "half",
          "order_index": 1
        },
        {
          "field_name": "property_type",
          "label": "Tipo de Imóvel",
          "field_type": "select",
          "target_entity": "property",
          "options_from_constant": "PROPERTY_TYPES",
          "width": "half",
          "order_index": 2
        }
      ]
    },
    {
      "title": "Especificações",
      "order_index": 1,
      "fields": [
        {
          "field_name": "bedrooms",
          "label": "Quartos",
          "field_type": "number",
          "target_entity": "property_specs",
          "min": 0,
          "width": "third",
          "order_index": 0
        },
        {
          "field_name": "bathrooms",
          "label": "Casas de Banho",
          "field_type": "number",
          "target_entity": "property_specs",
          "min": 0,
          "width": "third",
          "order_index": 1
        },
        {
          "field_name": "area_gross",
          "label": "Área Bruta (m²)",
          "field_type": "number",
          "target_entity": "property_specs",
          "min": 0,
          "width": "third",
          "order_index": 2
        }
      ]
    },
    {
      "title": "Contrato",
      "order_index": 2,
      "fields": [
        {
          "field_name": "commission_agreed",
          "label": "Comissão Acordada",
          "field_type": "percentage",
          "target_entity": "property_internal",
          "min": 0,
          "max": 100,
          "width": "half",
          "order_index": 0
        }
      ]
    }
  ]
}
```

### 3.4 Exemplo para Proprietário

```jsonc
// Subtarefa "Confirmar Dados do Proprietário" com owner_scope: 'all_owners'
{
  "type": "form",
  "form_title": "Dados do Proprietário",
  "owner_scope": "all_owners",
  "sections": [
    {
      "title": "Identificação",
      "order_index": 0,
      "fields": [
        {
          "field_name": "name",
          "label": "Nome Completo",
          "field_type": "text",
          "target_entity": "owner",
          "required": true,
          "width": "full",
          "order_index": 0
        },
        {
          "field_name": "nif",
          "label": "NIF",
          "field_type": "text",
          "target_entity": "owner",
          "required": true,
          "width": "half",
          "order_index": 1
        },
        {
          "field_name": "email",
          "label": "Email",
          "field_type": "email",
          "target_entity": "owner",
          "width": "half",
          "order_index": 2
        }
      ]
    },
    {
      "title": "Participação",
      "order_index": 1,
      "fields": [
        {
          "field_name": "ownership_percentage",
          "label": "Percentagem de Propriedade",
          "field_type": "percentage",
          "target_entity": "property_owner",
          "required": true,
          "min": 0,
          "max": 100,
          "width": "half",
          "order_index": 0
        },
        {
          "field_name": "is_main_contact",
          "label": "Contacto Principal",
          "field_type": "checkbox",
          "target_entity": "property_owner",
          "width": "half",
          "order_index": 1
        }
      ]
    }
  ]
}
```

### 3.5 Exemplos de Config para `type: 'field'` (Campo Único Inline)

```jsonc
// Subtarefa "Confirmar Preço de Venda" — input currency inline no card
{
  "type": "field",
  "show_current_value": true,
  "auto_complete_on_save": true,
  "field": {
    "field_name": "listing_price",
    "label": "Preço de Venda",
    "field_type": "currency",
    "target_entity": "property",
    "required": true,
    "min": 0,
    "placeholder": "Ex: 350000",
    "width": "full",
    "order_index": 0
  }
}
```

```jsonc
// Subtarefa "Confirmar NIF do Proprietário" — com owner_scope
{
  "type": "field",
  "show_current_value": true,
  "auto_complete_on_save": true,
  "owner_scope": "all_owners",
  "field": {
    "field_name": "nif",
    "label": "NIF",
    "field_type": "text",
    "target_entity": "owner",
    "required": true,
    "placeholder": "Ex: 123456789",
    "width": "full",
    "order_index": 0
  }
}
```

```jsonc
// Subtarefa "Tem Elevador?" — checkbox inline (mais simples possível)
{
  "type": "field",
  "auto_complete_on_save": true,
  "field": {
    "field_name": "has_elevator",
    "label": "O imóvel tem elevador?",
    "field_type": "checkbox",
    "target_entity": "property_specs",
    "width": "full",
    "order_index": 0
  }
}
```

```jsonc
// Subtarefa "Seleccionar Tipologia" — select inline
{
  "type": "field",
  "show_current_value": true,
  "auto_complete_on_save": false,
  "field": {
    "field_name": "typology",
    "label": "Tipologia",
    "field_type": "select",
    "target_entity": "property_specs",
    "options_from_constant": "TYPOLOGIES",
    "width": "full",
    "order_index": 0
  }
}
```

---

## 4. Field Registry — Catálogo de Campos Disponíveis

O field registry é o coração da configuração. É um ficheiro estático que define todos os campos que podem ser adicionados a um formulário. O template builder consulta este registry para apresentar ao utilizador os campos disponíveis.

```typescript
// lib/form-field-registry.ts

import {
  PROPERTY_TYPES, BUSINESS_TYPES, PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES, TYPOLOGIES, CONTRACT_REGIMES,
  SOLAR_ORIENTATIONS, VIEWS, EQUIPMENT, FEATURES,
  PERSON_TYPES, MARITAL_STATUS
} from '@/lib/constants'

export interface FieldRegistryEntry {
  field_name: string
  label: string
  field_type: FormFieldType
  target_entity: FormTargetEntity
  /** Categoria para agrupar no picker */
  category: string
  /** Opções pré-definidas (para selects) */
  options?: { value: string; label: string }[]
  /** Nome da constante para resolver opções em runtime */
  options_from_constant?: string
  /** Placeholder sugerido */
  default_placeholder?: string
  /** Validação sugerida */
  suggested_min?: number
  suggested_max?: number
}

export const FIELD_REGISTRY: FieldRegistryEntry[] = [
  // ═══════════════════════════════════
  // IMÓVEL — dev_properties
  // ═══════════════════════════════════
  {
    field_name: 'title',
    label: 'Título do Anúncio',
    field_type: 'text',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    default_placeholder: 'Ex: T3 renovado com terraço em Lisboa',
  },
  {
    field_name: 'description',
    label: 'Descrição',
    field_type: 'textarea',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
  },
  {
    field_name: 'listing_price',
    label: 'Preço de Venda/Arrendamento',
    field_type: 'currency',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    suggested_min: 0,
  },
  {
    field_name: 'property_type',
    label: 'Tipo de Imóvel',
    field_type: 'select',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    options_from_constant: 'PROPERTY_TYPES',
  },
  {
    field_name: 'business_type',
    label: 'Tipo de Negócio',
    field_type: 'select',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    options_from_constant: 'BUSINESS_TYPES',
  },
  {
    field_name: 'property_condition',
    label: 'Estado do Imóvel',
    field_type: 'select',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    options_from_constant: 'PROPERTY_CONDITIONS',
  },
  {
    field_name: 'energy_certificate',
    label: 'Certificado Energético',
    field_type: 'select',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    options_from_constant: 'ENERGY_CERTIFICATES',
  },
  {
    field_name: 'external_ref',
    label: 'Referência Externa',
    field_type: 'text',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
  },

  // ═══════════════════════════════════
  // IMÓVEL — Localização
  // ═══════════════════════════════════
  {
    field_name: 'city',
    label: 'Cidade',
    field_type: 'text',
    target_entity: 'property',
    category: 'Imóvel — Localização',
  },
  {
    field_name: 'zone',
    label: 'Zona / Freguesia',
    field_type: 'text',
    target_entity: 'property',
    category: 'Imóvel — Localização',
  },
  {
    field_name: 'address_street',
    label: 'Morada',
    field_type: 'text',
    target_entity: 'property',
    category: 'Imóvel — Localização',
  },
  {
    field_name: 'postal_code',
    label: 'Código Postal',
    field_type: 'text',
    target_entity: 'property',
    category: 'Imóvel — Localização',
    default_placeholder: '0000-000',
  },

  // ═══════════════════════════════════
  // ESPECIFICAÇÕES — dev_property_specifications
  // ═══════════════════════════════════
  {
    field_name: 'typology',
    label: 'Tipologia',
    field_type: 'select',
    target_entity: 'property_specs',
    category: 'Especificações',
    options_from_constant: 'TYPOLOGIES',
  },
  {
    field_name: 'bedrooms',
    label: 'Quartos',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações',
    suggested_min: 0,
  },
  {
    field_name: 'bathrooms',
    label: 'Casas de Banho',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações',
    suggested_min: 0,
  },
  {
    field_name: 'area_gross',
    label: 'Área Bruta (m²)',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações',
    suggested_min: 0,
  },
  {
    field_name: 'area_util',
    label: 'Área Útil (m²)',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações',
    suggested_min: 0,
  },
  {
    field_name: 'construction_year',
    label: 'Ano de Construção',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações',
    suggested_min: 1800,
    suggested_max: 2030,
  },
  {
    field_name: 'parking_spaces',
    label: 'Lugares de Estacionamento',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações',
    suggested_min: 0,
  },
  {
    field_name: 'has_elevator',
    label: 'Tem Elevador',
    field_type: 'checkbox',
    target_entity: 'property_specs',
    category: 'Especificações',
  },
  {
    field_name: 'solar_orientation',
    label: 'Orientação Solar',
    field_type: 'multiselect',
    target_entity: 'property_specs',
    category: 'Especificações',
    options_from_constant: 'SOLAR_ORIENTATIONS',
  },
  {
    field_name: 'views',
    label: 'Vistas',
    field_type: 'multiselect',
    target_entity: 'property_specs',
    category: 'Especificações',
    options_from_constant: 'VIEWS',
  },
  {
    field_name: 'equipment',
    label: 'Equipamento',
    field_type: 'multiselect',
    target_entity: 'property_specs',
    category: 'Especificações',
    options_from_constant: 'EQUIPMENT',
  },
  {
    field_name: 'features',
    label: 'Características',
    field_type: 'multiselect',
    target_entity: 'property_specs',
    category: 'Especificações',
    options_from_constant: 'FEATURES',
  },

  // ═══════════════════════════════════
  // DADOS INTERNOS — dev_property_internal
  // ═══════════════════════════════════
  {
    field_name: 'commission_agreed',
    label: 'Comissão Acordada',
    field_type: 'percentage',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
    suggested_min: 0,
    suggested_max: 100,
  },
  {
    field_name: 'commission_type',
    label: 'Tipo de Comissão',
    field_type: 'select',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
    options: [
      { value: 'percentage', label: 'Percentagem' },
      { value: 'fixed', label: 'Valor Fixo' },
    ],
  },
  {
    field_name: 'contract_regime',
    label: 'Regime de Contrato',
    field_type: 'select',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
    options_from_constant: 'CONTRACT_REGIMES',
  },
  {
    field_name: 'contract_expiry',
    label: 'Data de Expiração do Contrato',
    field_type: 'date',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
  },
  {
    field_name: 'imi_value',
    label: 'Valor IMI (€)',
    field_type: 'currency',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
    suggested_min: 0,
  },
  {
    field_name: 'condominium_fee',
    label: 'Condomínio (€/mês)',
    field_type: 'currency',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
    suggested_min: 0,
  },
  {
    field_name: 'internal_notes',
    label: 'Notas Internas',
    field_type: 'textarea',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
  },

  // ═══════════════════════════════════
  // PROPRIETÁRIO — owners
  // ═══════════════════════════════════
  {
    field_name: 'name',
    label: 'Nome Completo',
    field_type: 'text',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
  },
  {
    field_name: 'email',
    label: 'Email',
    field_type: 'email',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
  },
  {
    field_name: 'phone',
    label: 'Telefone',
    field_type: 'phone',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
  },
  {
    field_name: 'nif',
    label: 'NIF',
    field_type: 'text',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
  },
  {
    field_name: 'nationality',
    label: 'Nacionalidade',
    field_type: 'text',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
  },
  {
    field_name: 'marital_status',
    label: 'Estado Civil',
    field_type: 'select',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
    options_from_constant: 'MARITAL_STATUS',
  },
  {
    field_name: 'address',
    label: 'Morada',
    field_type: 'textarea',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
  },
  {
    field_name: 'person_type',
    label: 'Tipo de Pessoa',
    field_type: 'select',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
    options: [
      { value: 'singular', label: 'Pessoa Singular' },
      { value: 'coletiva', label: 'Pessoa Colectiva' },
    ],
  },

  // ═══════════════════════════════════
  // PROPRIETÁRIO — Empresa (coletiva)
  // ═══════════════════════════════════
  {
    field_name: 'legal_representative_name',
    label: 'Nome do Representante Legal',
    field_type: 'text',
    target_entity: 'owner',
    category: 'Proprietário — Empresa',
  },
  {
    field_name: 'legal_representative_nif',
    label: 'NIF do Representante Legal',
    field_type: 'text',
    target_entity: 'owner',
    category: 'Proprietário — Empresa',
  },

  // ═══════════════════════════════════
  // JUNCTION — property_owners
  // ═══════════════════════════════════
  {
    field_name: 'ownership_percentage',
    label: 'Percentagem de Propriedade',
    field_type: 'percentage',
    target_entity: 'property_owner',
    category: 'Participação no Imóvel',
    suggested_min: 0,
    suggested_max: 100,
  },
  {
    field_name: 'is_main_contact',
    label: 'É Contacto Principal',
    field_type: 'checkbox',
    target_entity: 'property_owner',
    category: 'Participação no Imóvel',
  },
]

/**
 * Helper: agrupar campos por categoria para o picker.
 */
export function getFieldsByCategory(): Record<string, FieldRegistryEntry[]> {
  return FIELD_REGISTRY.reduce((acc, field) => {
    if (!acc[field.category]) acc[field.category] = []
    acc[field.category].push(field)
    return acc
  }, {} as Record<string, FieldRegistryEntry[]>)
}

/**
 * Helper: obter campo do registry por field_name + target_entity.
 */
export function getRegistryField(
  fieldName: string,
  targetEntity: FormTargetEntity
): FieldRegistryEntry | undefined {
  return FIELD_REGISTRY.find(
    (f) => f.field_name === fieldName && f.target_entity === targetEntity
  )
}
```

---

## 5. Padrão de Implementação — Renderer Dinâmico

### 5.1 Abordagem Escolhida: Custom Config Array + ComponentMap

Baseado na pesquisa, a abordagem mais adequada ao nosso stack é a **config array com component map**. Descartámos:

- **RJSF (@rjsf/core)** — incompatível com react-hook-form e shadcn/ui
- **AutoForm** — bom para formulários simples, mas sem controlo de layout em grid/secções
- **JSON Schema puro** — overhead desnecessário, já temos Zod

O padrão é:

```typescript
// components/processes/dynamic-form-renderer.tsx

'use client'

import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Form, FormField, FormItem, FormLabel, FormControl,
  FormDescription, FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { FormSectionConfig, FormFieldConfig, FormFieldType } from '@/types/subtask'

/**
 * Component Map — mapeia field_type para componente shadcn.
 * Cada entry recebe field config + react-hook-form control.
 */
const FIELD_COMPONENTS: Record<FormFieldType, React.ComponentType<FieldRendererProps>> = {
  text:        TextFieldRenderer,
  textarea:    TextareaFieldRenderer,
  number:      NumberFieldRenderer,
  currency:    CurrencyFieldRenderer,
  percentage:  PercentageFieldRenderer,
  select:      SelectFieldRenderer,
  multiselect: MultiselectFieldRenderer,
  checkbox:    CheckboxFieldRenderer,
  date:        DateFieldRenderer,
  email:       EmailFieldRenderer,
  phone:       PhoneFieldRenderer,
  image_upload: ImageUploadFieldRenderer,
}

interface DynamicFormRendererProps {
  sections: FormSectionConfig[]
  defaultValues: Record<string, unknown>
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  isSubmitting?: boolean
}

/**
 * Gerar schema Zod dinamicamente a partir da config.
 */
function buildZodSchema(sections: FormSectionConfig[]): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const section of sections) {
    for (const field of section.fields) {
      let fieldSchema: z.ZodTypeAny

      switch (field.field_type) {
        case 'number':
        case 'currency':
        case 'percentage':
          fieldSchema = z.coerce.number()
          if (field.min !== undefined) fieldSchema = (fieldSchema as z.ZodNumber).min(field.min)
          if (field.max !== undefined) fieldSchema = (fieldSchema as z.ZodNumber).max(field.max)
          if (!field.required) fieldSchema = fieldSchema.optional()
          break
        case 'checkbox':
          fieldSchema = z.boolean().default(false)
          break
        case 'multiselect':
          fieldSchema = z.array(z.string()).default([])
          break
        case 'date':
          fieldSchema = field.required ? z.string().min(1) : z.string().optional()
          break
        default: // text, textarea, email, phone, select
          fieldSchema = field.required
            ? z.string().min(1, `${field.label} é obrigatório`)
            : z.string().optional()
      }

      // Chave única: target_entity__field_name (para evitar colisões)
      const key = `${field.target_entity}__${field.field_name}`
      shape[key] = fieldSchema
    }
  }

  return z.object(shape)
}

export function DynamicFormRenderer({
  sections,
  defaultValues,
  onSubmit,
  isSubmitting,
}: DynamicFormRendererProps) {
  const schema = buildZodSchema(sections)

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const handleSubmit = async (values: Record<string, unknown>) => {
    // Agrupar valores por target_entity para enviar ao API
    const grouped: Record<string, Record<string, unknown>> = {}

    for (const [key, value] of Object.entries(values)) {
      const [entity, ...fieldParts] = key.split('__')
      const fieldName = fieldParts.join('__')
      if (!grouped[entity]) grouped[entity] = {}
      grouped[entity][fieldName] = value
    }

    await onSubmit(grouped)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {sections
          .sort((a, b) => a.order_index - b.order_index)
          .map((section) => (
            <Card key={section.title}>
              <CardHeader>
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
                      const colSpan =
                        field.width === 'third' ? 'col-span-4' :
                        field.width === 'half' ? 'col-span-6' :
                        'col-span-12'

                      return (
                        <div key={key} className={colSpan}>
                          <Component
                            field={field}
                            name={key}
                            control={form.control}
                          />
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          ))}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              A guardar...
            </>
          ) : (
            'Guardar Alterações'
          )}
        </Button>
      </form>
    </Form>
  )
}
```

### 5.2 Exemplo de Field Renderer

```typescript
// Padrão para cada tipo de campo:

function TextFieldRenderer({ field, name, control }: FieldRendererProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              {...formField}
              placeholder={field.placeholder}
              value={formField.value ?? ''}
            />
          </FormControl>
          {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function CurrencyFieldRenderer({ field, name, control }: FieldRendererProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>{field.label}</FormLabel>
          <FormControl>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                €
              </span>
              <Input
                type="number"
                step="0.01"
                className="pl-7"
                {...formField}
                value={formField.value ?? ''}
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function SelectFieldRenderer({ field, name, control }: FieldRendererProps) {
  // Resolver opções: de options directas ou de constante
  const options = field.options || resolveOptionsFromConstant(field.options_from_constant)

  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>{field.label}</FormLabel>
          <Select
            onValueChange={formField.onChange}
            value={formField.value ?? ''}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder || 'Seleccionar...'} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
```

### 5.3 Componente Inline para `field` (Campo Único)

```typescript
// components/processes/field-subtask-inline.tsx

'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Check, Pencil, Loader2 } from 'lucide-react'
import type { FieldSubtaskConfig, ProcSubtask } from '@/types/subtask'

interface FieldSubtaskInlineProps {
  subtask: ProcSubtask
  procId: string
  taskId: string
  onCompleted: () => void
}

export function FieldSubtaskInline({
  subtask, procId, taskId, onCompleted
}: FieldSubtaskInlineProps) {
  const config = subtask.config as FieldSubtaskConfig
  const field = config.field
  const isCompleted = subtask.is_completed
  const [isEditing, setIsEditing] = useState(!isCompleted)
  const [currentValue, setCurrentValue] = useState<unknown>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Buscar valor actual do DB
  useEffect(() => {
    fetch(`/api/processes/${procId}/tasks/${taskId}/subtasks/${subtask.id}/form`)
      .then(r => r.json())
      .then(data => {
        const key = `${field.target_entity}__${field.field_name}`
        setCurrentValue(data.values[key])
      })
  }, [])

  const handleSave = async (value: unknown) => {
    setIsSaving(true)
    try {
      // Agrupar por entidade (mesmo padrão do form)
      const body = { [field.target_entity]: { [field.field_name]: value } }

      await fetch(
        `/api/processes/${procId}/tasks/${taskId}/subtasks/${subtask.id}/form`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      )

      setCurrentValue(value)
      toast.success(`${field.label} guardado`)

      // Auto-complete se configurado
      if (config.auto_complete_on_save !== false) {
        onCompleted()
      }
      setIsEditing(false)
    } catch {
      toast.error('Erro ao guardar')
    } finally {
      setIsSaving(false)
    }
  }

  // Estado concluído: mostra valor + botão editar
  if (isCompleted && !isEditing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md">
        <span className="text-sm font-medium">{field.label}:</span>
        <span className="text-sm">{formatDisplayValue(currentValue, field)}</span>
        <Button
          variant="ghost" size="sm"
          onClick={() => setIsEditing(true)}
          className="ml-auto h-7"
        >
          <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
        </Button>
      </div>
    )
  }

  // Estado pendente/editing: mostra input inline
  const FieldComponent = FIELD_COMPONENTS[field.field_type]
  return (
    <div className="px-3 py-2 border rounded-md space-y-2">
      {config.show_current_value && currentValue != null && (
        <p className="text-xs text-muted-foreground">
          Valor actual: {formatDisplayValue(currentValue, field)}
        </p>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          {/* Renderiza o campo inline usando o mesmo componentMap */}
          <FieldComponent
            field={field}
            name="value"
            control={inlineForm.control}
          />
        </div>
        <Button
          size="sm"
          onClick={() => handleSave(inlineForm.getValues('value'))}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <><Check className="h-4 w-4 mr-1" /> Guardar</>
          )}
        </Button>
      </div>
    </div>
  )
}
```

**Ponto chave:** O `FieldSubtaskInline` reutiliza exactamente os mesmos field renderers (componentMap) que o `DynamicFormRenderer`. A diferença é apenas o wrapper — inline vs modal.

---

## 6. API de Upsert para Formulários

### 6.1 Endpoint

```
GET  /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form
PUT  /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form
```

### 6.2 GET — Carregar Dados Actuais

```typescript
// Lógica:
// 1. Buscar proc_instance → property_id
// 2. Buscar config da subtarefa → form_fields com target_entities
// 3. Para cada target_entity presente, buscar dados actuais:
//    - property     → SELECT * FROM dev_properties WHERE id = property_id
//    - property_specs → SELECT * FROM dev_property_specifications WHERE property_id = ...
//    - property_internal → SELECT * FROM dev_property_internal WHERE property_id = ...
//    - owner        → SELECT * FROM owners WHERE id = subtask.owner_id
//    - property_owner → SELECT * FROM property_owners WHERE property_id = ... AND owner_id = ...
// 4. Retornar apenas os campos que estão na config (não enviar dados desnecessários)
// 5. Formato: { [target_entity__field_name]: value }

export async function GET(request, { params }) {
  const { id: procId, taskId, subtaskId } = await params
  const supabase = await createClient()

  // 1. Buscar subtarefa com config
  const { data: subtask } = await supabase
    .from('proc_subtasks')
    .select('config, owner_id, proc_task_id')
    .eq('id', subtaskId)
    .single()

  // 2. Buscar property_id do processo
  const { data: proc } = await supabase
    .from('proc_instances')
    .select('property_id')
    .eq('id', procId)
    .single()

  const propertyId = proc.property_id
  const config = subtask.config as FormSubtaskConfig
  const fields = config.sections.flatMap(s => s.fields)

  // 3. Determinar que entidades precisamos buscar
  const entities = new Set(fields.map(f => f.target_entity))
  const values: Record<string, unknown> = {}

  if (entities.has('property')) {
    const { data } = await supabase
      .from('dev_properties')
      .select('*')
      .eq('id', propertyId)
      .single()
    for (const f of fields.filter(f => f.target_entity === 'property')) {
      values[`property__${f.field_name}`] = data?.[f.field_name] ?? null
    }
  }

  // ... repetir para property_specs, property_internal, owner, property_owner

  return NextResponse.json({ values, config })
}
```

### 6.3 PUT — Upsert

```typescript
// Segue o MESMO padrão que PUT /api/properties/[id]:
// Recebe dados agrupados por entidade, faz update/upsert independente por tabela.

export async function PUT(request, { params }) {
  const { id: procId, taskId, subtaskId } = await params
  const supabase = await createClient()
  const body = await request.json()
  // body = { property: {...}, property_specs: {...}, property_internal: {...}, owner: {...}, property_owner: {...} }

  const { data: proc } = await supabase
    .from('proc_instances')
    .select('property_id')
    .eq('id', procId)
    .single()

  const propertyId = proc.property_id

  // Upsert por entidade (padrão existente em properties/[id]/route.ts)
  if (body.property && Object.keys(body.property).length > 0) {
    await supabase.from('dev_properties').update(body.property).eq('id', propertyId)
  }
  if (body.property_specs && Object.keys(body.property_specs).length > 0) {
    await supabase.from('dev_property_specifications').upsert({ property_id: propertyId, ...body.property_specs })
  }
  if (body.property_internal && Object.keys(body.property_internal).length > 0) {
    await supabase.from('dev_property_internal').upsert({ property_id: propertyId, ...body.property_internal })
  }
  if (body.owner && Object.keys(body.owner).length > 0) {
    const { data: subtask } = await supabase.from('proc_subtasks').select('owner_id').eq('id', subtaskId).single()
    if (subtask.owner_id) {
      await supabase.from('owners').update(body.owner).eq('id', subtask.owner_id)
    }
  }
  if (body.property_owner && Object.keys(body.property_owner).length > 0) {
    const { data: subtask } = await supabase.from('proc_subtasks').select('owner_id').eq('id', subtaskId).single()
    if (subtask.owner_id) {
      await supabase.from('property_owners').update(body.property_owner)
        .eq('property_id', propertyId)
        .eq('owner_id', subtask.owner_id)
    }
  }

  return NextResponse.json({ success: true })
}
```

---

## 7. UX do Template Builder — Configuração de `form` e `field`

### 7.1 Selecção de Tipo no Builder

Quando o utilizador cria uma subtarefa, o dropdown de tipo mostra agora 6 opções:

```
┌─ Tipo de Subtarefa ──────────────────┐
│  📤 Upload de Documento              │
│  ✅ Checklist (Manual)               │
│  📧 Envio de Email                   │
│  📄 Gerar Documento                  │
│  📋 Formulário (multi-campo)    NEW  │ ← type: 'form'
│  ✏️  Campo Único (inline)       NEW  │ ← type: 'field'
└──────────────────────────────────────┘
```

### 7.2 Configuração de `form` — Multi-Field Picker

```
Utilizador selecciona tipo "Formulário" → Secção "Campos" aparece no config dialog
    │
    ▼
FormFieldPicker (modo multi):
┌──────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Categorias   │  │ Campos Disponíveis   │  │
│  │              │  │                      │  │
│  │ ▸ Imóvel     │  │ ☐ Título do Anúncio  │  │
│  │ ▸ Specs      │  │ ☐ Preço             │  │
│  │ ▸ Contrato   │  │ ☐ Tipo de Imóvel    │  │
│  │ ▸ Proprietá. │  │ ☐ ...               │  │
│  │ ▸ Junction   │  │                      │  │
│  └──────────────┘  └──────────────────────┘  │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ Campos Seleccionados (drag-to-reorder)│   │
│  │                                      │    │
│  │ [Secção: Dados Gerais      ] [+ Add] │    │
│  │   ├─ Título do Anúncio  [⚙️] [🗑️]  │    │
│  │   ├─ Preço               [⚙️] [🗑️]  │    │
│  │   └─ Tipo de Imóvel      [⚙️] [🗑️]  │    │
│  │                                      │    │
│  │ [Secção: Especificações   ] [+ Add]  │    │
│  │   ├─ Quartos             [⚙️] [🗑️]  │    │
│  │   └─ Área Bruta          [⚙️] [🗑️]  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  [+ Nova Secção]                             │
└──────────────────────────────────────────────┘
```

### 7.3 Configuração de `field` — Single Field Picker

Quando o tipo é `field`, a UI é **muito mais simples** — basta seleccionar 1 campo:

```
Utilizador selecciona tipo "Campo Único" → Secção "Campo" aparece
    │
    ▼
FormFieldPicker (modo single):
┌──────────────────────────────────────────────┐
│  Campo a vincular:                           │
│  ┌──────────────────────────────────────┐    │
│  │ 🔍 Pesquisar campo...                │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  Imóvel — Dados Gerais                       │
│    ○ Título do Anúncio                       │
│    ● Preço de Venda/Arrendamento     ← sel.  │
│    ○ Tipo de Imóvel                          │
│  Especificações                              │
│    ○ Quartos                                 │
│    ○ Casas de Banho                          │
│  Proprietário — Identificação                │
│    ○ Nome Completo                           │
│    ○ NIF                                     │
│  ...                                         │
│                                              │
│  ─────────────────────────────────────────   │
│  Campo seleccionado: Preço (€, property)     │
│                                              │
│  Opções:                                     │
│  ☑ Mostrar valor actual                      │
│  ☑ Auto-completar ao guardar                 │
│  ☐ Obrigatório                               │
│  Placeholder: [Ex: 350000          ]         │
└──────────────────────────────────────────────┘
```

**Diferenças chave do picker:**
- Modo `form`: Multi-select com checkboxes + drag-to-reorder + secções
- Modo `field`: Radio select (apenas 1 campo) + opções inline simples

### 7.4 Configuração por Campo (⚙️) — Comum a ambos

Popover com:
- **Obrigatório** (toggle)
- **Largura** (full / half / third) — apenas para `form`, `field` é sempre `full`
- **Placeholder** (text input)
- **Texto de ajuda** (text input)
- **Min / Max** (para números)
- **Opções customizadas** (para select, se não usar constante)

---

## 8. UX da Execução (Processo Activo)

### 8.1 Modo `form` — Formulário Completo (Sheet/Dialog)

```
Gestora Processual abre processo → vê lista de tarefas por fase
    │
    ▼
Clica na subtarefa "Completar Dados do Imóvel" (ícone 📋, tipo form)
    │
    ▼
Abre Sheet/Dialog com:
┌─────────────────────────────────────────────┐
│  Completar Informações do Imóvel            │
│  ─────────────────────────────────────────  │
│                                             │
│  ┌─ Dados Gerais ─────────────────────────┐ │
│  │  Título do Anúncio: [T3 em Cascais   ] │ │
│  │  Preço: [€ 350.000]  Tipo: [Apart.. ▼] │ │
│  └─────────────────────────────────────────┘ │
│                                             │
│  ┌─ Especificações ───────────────────────┐ │
│  │  Quartos: [3]  WC: [2]  Área: [120]   │ │
│  └─────────────────────────────────────────┘ │
│                                             │
│  ┌─ Contrato ─────────────────────────────┐ │
│  │  Comissão: [5%]                         │ │
│  └─────────────────────────────────────────┘ │
│                                             │
│  [Cancelar]                  [Guardar ✓]    │
└─────────────────────────────────────────────┘
```

**Comportamento:**
1. **Ao abrir:** GET busca dados actuais → preenche defaultValues
2. **Ao guardar:** PUT faz upsert → toast success → marca subtarefa como `completed`
3. **Re-abertura:** Se subtarefa já concluída, mostra dados em modo read-only com opção "Editar novamente"
4. **Validação:** Schema Zod gerado dinamicamente a partir da config
5. **Loading:** Skeleton enquanto carrega dados
6. **Erros:** FormMessage inline por campo + toast.error global

### 8.2 Modo `field` — Campo Único Inline

O campo aparece **dentro do próprio card da subtarefa** na lista, sem abrir modal.

```
Lista de subtarefas no processo:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ☐ Enviar Contrato (email)                    📧 Pendente  │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ☐ Confirmar Preço de Venda (field)           💰 Pendente  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Preço de Venda                                     │   │
│  │  Valor actual: € 350.000                            │   │
│  │  ┌──────────────────────────┐                       │   │
│  │  │ € [          350000    ] │  [Guardar ✓]          │   │
│  │  └──────────────────────────┘                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ☐ Tem Elevador? (field)                      🔲 Pendente  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ☐ O imóvel tem elevador?           [Confirmar ✓]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ✅ Tipologia (field)                         T3 Concluído │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Tipologia: T3                      [Editar ✏️]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Comportamento:**
1. **Estado pendente:** Mostra input inline com valor actual (se `show_current_value: true`) + botão "Guardar"
2. **Ao guardar:** PUT faz upsert do campo → toast success → se `auto_complete_on_save: true`, marca subtarefa como `completed` automaticamente
3. **Estado concluído:** Mostra valor guardado em modo read-only + botão "Editar" para re-abrir input
4. **Validação:** Mesma lógica do form (Zod dinâmico), mas apenas 1 campo
5. **Inline rendering:** O componente `FieldSubtaskInline` é renderizado **dentro** do `SubtaskCardBase`, sem modal
6. **Tipos de input inline:**
   - `text`, `email`, `phone` → Input simples
   - `number`, `currency`, `percentage` → Input com prefixo/sufixo
   - `select` → Select dropdown
   - `multiselect` → Multi-select com badges
   - `checkbox` → Checkbox com label (o mais compacto)
   - `date` → DatePicker inline
   - `textarea` → Textarea (expande o card)

### 8.3 Comparação Visual dos Dois Modos

```
┌──────────────────────────────────────────────────────────────────┐
│  MODO FORM (Sheet)                 MODO FIELD (Inline)           │
│                                                                  │
│  ┌─── Sheet ──────────────┐       ┌─── Card ─────────────────┐  │
│  │ ┌─ Secção 1 ─────────┐│       │ ☐ Confirmar Preço        │  │
│  │ │ Campo A  [_______]  ││       │   Actual: € 350.000      │  │
│  │ │ Campo B  [_______]  ││       │   [€ ________] [Guardar] │  │
│  │ └────────────────────┘││       └──────────────────────────┘  │
│  │ ┌─ Secção 2 ─────────┐│                                      │
│  │ │ Campo C  [___▼____] ││       ┌─── Card ─────────────────┐  │
│  │ │ Campo D  [☐]       ││       │ ✅ NIF Confirmado         │  │
│  │ └────────────────────┘││       │   123456789  [Editar ✏️]  │  │
│  │                        ││       └──────────────────────────┘  │
│  │ [Cancelar] [Guardar ✓]││                                      │
│  └────────────────────────┘│                                      │
│                                                                  │
│  Ideal para: 5-15 campos          Ideal para: 1 campo atómico   │
│  Preenchimento bulk                Confirmação rápida            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9. Validação Zod para Template Builder

Adicionar ao `lib/validations/template.ts`:

```typescript
// Dentro do subtaskSchema .refine():

// form: sections obrigatórias com pelo menos 1 campo
if (subtask.type === 'form') {
  const sections = subtask.config?.sections
  if (!sections || !Array.isArray(sections) || sections.length === 0) return false
  return sections.every(s =>
    s.fields && Array.isArray(s.fields) && s.fields.length > 0
  )
}

// field: campo único obrigatório com field_name e target_entity
if (subtask.type === 'field') {
  const field = subtask.config?.field
  return !!field && !!field.field_name && !!field.target_entity && !!field.field_type
}
```

E adicionar ao config schema:

```typescript
config: z.object({
  // ... campos existentes
  // Novo para form:
  sections: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    order_index: z.number().int().min(0),
    fields: z.array(z.object({
      field_name: z.string().min(1),
      label: z.string().min(1),
      field_type: z.enum(['text', 'textarea', 'number', 'currency', 'percentage',
                          'select', 'multiselect', 'checkbox', 'date', 'email',
                          'phone', 'image_upload']),
      target_entity: z.enum(['property', 'property_specs', 'property_internal',
                             'owner', 'property_owner']),
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

  // Novo para field (campo único):
  field: z.object({
    field_name: z.string().min(1),
    label: z.string().min(1),
    field_type: z.enum(['text', 'textarea', 'number', 'currency', 'percentage',
                        'select', 'multiselect', 'checkbox', 'date', 'email',
                        'phone', 'image_upload']),
    target_entity: z.enum(['property', 'property_specs', 'property_internal',
                           'owner', 'property_owner']),
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

  // Opções específicas do field inline:
  show_current_value: z.boolean().optional(),
  auto_complete_on_save: z.boolean().optional(),
}).default({}),
```

---

## 10. Padrões Externos de Referência

### 10.1 Custom Config Array + ComponentMap (Recomendado)

**Fonte:** [DEV.to — Dynamic Forms with React, TypeScript, RHF and Zod](https://dev.to/franciscolunadev82/creating-dynamic-forms-with-react-typescript-react-hook-form-and-zod-3d8)

Padrão:
```typescript
type FieldConfig = {
  name: string; label: string; type: 'text' | 'select' | ...
  validation?: ZodType; options?: Option[]
}

const componentMap = {
  text: TextInput,
  select: SelectInput,
  number: NumberInput,
}

// Renderer:
config.fields.map(field => {
  const Component = componentMap[field.type]
  return <Component key={field.name} field={field} control={form.control} />
})
```

**Por que escolhemos este:**
- Integra directamente com react-hook-form (já usamos)
- Usa componentes shadcn/ui (já temos)
- Schema Zod gerado da config (já temos Zod em todo lado)
- Full control sobre layout (grid cols, secções em Cards)

### 10.2 AutoForm (Alternativa para Formulários Simples)

**Fonte:** [vantezzen/autoform](https://github.com/vantezzen/autoform)

```typescript
import AutoForm from '@autoform/react'
// Passa schema Zod → renderiza form automaticamente
<AutoForm schema={myZodSchema} onSubmit={handleSubmit} />
```

**Não usamos porque:** Sem controlo de layout em grid, sem secções, menos customizável.

### 10.3 Upsert Pattern (Já Implementado)

**Fonte:** Nosso próprio [app/api/properties/[id]/route.ts](app/api/properties/[id]/route.ts)

```typescript
// Padrão que já seguimos:
// 1. Receber { property, specifications, internal } no body
// 2. Validar com Zod parcial (schema.partial())
// 3. Update/upsert independente por tabela
// 4. Apenas campos com valor são enviados
```

### 10.4 react-hook-form useFormContext (Para Forms Compostos)

**Fonte:** [React Hook Form docs](https://react-hook-form.com/docs/useformcontext)

```typescript
// Quando o form é composto de sub-componentes:
<FormProvider {...methods}>
  <SectionA />  {/* usa useFormContext() internamente */}
  <SectionB />
</FormProvider>
```

---

## 11. Alterações na Base de Dados

**Nenhuma migração necessária.** O tipo `form` e toda a sua configuração vivem dentro do campo `config` (JSONB) de `tpl_subtasks` e `proc_subtasks`. O schema JSONB já é flexível o suficiente.

A única adição é o valor `'form'` como opção válida no `type` dentro do JSONB config. Não é uma coluna com constraint.

---

## 12. Impacto e Dependências

### Sem Novas Dependências

Tudo é implementado com ferramentas já instaladas:
- `react-hook-form` + `@hookform/resolvers` + `zod` — formulários + validação
- `shadcn/ui` — componentes de UI (Form, Input, Select, Card, Sheet, etc.)
- `@dnd-kit` — drag-to-reorder de campos no builder (já instalado)
- `sonner` — toasts de feedback

### Ordem de Implementação Sugerida

1. **Types + Registry** — `FormFieldConfig`, `FormSubtaskConfig`, `FieldSubtaskConfig`, `FIELD_REGISTRY`
2. **Validação** — Actualizar Zod schema em `template.ts` (ambos os tipos)
3. **Constants** — Adicionar `form` e `field` ao `SUBTASK_TYPES`
4. **Dynamic Form Renderer** — Componente central com componentMap (usado por ambos os modos)
5. **API Form endpoint** — GET + PUT para carregar/guardar dados (serve ambos os modos)
6. **Form Subtask Dialog** — Modal Sheet para modo `form`
7. **Field Subtask Inline** — Componente inline para modo `field`
8. **Template Builder** — FormFieldPicker (modo multi para `form`, modo single para `field`)
9. **Integração** — Ligar tudo nos componentes de processo existentes (subtask-card-base, task-detail-actions, subtask-card-list)

---

## 13. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Config JSONB sem validação no DB | Validar sempre com Zod no API antes de guardar |
| Campos do registry desincronizados com schema DB | Registry é source of truth; gerar a partir de introspection futura |
| Formulários complexos demais para utilizadores | Limitar a campos simples; sem lógica condicional entre campos (v1) |
| Performance com muitos campos | Lazy render por secção; limitar a ~30 campos por formulário |
| Colisão de nomes de campo entre entidades | Chave composta `target_entity__field_name` no form state |

---

## 14. Fora de Escopo (v1)

- Campos condicionais (mostrar campo B se campo A = X)
- Upload de imagens dentro do form (usar subtarefa upload separada)
- Campos calculados (derivar valor de outros campos)
- Permissões por campo (quem pode ver/editar cada campo)
- Preview do formulário no template builder
- Histórico de alterações por campo (audit log)
