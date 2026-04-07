/**
 * Fonte única de verdade para agrupamentos de roles.
 * Qualquer ficheiro que precise verificar roles por nome deve importar daqui.
 */

/** Roles com acesso total (superadmin) */
export const ADMIN_ROLES = ['admin', 'Broker/CEO'] as const

/** Roles que podem aprovar/rejeitar/pausar/cancelar/devolver processos */
export const PROCESS_MANAGER_ROLES = ['Broker/CEO', 'Gestor Processual', 'admin'] as const

/** Roles que podem criar/remover tarefas ad-hoc e reverter tarefas concluídas */
export const ADHOC_TASK_ROLES = ['admin', 'Broker/CEO', 'Gestor Processual'] as const

/** Roles consideradas "consultores" (não back-office/admin) */
export const CONSULTANT_ROLES = ['Consultor', 'Consultora Executiva', 'Team Leader'] as const

/** Roles que podem ser responsáveis por um imóvel ou processo (consultores + brokers) */
export const PROPERTY_RESPONSIBLE_ROLES = [
  'Consultor',
  'Consultora Executiva',
  'Team Leader',
  'Broker/CEO',
] as const

/** Roles que recebem notificações de aprovação/gestão */
export const APPROVER_NOTIFICATION_ROLES = ['Broker/CEO', 'Gestor Processual'] as const

/** Roles com acesso a TODAS as caixas de email (podem ver e enviar de qualquer conta) */
export const EMAIL_ADMIN_ROLES = ['admin', 'Broker/CEO', 'Gestor Processual'] as const

/** Roles que podem ver e gerir TODAS as instâncias WhatsApp */
export const WHATSAPP_ADMIN_ROLES = ['admin', 'Broker/CEO', 'Gestor Processual'] as const

/** Lista completa de todos os módulos de permissão */
export const ALL_PERMISSION_MODULES = [
  'dashboard', 'properties', 'leads', 'processes', 'documents',
  'consultants', 'owners', 'teams', 'commissions', 'marketing',
  'templates', 'settings', 'goals', 'store', 'users', 'buyers',
  'credit', 'calendar', 'pipeline', 'financial', 'integration', 'recruitment',
  'training',
] as const

/** Todos os agrupamentos disponíveis (para referência) */
export const ROLE_GROUPS = {
  admin: ADMIN_ROLES,
  processManager: PROCESS_MANAGER_ROLES,
  adhocTask: ADHOC_TASK_ROLES,
  consultant: CONSULTANT_ROLES,
  approverNotification: APPROVER_NOTIFICATION_ROLES,
  emailAdmin: EMAIL_ADMIN_ROLES,
  whatsappAdmin: WHATSAPP_ADMIN_ROLES,
} as const
