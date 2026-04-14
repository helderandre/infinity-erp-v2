// ============================================================
// whatsapp-template.ts — Tipos para templates WhatsApp
// Fase 2 do Sistema de Automações
// ============================================================

import type { WhatsAppMessageType } from "./automation-flow"

// ── Template de mensagem WhatsApp (armazenado em auto_wpp_templates) ──

export interface WhatsAppTemplateMessage {
  id: string
  type: WhatsAppMessageType
  content: string
  mediaUrl?: string
  docName?: string
  delay?: number
}

export interface WhatsAppTemplate {
  id: string
  name: string
  description?: string
  category: WhatsAppTemplateCategory
  tags: string[]
  messages: WhatsAppTemplateMessage[]
  created_by: string
  instance_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type WhatsAppTemplateCategory =
  | "boas_vindas"
  | "follow_up"
  | "lembrete"
  | "documentos"
  | "notificacao"
  | "marketing"
  | "outro"
  // Categorias canónicas partilhadas com contact_automations (lib/constants-template-categories.ts)
  | "aniversario_contacto"
  | "aniversario_fecho"
  | "natal"
  | "ano_novo"
  | "festividade"
  | "custom"
  | "geral"

export const TEMPLATE_CATEGORY_LABELS: Record<WhatsAppTemplateCategory, string> = {
  boas_vindas: "Boas-vindas",
  follow_up: "Follow-up",
  lembrete: "Lembrete",
  documentos: "Documentos",
  notificacao: "Notificação",
  marketing: "Marketing",
  outro: "Outro",
  aniversario_contacto: "Aniversário do contacto",
  aniversario_fecho: "Aniversário de fecho",
  natal: "Natal",
  ano_novo: "Ano Novo",
  festividade: "Festividade",
  custom: "Personalizado",
  geral: "Geral",
}

// ── Instância WhatsApp (armazenado em auto_wpp_instances) ──

export type WhatsAppConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "not_found"

export interface WhatsAppInstance {
  id: string
  name: string
  uazapi_token: string
  uazapi_instance_id?: string | null
  status: "active" | "inactive"
  connection_status: WhatsAppConnectionStatus
  phone?: string | null
  profile_name?: string | null
  profile_pic_url?: string | null
  is_business?: boolean
  user_id?: string | null
  created_at: string
  updated_at: string
  // Computed fields (from joins/API)
  flow_count?: number
  user?: { id: string; commercial_name: string } | null
}

export const CONNECTION_STATUS_LABELS: Record<WhatsAppConnectionStatus, string> = {
  disconnected: "Desconectado",
  connecting: "A conectar",
  connected: "Conectado",
  not_found: "Não encontrado",
}

export const CONNECTION_STATUS_COLORS: Record<
  WhatsAppConnectionStatus,
  { bg: string; text: string; dot: string }
> = {
  disconnected: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
  connecting: { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500" },
  connected: { bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-500" },
  not_found: { bg: "bg-slate-100", text: "text-slate-800", dot: "bg-slate-400" },
}

/** @deprecated Use WhatsAppConnectionStatus instead */
export type WhatsAppInstanceStatus = WhatsAppConnectionStatus

/** @deprecated Use CONNECTION_STATUS_LABELS instead */
export const INSTANCE_STATUS_LABELS = CONNECTION_STATUS_LABELS

/** @deprecated Use CONNECTION_STATUS_COLORS instead */
export const INSTANCE_STATUS_COLORS = CONNECTION_STATUS_COLORS

// ── Payload para envio via Uazapi ──

export interface UazapiSendPayload {
  number: string
  delay?: number
  readchat?: boolean
  replyid?: string
  track_source?: string
  track_id?: string
}

export interface UazapiSendTextPayload extends UazapiSendPayload {
  text: string
}

export interface UazapiSendMediaPayload extends UazapiSendPayload {
  type: WhatsAppMessageType
  url: string
  text?: string
  docName?: string
}

export interface UazapiSendPollPayload extends UazapiSendPayload {
  type: 'poll'
  text: string
  choices: string[]
  selectableCount?: number
}

export interface UazapiSendContactPayload extends UazapiSendPayload {
  fullName: string
  phoneNumber: string
  organization?: string
  email?: string
  url?: string
}
