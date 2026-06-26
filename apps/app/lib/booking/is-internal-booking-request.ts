import { createClient } from '@/lib/supabase/server'

/**
 * `true` quando o pedido traz uma sessão autenticada (consultor interno do ERP).
 *
 * Os endpoints públicos de agendamento (`/api/visita/[slug]/info` e `/slots`)
 * estão atrás de um opt-in (`consultant_booking_settings.public_booking_enabled`)
 * para visitantes anónimos. Porém, o fluxo interno "Solicitar visita"
 * (RequestVisitDialog) reutiliza esses mesmos endpoints — e um consultor
 * autenticado deve poder sempre pedir visita a um colega, mesmo que o
 * agendamento público não esteja activo nesse imóvel. Este helper distingue
 * os dois casos: com sessão → interno (contorna o opt-in); sem sessão →
 * visitante público (opt-in aplica-se).
 */
export async function isInternalBookingRequest(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return !!data.user
  } catch {
    return false
  }
}
