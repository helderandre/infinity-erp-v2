// Sistema de Cores e Labels para Status (PT-PT)

export const STATUS_COLORS = {
  // Propriedades
  pending_approval: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    label: 'Pendente Aprovação',
  },
  active: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    label: 'Activo',
  },
  sold: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
    label: 'Vendido',
  },
  rented: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    dot: 'bg-indigo-500',
    label: 'Arrendado',
  },
  suspended: {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    dot: 'bg-slate-500',
    label: 'Suspenso',
  },
  cancelled: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    dot: 'bg-red-500',
    label: 'Cancelado',
  },

  // Leads
  new: {
    bg: 'bg-sky-100',
    text: 'text-sky-800',
    dot: 'bg-sky-500',
    label: 'Novo',
  },
  contacted: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    dot: 'bg-yellow-500',
    label: 'Contactado',
  },
  qualified: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    label: 'Qualificado',
  },
  archived: {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    dot: 'bg-slate-500',
    label: 'Arquivado',
  },
  expired: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    dot: 'bg-red-500',
    label: 'Expirado',
  },

  // Tarefas de Processo
  pending: {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    dot: 'bg-slate-400',
    label: 'Pendente',
  },
  in_progress: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
    label: 'Em Progresso',
  },
  completed: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    label: 'Concluído',
  },
  skipped: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    dot: 'bg-orange-500',
    label: 'Ignorado',
  },

  // Prioridade Leads
  low: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    label: 'Baixa',
  },
  medium: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    label: 'Média',
  },
  high: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    label: 'Alta',
  },
  urgent: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    label: 'Urgente',
  },

  // Documentos
  received: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'Recebido',
  },
  validated: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    label: 'Validado',
  },
  rejected: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    label: 'Rejeitado',
  },
} as const

// Status de Propriedades (Visibilidade e Ciclo de Vida)
export const PROPERTY_STATUS = {
  pending_approval: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    label: 'Pendente Aprovação',
  },
  in_process: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    dot: 'bg-yellow-500',
    label: 'Em Processo',
  },
  active: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    label: 'Activo',
  },
  reserved: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    dot: 'bg-purple-500',
    label: 'Reservado',
  },
  sold: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
    label: 'Vendido',
  },
  rented: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    dot: 'bg-indigo-500',
    label: 'Arrendado',
  },
  suspended: {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    dot: 'bg-slate-500',
    label: 'Suspenso',
  },
  cancelled: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    dot: 'bg-red-500',
    label: 'Cancelado',
  },
} as const

// Status de Processos (Workflow)
export const PROCESS_STATUS = {
  pending_approval: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    label: 'Pendente Aprovação',
  },
  returned: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    dot: 'bg-orange-500',
    label: 'Devolvido',
  },
  active: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
    label: 'Em Andamento',
  },
  on_hold: {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    dot: 'bg-slate-500',
    label: 'Pausado',
  },
  completed: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    label: 'Concluído',
  },
  rejected: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    dot: 'bg-red-500',
    label: 'Rejeitado',
  },
  cancelled: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    dot: 'bg-red-500',
    label: 'Cancelado',
  },
} as const

// Status de Tarefas (Execução)
export const TASK_STATUS = {
  pending: {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    dot: 'bg-slate-400',
    label: 'Pendente',
  },
  in_progress: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
    label: 'Em Progresso',
  },
  completed: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    label: 'Concluída',
  },
  skipped: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
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

// Tipos de Acção de Tarefa
export const ACTION_TYPES = {
  UPLOAD: 'Upload de Documento',
  EMAIL: 'Envio de Email',
  GENERATE_DOC: 'Gerar Documento',
  MANUAL: 'Tarefa Manual',
} as const

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
  'Piscina',
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
  'Elevador',
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
