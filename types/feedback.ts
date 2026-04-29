export interface FeedbackSubmission {
  id: string
  type: 'ticket' | 'ideia'
  title: string
  description: string | null
  voice_url: string | null
  images: string[]
  status: FeedbackStatus
  priority: number
  submitted_by: string | null
  tech_notes: string | null
  assigned_to: string | null
  /** Página/área onde o utilizador detectou o problema ou pensou na ideia.
   *  Slug correspondente a `FEEDBACK_PAGES` (ou `null` para entradas antigas
   *  pré-feature). */
  page: FeedbackPage | null
  created_at: string
  updated_at: string
}

export interface FeedbackWithRelations extends FeedbackSubmission {
  submitter?: { id: string; commercial_name: string } | null
  assignee?: { id: string; commercial_name: string } | null
}

export type FeedbackStatus = 'novo' | 'em_analise' | 'em_desenvolvimento' | 'concluido' | 'rejeitado'

export const FEEDBACK_STATUS_MAP: Record<FeedbackStatus, { label: string; bg: string; text: string; dot: string }> = {
  novo: { label: 'Novo', bg: 'bg-sky-100', text: 'text-sky-800', dot: 'bg-sky-500' },
  em_analise: { label: 'Em Análise', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
  em_desenvolvimento: { label: 'Em Desenvolvimento', bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
  concluido: { label: 'Concluído', bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  rejeitado: { label: 'Rejeitado', bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
}

export const FEEDBACK_TYPE_LABELS = {
  ticket: 'Ticket',
  ideia: 'Ideia',
} as const

export const FEEDBACK_PIPELINE_COLUMNS: FeedbackStatus[] = [
  'novo', 'em_analise', 'em_desenvolvimento', 'concluido', 'rejeitado',
]

/**
 * Lista canónica de páginas/áreas da app que o utilizador pode escolher ao
 * reportar um bug ou ideia. Slug é estável (vai para a base) — labels podem
 * ser ajustados livremente. Manter sincronizado com `pathPrefixToFeedbackPage`
 * abaixo, que faz o auto-detect a partir do `pathname`.
 */
export const FEEDBACK_PAGES = [
  { slug: 'dashboard', label: 'Dashboard' },
  { slug: 'crm', label: 'CRM / Pipeline' },
  { slug: 'leads', label: 'Contactos' },
  { slug: 'negocios', label: 'Negócios' },
  { slug: 'imoveis', label: 'Imóveis' },
  { slug: 'processos', label: 'Processos' },
  { slug: 'tarefas', label: 'Tarefas' },
  { slug: 'calendario', label: 'Calendário' },
  { slug: 'documentos', label: 'Documentos' },
  { slug: 'marketing', label: 'Marketing' },
  { slug: 'whatsapp', label: 'WhatsApp' },
  { slug: 'email', label: 'Email' },
  { slug: 'comunicacao', label: 'Chat interno' },
  { slug: 'formacoes', label: 'Formações' },
  { slug: 'objetivos', label: 'Objectivos' },
  { slug: 'consultores', label: 'Consultores' },
  { slug: 'parceiros', label: 'Parceiros' },
  { slug: 'acessos', label: 'Acessos' },
  { slug: 'financeiro', label: 'Financeiro' },
  { slug: 'definicoes', label: 'Definições / Perfil' },
  { slug: 'outra', label: 'Outra zona' },
] as const

export type FeedbackPage = (typeof FEEDBACK_PAGES)[number]['slug']

export const FEEDBACK_PAGE_LABELS: Record<FeedbackPage, string> = FEEDBACK_PAGES.reduce(
  (acc, p) => {
    acc[p.slug] = p.label
    return acc
  },
  {} as Record<FeedbackPage, string>,
)

/**
 * Resolve o `pathname` actual do utilizador para o slug da página
 * correspondente em FEEDBACK_PAGES. Devolve `null` se não bater (ex.: rotas
 * fora de /dashboard). O caller pode usar isto para pré-seleccionar o
 * select do diálogo de feedback.
 */
export function pathnameToFeedbackPage(pathname: string | null | undefined): FeedbackPage | null {
  if (!pathname) return null
  const m = pathname.match(/^\/dashboard\/?([^/?#]*)/)
  if (!m) return null
  const segment = m[1] || ''
  if (!segment) return 'dashboard'
  // Mapping de segments → slug; a maioria coincide directamente.
  const map: Record<string, FeedbackPage> = {
    crm: 'crm',
    leads: 'leads',
    negocios: 'negocios',
    imoveis: 'imoveis',
    processos: 'processos',
    tarefas: 'tarefas',
    calendario: 'calendario',
    documentos: 'documentos',
    marketing: 'marketing',
    whatsapp: 'whatsapp',
    email: 'email',
    comunicacao: 'comunicacao',
    formacoes: 'formacoes',
    objetivos: 'objetivos',
    consultores: 'consultores',
    parceiros: 'parceiros',
    acessos: 'acessos',
    financeiro: 'financeiro',
    definicoes: 'definicoes',
    perfil: 'definicoes',
    tech: 'definicoes',
  }
  return map[segment] ?? null
}
