export type CalendarCategory =
  // Automáticas (derivadas de tabelas existentes)
  | 'contract_expiry'
  | 'lead_expiry'
  | 'lead_followup'
  // Automáticas (derivadas de processos)
  | 'process_task'
  | 'process_subtask'
  | 'process_event'
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
  item_type?: 'event' | 'task'
  start_date: string
  end_date?: string
  all_day: boolean
  color: string
  source: 'auto' | 'manual'
  is_recurring: boolean
  is_overdue: boolean
  status?: string
  cover_image_url?: string
  location?: string
  requires_rsvp?: boolean
  visibility_mode?: 'all' | 'include' | 'exclude'
  visibility_user_ids?: string[]
  visibility_role_names?: string[]
  livestream_url?: string
  registration_url?: string
  links?: { name: string; url: string }[]
  reminders?: { minutes_before: number }[]

  // RSVP (populated on detail)
  rsvp_status?: 'pending' | 'going' | 'not_going'
  rsvp_counts?: { going: number; not_going: number; pending: number }

  // Relações (para navegação)
  user_id?: string
  user_name?: string
  property_id?: string
  property_title?: string
  lead_id?: string
  lead_name?: string

  // Relações de processo (para navegação)
  process_id?: string
  process_ref?: string
  task_id?: string
  subtask_id?: string
  priority?: 'urgent' | 'normal' | 'low'
  stage_name?: string

  // Evento de processo (schedule_event subtask)
  proc_subtask_id?: string
  owner_ids?: string[]
  owners?: { id: string; name: string }[]
  attendees?: { id: string; name: string }[]

  // Origem WhatsApp (evento guardado a partir do chat)
  wpp_message_id?: string
  wpp_chat_id?: string
}

export interface CalendarFilters {
  categories: CalendarCategory[]
  userId?: string
  teamOnly?: boolean
  propertyId?: string
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
  visibility?: 'all' | 'team' | 'private'
  color?: string
}

export const ALL_CATEGORIES: CalendarCategory[] = [
  'contract_expiry', 'lead_expiry', 'lead_followup',
  'process_task', 'process_subtask', 'process_event',
  'birthday', 'vacation', 'company_event',
  'marketing_event', 'meeting', 'reminder', 'custom',
]

export const MANUAL_CATEGORIES = [
  'birthday', 'vacation', 'company_event',
  'marketing_event', 'meeting', 'reminder', 'custom',
] as const

export const CALENDAR_CATEGORY_LABELS: Record<CalendarCategory, string> = {
  contract_expiry: 'Expiração Contrato',
  lead_expiry: 'Expiração Lead',
  lead_followup: 'Follow-up Lead',
  process_task: 'Tarefa de Processo',
  process_subtask: 'Subtarefa de Processo',
  process_event: 'Evento de Processo',
  birthday: 'Aniversários',
  vacation: 'Férias / Ausências',
  company_event: 'Eventos Empresa',
  marketing_event: 'Marketing',
  meeting: 'Reuniões',
  reminder: 'Lembretes',
  custom: 'Outros',
}

export const CALENDAR_CATEGORY_COLORS: Record<CalendarCategory, { bg: string; text: string; dot: string }> = {
  contract_expiry:   { bg: 'bg-amber-500/15',    text: 'text-amber-600',    dot: 'bg-amber-500' },
  lead_expiry:       { bg: 'bg-red-500/15',      text: 'text-red-600',      dot: 'bg-red-500' },
  lead_followup:     { bg: 'bg-yellow-500/15',   text: 'text-yellow-600',   dot: 'bg-yellow-500' },
  process_task:      { bg: 'bg-violet-500/15',   text: 'text-violet-600',   dot: 'bg-violet-500' },
  process_subtask:   { bg: 'bg-teal-500/15',     text: 'text-teal-600',     dot: 'bg-teal-500' },
  process_event:     { bg: 'bg-cyan-500/15',     text: 'text-cyan-600',     dot: 'bg-cyan-500' },
  birthday:          { bg: 'bg-pink-500/15',     text: 'text-pink-600',     dot: 'bg-pink-500' },
  vacation:          { bg: 'bg-slate-500/15',    text: 'text-slate-600',    dot: 'bg-slate-400' },
  company_event:     { bg: 'bg-emerald-500/15',  text: 'text-emerald-600',  dot: 'bg-emerald-500' },
  marketing_event:   { bg: 'bg-orange-500/15',   text: 'text-orange-600',   dot: 'bg-orange-500' },
  meeting:           { bg: 'bg-indigo-500/15',   text: 'text-indigo-600',   dot: 'bg-indigo-500' },
  reminder:          { bg: 'bg-sky-500/15',      text: 'text-sky-600',      dot: 'bg-sky-500' },
  custom:            { bg: 'bg-stone-500/15',    text: 'text-stone-600',    dot: 'bg-stone-500' },
}

// Presets por role — categorias activas por defeito
export const CALENDAR_ROLE_PRESETS: Record<string, { categories: CalendarCategory[]; filterSelf: boolean }> = {
  'Broker/CEO': { categories: ALL_CATEGORIES, filterSelf: false },
  'admin': { categories: ALL_CATEGORIES, filterSelf: false },
  'Office Manager': { categories: ALL_CATEGORIES, filterSelf: false },
  'Consultor': {
    categories: ['contract_expiry', 'process_task', 'process_subtask', 'process_event', 'birthday', 'vacation', 'company_event', 'meeting'],
    filterSelf: true,
  },
  'Consultora Executiva': {
    categories: ['contract_expiry', 'process_task', 'process_subtask', 'process_event', 'birthday', 'vacation', 'company_event', 'meeting'],
    filterSelf: true,
  },
  'Team Leader': {
    categories: ['contract_expiry', 'process_task', 'process_subtask', 'process_event', 'birthday', 'vacation', 'company_event', 'meeting'],
    filterSelf: false,
  },
  'Gestora Processual': {
    categories: ['contract_expiry', 'lead_expiry', 'process_task', 'process_subtask', 'process_event', 'meeting', 'reminder'],
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
    categories: ['meeting', 'reminder', 'contract_expiry'],
    filterSelf: true,
  },
}
