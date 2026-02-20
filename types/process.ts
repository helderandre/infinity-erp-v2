import type { Database } from './database'

type ProcInstance = Database['public']['Tables']['proc_instances']['Row']
type ProcTask = Database['public']['Tables']['proc_tasks']['Row']
type DevProperty = Database['public']['Tables']['dev_properties']['Row']
type DevUser = Database['public']['Tables']['dev_users']['Row']

export interface ProcessInstance extends ProcInstance {
  property?: Pick<
    DevProperty,
    'id' | 'title' | 'slug' | 'city' | 'listing_price' | 'status' | 'property_type'
  >
  requested_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
  approved_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
  returned_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
  rejected_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
}

export interface ProcessTask extends ProcTask {
  assigned_to_user?: Pick<DevUser, 'id' | 'commercial_name'>
}

export interface ProcessStageWithTasks {
  name: string
  order_index: number
  status: 'completed' | 'in_progress' | 'pending'
  tasks_completed: number
  tasks_total: number
  tasks: ProcessTask[]
}

export interface ProcessOwner {
  id: string
  name: string
  nif: string | null
  person_type: 'singular' | 'coletiva'
  ownership_percentage: number
  is_main_contact: boolean
}

export interface ProcessDocument {
  id: string
  doc_type: { id: string; name: string; category: string }
  file_name: string
  file_url: string
  status: string
  created_at: string
}

export interface ProcessDetail {
  instance: ProcessInstance
  stages: ProcessStageWithTasks[] | null
  owners: ProcessOwner[]
  documents: ProcessDocument[]
}

export type ProcessStatus =
  | 'pending_approval'
  | 'returned'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'rejected'
  | 'cancelled'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'

export type TaskAction =
  | 'complete'
  | 'bypass'
  | 'assign'
  | 'start'
  | 'reset'

export type ActionType = 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL'
