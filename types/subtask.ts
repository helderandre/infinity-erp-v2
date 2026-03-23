import type { AlertsConfig } from './alert'

export type SubtaskType = 'upload' | 'checklist' | 'email' | 'generate_doc' | 'form' | 'field' | 'schedule_event' | 'external_form'

// Tipos de multiplicação por proprietário
export type OwnerScope = 'none' | 'all_owners' | 'main_contact_only'
export type PersonTypeFilter = 'all' | 'singular' | 'coletiva'

// Configuração de proprietário para subtarefas
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

// ═══════════════════════════════════════════════
// Tipos para subtarefas Form & Field
// ═══════════════════════════════════════════════

export type FormTargetEntity =
  | 'property'           // dev_properties
  | 'property_specs'     // dev_property_specifications
  | 'property_internal'  // dev_property_internal
  | 'owner'              // owners (via property_owners junction)
  | 'property_owner'     // property_owners (ownership_percentage, is_main_contact)
  | 'consultant'         // dev_users + dev_consultant_profiles (consultor do imóvel)
  | 'process'            // proc_instances (dados do processo)

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
  | 'rich_text'      // Editor Tiptap (texto rico HTML)
  | 'address_map'    // Mapbox autocomplete + mapa (campo composto)
  | 'media_upload'   // Upload de imagens do imóvel
  | 'link_external'  // Array de links externos (nome, url, data publicação)

// Estrutura de um link externo de anúncio (listing_links JSONB)
export interface ListingLink {
  site_name: string
  url: string
  published_at?: string  // ISO date YYYY-MM-DD (opcional)
}

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
  form_template_id?: string  // referência a tpl_form_templates.id (DB)
  sections: FormSectionConfig[]
}

export interface FieldSubtaskConfig {
  type: 'field'
  field: FormFieldConfig
  show_current_value?: boolean
  auto_complete_on_save?: boolean
}

export interface ExternalFormField {
  field_name: string
  label: string
  target_entity: FormTargetEntity
  format?: 'text' | 'currency' | 'number' | 'date'
  order_index: number
}

export interface ExternalLink {
  site_name: string
  url: string
  icon_url?: string
}

export interface DocumentShortcut {
  doc_type_id: string
  label?: string
}

export interface ExternalFormConfig {
  type: 'external_form'
  form_title?: string
  fields: ExternalFormField[]
  external_links: ExternalLink[]
  document_shortcuts: DocumentShortcut[]
}

export type DependencyType = 'none' | 'subtask' | 'task'

export interface TplSubtask {
  id: string
  tpl_task_id: string
  title: string
  description: string | null
  is_mandatory: boolean
  order_index: number
  // Prazo, responsável, prioridade
  sla_days: number | null
  assigned_role: string | null
  priority: string // default 'normal'
  // Dependências
  dependency_type?: DependencyType
  dependency_subtask_id?: string | null
  dependency_task_id?: string | null
  config: {
    type?: SubtaskType
    doc_type_id?: string
    email_library_id?: string
    doc_library_id?: string
    // Legacy fields (retrocompatibilidade)
    check_type?: 'field' | 'document' | 'manual'
    field_name?: string
    alerts?: AlertsConfig
    // Form subtask config
    form_template_id?: string
    form_title?: string
    sections?: FormSectionConfig[]
    // Field subtask config (campo único)
    field?: FormFieldConfig
    show_current_value?: boolean
    auto_complete_on_save?: boolean
    // External form config
    external_form_fields?: ExternalFormField[]
    external_links?: ExternalLink[]
    document_shortcuts?: DocumentShortcut[]
  } & SubtaskOwnerConfig
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
  owner_id?: string | null
  owner?: {
    id: string
    name: string
    person_type?: string
    email?: string
  } | null
  // Prazo, responsável, prioridade
  due_date: string | null
  assigned_to: string | null
  assigned_to_user?: { id: string; commercial_name: string } | null
  assigned_role: string | null
  priority: string // default 'normal'
  started_at: string | null
  // Dependências / bloqueio
  is_blocked?: boolean
  dependency_type?: DependencyType
  dependency_proc_subtask_id?: string | null
  dependency_proc_task_id?: string | null
  unblocked_at?: string | null
  // Nomes das dependências (resolvidos pelo servidor)
  blocking_subtask_title?: string | null
  blocking_task_title?: string | null
  config: {
    type?: SubtaskType
    check_type?: 'field' | 'document' | 'manual'
    field_name?: string
    doc_type_id?: string
    email_library_id?: string
    doc_library_id?: string
    rendered?: Record<string, unknown>
    // Form subtask config
    form_template_id?: string
    form_title?: string
    sections?: FormSectionConfig[]
    // Field subtask config
    field?: FormFieldConfig
    show_current_value?: boolean
    auto_complete_on_save?: boolean
    // External form config
    external_form_fields?: ExternalFormField[]
    external_links?: ExternalLink[]
    document_shortcuts?: DocumentShortcut[]
    [key: string]: unknown
  } & SubtaskOwnerConfig
}

// Usado no template builder (estado local)
export interface SubtaskData {
  id: string
  title: string
  description?: string
  is_mandatory: boolean
  order_index: number
  type: SubtaskType
  // Prazo, responsável, prioridade (template builder)
  sla_days?: number
  assigned_role?: string
  priority?: 'urgent' | 'normal' | 'low'
  // Dependências (template builder)
  dependency_type?: DependencyType
  dependency_subtask_id?: string | null  // depende de outra subtarefa
  dependency_task_id?: string | null     // depende de uma tarefa inteira
  config: {
    doc_type_id?: string        // type === 'upload'
    email_library_id?: string   // type === 'email'
    doc_library_id?: string     // type === 'generate_doc'
    // type === 'checklist' → sem config extra
    alerts?: AlertsConfig
    // Form subtask config
    form_template_id?: string
    form_title?: string
    sections?: FormSectionConfig[]
    // Field subtask config
    field?: FormFieldConfig
    show_current_value?: boolean
    auto_complete_on_save?: boolean
    // External form config
    external_form_fields?: ExternalFormField[]
    external_links?: ExternalLink[]
    document_shortcuts?: DocumentShortcut[]
  } & SubtaskOwnerConfig
}
