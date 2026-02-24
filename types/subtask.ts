export interface TplSubtask {
  id: string
  tpl_task_id: string
  title: string
  description: string | null
  is_mandatory: boolean
  order_index: number
  config: {
    check_type: 'field' | 'document' | 'manual'
    field_name?: string
    doc_type_id?: string
  }
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
  config: {
    check_type: 'field' | 'document' | 'manual'
    field_name?: string
    doc_type_id?: string
  }
}
