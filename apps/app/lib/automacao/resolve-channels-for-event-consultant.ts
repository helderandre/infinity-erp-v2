/**
 * Fonte única de verdade para o estado "efectivo" de cada canal dado
 * um evento (lista `channels`) e a disponibilidade de contas/instâncias
 * do consultor.
 *
 * Usado por:
 *   - `GET /api/automacao/custom-events/[id]` (payload `effective_channels`)
 *   - `GET /api/crm/contact-automations-scheduled` (badges da tabela)
 *   - `AutomationDetailSheet` (chips no header + Info section)
 *
 * Estados possíveis:
 *   - 'active'       — canal incluído no evento E consultor tem conta/instância activa.
 *   - 'unavailable'  — canal incluído no evento MAS consultor não tem conta/instância.
 *   - 'off'          — canal NÃO incluído no evento (ignorado).
 *
 * Puro: sem efeitos colaterais, sem DB. Recebe já os counts.
 */

export type ChannelState = "active" | "unavailable" | "off"

export interface ChannelAccounts {
  /** Nº de consultant_email_accounts activos do consultor. */
  email_count: number
  /** Nº de auto_wpp_instances conectadas do consultor. */
  wpp_count: number
}

export interface EventChannels {
  /** Canais seleccionados no evento (pode conter 'email'|'whatsapp'). */
  channels: string[]
}

export interface ResolvedChannels {
  email: ChannelState
  whatsapp: ChannelState
}

export function resolveChannels(
  event: EventChannels,
  accounts: ChannelAccounts,
): ResolvedChannels {
  const includesEmail = event.channels.includes("email")
  const includesWpp = event.channels.includes("whatsapp")

  return {
    email: !includesEmail
      ? "off"
      : accounts.email_count > 0
        ? "active"
        : "unavailable",
    whatsapp: !includesWpp
      ? "off"
      : accounts.wpp_count > 0
        ? "active"
        : "unavailable",
  }
}
