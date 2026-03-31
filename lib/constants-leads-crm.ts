// lib/constants-leads-crm.ts — Constants for the CRM Leads System (PT-PT)

import type {
  PipelineType,
  EntrySource,
  ActivityType,
  ReferralType,
  ReferralStatus,
  PartnerType,
  CampaignPlatform,
  CampaignStatus,
  TagCategory,
  ActivityDirection,
} from '@/types/leads-crm'

// =============================================================================
// Pipeline Types
// =============================================================================

export const PIPELINE_TYPE_LABELS: Record<PipelineType, string> = {
  comprador: 'Comprador',
  vendedor: 'Vendedor',
  arrendatario: 'Arrendatário',
  arrendador: 'Senhorio',
}

export const PIPELINE_TYPE_DESCRIPTIONS: Record<PipelineType, string> = {
  comprador: 'Pipeline para clientes que querem comprar imóvel',
  vendedor: 'Pipeline para proprietários que querem vender',
  arrendatario: 'Pipeline para clientes que querem arrendar',
  arrendador: 'Pipeline para senhorios que querem colocar para arrendamento',
}

export const PIPELINE_TYPE_ICONS: Record<PipelineType, string> = {
  comprador: 'ShoppingCart',
  vendedor: 'Store',
  arrendatario: 'Key',
  arrendador: 'Building',
}

export const PIPELINE_TYPE_COLORS: Record<PipelineType, { bg: string; text: string; border: string }> = {
  comprador: { bg: 'bg-blue-500/15', text: 'text-blue-600', border: 'border-blue-500' },
  vendedor: { bg: 'bg-emerald-500/15', text: 'text-emerald-600', border: 'border-emerald-500' },
  arrendatario: { bg: 'bg-purple-500/15', text: 'text-purple-600', border: 'border-purple-500' },
  arrendador: { bg: 'bg-amber-500/15', text: 'text-amber-600', border: 'border-amber-500' },
}

// =============================================================================
// Entry Sources
// =============================================================================

export const ENTRY_SOURCE_LABELS: Record<EntrySource, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  website: 'Website',
  landing_page: 'Landing Page',
  partner: 'Parceiro',
  organic: 'Organico',
  walk_in: 'Presencial',
  phone_call: 'Chamada Telefonica',
  social_media: 'Redes Sociais',
  other: 'Outro',
}

export const ENTRY_SOURCE_ICONS: Record<EntrySource, string> = {
  meta_ads: 'Facebook',
  google_ads: 'Search',
  website: 'Globe',
  landing_page: 'FileText',
  partner: 'Handshake',
  organic: 'Leaf',
  walk_in: 'MapPin',
  phone_call: 'Phone',
  social_media: 'Share2',
  other: 'MoreHorizontal',
}

// =============================================================================
// Activity Types
// =============================================================================

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: 'Chamada',
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  note: 'Nota',
  visit: 'Visita',
  stage_change: 'Mudanca de Fase',
  assignment: 'Atribuicao',
  lifecycle_change: 'Mudanca de Ciclo',
  system: 'Sistema',
}

export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  call: 'Phone',
  email: 'Mail',
  whatsapp: 'MessageCircle',
  sms: 'MessageSquare',
  note: 'StickyNote',
  visit: 'MapPin',
  stage_change: 'ArrowRight',
  assignment: 'UserPlus',
  lifecycle_change: 'RefreshCw',
  system: 'Cog',
}

export const ACTIVITY_TYPE_COLORS: Record<ActivityType, string> = {
  call: 'text-green-600',
  email: 'text-blue-600',
  whatsapp: 'text-emerald-600',
  sms: 'text-purple-600',
  note: 'text-amber-600',
  visit: 'text-rose-600',
  stage_change: 'text-indigo-600',
  assignment: 'text-cyan-600',
  lifecycle_change: 'text-orange-600',
  system: 'text-slate-500',
}

export const ACTIVITY_DIRECTION_LABELS: Record<ActivityDirection, string> = {
  inbound: 'Recebido',
  outbound: 'Enviado',
}

// =============================================================================
// Referral
// =============================================================================

export const REFERRAL_TYPE_LABELS: Record<ReferralType, string> = {
  internal: 'Interna',
  partner_inbound: 'Parceiro',
}

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  pending: 'Pendente',
  accepted: 'Aceite',
  rejected: 'Rejeitada',
  converted: 'Convertida',
  lost: 'Perdida',
}

export const REFERRAL_STATUS_COLORS: Record<ReferralStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-500/15', text: 'text-amber-600' },
  accepted: { bg: 'bg-blue-500/15', text: 'text-blue-600' },
  rejected: { bg: 'bg-red-500/15', text: 'text-red-600' },
  converted: { bg: 'bg-emerald-500/15', text: 'text-emerald-600' },
  lost: { bg: 'bg-slate-500/15', text: 'text-slate-600' },
}

// =============================================================================
// Partners
// =============================================================================

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  advogado: 'Advogado',
  banco: 'Banco',
  particular: 'Particular',
  agencia: 'Agencia',
  construtor: 'Construtor',
  outro: 'Outro',
}

// =============================================================================
// Campaigns
// =============================================================================

export const CAMPAIGN_PLATFORM_LABELS: Record<CampaignPlatform, string> = {
  meta: 'Meta (Facebook/Instagram)',
  google: 'Google Ads',
  website: 'Website',
  landing_page: 'Landing Page',
  other: 'Outro',
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  active: 'Activa',
  paused: 'Pausada',
  ended: 'Terminada',
}

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, { bg: string; text: string }> = {
  active: { bg: 'bg-emerald-500/15', text: 'text-emerald-600' },
  paused: { bg: 'bg-amber-500/15', text: 'text-amber-600' },
  ended: { bg: 'bg-slate-500/15', text: 'text-slate-600' },
}

// =============================================================================
// Tags
// =============================================================================

export const TAG_CATEGORY_LABELS: Record<TagCategory, string> = {
  lifecycle: 'Ciclo de Vida',
  interest: 'Interesse',
  campaign: 'Campanha',
  custom: 'Personalizada',
}

// =============================================================================
// Contact Lifecycle — default stage names (for UI reference)
// =============================================================================

export const DEFAULT_LIFECYCLE_STAGES = [
  { name: 'Lead', description: 'Contacto novo, ainda nao qualificado', color: '#3b82f6' },
  { name: 'Potencial Cliente', description: 'Qualificado, demonstra interesse', color: '#f59e0b' },
  { name: 'Cliente', description: 'Pelo menos 1 negocio activo ou fechado', color: '#10b981' },
  { name: 'Cliente Recorrente', description: '2 ou mais negocios fechados', color: '#8b5cf6' },
  { name: 'Inactivo', description: 'Sem actividade durante periodo prolongado', color: '#6b7280' },
] as const

// =============================================================================
// Lost Reasons (predefined options for quick selection)
// =============================================================================

export const LOST_REASONS = [
  'Nao responde',
  'Sem interesse',
  'Comprou com outra agencia',
  'Vendeu com outra agencia',
  'Arrendou com outra agencia',
  'Preco fora do orcamento',
  'Desistiu do projecto',
  'Nao qualificado',
  'Duplicado',
  'Spam',
  'Outro',
] as const

// =============================================================================
// Formatters
// =============================================================================

export function formatPipelineType(type: PipelineType): string {
  return PIPELINE_TYPE_LABELS[type] || type
}

export function formatEntrySource(source: EntrySource): string {
  return ENTRY_SOURCE_LABELS[source] || source
}

export function formatActivityType(type: ActivityType): string {
  return ACTIVITY_TYPE_LABELS[type] || type
}

export function formatReferralStatus(status: ReferralStatus): string {
  return REFERRAL_STATUS_LABELS[status] || status
}

/**
 * Derive a PipelineType from the raw `tipo` column of the `negocios` table.
 * The `negocios.tipo` values (e.g. 'Compra', 'Venda', 'Arrendatário', 'Arrendador')
 * map to the CRM pipeline types used in the kanban.
 */
export function derivePipelineTypeFromTipo(tipo?: string | null): PipelineType {
  if (!tipo) return 'comprador'
  const t = tipo.toLowerCase()
  if (t.includes('venda') || t.includes('vendedor')) return 'vendedor'
  if (t.includes('arrendador') || t.includes('senhorio')) return 'arrendador'
  if (t.includes('arrendat')) return 'arrendatario'
  // 'Compra', 'comprador', 'buyer', etc.
  return 'comprador'
}
