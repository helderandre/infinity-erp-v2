/**
 * Helpers para notificar destinatários de um evento de calendário —
 * usados pelo POST de `/api/calendar/events` quando o criador escolhe
 * `notify_mode='push'` (envia web-push aos destinatários da visibilidade)
 * ou `notify_mode='chat'` (posta uma mensagem no canal global de chat).
 */

import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>

interface EventForNotify {
  id: string
  title: string
  start_date: string
  end_date?: string | null
  all_day?: boolean | null
  location?: string | null
  visibility?: string | null
  visibility_mode?: 'all' | 'include' | 'exclude' | null
  visibility_user_ids?: string[] | null
  visibility_role_names?: string[] | null
  created_by?: string | null
}

/**
 * Constrói a mensagem PT-PT padrão para o canal global de chat. O criador
 * pode editá-la livremente no form — esta é só a versão pré-preenchida.
 *
 * Formato:
 *   📅 *{title}*
 *   {data formatada} (· {hora}–{hora_fim})
 *   📍 {local}            (linha opcional)
 *   — partilhado por {creatorName}
 */
export function buildDefaultChatMessage(
  event: Pick<EventForNotify, 'title' | 'start_date' | 'end_date' | 'all_day' | 'location'>,
  creatorName?: string | null,
): string {
  const start = parseISO(event.start_date)
  const dateLine = event.all_day
    ? format(start, "EEEE, d 'de' MMMM", { locale: pt })
    : `${format(start, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: pt })}${
        event.end_date ? ` – ${format(parseISO(event.end_date), 'HH:mm')}` : ''
      }`

  const lines = [`📅 *${event.title}*`, capitalise(dateLine)]
  if (event.location) lines.push(`📍 ${event.location}`)
  if (creatorName) lines.push(`— partilhado por ${creatorName}`)
  return lines.join('\n')
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Resolve a lista de user_ids que devem receber notificação push para um
 * dado evento, baseado na sua visibilidade. Devolve sempre um Set; o
 * criador é excluído (não vale a pena auto-notificar).
 *
 * Regras (mapeiam directamente o filtro de leitura em /api/calendar/events):
 *   - visibility='private'             → vazio (UI já bloqueia mas defensivo)
 *   - visibility_mode='all'            → todos os utilizadores activos
 *   - visibility_mode='include'        → users do array ∪ users com role
 *   - visibility_mode='exclude'        → todos activos menos (users + roles)
 */
export async function resolveEventAudience(
  admin: SupabaseClient,
  event: EventForNotify,
): Promise<Set<string>> {
  if (event.visibility === 'private') return new Set()

  const mode = event.visibility_mode ?? 'all'
  const userIds = event.visibility_user_ids ?? []
  const roleNames = event.visibility_role_names ?? []
  const creatorId = event.created_by ?? null

  // Helper: ids de TODOS os utilizadores activos.
  const fetchAllActive = async (): Promise<string[]> => {
    const { data } = await admin
      .from('dev_users')
      .select('id')
      .eq('is_active', true)
    return (data ?? []).map((u: { id: string }) => u.id)
  }

  // Helper: ids dos utilizadores que têm pelo menos um dos roles indicados.
  const fetchByRoles = async (roles: string[]): Promise<string[]> => {
    if (roles.length === 0) return []
    const { data } = await admin
      .from('user_roles')
      .select('user_id, role:roles!inner(name)')
      .in('role.name', roles)
    return Array.from(new Set((data ?? []).map((r: { user_id: string }) => r.user_id)))
  }

  let result: Set<string>
  if (mode === 'all') {
    result = new Set(await fetchAllActive())
  } else if (mode === 'include') {
    const fromRoles = await fetchByRoles(roleNames)
    result = new Set([...userIds, ...fromRoles])
  } else {
    const all = new Set(await fetchAllActive())
    const exclude = new Set([...userIds, ...(await fetchByRoles(roleNames))])
    for (const id of exclude) all.delete(id)
    result = all
  }

  if (creatorId) result.delete(creatorId)
  return result
}
