import type { AlertsConfig } from './alert'

export type SubtaskType = 'upload' | 'checklist' | 'email' | 'generate_doc'

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
  config: {
    type?: SubtaskType
    check_type?: 'field' | 'document' | 'manual'
    field_name?: string
    doc_type_id?: string
    email_library_id?: string
    doc_library_id?: string
    rendered?: Record<string, unknown>
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
  } & SubtaskOwnerConfig
}
