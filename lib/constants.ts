// Sistema de Cores e Labels para Status (PT-PT)

export const STATUS_COLORS = {
  // Propriedades
  pending_approval: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-500',
    dot: 'bg-amber-500',
    label: 'Pendente Aprovação',
  },
  active: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-500',
    dot: 'bg-emerald-500',
    label: 'Activo',
  },
  sold: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-500',
    dot: 'bg-blue-500',
    label: 'Vendido',
  },
  rented: {
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-500',
    dot: 'bg-indigo-500',
    label: 'Arrendado',
  },
  suspended: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-500',
    dot: 'bg-slate-500',
    label: 'Suspenso',
  },
  cancelled: {
    bg: 'bg-red-500/15',
    text: 'text-red-500',
    dot: 'bg-red-500',
    label: 'Cancelado',
  },

  // Leads
  new: {
    bg: 'bg-sky-500/15',
    text: 'text-sky-500',
    dot: 'bg-sky-500',
    label: 'Novo',
  },
  contacted: {
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-500',
    dot: 'bg-yellow-500',
    label: 'Contactado',
  },
  qualified: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-500',
    dot: 'bg-emerald-500',
    label: 'Qualificado',
  },
  archived: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-500',
    dot: 'bg-slate-500',
    label: 'Arquivado',
  },
  expired: {
    bg: 'bg-red-500/15',
    text: 'text-red-500',
    dot: 'bg-red-500',
    label: 'Expirado',
  },

  // Tarefas de Processo
  pending: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-500',
    dot: 'bg-slate-400',
    label: 'Pendente',
  },
  in_progress: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-500',
    dot: 'bg-blue-500',
    label: 'Em Progresso',
  },
  completed: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-500',
    dot: 'bg-emerald-500',
    label: 'Concluído',
  },
  skipped: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-500',
    dot: 'bg-orange-500',
    label: 'Ignorado',
  },

  // Prioridade Leads
  low: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-500',
    label: 'Baixa',
  },
  medium: {
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-500',
    label: 'Média',
  },
  high: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-500',
    label: 'Alta',
  },
  urgent: {
    bg: 'bg-red-500/15',
    text: 'text-red-500',
    label: 'Urgente',
  },

  // Documentos
  received: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-500',
    label: 'Recebido',
  },
  validated: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-500',
    label: 'Validado',
  },
  rejected: {
    bg: 'bg-red-500/15',
    text: 'text-red-500',
    label: 'Rejeitado',
  },
} as const

// Status de Propriedades (Visibilidade e Ciclo de Vida)
export const PROPERTY_STATUS = {
  draft: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-500',
    dot: 'bg-violet-500',
    label: 'Rascunho',
  },
  pending_approval: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-500',
    dot: 'bg-amber-500',
    label: 'Pendente Aprovação',
  },
  in_process: {
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-500',
    dot: 'bg-yellow-500',
    label: 'Em Processo',
  },
  available: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-500',
    dot: 'bg-emerald-500',
    label: 'Disponível',
  },
  active: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-500',
    dot: 'bg-emerald-500',
    label: 'Activo',
  },
  reserved: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-500',
    dot: 'bg-purple-500',
    label: 'Reservado',
  },
  sold: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-500',
    dot: 'bg-blue-500',
    label: 'Vendido',
  },
  rented: {
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-500',
    dot: 'bg-indigo-500',
    label: 'Arrendado',
  },
  suspended: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-500',
    dot: 'bg-slate-500',
    label: 'Suspenso',
  },
  cancelled: {
    bg: 'bg-red-500/15',
    text: 'text-red-500',
    dot: 'bg-red-500',
    label: 'Cancelado',
  },
} as const

// Tipos de Processo
export const PROCESS_TYPES = {
  angariacao: {
    label: 'Angariação',
    prefix: 'ANG',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    icon: 'FileSearch',
    description: 'Captação e validação documental de imóveis',
  },
  negocio: {
    label: 'Negócio',
    prefix: 'NEG',
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    icon: 'Handshake',
    description: 'Processo de negócio de imóvel',
  },
} as const

export type ProcessTypeKey = keyof typeof PROCESS_TYPES

// Status de Processos (Workflow)
export const PROCESS_STATUS = {
  draft: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-500',
    dot: 'bg-violet-500',
    label: 'Rascunho',
  },
  pending_approval: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-500',
    dot: 'bg-amber-500',
    label: 'Pendente Aprovação',
  },
  returned: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-500',
    dot: 'bg-orange-500',
    label: 'Devolvido',
  },
  active: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-500',
    dot: 'bg-blue-500',
    label: 'Em Andamento',
  },
  on_hold: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-500',
    dot: 'bg-slate-500',
    label: 'Pausado',
  },
  completed: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-500',
    dot: 'bg-emerald-500',
    label: 'Concluído',
  },
  rejected: {
    bg: 'bg-red-500/15',
    text: 'text-red-500',
    dot: 'bg-red-500',
    label: 'Rejeitado',
  },
  cancelled: {
    bg: 'bg-red-500/15',
    text: 'text-red-500',
    dot: 'bg-red-500',
    label: 'Cancelado',
  },
} as const

// Status de Tarefas (Execução)
export const TASK_STATUS = {
  pending: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-500',
    dot: 'bg-slate-400',
    label: 'Pendente',
  },
  in_progress: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-500',
    dot: 'bg-blue-500',
    label: 'Em Progresso',
  },
  completed: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-500',
    dot: 'bg-emerald-500',
    label: 'Concluída',
  },
  skipped: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-500',
    dot: 'bg-orange-500',
    label: 'Dispensada',
  },
} as const

// Tipos de Imóvel
export const PROPERTY_TYPES = {
  apartamento: 'Apartamento',
  moradia: 'Moradia',
  terreno: 'Terreno',
  escritorio: 'Escritório',
  loja: 'Loja',
  armazem: 'Armazém',
  garagem: 'Garagem',
  quintinha: 'Quintinha',
  outro: 'Outro',
} as const

// Tipos de Negócio
export const BUSINESS_TYPES = {
  venda: 'Venda',
  arrendamento: 'Arrendamento',
  trespasse: 'Trespasse',
} as const

// Condição do Imóvel
export const PROPERTY_CONDITIONS = {
  novo: 'Novo',
  usado_como_novo: 'Usado - Como Novo',
  usado_bom_estado: 'Usado - Bom Estado',
  usado_recuperar: 'Usado - A Recuperar',
  em_construcao: 'Em Construção',
  para_remodelar: 'Para Remodelar',
} as const

// Certificado Energético
export const ENERGY_CERTIFICATES = {
  'A+': 'A+',
  A: 'A',
  B: 'B',
  'B-': 'B-',
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'F',
  isento: 'Isento',
  em_curso: 'Em Curso',
} as const

// Regime de Contrato
export const CONTRACT_REGIMES = {
  exclusivo: 'Exclusivo',
  nao_exclusivo: 'Não Exclusivo',
  angariacao: 'Angariação',
} as const

// Fontes de Lead
export const LEAD_SOURCES = {
  portal_idealista: 'Portal - Idealista',
  portal_imovirtual: 'Portal - Imovirtual',
  portal_casa_sapo: 'Portal - Casa Sapo',
  website: 'Website',
  referral: 'Referência',
  walk_in: 'Walk-in',
  phone_call: 'Chamada Telefónica',
  social_media: 'Redes Sociais',
  other: 'Outro',
} as const

// Portais imobiliários — metadata para Email Builder
export const PROPERTY_PORTALS = {
  idealista: {
    name: 'Idealista',
    color: '#1DBF73',
    icon: '🏠',
  },
  imovirtual: {
    name: 'Imovirtual',
    color: '#FF6600',
    icon: '🏡',
  },
  casa_sapo: {
    name: 'Casa Sapo',
    color: '#0066CC',
    icon: '🏘️',
  },
  supercasa: {
    name: 'SuperCasa',
    color: '#E31E24',
    icon: '🏢',
  },
  remax: {
    name: 'RE/MAX',
    color: '#003DA5',
    icon: '🏠',
  },
  custom: {
    name: 'Personalizado',
    color: '#6B7280',
    icon: '🔗',
  },
} as const

export type PropertyPortalKey = keyof typeof PROPERTY_PORTALS

// Tipos de Lead
export const LEAD_TYPES = {
  unknown: 'Desconhecido',
  buyer: 'Comprador',
  seller: 'Vendedor',
  landlord: 'Senhorio',
  tenant: 'Inquilino',
  investor: 'Investidor',
  buyer_seller: 'Comprador/Vendedor',
  other: 'Outro',
} as const

// Razões de Arquivo
export const ARCHIVED_REASONS = {
  duplicate: 'Duplicado',
  no_response: 'Sem Resposta',
  not_interested: 'Não Interessado',
  converted: 'Convertido',
  spam: 'Spam',
  other: 'Outro',
} as const

// Tipos de Actividade de Lead
export const ACTIVITY_TYPES = {
  call: 'Chamada',
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  visit: 'Visita',
  note: 'Nota',
  status_change: 'Mudança de Estado',
  assignment: 'Atribuição',
  qualification: 'Qualificação',
} as const

// Tipos de Pessoa (Proprietário)
export const PERSON_TYPES = {
  singular: 'Singular',
  coletiva: 'Coletiva',
} as const

// Estado Civil
export const MARITAL_STATUS = {
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a)',
  divorciado: 'Divorciado(a)',
  viuvo: 'Viúvo(a)',
  uniao_facto: 'União de Facto',
} as const

// Regimes Matrimoniais (Portugal)
export const MARITAL_REGIMES = {
  comunhao_adquiridos: 'Comunhão de Adquiridos',
  comunhao_geral: 'Comunhão Geral de Bens',
  separacao_bens: 'Separação de Bens',
  uniao_facto: 'União de Facto',
} as const

// Estados civis que indicam cônjuge
export const MARRIED_STATUSES = ['casado', 'uniao_facto'] as const

// Cores para roles de proprietário (fallback se BD não tiver)
export const OWNER_ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  proprietario: { bg: 'bg-blue-100', text: 'text-blue-800' },
  conjuge: { bg: 'bg-pink-100', text: 'text-pink-800' },
  socio: { bg: 'bg-amber-100', text: 'text-amber-800' },
  herdeiro: { bg: 'bg-purple-100', text: 'text-purple-800' },
  usufrutuario: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  nu_proprietario: { bg: 'bg-slate-100', text: 'text-slate-800' },
} as const

// Re-export de lib/auth/roles.ts (fonte única de verdade)
export { ADHOC_TASK_ROLES } from '@/lib/auth/roles'

// Tipos de Acção de Tarefa
export const ACTION_TYPES = {
  UPLOAD: 'Upload de Documento',
  EMAIL: 'Envio de Email',
  GENERATE_DOC: 'Gerar Documento',
  MANUAL: 'Tarefa Manual',
  FORM: 'Preencher Formulário',
} as const

// Labels de Prioridade de Tarefa (PT-PT)
export const TASK_PRIORITY_LABELS = {
  urgent: 'Urgente',
  normal: 'Normal',
  low: 'Baixa',
} as const

// Labels de Status de Tarefa (PT-PT)
export const TASK_STATUS_LABELS = {
  pending: 'Pendente',
  in_progress: 'Em Progresso',
  completed: 'Concluída',
  skipped: 'Dispensada',
} as const

// Labels de Tipo de Acção (PT-PT)
export const ACTION_TYPE_LABELS = {
  UPLOAD: 'Upload',
  EMAIL: 'Email',
  GENERATE_DOC: 'Documento',
  MANUAL: 'Manual',
  FORM: 'Formulário',
  COMPOSITE: 'Composta',
} as const

// Labels de Tipo de Actividade (PT-PT)
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  comment: 'Comentário',
  status_change: 'Alteração de estado',
  assignment: 'Atribuição',
  priority_change: 'Alteração de prioridade',
  due_date_change: 'Alteração de data limite',
  bypass: 'Dispensa de tarefa',
}

// Configuração de tipos de actividade para timeline (ícones e cores)
export const TASK_ACTIVITY_TYPE_CONFIG: Record<string, {
  icon: string
  label: string
  color: string
}> = {
  status_change:   { icon: 'RefreshCw',      label: 'Estado alterado',      color: 'text-blue-500' },
  assignment:      { icon: 'UserPlus',       label: 'Atribuição',           color: 'text-violet-500' },
  priority_change: { icon: 'Flag',           label: 'Prioridade alterada',  color: 'text-amber-500' },
  due_date_change: { icon: 'CalendarClock',  label: 'Data limite alterada', color: 'text-orange-500' },
  bypass:          { icon: 'Ban',            label: 'Dispensada',           color: 'text-orange-500' },
  upload:          { icon: 'Upload',         label: 'Documento carregado',  color: 'text-emerald-500' },
  email_sent:      { icon: 'Mail',           label: 'Email enviado',        color: 'text-sky-500' },
  doc_generated:   { icon: 'FileText',       label: 'Documento gerado',     color: 'text-indigo-500' },
  started:         { icon: 'PlayCircle',     label: 'Iniciada',             color: 'text-blue-500' },
  completed:       { icon: 'CheckCircle2',   label: 'Concluída',            color: 'text-emerald-500' },
  viewed:          { icon: 'Eye',            label: 'Visto por',            color: 'text-muted-foreground' },
  draft_generated: { icon: 'PenLine',        label: 'Rascunho gerado',      color: 'text-violet-500' },
  comment:         { icon: 'MessageSquare',  label: 'Comentário',           color: 'text-foreground' },
  email_delivered: { icon: 'MailCheck',         label: 'Email entregue',     color: 'text-emerald-500' },
  email_opened:    { icon: 'MailOpen',          label: 'Email aberto',       color: 'text-violet-500' },
  email_clicked:   { icon: 'MousePointerClick', label: 'Link clicado',       color: 'text-indigo-500' },
  email_bounced:   { icon: 'MailX',             label: 'Email rejeitado',    color: 'text-red-500' },
  email_failed:    { icon: 'AlertCircle',       label: 'Erro no envio',      color: 'text-red-500' },
  email_resent:       { icon: 'MailPlus',          label: 'Email reenviado',      color: 'text-sky-500' },
  email_delayed:      { icon: 'Clock',             label: 'Email atrasado',       color: 'text-amber-500' },
  subtask_reverted:   { icon: 'RotateCcw',         label: 'Subtarefa revertida',  color: 'text-orange-500' },
  template_reset:     { icon: 'RotateCcw',         label: 'Template resetado',    color: 'text-orange-500' },
  document_replaced:  { icon: 'RefreshCw',          label: 'Documento substituído', color: 'text-blue-500' },
  upload_completed:   { icon: 'Upload',             label: 'Upload concluído',     color: 'text-emerald-500' },
  // Ad-hoc tasks
  task_created:            { icon: 'Plus',           label: 'Tarefa criada',              color: 'text-violet-600' },
  task_deleted:            { icon: 'Trash2',         label: 'Tarefa removida',            color: 'text-red-600' },
  subtask_added:           { icon: 'ListPlus',       label: 'Subtarefa adicionada',       color: 'text-violet-600' },
  subtask_deleted:         { icon: 'ListMinus',      label: 'Subtarefa removida',         color: 'text-red-600' },
  adhoc_task_completed:    { icon: 'CheckCircle2',   label: 'Tarefa manual concluída',    color: 'text-emerald-600' },
  adhoc_subtask_completed: { icon: 'CircleCheck',    label: 'Subtarefa manual concluída', color: 'text-emerald-500' },
  adhoc_subtask_reverted:  { icon: 'RotateCcw',      label: 'Subtarefa manual revertida', color: 'text-amber-600' },
  // Eventos de calendário
  event_scheduled:         { icon: 'CalendarPlus',    label: 'Evento agendado',            color: 'text-indigo-500' },
  event_updated:           { icon: 'CalendarClock',   label: 'Evento actualizado',         color: 'text-indigo-500' },
  event_cancelled:         { icon: 'CalendarX',       label: 'Evento cancelado',           color: 'text-red-500' },
}

export const EMAIL_STATUS_CONFIG: Record<string, {
  label: string
  icon: string
  color: string
  badgeVariant: 'secondary' | 'default' | 'destructive' | 'outline'
}> = {
  sent:       { label: 'Enviado',   icon: 'Mail',              color: 'text-sky-500',     badgeVariant: 'secondary' },
  delivered:  { label: 'Entregue',  icon: 'MailCheck',         color: 'text-emerald-500', badgeVariant: 'default' },
  opened:     { label: 'Aberto',    icon: 'MailOpen',          color: 'text-violet-500',  badgeVariant: 'default' },
  clicked:    { label: 'Clicado',   icon: 'MousePointerClick', color: 'text-indigo-500',  badgeVariant: 'default' },
  bounced:    { label: 'Rejeitado', icon: 'MailX',             color: 'text-red-500',     badgeVariant: 'destructive' },
  complained: { label: 'Spam',      icon: 'ShieldAlert',       color: 'text-red-500',     badgeVariant: 'destructive' },
  failed:            { label: 'Falhou',    icon: 'AlertCircle',       color: 'text-red-500',     badgeVariant: 'destructive' },
  delivery_delayed:  { label: 'Atrasado',  icon: 'Clock',             color: 'text-amber-500',   badgeVariant: 'outline' },
  scheduled:         { label: 'Agendado',  icon: 'Clock',             color: 'text-blue-500',    badgeVariant: 'secondary' },
  suppressed:        { label: 'Suprimido', icon: 'ShieldAlert',       color: 'text-orange-500',  badgeVariant: 'destructive' },
  received:          { label: 'Recebido',  icon: 'MailCheck',         color: 'text-emerald-500', badgeVariant: 'default' },
}

// Badges de prioridade com design expressivo
export const PRIORITY_BADGE_CONFIG: Record<string, {
  icon: string
  label: string
  className: string
  dotColor: string
}> = {
  urgent: {
    icon: 'AlertTriangle',
    label: 'Urgente',
    className: 'bg-red-500/15 text-red-600 border-red-500/20',
    dotColor: 'bg-red-500',
  },
  normal: {
    icon: 'ArrowRight',
    label: 'Normal',
    className: 'bg-amber-500/15 text-amber-600 border-amber-500/20',
    dotColor: 'bg-amber-500',
  },
  low: {
    icon: 'ArrowDown',
    label: 'Baixa',
    className: 'bg-slate-500/15 text-slate-500 border-slate-500/20',
    dotColor: 'bg-slate-400',
  },
}

// Labels de Tipo de Verificação de Subtarefa (PT-PT) — Legacy
export const CHECK_TYPE_LABELS = {
  field: 'Campo do proprietário',
  document: 'Documento',
  manual: 'Verificação manual',
} as const

// Tipos de subtask (novo modelo)
export const SUBTASK_TYPES = [
  { type: 'upload' as const, label: 'Upload de Documento', icon: 'Upload', color: 'text-blue-500' },
  { type: 'checklist' as const, label: 'Checklist (Manual)', icon: 'CheckSquare', color: 'text-slate-500' },
  { type: 'email' as const, label: 'Envio de Email', icon: 'Mail', color: 'text-amber-500' },
  { type: 'generate_doc' as const, label: 'Gerar Documento', icon: 'FileText', color: 'text-purple-500' },
  { type: 'form' as const, label: 'Formulário (multi-campo)', icon: 'ClipboardList', color: 'text-teal-500' },
  { type: 'field' as const, label: 'Campo Único (inline)', icon: 'TextCursorInput', color: 'text-cyan-500' },
  { type: 'schedule_event' as const, label: 'Agendar Evento', icon: 'CalendarPlus', color: 'text-indigo-600' },
  { type: 'external_form' as const, label: 'Formulário Externo', icon: 'ClipboardList', color: 'text-rose-500' },
] as const

export const SUBTASK_TYPE_LABELS: Record<string, string> = {
  upload: 'Upload',
  checklist: 'Checklist',
  email: 'Email',
  generate_doc: 'Gerar Doc',
  form: 'Formulário',
  field: 'Campo',
  schedule_event: 'Evento',
  external_form: 'Formulário Externo',
  // Legacy check_type mappings
  manual: 'Checklist',
  document: 'Documento',
}

export const SUBTASK_TYPE_ICONS: Record<string, string> = {
  upload: 'Upload',
  checklist: 'CheckSquare',
  email: 'Mail',
  generate_doc: 'FileText',
  form: 'ClipboardList',
  field: 'TextCursorInput',
  schedule_event: 'CalendarPlus',
  external_form: 'ClipboardList',
}

// Labels de Owner Scope para subtarefas (PT-PT)
export const OWNER_SCOPE_LABELS: Record<string, string> = {
  none: 'Sem multiplicação',
  all_owners: 'Todos os proprietários',
  main_contact_only: 'Apenas contacto principal',
}

// Labels de filtro por tipo de pessoa (PT-PT)
export const PERSON_TYPE_FILTER_LABELS: Record<string, string> = {
  all: 'Todos os tipos',
  singular: 'Apenas Pessoa Singular',
  coletiva: 'Apenas Pessoa Colectiva',
}

// Campos do proprietário singular
export const OWNER_FIELDS_SINGULAR = [
  { value: 'name', label: 'Nome completo' },
  { value: 'nif', label: 'NIF' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefone' },
  { value: 'birth_date', label: 'Data de nascimento' },
  { value: 'nationality', label: 'Nacionalidade' },
  { value: 'naturality', label: 'Naturalidade' },
  { value: 'id_doc_type', label: 'Tipo de documento' },
  { value: 'id_doc_number', label: 'Número do documento' },
  { value: 'id_doc_expiry', label: 'Validade do documento' },
  { value: 'id_doc_issued_by', label: 'Emitido por' },
  { value: 'address', label: 'Morada' },
  { value: 'postal_code', label: 'Código postal' },
  { value: 'city', label: 'Localidade' },
  { value: 'marital_status', label: 'Estado civil' },
  { value: 'marital_regime', label: 'Regime matrimonial' },
  { value: 'profession', label: 'Profissão actual' },
  { value: 'last_profession', label: 'Última profissão' },
  { value: 'is_portugal_resident', label: 'Residente em Portugal' },
  { value: 'residence_country', label: 'País de residência' },
  { value: 'is_pep', label: 'Pessoa politicamente exposta' },
  { value: 'pep_position', label: 'Cargo PEP' },
  { value: 'funds_origin', label: 'Origem dos fundos' },
] as const

// Campos do proprietário empresa (pessoa colectiva)
export const OWNER_FIELDS_COLETIVA = [
  { value: 'name', label: 'Nome da empresa' },
  { value: 'nif', label: 'NIF/NIPC' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefone' },
  { value: 'address', label: 'Sede / Morada' },
  { value: 'legal_representative_name', label: 'Nome do representante legal' },
  { value: 'legal_representative_nif', label: 'NIF do representante legal' },
  { value: 'legal_rep_id_doc', label: 'Documento do representante legal' },
  { value: 'company_object', label: 'Objecto social' },
  { value: 'company_branches', label: 'Sucursais' },
  { value: 'legal_nature', label: 'Natureza jurídica' },
  { value: 'country_of_incorporation', label: 'País de constituição' },
  { value: 'cae_code', label: 'Código CAE' },
  { value: 'rcbe_code', label: 'Código RCBE' },
] as const

// Orientação Solar
export const SOLAR_ORIENTATIONS = [
  'Norte',
  'Sul',
  'Este',
  'Oeste',
  'Nascente',
  'Poente',
] as const

// Vistas
export const VIEWS = [
  'Mar',
  'Serra',
  'Rio',
  'Cidade',
  'Campo',
  'Jardim',
] as const

// Equipamentos
export const EQUIPMENT = [
  'Ar Condicionado',
  'Aquecimento Central',
  'Lareira',
  'Painéis Solares',
  'Bomba de Calor',
  'Vidros Duplos',
  'Estores Eléctricos',
  'Alarme',
  'Vídeo Porteiro',
  'Sistema de Rega',
] as const

// Características
export const FEATURES = [
  'Varanda',
  'Terraço',
  'Jardim',
  'Piscina',
  'Garagem',
  'Arrecadação',
  'Sótão',
  'Cave',
  'Ginásio',
  'Condomínio Fechado',
  'Portaria',
  'Cozinha Equipada',
  'Mobilado',
  'Suite',
] as const

// Tipologias
export const TYPOLOGIES = [
  'T0',
  'T1',
  'T2',
  'T3',
  'T4',
  'T5',
  'T6+',
  'Loft',
  'Estúdio',
  'Duplex',
  'Triplex',
] as const

// Módulos do Sistema (para permissões)
export const MODULES = {
  dashboard: 'Dashboard',
  properties: 'Imóveis',
  leads: 'Leads',
  processes: 'Processos',
  documents: 'Documentos',
  consultants: 'Consultores',
  owners: 'Proprietários',
  teams: 'Equipas',
  commissions: 'Comissões',
  marketing: 'Marketing',
  templates: 'Templates',
  settings: 'Definições',
  goals: 'Objectivos',
  store: 'Loja',
  users: 'Utilizadores',
  buyers: 'Compradores',
  credit: 'Crédito',
  calendar: 'Calendário',
  pipeline: 'Pipeline',
  financial: 'Financeiro',
  integration: 'Integração',
  recruitment: 'Recrutamento',
  training: 'Formações',
} as const

// Roles do Sistema
export const ROLES = {
  broker: 'Broker/CEO',
  consultor: 'Consultor',
  consultora_executiva: 'Consultora Executiva',
  gestora_processual: 'Gestora Processual',
  marketing: 'Marketing',
  office_manager: 'Office Manager',
  team_leader: 'Team Leader',
  recrutador: 'Recrutador',
  intermediario_credito: 'Intermediário de Crédito',
  cliente: 'Cliente',
} as const

// Formatadores
// Labels de Documentos (PT-PT)
export const DOC_LABELS = {
  upload: 'Carregar documento',
  archive: 'Arquivar',
  replace: 'Substituir documento',
  use_existing: 'Usar este documento',
  select_file: 'Seleccionar ficheiro',
  drag_drop: 'Arraste ficheiros ou clique para seleccionar',
  valid_until: 'Valido ate',
  issued_by: 'Emitido por',
  doc_type: 'Tipo de documento',
  already_exists_valid: 'Ja existe (valido)',
  already_exists_expired: 'Ja existe (expirado)',
  no_documents: 'Nenhum documento encontrado',
  max_size: 'Tamanho maximo: 20MB',
  format_error: 'Formato nao permitido',
  upload_success: 'Documento carregado com sucesso',
  upload_error: 'Erro ao carregar documento',
  archive_confirm: 'Tem a certeza de que pretende arquivar este documento?',
} as const

export const DOC_CATEGORIES: Record<string, string> = {
  'Contratual': 'Contratual',
  'Imóvel': 'Imóvel',
  'Jurídico': 'Jurídico',
  'Jurídico Especial': 'Jurídico Especial',
  'Proprietário': 'Proprietário',
  'Proprietário Empresa': 'Proprietário Empresa',
}

export const DOC_FOLDER_LABELS = {
  property: 'Documentos do Imóvel',
  process: 'Documentos do Processo',
  owner: 'Documentos do Proprietário',
  consultant: 'Documentos do Consultor',
} as const

export const DOC_FOLDER_ICONS = {
  property: 'Building2',
  process: 'FileCheck',
  owner: 'User',
  consultant: 'Briefcase',
} as const

export const KYC_LABELS = {
  birth_date: 'Data de Nascimento',
  id_doc_type: 'Tipo de Documento',
  id_doc_number: 'Numero do Documento',
  id_doc_expiry: 'Data de Validade',
  id_doc_issued_by: 'Emitido por',
  is_pep: 'Pessoa Politicamente Exposta (PEP)',
  pep_position: 'Cargo PEP',
  funds_origin: 'Origem dos Fundos',
  profession: 'Profissao',
  last_profession: 'Ultima Profissao',
  is_portugal_resident: 'Residente em Portugal',
  residence_country: 'Pais de Residencia',
  marital_regime: 'Regime Matrimonial',
  company_object: 'Objecto Social',
  company_branches: 'Estabelecimentos',
  legal_nature: 'Natureza Juridica',
  country_of_incorporation: 'Pais de Constituicao',
  cae_code: 'Codigo CAE',
  rcbe_code: 'Codigo RCBE',
} as const

// --- CHAT ---

export const CHAT_LABELS = {
  title: 'Chat do Processo',
  placeholder: 'Escrever mensagem... @ mencionar, / tarefas',
  send: 'Enviar',
  no_messages: 'Sem mensagens. Inicie a conversa.',
  typing_one: 'está a escrever...',
  typing_many: 'estão a escrever...',
  online: 'online',
  edited: '(editado)',
  deleted_message: 'Esta mensagem foi eliminada.',
  reply_to: 'A responder a',
  reactions: 'Reações',
  attach_file: 'Anexar ficheiro',
  uploading: 'A enviar...',
  upload_error: 'Erro ao enviar ficheiro',
  upload_success: 'Ficheiro enviado com sucesso',
  max_file_size: 'Tamanho máximo: 20MB',
  edit_message: 'Editar mensagem',
  delete_message: 'Eliminar mensagem',
  delete_confirm: 'Tem a certeza de que pretende eliminar esta mensagem?',
} as const

export const CHAT_EMOJI_QUICK = ['👍', '❤️', '😂', '🎉', '👀', '✅'] as const

export const VOICE_LABELS = {
  record: 'Gravar áudio',
  stop: 'Parar gravação',
  play: 'Ouvir',
  pause: 'Pausar',
  send: 'Enviar',
  cancel: 'Cancelar',
  discard: 'Descartar',
  recording: 'A gravar...',
  voice_message: 'Mensagem de voz',
  sending: 'A enviar áudio...',
  sent: 'Áudio enviado com sucesso',
  error: 'Erro ao enviar áudio',
  mic_denied: 'Permissão de microfone negada',
} as const

// --- NOTIFICAÇÕES ---

export const NOTIFICATION_TYPE_CONFIG: Record<string, {
  icon: string
  label: string
  color: string
}> = {
  process_created:  { icon: 'FilePlus2',     label: 'Novo Processo',        color: 'amber' },
  process_approved: { icon: 'CheckCircle2',   label: 'Processo Aprovado',    color: 'emerald' },
  process_rejected: { icon: 'XCircle',        label: 'Processo Rejeitado',   color: 'red' },
  process_returned: { icon: 'Undo2',          label: 'Processo Devolvido',   color: 'orange' },
  task_assigned:    { icon: 'UserCheck',      label: 'Tarefa Atribuída',     color: 'blue' },
  task_completed:   { icon: 'CircleCheckBig', label: 'Tarefa Concluída',     color: 'emerald' },
  task_comment:     { icon: 'MessageSquare',  label: 'Comentário',           color: 'slate' },
  chat_message:     { icon: 'MessageCircle',  label: 'Mensagem no Chat',     color: 'indigo' },
  comment_mention:  { icon: 'AtSign',         label: 'Menção em Comentário', color: 'amber' },
  chat_mention:     { icon: 'AtSign',         label: 'Menção no Chat',       color: 'amber' },
  task_updated:     { icon: 'RefreshCw',      label: 'Tarefa Actualizada',   color: 'orange' },
  task_overdue:     { icon: 'AlertTriangle',  label: 'Tarefa Vencida',       color: 'red' },
}

export const NOTIFICATION_LABELS = {
  title: 'Notificações',
  no_notifications: 'Sem notificações',
  mark_all_read: 'Marcar tudo como lido',
  mark_as_read: 'Marcar como lido',
  mark_as_unread: 'Marcar como não lido',
  delete: 'Eliminar',
} as const

// --- LEADS ---

export const LEAD_ESTADOS = [
  'Novo',
  'Em contacto',
  'Qualificado',
  'Em negociação',
  'Convertido',
  'Perdido',
] as const

export const LEAD_TEMPERATURAS = [
  { value: 'Quente', label: 'Quente', color: 'text-red-600 bg-red-50' },
  { value: 'Morno', label: 'Morno', color: 'text-amber-600 bg-amber-50' },
  { value: 'Frio', label: 'Frio', color: 'text-blue-600 bg-blue-50' },
] as const

export const LEAD_ORIGENS = [
  'Idealista',
  'Imovirtual',
  'Casa Sapo',
  'Website',
  'Referência',
  'Walk-in',
  'Telefone',
  'Redes Sociais',
  'Outro',
] as const

export const LEAD_FORMAS_CONTACTO = [
  'Telefone',
  'Email',
  'WhatsApp',
  'Presencial',
  'Redes Sociais',
  'Outro',
] as const

export const LEAD_MEIOS_CONTACTO = [
  'Telefone',
  'Email',
  'WhatsApp',
  'SMS',
] as const

export const LEAD_GENEROS = ['Masculino', 'Feminino'] as const

export const LEAD_TIPOS_DOCUMENTO = [
  'Cartão de Cidadão',
  'Passaporte',
  'Bilhete de Identidade',
  'Autorização de Residência',
] as const

// --- NEGOCIOS ---

export const NEGOCIO_TIPOS = [
  'Compra',
  'Venda',
  'Compra e Venda',
  'Arrendatário',
  'Arrendador',
  'Outro',
] as const

export const NEGOCIO_ESTADOS = [
  'Aberto',
  'Em Acompanhamento',
  'Em progresso',
  'Proposta',
  'Fechado',
  'Cancelado',
  'Perdido',
] as const

export const NEGOCIO_TIPOS_IMOVEL = [
  'Apartamento',
  'Moradia',
  'Terreno',
  'Escritório',
  'Loja',
  'Armazém',
  'Outro',
] as const

export const NEGOCIO_ESTADOS_IMOVEL = [
  'Novo',
  'Em construção',
  'Usado',
  'Para recuperação',
] as const

export const NEGOCIO_MOTIVACOES = [
  'Primeira habitação',
  'Investimento',
  'Upgrade',
  'Downsize',
  'Relocalização',
  'Outro',
] as const

export const NEGOCIO_PRAZOS = [
  'Imediato',
  'Até 3 meses',
  '3 a 6 meses',
  '6 a 12 meses',
  'Mais de 1 ano',
] as const

export const NEGOCIO_CLASSES_IMOVEL = [
  'Habitação',
  'Comercial',
  'Misto',
  'Rústico',
  'Outro',
] as const

export const NEGOCIO_SITUACOES_PROFISSIONAIS = [
  'Empregado por conta de outrem',
  'Trabalhador independente',
  'Empresário',
  'Reformado',
  'Estudante',
  'Outro',
] as const

export const NEGOCIO_DURACOES_CONTRATO = [
  'Sem mínimo',
  '1 ano',
  '2 anos',
  '3 anos',
] as const

// Localizações PT — distritos, concelhos e zonas relevantes para imobiliário
export const LOCALIZACOES_PT = [
  // Distritos
  'Aveiro', 'Beja', 'Braga', 'Bragança', 'Castelo Branco',
  'Coimbra', 'Évora', 'Faro', 'Guarda', 'Leiria',
  'Lisboa', 'Portalegre', 'Porto', 'Santarém', 'Setúbal',
  'Viana do Castelo', 'Vila Real', 'Viseu',
  // Regiões autónomas
  'Açores', 'Madeira', 'Funchal', 'Ponta Delgada',
  // AML — Área Metropolitana de Lisboa
  'Alcochete', 'Almada', 'Amadora', 'Barreiro', 'Cascais',
  'Loures', 'Mafra', 'Moita', 'Montijo', 'Odivelas',
  'Oeiras', 'Palmela', 'Seixal', 'Sesimbra', 'Sintra',
  'Vila Franca de Xira',
  // Zonas de Lisboa
  'Alfama', 'Avenidas Novas', 'Baixa', 'Belém', 'Benfica',
  'Campo de Ourique', 'Chiado', 'Estrela', 'Graça', 'Lapa',
  'Lumiar', 'Marvila', 'Olivais', 'Parque das Nações',
  'Príncipe Real', 'Restelo', 'Santos', 'São Domingos de Benfica',
  'Telheiras', 'Alvalade', 'Areeiro', 'Arroios', 'Campolide',
  'Carnide', 'Ajuda',
  // AMP — Área Metropolitana do Porto
  'Espinho', 'Gondomar', 'Maia', 'Matosinhos', 'Póvoa de Varzim',
  'Santo Tirso', 'Trofa', 'Valongo', 'Vila do Conde',
  'Vila Nova de Gaia',
  // Zonas do Porto
  'Boavista', 'Cedofeita', 'Foz do Douro', 'Lordelo do Ouro',
  'Marquês', 'Massarelos', 'Nevogilde', 'Paranhos', 'Ramalde',
  // Algarve — concelhos
  'Albufeira', 'Alcoutim', 'Aljezur', 'Castro Marim', 'Faro',
  'Lagoa', 'Lagos', 'Loulé', 'Monchique', 'Olhão',
  'Portimão', 'São Brás de Alportel', 'Silves', 'Tavira',
  'Vila do Bispo', 'Vila Real de Santo António',
  // Algarve — zonas
  'Vilamoura', 'Quarteira', 'Vale do Lobo', 'Quinta do Lago',
  'Carvoeiro', 'Armação de Pêra', 'Praia da Rocha', 'Alvor',
  'Sagres', 'Monte Gordo',
  // Costa de Prata / Oeste
  'Caldas da Rainha', 'Peniche', 'Óbidos', 'Torres Vedras',
  'Nazaré', 'Alcobaça', 'Bombarral', 'Lourinhã', 'Alenquer',
  'Arruda dos Vinhos', 'Sobral de Monte Agraço', 'Cadaval',
  // Linha de Sintra / Cascais
  'Queluz', 'Cacém', 'Agualva', 'Rio de Mouro', 'Mem Martins',
  'Algueirão', 'Estoril', 'Carcavelos', 'Parede', 'São João do Estoril',
  'São Pedro do Estoril', 'Monte Estoril', 'Birre',
  // Margem Sul
  'Costa da Caparica', 'Corroios', 'Amora', 'Arrentela',
  'Paio Pires', 'Pinhal Novo', 'Quinta do Conde',
  'Azeitão', 'Setúbal', 'Tróia',
  // Centro
  'Aveiro', 'Ílhavo', 'Águeda', 'Ovar', 'Viseu',
  'Coimbra', 'Figueira da Foz', 'Leiria', 'Marinha Grande',
  'Pombal', 'Tomar', 'Torres Novas', 'Abrantes', 'Entroncamento',
  // Norte
  'Guimarães', 'Barcelos', 'Famalicão', 'Viana do Castelo',
  'Ponte de Lima', 'Bragança', 'Chaves', 'Vila Real',
  'Amarante', 'Penafiel', 'Marco de Canaveses', 'Felgueiras',
  // Alentejo
  'Évora', 'Beja', 'Portalegre', 'Elvas', 'Estremoz',
  'Vendas Novas', 'Montemor-o-Novo', 'Grândola', 'Santiago do Cacém',
  'Sines', 'Alcácer do Sal', 'Comporta',
] as const

// Formatadores
export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

export const formatDate = (date: string | null | undefined): string => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '—'
  return new Date(date).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const formatArea = (area: number | null | undefined): string => {
  if (area === null || area === undefined) return '—'
  return `${area} m²`
}

export const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  return `${value}%`
}

// === MARKETING SHOP ===

export const MARKETING_CATEGORIES = {
  photography: 'Fotografia',
  video: 'Vídeo',
  design: 'Design',
  physical_materials: 'Materiais Físicos',
  ads: 'Publicidade',
  social_media: 'Redes Sociais',
  other: 'Outro',
} as const

export const MARKETING_CATEGORY_ICONS: Record<string, string> = {
  photography: 'Camera',
  video: 'Video',
  design: 'Palette',
  physical_materials: 'Package',
  ads: 'Megaphone',
  social_media: 'Share2',
  other: 'MoreHorizontal',
}

export const MARKETING_ORDER_STATUS = {
  pending: { bg: 'bg-amber-500/15', text: 'text-amber-500', dot: 'bg-amber-500', label: 'Pendente' },
  accepted: { bg: 'bg-blue-500/15', text: 'text-blue-500', dot: 'bg-blue-500', label: 'Aceite' },
  scheduled: { bg: 'bg-indigo-500/15', text: 'text-indigo-500', dot: 'bg-indigo-500', label: 'Agendado' },
  in_production: { bg: 'bg-purple-500/15', text: 'text-purple-500', dot: 'bg-purple-500', label: 'Em Produção' },
  delivered: { bg: 'bg-cyan-500/15', text: 'text-cyan-500', dot: 'bg-cyan-500', label: 'Entregue' },
  completed: { bg: 'bg-emerald-500/15', text: 'text-emerald-500', dot: 'bg-emerald-500', label: 'Concluído' },
  rejected: { bg: 'bg-red-500/15', text: 'text-red-500', dot: 'bg-red-500', label: 'Rejeitado' },
  cancelled: { bg: 'bg-slate-500/15', text: 'text-slate-500', dot: 'bg-slate-500', label: 'Cancelado' },
} as const

export const MARKETING_TIME_SLOTS = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  all_day: 'Todo o dia',
} as const

export const MARKETING_CONTACT_RELATIONSHIPS = {
  agent: 'Consultor',
  owner: 'Proprietário',
  tenant: 'Inquilino',
  colleague: 'Colega',
  other: 'Outro',
} as const

export const CONTA_CORRENTE_CATEGORIES = {
  // DEBIT
  marketing_purchase: 'Compra Marketing',
  physical_material: 'Material Físico',
  fee_registration: 'Taxa de Registo',
  fee_renewal: 'Taxa de Renovação',
  fee_technology: 'Taxa de Tecnologia',
  fee_process_management: 'Taxa Gestão Processual',
  manual_adjustment: 'Ajuste Manual',
  // CREDIT
  commission_payment: 'Pagamento Comissão',
  refund: 'Reembolso',
} as const

export const MARKETING_LABELS = {
  catalog: 'Catálogo',
  packs: 'Packs',
  orders: 'Encomendas',
  conta_corrente: 'Conta Corrente',
  new_service: 'Novo Serviço',
  new_pack: 'Novo Pack',
  edit_service: 'Editar Serviço',
  edit_pack: 'Editar Pack',
  delete_confirm: 'Tem a certeza de que pretende eliminar este item?',
  no_services: 'Nenhum serviço encontrado',
  no_packs: 'Nenhum pack encontrado',
  no_orders: 'Nenhuma encomenda encontrada',
  price: 'Preço',
  delivery_days: 'Prazo de Entrega',
  days: 'dias úteis',
  requires_scheduling: 'Requer Agendamento',
  requires_property: 'Requer Imóvel',
  request_service: 'Pedir Serviço',
  balance: 'Saldo',
  transactions: 'Movimentos',
} as const

// === M13: Templates de Email ===

export const EMAIL_TEMPLATE_VARIABLES = [
  { value: '{{proprietario_nome}}', label: 'Nome do Proprietário' },
  { value: '{{proprietario_email}}', label: 'Email do Proprietário' },
  { value: '{{proprietario_telefone}}', label: 'Telefone do Proprietário' },
  { value: '{{imovel_ref}}', label: 'Referência do Imóvel' },
  { value: '{{imovel_titulo}}', label: 'Título do Imóvel' },
  { value: '{{imovel_morada}}', label: 'Morada do Imóvel' },
  { value: '{{imovel_preco}}', label: 'Preço do Imóvel' },
  { value: '{{consultor_nome}}', label: 'Nome do Consultor' },
  { value: '{{consultor_email}}', label: 'Email do Consultor' },
  { value: '{{consultor_telefone}}', label: 'Telefone do Consultor' },
  { value: '{{processo_ref}}', label: 'Referência do Processo' },
  { value: '{{data_actual}}', label: 'Data Actual' },
  { value: '{{empresa_nome}}', label: 'Nome da Empresa' },
] as const

export const EMAIL_COMPONENT_LABELS = {
  EmailContainer: 'Contentor',
  EmailText: 'Texto',
  EmailHeading: 'Título',
  EmailImage: 'Imagem',
  EmailButton: 'Botão',
  EmailDivider: 'Divisor',
  EmailSpacer: 'Espaçador',
  EmailAttachment: 'Anexo',
} as const

// --- ALERTAS ---

export const ALERT_EVENT_LABELS = {
  on_complete: 'Ao concluir',
  on_overdue: 'Ao vencer prazo',
  on_unblock: 'Ao desbloquear',
  on_assign: 'Ao atribuir',
} as const

export const ALERT_CHANNEL_LABELS = {
  notification: 'Notificação in-app',
  email: 'Email',
  whatsapp: 'WhatsApp',
} as const

export const ALERT_RECIPIENT_LABELS = {
  consultant: 'Consultor do processo',
  assigned: 'Responsável atribuído',
  role: 'Todos com a role...',
  specific_users: 'Utilizadores específicos',
} as const

export const ALERT_MESSAGE_VARIABLES = {
  '{title}': 'Título da tarefa/subtarefa',
  '{process_ref}': 'Referência do processo (PROC-2026-XXXX)',
  '{triggered_by}': 'Nome de quem executou a acção',
} as const

// === OBJETIVOS (M16) ===

export const GOAL_ACTIVITY_TYPES = {
  call: 'Chamada',
  visit: 'Visita',
  listing: 'Angariação',
  sale_close: 'Fecho Venda',
  buyer_close: 'Fecho Comprador',
  lead_contact: 'Contacto Lead',
  buyer_qualify: 'Qualificação Comprador',
  follow_up: 'Follow-up',
} as const

export const GOAL_ORIGINS = {
  sellers: 'Vendedores',
  buyers: 'Compradores',
} as const

export const GOAL_STATUS_COLORS = {
  green: { bg: 'bg-emerald-500/15', text: 'text-emerald-500', label: 'Acima do objetivo' },
  orange: { bg: 'bg-amber-500/15', text: 'text-amber-500', label: 'No limite' },
  red: { bg: 'bg-red-500/15', text: 'text-red-500', label: 'Abaixo do mínimo' },
} as const

export const GOAL_PERIOD_LABELS = {
  annual: 'Anual',
  monthly: 'Mensal',
  weekly: 'Semanal',
  daily: 'Diário',
} as const

// === NEGÓCIO ESTADOS ===

export const NEGOCIO_ESTADO_COLORS = {
  'Aberto':              { bg: 'bg-sky-500/15',     text: 'text-sky-600',     dot: 'bg-sky-500',     label: 'Aberto' },
  'Em Acompanhamento':   { bg: 'bg-blue-500/15',    text: 'text-blue-600',    dot: 'bg-blue-500',    label: 'Em Acompanhamento' },
  'Em progresso':        { bg: 'bg-indigo-500/15',  text: 'text-indigo-600',  dot: 'bg-indigo-500',  label: 'Em Progresso' },
  'Proposta':            { bg: 'bg-violet-500/15',  text: 'text-violet-600',  dot: 'bg-violet-500',  label: 'Proposta' },
  'Fechado':             { bg: 'bg-emerald-500/15', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Fechado' },
  'Cancelado':           { bg: 'bg-slate-500/15',   text: 'text-slate-600',   dot: 'bg-slate-400',   label: 'Cancelado' },
  'Perdido':             { bg: 'bg-red-500/15',     text: 'text-red-600',     dot: 'bg-red-500',     label: 'Perdido' },
} as const

export const NEGOCIO_ESTADO_OPTIONS = [
  { value: 'Aberto' as const, label: 'Aberto' },
  { value: 'Em Acompanhamento' as const, label: 'Em Acompanhamento' },
  { value: 'Em progresso' as const, label: 'Em Progresso' },
  { value: 'Proposta' as const, label: 'Proposta' },
  { value: 'Fechado' as const, label: 'Fechado' },
  { value: 'Cancelado' as const, label: 'Cancelado' },
  { value: 'Perdido' as const, label: 'Perdido' },
] as const

export const NEGOCIO_PROPERTY_STATUS = {
  suggested:  { bg: 'bg-slate-500/15',   text: 'text-slate-600',   label: 'Sugerido' },
  sent:       { bg: 'bg-blue-500/15',    text: 'text-blue-600',    label: 'Enviado' },
  visited:    { bg: 'bg-amber-500/15',   text: 'text-amber-600',   label: 'Visitado' },
  interested: { bg: 'bg-emerald-500/15', text: 'text-emerald-600', label: 'Interessado' },
  discarded:  { bg: 'bg-red-500/15',     text: 'text-red-600',     label: 'Descartado' },
} as const

// Backward compat aliases
export const ACOMPANHAMENTO_STATUS_COLORS = NEGOCIO_ESTADO_COLORS
export const ACOMPANHAMENTO_STATUS_OPTIONS = NEGOCIO_ESTADO_OPTIONS
export const ACOMPANHAMENTO_PROPERTY_STATUS = NEGOCIO_PROPERTY_STATUS

// === PARCEIROS ===

export const PARTNER_CATEGORY_OPTIONS = [
  { value: 'lawyer' as const, label: 'Advogado', icon: 'Scale' },
  { value: 'notary' as const, label: 'Notário', icon: 'Stamp' },
  { value: 'bank' as const, label: 'Banco', icon: 'Landmark' },
  { value: 'photographer' as const, label: 'Fotógrafo', icon: 'Camera' },
  { value: 'constructor' as const, label: 'Empreiteiro', icon: 'HardHat' },
  { value: 'insurance' as const, label: 'Seguros', icon: 'Shield' },
  { value: 'energy_cert' as const, label: 'Cert. Energética', icon: 'Zap' },
  { value: 'cleaning' as const, label: 'Limpezas', icon: 'Sparkles' },
  { value: 'moving' as const, label: 'Mudanças', icon: 'Truck' },
  { value: 'appraiser' as const, label: 'Avaliador', icon: 'ClipboardCheck' },
  { value: 'architect' as const, label: 'Arquitecto', icon: 'Ruler' },
  { value: 'home_staging' as const, label: 'Home Staging', icon: 'Sofa' },
  { value: 'credit_broker' as const, label: 'Interm. Crédito', icon: 'BadgePercent' },
  { value: 'interior_design' as const, label: 'Design Interior', icon: 'Palette' },
  { value: 'marketing' as const, label: 'Marketing', icon: 'Megaphone' },
  { value: 'other' as const, label: 'Outro', icon: 'MoreHorizontal' },
] as const

export const PARTNER_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PARTNER_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
)

export const PARTNER_CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  lawyer:          { bg: 'bg-violet-500/15',  text: 'text-violet-600',  dot: 'bg-violet-500' },
  notary:          { bg: 'bg-indigo-500/15',  text: 'text-indigo-600',  dot: 'bg-indigo-500' },
  bank:            { bg: 'bg-blue-500/15',    text: 'text-blue-600',    dot: 'bg-blue-500' },
  photographer:    { bg: 'bg-pink-500/15',    text: 'text-pink-600',    dot: 'bg-pink-500' },
  constructor:     { bg: 'bg-orange-500/15',  text: 'text-orange-600',  dot: 'bg-orange-500' },
  insurance:       { bg: 'bg-emerald-500/15', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  energy_cert:     { bg: 'bg-yellow-500/15',  text: 'text-yellow-600',  dot: 'bg-yellow-500' },
  cleaning:        { bg: 'bg-cyan-500/15',    text: 'text-cyan-600',    dot: 'bg-cyan-500' },
  moving:          { bg: 'bg-amber-500/15',   text: 'text-amber-600',   dot: 'bg-amber-500' },
  appraiser:       { bg: 'bg-teal-500/15',    text: 'text-teal-600',    dot: 'bg-teal-500' },
  architect:       { bg: 'bg-sky-500/15',     text: 'text-sky-600',     dot: 'bg-sky-500' },
  home_staging:    { bg: 'bg-rose-500/15',    text: 'text-rose-600',    dot: 'bg-rose-500' },
  credit_broker:   { bg: 'bg-lime-500/15',    text: 'text-lime-600',    dot: 'bg-lime-500' },
  interior_design: { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-600', dot: 'bg-fuchsia-500' },
  marketing:       { bg: 'bg-red-500/15',     text: 'text-red-600',     dot: 'bg-red-500' },
  other:           { bg: 'bg-slate-500/15',   text: 'text-slate-600',   dot: 'bg-slate-500' },
}

export const PARTNER_VISIBILITY_OPTIONS = [
  { value: 'public' as const, label: 'Público' },
  { value: 'private' as const, label: 'Privado' },
] as const

export const PARTNER_PAYMENT_OPTIONS = [
  { value: 'transfer' as const, label: 'Transferência' },
  { value: 'check' as const, label: 'Cheque' },
  { value: 'cash' as const, label: 'Numerário' },
  { value: 'other' as const, label: 'Outro' },
] as const

// === VISITAS ===

export const VISIT_STATUS_COLORS = {
  scheduled:  { bg: 'bg-blue-500/15',    text: 'text-blue-600',    dot: 'bg-blue-500',    label: 'Agendada' },
  confirmed:  { bg: 'bg-emerald-500/15', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Confirmada' },
  completed:  { bg: 'bg-slate-500/15',   text: 'text-slate-600',   dot: 'bg-slate-500',   label: 'Realizada' },
  cancelled:  { bg: 'bg-red-500/15',     text: 'text-red-600',     dot: 'bg-red-500',     label: 'Cancelada' },
  no_show:    { bg: 'bg-orange-500/15',  text: 'text-orange-600',  dot: 'bg-orange-500',  label: 'Não Compareceu' },
} as const

export const VISIT_STATUS_OPTIONS = [
  { value: 'scheduled' as const, label: 'Agendada' },
  { value: 'confirmed' as const, label: 'Confirmada' },
  { value: 'completed' as const, label: 'Realizada' },
  { value: 'cancelled' as const, label: 'Cancelada' },
  { value: 'no_show' as const, label: 'Não Compareceu' },
] as const

export const VISIT_FEEDBACK_INTEREST_OPTIONS = [
  { value: 'very_interested' as const, label: 'Muito Interessado' },
  { value: 'interested' as const, label: 'Interessado' },
  { value: 'neutral' as const, label: 'Neutro' },
  { value: 'not_interested' as const, label: 'Sem Interesse' },
] as const

export const VISIT_FEEDBACK_NEXT_STEP_OPTIONS = [
  { value: 'second_visit' as const, label: 'Segunda Visita' },
  { value: 'proposal' as const, label: 'Proposta' },
  { value: 'thinking' as const, label: 'A Pensar' },
  { value: 'discard' as const, label: 'Descartar' },
] as const

export const VISIT_CONFIRMATION_METHOD_OPTIONS = [
  { value: 'whatsapp' as const, label: 'WhatsApp' },
  { value: 'phone' as const, label: 'Telefone' },
  { value: 'email' as const, label: 'Email' },
  { value: 'sms' as const, label: 'SMS' },
] as const

export const VISIT_DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h 30min' },
  { value: 120, label: '2 horas' },
] as const

// === CALENDÁRIO ===

export const CALENDAR_CATEGORY_OPTIONS = [
  { value: 'birthday' as const, label: 'Aniversário' },
  { value: 'vacation' as const, label: 'Férias / Ausência' },
  { value: 'company_event' as const, label: 'Evento de Empresa' },
  { value: 'marketing_event' as const, label: 'Evento de Marketing' },
  { value: 'meeting' as const, label: 'Reunião' },
  { value: 'reminder' as const, label: 'Lembrete' },
  { value: 'custom' as const, label: 'Outro' },
] as const

export const CALENDAR_RECURRENCE_OPTIONS = [
  { value: 'yearly' as const, label: 'Anual' },
  { value: 'monthly' as const, label: 'Mensal' },
  { value: 'weekly' as const, label: 'Semanal' },
] as const

export const CALENDAR_VISIBILITY_OPTIONS = [
  { value: 'all' as const, label: 'Visível para todos' },
  { value: 'team' as const, label: 'Apenas a minha equipa' },
  { value: 'private' as const, label: 'Apenas eu' },
] as const

// Módulos de Permissão — labels PT-PT
export const PERMISSION_MODULES: { key: string; label: string; group: string }[] = [
  // Core
  { key: 'dashboard', label: 'Dashboard', group: 'Core' },
  { key: 'properties', label: 'Imóveis', group: 'Core' },
  { key: 'leads', label: 'Leads', group: 'Core' },
  { key: 'owners', label: 'Proprietários', group: 'Core' },
  { key: 'processes', label: 'Processos', group: 'Core' },
  { key: 'documents', label: 'Documentos', group: 'Core' },
  // Pessoas
  { key: 'consultants', label: 'Consultores', group: 'Pessoas' },
  { key: 'teams', label: 'Equipas', group: 'Pessoas' },
  { key: 'users', label: 'Utilizadores', group: 'Pessoas' },
  { key: 'buyers', label: 'Compradores', group: 'Pessoas' },
  { key: 'recruitment', label: 'Recrutamento', group: 'Pessoas' },
  // Negócio
  { key: 'pipeline', label: 'Pipeline', group: 'Negócio' },
  { key: 'commissions', label: 'Comissões', group: 'Negócio' },
  { key: 'financial', label: 'Financeiro', group: 'Negócio' },
  { key: 'goals', label: 'Objectivos', group: 'Negócio' },
  { key: 'credit', label: 'Crédito', group: 'Negócio' },
  // Sistema
  { key: 'marketing', label: 'Marketing', group: 'Sistema' },
  { key: 'templates', label: 'Templates', group: 'Sistema' },
  { key: 'calendar', label: 'Calendário', group: 'Sistema' },
  { key: 'store', label: 'Loja', group: 'Sistema' },
  { key: 'integration', label: 'Integrações', group: 'Sistema' },
  { key: 'settings', label: 'Definições', group: 'Sistema' },
  { key: 'training', label: 'Formações', group: 'Pessoas' },
] as const

// =============================================
// M17 — Intermediação de Crédito Habitação
// =============================================

// Status do Pedido de Crédito
export const CREDIT_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  novo:                { bg: 'bg-sky-500/15',     text: 'text-sky-500',     dot: 'bg-sky-500',     label: 'Novo' },
  recolha_docs:        { bg: 'bg-amber-500/15',   text: 'text-amber-500',   dot: 'bg-amber-500',   label: 'Recolha de Documentos' },
  analise_financeira:  { bg: 'bg-orange-500/15',  text: 'text-orange-500',  dot: 'bg-orange-500',  label: 'Análise Financeira' },
  submetido_bancos:    { bg: 'bg-blue-500/15',    text: 'text-blue-500',    dot: 'bg-blue-500',    label: 'Submetido a Bancos' },
  pre_aprovado:        { bg: 'bg-indigo-500/15',  text: 'text-indigo-500',  dot: 'bg-indigo-500',  label: 'Pré-Aprovado' },
  aprovado:            { bg: 'bg-emerald-500/15', text: 'text-emerald-500', dot: 'bg-emerald-500', label: 'Aprovado' },
  contratado:          { bg: 'bg-teal-500/15',    text: 'text-teal-500',    dot: 'bg-teal-500',    label: 'Contratado' },
  escriturado:         { bg: 'bg-violet-500/15',  text: 'text-violet-500',  dot: 'bg-violet-500',  label: 'Escriturado' },
  concluido:           { bg: 'bg-green-500/15',   text: 'text-green-500',   dot: 'bg-green-500',   label: 'Concluído' },
  recusado:            { bg: 'bg-red-500/15',     text: 'text-red-500',     dot: 'bg-red-500',     label: 'Recusado' },
  desistencia:         { bg: 'bg-slate-500/15',   text: 'text-slate-500',   dot: 'bg-slate-400',   label: 'Desistência' },
  expirado:            { bg: 'bg-gray-500/15',    text: 'text-gray-500',    dot: 'bg-gray-400',    label: 'Expirado' },
}

export const CREDIT_STATUS_PIPELINE = [
  'novo',
  'recolha_docs',
  'analise_financeira',
  'submetido_bancos',
  'pre_aprovado',
  'aprovado',
  'contratado',
  'escriturado',
  'concluido',
] as const

export const CREDIT_TERMINAL_STATUSES = ['concluido', 'recusado', 'desistencia', 'expirado'] as const

export const PROPOSAL_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  rascunho:     { bg: 'bg-slate-500/15',   text: 'text-slate-500',   dot: 'bg-slate-400',   label: 'Rascunho' },
  submetida:    { bg: 'bg-blue-500/15',    text: 'text-blue-500',    dot: 'bg-blue-500',    label: 'Submetida' },
  em_analise:   { bg: 'bg-amber-500/15',   text: 'text-amber-500',   dot: 'bg-amber-500',   label: 'Em Análise' },
  pre_aprovada: { bg: 'bg-indigo-500/15',  text: 'text-indigo-500',  dot: 'bg-indigo-500',  label: 'Pré-Aprovada' },
  aprovada:     { bg: 'bg-emerald-500/15', text: 'text-emerald-500', dot: 'bg-emerald-500', label: 'Aprovada' },
  recusada:     { bg: 'bg-red-500/15',     text: 'text-red-500',     dot: 'bg-red-500',     label: 'Recusada' },
  expirada:     { bg: 'bg-gray-500/15',    text: 'text-gray-500',    dot: 'bg-gray-400',    label: 'Expirada' },
  aceite:       { bg: 'bg-teal-500/15',    text: 'text-teal-500',    dot: 'bg-teal-500',    label: 'Aceite pelo Cliente' },
  contratada:   { bg: 'bg-green-500/15',   text: 'text-green-500',   dot: 'bg-green-500',   label: 'Contratada' },
}

export const CREDIT_DOC_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pendente:   { bg: 'bg-slate-500/15',   text: 'text-slate-500',   dot: 'bg-slate-400',   label: 'Pendente' },
  solicitado: { bg: 'bg-amber-500/15',   text: 'text-amber-500',   dot: 'bg-amber-500',   label: 'Solicitado' },
  recebido:   { bg: 'bg-blue-500/15',    text: 'text-blue-500',    dot: 'bg-blue-500',    label: 'Recebido' },
  validado:   { bg: 'bg-emerald-500/15', text: 'text-emerald-500', dot: 'bg-emerald-500', label: 'Validado' },
  rejeitado:  { bg: 'bg-red-500/15',     text: 'text-red-500',     dot: 'bg-red-500',     label: 'Rejeitado' },
  expirado:   { bg: 'bg-gray-500/15',    text: 'text-gray-500',    dot: 'bg-gray-400',    label: 'Expirado' },
}

export const CREDIT_DOC_CATEGORY_LABELS: Record<string, string> = {
  identificacao: 'Identificação',
  rendimentos: 'Rendimentos',
  patrimonio: 'Património',
  imovel: 'Imóvel',
  fiscal: 'Fiscal',
  empresa: 'Empresa',
  geral: 'Geral',
}

export const EMPLOYMENT_CONTRACT_OPTIONS = [
  { value: 'efetivo', label: 'Contrato Efectivo (sem termo)' },
  { value: 'termo_certo', label: 'Contrato a Termo Certo' },
  { value: 'termo_incerto', label: 'Contrato a Termo Incerto' },
  { value: 'independente', label: 'Trabalhador Independente' },
  { value: 'reformado', label: 'Reformado/Pensionista' },
  { value: 'outro', label: 'Outro' },
] as const

export const PROPERTY_PURPOSE_OPTIONS = [
  { value: 'habitacao_propria_permanente', label: 'Habitação Própria Permanente' },
  { value: 'habitacao_propria_secundaria', label: 'Habitação Própria Secundária' },
  { value: 'investimento', label: 'Investimento' },
] as const

export const RATE_TYPE_OPTIONS = [
  { value: 'variavel', label: 'Taxa Variável (Euribor + Spread)' },
  { value: 'fixa', label: 'Taxa Fixa' },
  { value: 'mista', label: 'Taxa Mista (fixa + variável)' },
] as const

export const CAPITAL_ORIGIN_OPTIONS = [
  { value: 'poupanca', label: 'Poupança' },
  { value: 'venda_imovel', label: 'Venda de Imóvel' },
  { value: 'doacao', label: 'Doação' },
  { value: 'heranca', label: 'Herança' },
  { value: 'outro', label: 'Outro' },
] as const

export const CIVIL_STATUS_OPTIONS = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado', label: 'Casado(a)' },
  { value: 'uniao_facto', label: 'União de Facto' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' },
] as const

export const CREDIT_ACTIVITY_TYPE_OPTIONS = [
  { value: 'nota', label: 'Nota', icon: 'FileText' },
  { value: 'chamada_banco', label: 'Chamada ao Banco', icon: 'Phone' },
  { value: 'chamada_cliente', label: 'Chamada ao Cliente', icon: 'Phone' },
  { value: 'email_banco', label: 'Email ao Banco', icon: 'Mail' },
  { value: 'email_cliente', label: 'Email ao Cliente', icon: 'Mail' },
  { value: 'reuniao', label: 'Reunião', icon: 'Users' },
  { value: 'documento_recebido', label: 'Documento Recebido', icon: 'FileCheck' },
  { value: 'documento_enviado', label: 'Documento Enviado', icon: 'Send' },
  { value: 'proposta_recebida', label: 'Proposta Recebida', icon: 'FileSpreadsheet' },
  { value: 'avaliacao_imovel', label: 'Avaliação do Imóvel', icon: 'Home' },
  { value: 'escritura', label: 'Escritura', icon: 'FileSignature' },
] as const

export const DEFAULT_PORTUGUESE_BANKS = [
  'CGD', 'Millennium BCP', 'Novo Banco', 'BPI', 'Santander',
  'Bankinter', 'Crédito Agrícola', 'Montepio', 'EuroBic', 'Banco CTT', 'UCI',
] as const

export const EURIBOR_REFERENCE_OPTIONS = [
  { value: 'Euribor 3M', label: 'Euribor 3 Meses' },
  { value: 'Euribor 6M', label: 'Euribor 6 Meses' },
  { value: 'Euribor 12M', label: 'Euribor 12 Meses' },
] as const

export const CREDIT_LIMITS = {
  TAXA_ESFORCO_MAX: 50,
  TAXA_ESFORCO_RECOMENDADO: 35,
  TAXA_ESFORCO_ALERTA: 40,
  LTV_MAX_HPP: 90,
  LTV_MAX_HPS: 80,
  LTV_MAX_INVESTIMENTO: 70,
  LTV_MAX_TERRENO: 50,
  PRAZO_MAX_ANOS: 40,
  IDADE_MAX_FIM_CONTRATO: 75,
  MIN_PROPOSTAS_REGULATORIO: 3,
  IMPOSTO_SELO_CREDITO: 0.006,
  IMPOSTO_SELO_JUROS: 0.04,
  IMPOSTO_SELO_COMISSOES: 0.04,
  EURIBOR_PERIODO_DEFAULT: 6,
} as const

// ─── FORMAÇÕES (Training) ────────────────────────────────

export const TRAINING_DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: 'Iniciante' },
  { value: 'intermediate', label: 'Intermédio' },
  { value: 'advanced', label: 'Avançado' },
] as const

export const TRAINING_DIFFICULTY_COLORS = {
  beginner: { bg: 'bg-emerald-500/15', text: 'text-emerald-500', label: 'Iniciante' },
  intermediate: { bg: 'bg-amber-500/15', text: 'text-amber-500', label: 'Intermédio' },
  advanced: { bg: 'bg-red-500/15', text: 'text-red-500', label: 'Avançado' },
} as const

export const TRAINING_COURSE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived', label: 'Arquivado' },
] as const

export const TRAINING_ENROLLMENT_STATUS = {
  enrolled: { bg: 'bg-sky-500/15', text: 'text-sky-500', dot: 'bg-sky-500', label: 'Inscrito' },
  in_progress: { bg: 'bg-blue-500/15', text: 'text-blue-500', dot: 'bg-blue-500', label: 'Em Progresso' },
  completed: { bg: 'bg-emerald-500/15', text: 'text-emerald-500', dot: 'bg-emerald-500', label: 'Concluído' },
  failed: { bg: 'bg-red-500/15', text: 'text-red-500', dot: 'bg-red-500', label: 'Reprovado' },
  expired: { bg: 'bg-slate-500/15', text: 'text-slate-500', dot: 'bg-slate-500', label: 'Expirado' },
} as const

export const TRAINING_CONTENT_TYPE_OPTIONS = [
  { value: 'video', label: 'Vídeo', icon: 'Play' },
  { value: 'pdf', label: 'PDF', icon: 'FileText' },
  { value: 'text', label: 'Texto', icon: 'AlignLeft' },
  { value: 'external_link', label: 'Link Externo', icon: 'ExternalLink' },
] as const

export const TRAINING_QUESTION_TYPE_OPTIONS = [
  { value: 'single_choice', label: 'Escolha única' },
  { value: 'multiple_choice', label: 'Escolha múltipla' },
  { value: 'true_false', label: 'Verdadeiro / Falso' },
] as const

export const TRAINING_NOTIFICATION_LABELS: Record<string, string> = {
  new_course: 'Nova Formação',
  course_assigned: 'Formação Atribuída',
  deadline_reminder: 'Lembrete de Prazo',
  certificate_expiring: 'Certificado a Expirar',
  quiz_passed: 'Quiz Aprovado',
  quiz_failed: 'Quiz Reprovado',
  course_completed: 'Formação Concluída',
  new_comment_reply: 'Nova Resposta',
}

export const TRAINING_CATEGORY_SUGGESTIONS = [
  'Comercial',
  'Processual',
  'Marketing',
  'Liderança',
  'Jurídico / Legal',
  'Tecnologia / Ferramentas',
  'Desenvolvimento Pessoal',
  'Onboarding',
] as const

// --- Encomendas (Materiais Físicos & Stock) ---

export const REQUISITION_STATUS = {
  pending:             { bg: 'bg-amber-500/15',   text: 'text-amber-500',   dot: 'bg-amber-500',   label: 'Pendente' },
  approved:            { bg: 'bg-blue-500/15',    text: 'text-blue-500',    dot: 'bg-blue-500',    label: 'Aprovada' },
  rejected:            { bg: 'bg-red-500/15',     text: 'text-red-500',     dot: 'bg-red-500',     label: 'Rejeitada' },
  in_production:       { bg: 'bg-purple-500/15',  text: 'text-purple-500',  dot: 'bg-purple-500',  label: 'Em Produção' },
  ready:               { bg: 'bg-emerald-500/15', text: 'text-emerald-500', dot: 'bg-emerald-500', label: 'Pronta' },
  delivered:           { bg: 'bg-green-500/15',   text: 'text-green-500',   dot: 'bg-green-500',   label: 'Entregue' },
  cancelled:           { bg: 'bg-slate-500/15',   text: 'text-slate-500',   dot: 'bg-slate-500',   label: 'Cancelada' },
  partially_delivered: { bg: 'bg-teal-500/15',    text: 'text-teal-500',    dot: 'bg-teal-500',    label: 'Entrega Parcial' },
} as const

export const SUPPLIER_ORDER_STATUS = {
  draft:              { bg: 'bg-slate-500/15',   text: 'text-slate-500',   dot: 'bg-slate-400',   label: 'Rascunho' },
  sent:               { bg: 'bg-blue-500/15',    text: 'text-blue-500',    dot: 'bg-blue-500',    label: 'Enviada' },
  confirmed:          { bg: 'bg-indigo-500/15',  text: 'text-indigo-500',  dot: 'bg-indigo-500',  label: 'Confirmada' },
  in_production:      { bg: 'bg-purple-500/15',  text: 'text-purple-500',  dot: 'bg-purple-500',  label: 'Em Produção' },
  shipped:            { bg: 'bg-amber-500/15',   text: 'text-amber-500',   dot: 'bg-amber-500',   label: 'Expedida' },
  partially_received: { bg: 'bg-teal-500/15',    text: 'text-teal-500',    dot: 'bg-teal-500',    label: 'Recepção Parcial' },
  received:           { bg: 'bg-emerald-500/15', text: 'text-emerald-500', dot: 'bg-emerald-500', label: 'Recebida' },
  cancelled:          { bg: 'bg-red-500/15',     text: 'text-red-500',     dot: 'bg-red-500',     label: 'Cancelada' },
} as const

export const REQUISITION_PRIORITY = {
  low:    { bg: 'bg-slate-500/15',  text: 'text-slate-500',  label: 'Baixa' },
  normal: { bg: 'bg-blue-500/15',   text: 'text-blue-500',   label: 'Normal' },
  high:   { bg: 'bg-orange-500/15', text: 'text-orange-500', label: 'Alta' },
  urgent: { bg: 'bg-red-500/15',    text: 'text-red-500',    label: 'Urgente' },
} as const

export const DELIVERY_TYPE_LABELS = {
  pickup:   'Recolha no Escritório',
  delivery: 'Entrega em Morada',
} as const

export const RETURN_CONDITION_LABELS = {
  good:      'Bom Estado (Reutilizável)',
  damaged:   'Danificado',
  destroyed: 'Destruído',
} as const

export const STOCK_MOVEMENT_LABELS = {
  in_purchase:     'Entrada (Compra)',
  in_return:       'Entrada (Devolução)',
  in_adjustment:   'Entrada (Ajuste Manual)',
  out_requisition: 'Saída (Requisição)',
  out_damage:      'Saída (Dano/Perda)',
  out_adjustment:  'Saída (Ajuste Manual)',
} as const

export const ENCOMENDA_LABELS = {
  pageTitle: 'Encomendas',
  catalog: 'Catálogo',
  myRequisitions: 'Minhas Requisições',
  management: 'Gestão',
  stock: 'Stock',
  suppliers: 'Fornecedores',
  supplierOrders: 'Encomendas a Fornecedores',
  reports: 'Relatórios',
  newRequisition: 'Nova Requisição',
  newProduct: 'Novo Produto',
  newSupplier: 'Novo Fornecedor',
  newSupplierOrder: 'Nova Encomenda',
  noProducts: 'Nenhum produto encontrado',
  noRequisitions: 'Nenhuma requisição encontrada',
  noSuppliers: 'Nenhum fornecedor encontrado',
  confirmDelete: 'Tem a certeza de que pretende eliminar?',
} as const

export const PRODUCT_CATEGORY_ICONS: Record<string, string> = {
  signpost: 'Signpost',
  'credit-card': 'CreditCard',
  'file-text': 'FileText',
  gift: 'Gift',
  flag: 'Flag',
  presentation: 'Presentation',
  'pen-tool': 'PenTool',
} as const

// ─── Marketing Subscriptions ────────────────────────────

export const SUBSCRIPTION_STATUS = {
  active:         { bg: 'bg-emerald-500/15', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Activa' },
  paused:         { bg: 'bg-amber-500/15',   text: 'text-amber-600',   dot: 'bg-amber-500',   label: 'Pausada' },
  cancelled:      { bg: 'bg-slate-500/15',   text: 'text-slate-500',   dot: 'bg-slate-500',   label: 'Cancelada' },
  expired:        { bg: 'bg-red-500/15',     text: 'text-red-500',     dot: 'bg-red-500',     label: 'Expirada' },
  billing_failed: { bg: 'bg-red-500/15',     text: 'text-red-600',     dot: 'bg-red-500',     label: 'Falha de Cobrança' },
} as const

export const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: '/mês',
  quarterly: '/trimestre',
  yearly: '/ano',
}

export const CALENDAR_EVENT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  service_scheduled:    { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-500' },
  purchase:             { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  subscription_renewal: { bg: 'bg-purple-100',  text: 'text-purple-800',  dot: 'bg-purple-500' },
}

// ─── Marketing Campaigns ────────────────────────────────

export const CAMPAIGN_OBJECTIVES: Record<string, string> = {
  notoriedade: 'Notoriedade',
  trafego: 'Tráfego',
  leads: 'Geração de Leads',
  conversoes: 'Conversões',
}

export const CAMPAIGN_STATUS = {
  pending:   { bg: 'bg-amber-500/15',   text: 'text-amber-600',   dot: 'bg-amber-500',   label: 'Pendente' },
  approved:  { bg: 'bg-blue-500/15',    text: 'text-blue-600',    dot: 'bg-blue-500',    label: 'Aprovada' },
  active:    { bg: 'bg-emerald-500/15', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Activa' },
  paused:    { bg: 'bg-amber-500/15',   text: 'text-amber-600',   dot: 'bg-amber-500',   label: 'Pausada' },
  completed: { bg: 'bg-slate-500/15',   text: 'text-slate-500',   dot: 'bg-slate-500',   label: 'Concluída' },
  rejected:  { bg: 'bg-red-500/15',     text: 'text-red-600',     dot: 'bg-red-500',     label: 'Rejeitada' },
  cancelled: { bg: 'bg-slate-500/15',   text: 'text-slate-500',   dot: 'bg-slate-500',   label: 'Cancelada' },
} as const

export const PAYMENT_METHODS: Record<string, string> = {
  conta_corrente: 'Conta Corrente',
  invoice: 'Fatura',
}
