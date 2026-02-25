export type SubtaskType = 'upload' | 'checklist' | 'email' | 'generate_doc'

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
  }
}

// NÃO alterar nesta spec — módulo processos fica para depois
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
    check_type: 'field' | 'document' | 'manual'
    field_name?: string
    doc_type_id?: string
  }
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
  }
}
