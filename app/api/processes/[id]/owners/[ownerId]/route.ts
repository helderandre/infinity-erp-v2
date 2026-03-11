import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { recalculateProgress } from '@/lib/process-engine'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * DELETE: Remove um proprietário do fluxo de um processo.
 *
 * - Elimina todas as proc_subtasks com owner_id deste owner
 * - Elimina todas as proc_tasks com owner_id deste owner (Estratégia A)
 * - Regista actividade em proc_task_activities
 * - Recalcula progresso do processo
 *
 * NÃO remove o owner da property_owners nem elimina o registo do owner.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; ownerId: string }> }
) {
  try {
    const { id: processId, ownerId } = await params

    if (!UUID_REGEX.test(processId)) {
      return NextResponse.json({ error: 'processId inválido' }, { status: 400 })
    }
    if (!UUID_REGEX.test(ownerId)) {
      return NextResponse.json({ error: 'ownerId inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 1. Verificar que o processo existe
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('id, tpl_process_id, property_id, current_status')
      .eq('id', processId)
      .single()

    if (procError || !proc) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    // 2. Buscar o owner para o nome (para a actividade)
    const { data: owner } = await supabase
      .from('owners')
      .select('id, name')
      .eq('id', ownerId)
      .single()

    if (!owner) {
      return NextResponse.json({ error: 'Proprietário não encontrado' }, { status: 404 })
    }

    // 3. Buscar todas as proc_tasks do processo
    const { data: procTasks } = await adminSupabase
      .from('proc_tasks')
      .select('id, owner_id')
      .eq('proc_instance_id', processId)

    if (!procTasks || procTasks.length === 0) {
      return NextResponse.json({
        success: true,
        subtasks_removed: 0,
        tasks_removed: 0,
        owner_name: owner.name,
      })
    }

    const allTaskIds = procTasks.map((t) => t.id)

    // 4. Contar subtarefas que vão ser removidas (para a resposta)
    const { count: subtaskCount } = await adminSupabase
      .from('proc_subtasks')
      .select('id', { count: 'exact', head: true })
      .in('proc_task_id', allTaskIds)
      .eq('owner_id', ownerId)

    // 5. Buscar IDs das proc_tasks afectadas (para registar actividade)
    const { data: affectedSubtasks } = await adminSupabase
      .from('proc_subtasks')
      .select('proc_task_id')
      .in('proc_task_id', allTaskIds)
      .eq('owner_id', ownerId)

    const affectedTaskIds = [...new Set((affectedSubtasks || []).map((s) => s.proc_task_id))]

    // 6. Eliminar proc_subtasks com owner_id
    const { error: deleteSubError } = await adminSupabase
      .from('proc_subtasks')
      .delete()
      .in('proc_task_id', allTaskIds)
      .eq('owner_id', ownerId)

    if (deleteSubError) {
      console.error('Erro ao eliminar subtarefas do owner:', deleteSubError)
      return NextResponse.json(
        { error: 'Erro ao eliminar subtarefas do proprietário' },
        { status: 500 }
      )
    }

    // 7. Eliminar proc_tasks com owner_id (Estratégia A — tasks owner-specific)
    const ownerTasks = procTasks.filter((t) => t.owner_id === ownerId)
    let tasksRemoved = 0

    if (ownerTasks.length > 0) {
      const ownerTaskIds = ownerTasks.map((t) => t.id)
      // Primeiro eliminar subtarefas dessas tasks (podem ter subtarefas sem owner_id)
      await adminSupabase
        .from('proc_subtasks')
        .delete()
        .in('proc_task_id', ownerTaskIds)

      const { error: deleteTaskError } = await adminSupabase
        .from('proc_tasks')
        .delete()
        .in('id', ownerTaskIds)

      if (deleteTaskError) {
        console.error('Erro ao eliminar tasks do owner:', deleteTaskError)
      } else {
        tasksRemoved = ownerTasks.length
      }
    }

    // 8. Registar actividade nas proc_tasks afectadas
    const totalRemoved = (subtaskCount ?? 0) + tasksRemoved
    if (affectedTaskIds.length > 0) {
      const activities = affectedTaskIds
        .filter((taskId) => !ownerTasks.some((t) => t.id === taskId)) // só tasks que ainda existem
        .map((taskId) => ({
          proc_task_id: taskId,
          activity_type: 'owner_removed',
          description: `Proprietário "${owner.name}" removido do fluxo (${subtaskCount ?? 0} subtarefa(s) eliminada(s))`,
          user_id: user.id,
          metadata: {
            owner_id: ownerId,
            owner_name: owner.name,
            subtasks_removed: subtaskCount ?? 0,
            tasks_removed: tasksRemoved,
          },
        }))

      if (activities.length > 0) {
        const { error: actError } = await adminSupabase
          .from('proc_task_activities')
          .insert(activities)

        if (actError) {
          console.error('Erro ao registar actividade:', actError)
          // Não falhar — a remoção já ocorreu
        }
      }
    }

    // 9. Recalcular progresso do processo
    try {
      await recalculateProgress(processId)
    } catch (e) {
      console.error('Erro ao recalcular progresso:', e)
    }

    return NextResponse.json({
      success: true,
      subtasks_removed: subtaskCount ?? 0,
      tasks_removed: tasksRemoved,
      total_removed: totalRemoved,
      owner_name: owner.name,
    })
  } catch (error) {
    console.error('Erro ao remover proprietário do processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
