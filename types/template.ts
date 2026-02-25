import type { Database } from './database'
import type { TplSubtask } from './subtask'

type TplProcess = Database['public']['Tables']['tpl_processes']['Row']
type TplStage = Database['public']['Tables']['tpl_stages']['Row']
type TplTask = Database['public']['Tables']['tpl_tasks']['Row']

export interface TemplateWithCounts extends TplProcess {
  stages_count: number
  tasks_count: number
}

export interface TemplateTask extends TplTask {
  // Config tipado por action_type
  config:
    | { doc_type_id?: string }
    | { email_library_id?: string }
    | { doc_library_id?: string }
    | Record<string, any>
  tpl_subtasks?: TplSubtask[]
}

export interface TemplateStage extends TplStage {
  tpl_tasks: TemplateTask[]
}

export interface TemplateDetail extends TplProcess {
  tpl_stages: TemplateStage[]
}

/** @deprecated action_type migrou para SubtaskData.type — mantido apenas para referência legacy */
export type ActionType = 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL' | 'FORM' | 'COMPOSITE'
