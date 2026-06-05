/**
 * Helpers for the "Gestora de Leads" role — the consultor who also manages the
 * unattributed Meta lead pool ("Por atribuir") and distributes it.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>

export const GESTORA_LEADS_ROLE = 'Gestora de Leads'

/**
 * User ids of everyone holding the "Gestora de Leads" role. Used to route
 * push/notifications for leads that arrive without an attribution rule.
 */
export async function getGestoraLeadsUserIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from('user_roles')
    .select('user_id, roles!inner(name)')
    .eq('roles.name', GESTORA_LEADS_ROLE)
  return Array.from(
    new Set((data ?? []).map((r: { user_id: string | null }) => r.user_id).filter(Boolean) as string[]),
  )
}
