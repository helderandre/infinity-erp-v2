// ============================================================
// constants-automations.ts — Constantes para o sistema de automações
// Mapeia nomes técnicos de tabelas/colunas/operadores para labels PT-PT
// ============================================================

import type { SupabaseQueryOperation } from "@/lib/types/automation-flow"

// ── Opções de Tabela (Select assistido) ──

export const TABLE_OPTIONS = [
  { value: "leads",             label: "Leads / Contactos",          icon: "Users",         description: "Contactos e potenciais clientes" },
  { value: "dev_properties",    label: "Imóveis",                    icon: "Home",          description: "Propriedades no sistema" },
  { value: "owners",            label: "Proprietários",              icon: "UserCheck",     description: "Donos de imóveis" },
  { value: "proc_instances",    label: "Processos",                  icon: "ClipboardList", description: "Instâncias de processos activos" },
  { value: "proc_tasks",        label: "Tarefas de Processo",        icon: "CheckSquare",   description: "Tarefas individuais de processos" },
  { value: "negocios",          label: "Negócios / Oportunidades",   icon: "Briefcase",     description: "Negócios de compra/venda/arrendamento" },
  { value: "dev_users",         label: "Consultores / Utilizadores", icon: "UserCog",       description: "Equipa e consultores" },
  { value: "doc_registry",      label: "Documentos",                 icon: "FileText",      description: "Documentos carregados no sistema" },
  { value: "tpl_email_library", label: "Templates de Email",         icon: "Mail",          description: "Templates de email guardados" },
  { value: "notifications",     label: "Notificações",               icon: "Bell",          description: "Notificações do sistema" },
  { value: "log_emails",        label: "Histórico de Emails",        icon: "MailCheck",     description: "Emails enviados pelo sistema" },
] as const

export type TableOptionValue = (typeof TABLE_OPTIONS)[number]["value"]

// ── Labels amigáveis para colunas por tabela ──

export const COLUMN_LABELS: Record<string, Record<string, string>> = {
  leads: {
    id: "ID",
    nome: "Nome",
    email: "Email",
    telefone: "Telefone",
    telemovel: "Telemóvel",
    origem: "Origem",
    estado: "Estado",
    temperatura: "Temperatura",
    observacoes: "Observações",
    created_at: "Data de criação",
    updated_at: "Data de actualização",
    assigned_agent_id: "Consultor atribuído",
    lead_type: "Tipo de lead",
    status: "Estado",
    priority: "Prioridade",
    score: "Pontuação",
    source: "Origem",
    source_detail: "Detalhe da origem",
    language: "Idioma",
    business_type: "Tipo de negócio",
    property_id: "Imóvel associado",
    property_reference: "Referência do imóvel",
    name: "Nome",
    phone_primary: "Telefone principal",
    phone_secondary: "Telefone secundário",
    first_contacted_at: "Primeiro contacto",
    qualified_at: "Data de qualificação",
  },
  dev_properties: {
    id: "ID",
    title: "Título",
    external_ref: "Referência",
    listing_price: "Preço",
    city: "Cidade",
    zone: "Zona",
    status: "Estado",
    property_type: "Tipo de imóvel",
    business_type: "Tipo de negócio",
    consultant_id: "Consultor",
    description: "Descrição",
    slug: "Slug",
    energy_certificate: "Certificado energético",
    property_condition: "Condição",
    business_status: "Estado do negócio",
    contract_regime: "Regime contratual",
    address_parish: "Freguesia",
    address_street: "Morada",
    postal_code: "Código postal",
    latitude: "Latitude",
    longitude: "Longitude",
    created_at: "Data de criação",
    updated_at: "Data de actualização",
  },
  owners: {
    id: "ID",
    name: "Nome",
    email: "Email",
    phone: "Telefone",
    nif: "NIF",
    person_type: "Tipo de pessoa",
    address: "Morada",
    nationality: "Nacionalidade",
    marital_status: "Estado civil",
    observations: "Observações",
    created_at: "Data de criação",
  },
  proc_instances: {
    id: "ID",
    external_ref: "Referência",
    current_status: "Estado actual",
    percent_complete: "Progresso (%)",
    property_id: "Imóvel",
    tpl_process_id: "Template do processo",
    current_stage_id: "Fase actual",
    started_at: "Data de início",
    completed_at: "Data de conclusão",
    updated_at: "Data de actualização",
  },
  proc_tasks: {
    id: "ID",
    title: "Título",
    status: "Estado",
    is_mandatory: "Obrigatória",
    is_bypassed: "Ignorada",
    assigned_to: "Atribuída a",
    due_date: "Data limite",
    completed_at: "Data de conclusão",
    stage_name: "Fase",
    stage_order_index: "Ordem da fase",
  },
  negocios: {
    id: "ID",
    tipo: "Tipo",
    estado: "Estado",
    lead_id: "Lead",
    orcamento: "Orçamento",
    preco_venda: "Preço de venda",
    localizacao: "Localização",
    created_at: "Data de criação",
    updated_at: "Data de actualização",
  },
  dev_users: {
    id: "ID",
    commercial_name: "Nome comercial",
    professional_email: "Email profissional",
    is_active: "Activo",
    role_id: "Role",
    created_at: "Data de criação",
  },
  doc_registry: {
    id: "ID",
    file_name: "Nome do ficheiro",
    file_url: "URL do ficheiro",
    status: "Estado",
    property_id: "Imóvel",
    doc_type_id: "Tipo de documento",
    uploaded_by: "Carregado por",
    valid_until: "Válido até",
    created_at: "Data de criação",
  },
  tpl_email_library: {
    id: "ID",
    name: "Nome",
    subject: "Assunto",
    description: "Descrição",
    body_html: "Corpo HTML",
  },
  notifications: {
    id: "ID",
    recipient_id: "Destinatário",
    title: "Título",
    body: "Corpo",
    entity_type: "Tipo de entidade",
    created_at: "Data de criação",
  },
  log_emails: {
    id: "ID",
    recipient_email: "Email do destinatário",
    subject: "Assunto",
    delivery_status: "Estado de entrega",
    sent_at: "Enviado em",
    proc_task_id: "Tarefa do processo",
  },
}

// ── Labels de operações em linguagem natural ──

export const OPERATION_OPTIONS: {
  value: SupabaseQueryOperation
  label: string
  sublabel: string
  icon: string
}[] = [
  { value: "select",  label: "Buscar dados",        sublabel: "Encontrar informação no sistema", icon: "Search" },
  { value: "update",  label: "Actualizar dados",     sublabel: "Modificar informação existente",  icon: "Pencil" },
  { value: "insert",  label: "Criar registo",        sublabel: "Adicionar novo ao sistema",       icon: "Plus" },
  { value: "upsert",  label: "Criar ou actualizar",  sublabel: "Se existe, muda. Se não, cria.",  icon: "RefreshCw" },
  { value: "delete",  label: "Remover registo",       sublabel: "Apagar dados do sistema",         icon: "Trash2" },
  { value: "rpc",     label: "Executar função",       sublabel: "Operação avançada",               icon: "Zap" },
]

// ── Operadores de filtro em linguagem natural PT-PT ──

export const FILTER_OPERATORS = [
  { value: "eq",     label: "é igual a" },
  { value: "neq",    label: "é diferente de" },
  { value: "gt",     label: "é maior que" },
  { value: "lt",     label: "é menor que" },
  { value: "gte",    label: "é maior ou igual a" },
  { value: "lte",    label: "é menor ou igual a" },
  { value: "like",   label: "contém" },
  { value: "is",     label: "está vazio" },
  { value: "not_is", label: "não está vazio" },
  { value: "in",     label: "é um de" },
] as const

// ── Opções de entidade para trigger de mudança de estado ──

export const ENTITY_OPTIONS = [
  { value: "lead",     label: "Lead / Contacto",     table: "leads",          statusField: "estado" },
  { value: "process",  label: "Processo",             table: "proc_instances", statusField: "current_status" },
  { value: "deal",     label: "Negócio",              table: "negocios",       statusField: "estado" },
  { value: "property", label: "Imóvel",               table: "dev_properties", statusField: "status" },
] as const

// ── Valores possíveis de estado por entidade.campo ──

export const STATUS_VALUES: Record<string, { value: string; label: string }[]> = {
  "leads.estado": [
    { value: "new",       label: "Novo" },
    { value: "contacted", label: "Contactado" },
    { value: "qualified", label: "Qualificado" },
    { value: "archived",  label: "Arquivado" },
    { value: "expired",   label: "Expirado" },
  ],
  "proc_instances.current_status": [
    { value: "draft",             label: "Rascunho" },
    { value: "pending_approval",  label: "Pendente aprovação" },
    { value: "approved",          label: "Aprovado" },
    { value: "in_progress",       label: "Em progresso" },
    { value: "completed",         label: "Concluído" },
    { value: "cancelled",         label: "Cancelado" },
  ],
  "negocios.estado": [
    { value: "Novo",              label: "Novo" },
    { value: "Em negociação",     label: "Em negociação" },
    { value: "Proposta enviada",  label: "Proposta enviada" },
    { value: "Fechado",           label: "Fechado" },
    { value: "Perdido",           label: "Perdido" },
  ],
  "dev_properties.status": [
    { value: "pending_approval",  label: "Pendente aprovação" },
    { value: "active",            label: "Activo" },
    { value: "available",         label: "Disponível" },
    { value: "reserved",          label: "Reservado" },
    { value: "sold",              label: "Vendido" },
    { value: "rented",            label: "Arrendado" },
    { value: "cancelled",         label: "Cancelado" },
  ],
}

// ── Tipos de parâmetros RPC ──

export const RPC_PARAM_TYPES = [
  { value: "text",    label: "Texto" },
  { value: "uuid",    label: "UUID" },
  { value: "int",     label: "Inteiro" },
  { value: "jsonb",   label: "JSONB" },
  { value: "boolean", label: "Booleano" },
] as const

// ── Helper: obter label amigável de uma tabela ──

export function getTableLabel(table: string): string {
  const option = TABLE_OPTIONS.find((t) => t.value === table)
  return option?.label ?? table
}

// ── Helper: obter label amigável de uma coluna ──

export function getColumnLabel(table: string, column: string): string {
  return COLUMN_LABELS[table]?.[column] ?? column
}

// ── Helper: obter label amigável de um operador de filtro ──

export function getFilterOperatorLabel(operator: string): string {
  const op = FILTER_OPERATORS.find((o) => o.value === operator)
  return op?.label ?? operator
}

// ── Helper: obter label amigável de uma operação ──

export function getOperationLabel(operation: SupabaseQueryOperation): string {
  const op = OPERATION_OPTIONS.find((o) => o.value === operation)
  return op?.label ?? operation
}
