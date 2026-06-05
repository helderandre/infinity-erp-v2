/**
 * Helpers de visibilidade/autorização para o módulo de tarefas.
 *
 * Regra base aplicada nas APIs (`/api/tasks`, `/api/tasks/[id]`, `/api/tasks/stats`):
 * - Gestão (admin, Broker/CEO, Gestor Processual, Office Manager, Team Leader)
 *   vê tudo.
 * - Restantes (consultor) só vêem tarefas onde estão envolvidos:
 *   - tasks gerais: `assigned_to=self` OU `created_by=self`
 *   - proc_tasks/proc_subtasks: `assigned_to=self`
 *   - tarefas dentro duma lista partilhada de que são membros: todas
 */

type SupabaseLike = {
  from: (table: string) => any
}

/**
 * Verifica se um utilizador é membro duma `task_lists` row — owner ou
 * partilhada com ele via `task_list_shares`. NULL-safe: lista inexistente
 * devolve false sem throw.
 */
export async function isTaskListMember(
  supabase: SupabaseLike,
  listId: string,
  userId: string,
): Promise<boolean> {
  const { data: list } = await supabase
    .from('task_lists')
    .select('owner_id')
    .eq('id', listId)
    .maybeSingle()
  if (!list) return false
  if (list.owner_id === userId) return true

  const { data: share } = await supabase
    .from('task_list_shares')
    .select('user_id')
    .eq('list_id', listId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!share
}
