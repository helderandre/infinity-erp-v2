export type CalendarCategory =
  // Automáticas (derivadas de tabelas existentes)
  | 'process_task'
  | 'process_subtask'
  | 'process_milestone'
  | 'contract_expiry'
  | 'lead_expiry'
  | 'lead_followup'
  // Manuais (TEMP_calendar_events)
  | 'birthday'
  | 'vacation'
  | 'company_event'
  | 'marketing_event'
  | 'meeting'
  | 'reminder'
  | 'custom'

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  category: CalendarCategory
  start_date: string
  end_date?: string
  all_day: boolean
  color: string
  source: 'auto' | 'manual'
  is_recurring: boolean
  is_overdue: boolean
  status?: string

  // Relações (para navegação)
  user_id?: string
  user_name?: string
  property_id?: string
  property_title?: string
  lead_id?: string
  lead_name?: string
  process_id?: string
  process_ref?: string
  task_id?: string
  task_title?: string
}

export interface CalendarFilters {
  categories: CalendarCategory[]
  userId?: string
  teamOnly?: boolean
  propertyId?: string
  processId?: string
}

export interface CreateCalendarEventInput {
  title: string
  description?: string
  category: 'birthday' | 'vacation' | 'company_event' | 'marketing_event' | 'meeting' | 'reminder' | 'custom'
  start_date: string
  end_date?: string
  all_day?: boolean
  is_recurring?: boolean
  recurrence_rule?: 'yearly' | 'monthly' | 'weekly'
  user_id?: string
  property_id?: string
  lead_id?: string
  process_id?: string
  visibility?: 'all' | 'team' | 'private'
  color?: string
}

export const ALL_CATEGORIES: CalendarCategory[] = [
  'process_task', 'process_subtask', 'process_milestone',
  'contract_expiry', 'lead_expiry', 'lead_followup',
  'birthday', 'vacation', 'company_event',
  'marketing_event', 'meeting', 'reminder', 'custom',
]

export const MANUAL_CATEGORIES = [
  'birthday', 'vacation', 'company_event',
  'marketing_event', 'meeting', 'reminder', 'custom',
] as const

export const CALENDAR_CATEGORY_LABELS: Record<CalendarCategory, string> = {
  process_task: 'Tarefas de Processo',
  process_subtask: 'Subtarefas',
  process_milestone: 'Marcos de Processo',
  contract_expiry: 'Expiração Contrato',
  lead_expiry: 'Expiração Lead',
  lead_followup: 'Follow-up Lead',
  birthday: 'Aniversários',
  vacation: 'Férias / Ausências',
  company_event: 'Eventos Empresa',
  marketing_event: 'Marketing',
  meeting: 'Reuniões',
  reminder: 'Lembretes',
  custom: 'Outros',
}

export const CALENDAR_CATEGORY_COLORS: Record<CalendarCategory, { bg: string; text: string; dot: string }> = {
  process_task:      { bg: 'bg-blue-500/15',    text: 'text-blue-600',    dot: 'bg-blue-500' },
  process_subtask:   { bg: 'bg-sky-500/15',     text: 'text-sky-600',     dot: 'bg-sky-400' },
  process_milestone: { bg: 'bg-emerald-500/15', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  contract_expiry:   { bg: 'bg-amber-500/15',   text: 'text-amber-600',   dot: 'bg-amber-500' },
  lead_expiry:       { bg: 'bg-red-500/15',     text: 'text-red-600',     dot: 'bg-red-400' },
  lead_followup:     { bg: 'bg-yellow-500/15',  text: 'text-yellow-600',  dot: 'bg-yellow-500' },
  birthday:          { bg: 'bg-pink-500/15',    text: 'text-pink-600',    dot: 'bg-pink-500' },
  vacation:          { bg: 'bg-slate-500/15',   text: 'text-slate-600',   dot: 'bg-slate-400' },
  company_event:     { bg: 'bg-purple-500/15',  text: 'text-purple-600',  dot: 'bg-purple-500' },
  marketing_event:   { bg: 'bg-orange-500/15',  text: 'text-orange-600',  dot: 'bg-orange-500' },
  meeting:           { bg: 'bg-indigo-500/15',  text: 'text-indigo-600',  dot: 'bg-indigo-500' },
  reminder:          { bg: 'bg-cyan-500/15',    text: 'text-cyan-600',    dot: 'bg-cyan-500' },
  custom:            { bg: 'bg-gray-500/15',    text: 'text-gray-600',    dot: 'bg-gray-500' },
}

// Presets por role — categorias activas por defeito
export const CALENDAR_ROLE_PRESETS: Record<string, { categories: CalendarCategory[]; filterSelf: boolean }> = {
  'Broker/CEO': { categories: ALL_CATEGORIES, filterSelf: false },
  'admin': { categories: ALL_CATEGORIES, filterSelf: false },
  'Office Manager': { categories: ALL_CATEGORIES, filterSelf: false },
  'Consultor': {
    categories: ['process_task', 'process_subtask', 'contract_expiry', 'birthday', 'vacation', 'company_event', 'meeting'],
    filterSelf: true,
  },
  'Consultora Executiva': {
    categories: ['process_task', 'process_subtask', 'contract_expiry', 'birthday', 'vacation', 'company_event', 'meeting'],
    filterSelf: true,
  },
  'Team Leader': {
    categories: ['process_task', 'process_subtask', 'contract_expiry', 'birthday', 'vacation', 'company_event', 'meeting'],
    filterSelf: false,
  },
  'Gestora Processual': {
    categories: ['process_task', 'process_subtask', 'process_milestone', 'contract_expiry', 'lead_expiry'],
    filterSelf: false,
  },
  'Marketing': {
    categories: ['marketing_event', 'company_event', 'birthday', 'meeting'],
    filterSelf: false,
  },
  'recrutador': {
    categories: ['meeting', 'birthday', 'vacation', 'company_event', 'reminder'],
    filterSelf: false,
  },
  'intermediario_credito': {
    categories: ['process_task', 'process_subtask', 'meeting', 'reminder'],
    filterSelf: true,
  },
}
