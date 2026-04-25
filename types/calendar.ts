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
  | 'visit'
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
  location_lat?: number | null
  location_lng?: number | null
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

  // Visitas (eventos derivados da tabela `visits`)
  // Uma visita = um evento; ambos os consultores (comprador + vendedor) são
  // listados como participantes. O filtro "Os meus eventos" passa quando o
  // utilizador é qualquer um dos dois.
  visit_id?: string
  visit_buyer_agent_id?: string
  visit_buyer_agent_name?: string
  visit_seller_agent_id?: string
  visit_seller_agent_name?: string
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
  'marketing_event', 'meeting', 'visit', 'reminder', 'custom',
]

export const MANUAL_CATEGORIES = [
  'birthday', 'vacation', 'company_event',
  'marketing_event', 'meeting', 'visit', 'reminder', 'custom',
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
  visit: 'Visitas',
  reminder: 'Lembretes',
  custom: 'Outros',
}

// Mature palette — muted, earthy, sophisticated.
// company_event → gold (amber-500) per product decision.
export const CALENDAR_CATEGORY_COLORS: Record<CalendarCategory, { bg: string; text: string; dot: string }> = {
  contract_expiry:   { bg: 'bg-stone-500/15',   text: 'text-stone-700',    dot: 'bg-stone-500' },
  lead_expiry:       { bg: 'bg-red-700/15',     text: 'text-red-700',      dot: 'bg-red-700' },
  lead_followup:     { bg: 'bg-yellow-600/15',  text: 'text-yellow-700',   dot: 'bg-yellow-600' },
  process_task:      { bg: 'bg-violet-600/15',  text: 'text-violet-700',   dot: 'bg-violet-600' },
  process_subtask:   { bg: 'bg-teal-600/15',    text: 'text-teal-700',     dot: 'bg-teal-600' },
  process_event:     { bg: 'bg-sky-700/15',     text: 'text-sky-700',      dot: 'bg-sky-700' },
  birthday:          { bg: 'bg-rose-500/15',    text: 'text-rose-700',     dot: 'bg-rose-500' },
  vacation:          { bg: 'bg-slate-500/15',   text: 'text-slate-700',    dot: 'bg-slate-500' },
  company_event:     { bg: 'bg-yellow-400/25',  text: 'text-yellow-800',   dot: 'bg-yellow-500' },
  marketing_event:   { bg: 'bg-orange-600/15',  text: 'text-orange-700',   dot: 'bg-orange-600' },
  meeting:           { bg: 'bg-indigo-700/15',  text: 'text-indigo-700',   dot: 'bg-indigo-700' },
  visit:             { bg: 'bg-fuchsia-600/15', text: 'text-fuchsia-700',  dot: 'bg-fuchsia-600' },
  reminder:          { bg: 'bg-blue-600/15',    text: 'text-blue-700',     dot: 'bg-blue-600' },
  custom:            { bg: 'bg-neutral-500/15', text: 'text-neutral-700',  dot: 'bg-neutral-500' },
}

// Presets por role — categorias activas por defeito
export const CALENDAR_ROLE_PRESETS: Record<string, { categories: CalendarCategory[]; filterSelf: boolean }> = {
  'Broker/CEO': { categories: ALL_CATEGORIES, filterSelf: false },
  'admin': { categories: ALL_CATEGORIES, filterSelf: false },
  'Office Manager': { categories: ALL_CATEGORIES, filterSelf: false },
  'Consultor': {
    categories: ['contract_expiry', 'process_task', 'process_subtask', 'process_event', 'birthday', 'vacation', 'company_event', 'meeting', 'visit'],
    filterSelf: true,
  },
  'Consultora Executiva': {
    categories: ['contract_expiry', 'process_task', 'process_subtask', 'process_event', 'birthday', 'vacation', 'company_event', 'meeting', 'visit'],
    filterSelf: true,
  },
  'Team Leader': {
    categories: ['contract_expiry', 'process_task', 'process_subtask', 'process_event', 'birthday', 'vacation', 'company_event', 'meeting', 'visit'],
    filterSelf: false,
  },
  'Gestora Processual': {
    categories: ['contract_expiry', 'lead_expiry', 'process_task', 'process_subtask', 'process_event', 'meeting', 'visit', 'reminder'],
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
