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
