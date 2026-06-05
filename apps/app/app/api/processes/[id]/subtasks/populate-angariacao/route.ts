import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'
import { populateSubtasks } from '@/lib/processes/subtasks/populate'
import { logTaskActivity } from '@/lib/processes/activity-logger'

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * POST /api/processes/[id]/subtasks/populate-angariacao
 *
 * Materializa as rules hardcoded de angariação em `proc_subtasks`.
 * Sync, não-transaccional, idempotente via `proc_subtasks_dedup`.
 *
 * Autorização: consultor do imóvel, OU caller com permissão `pipeline`
 * (broker, office manager, gestora processual, etc.).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'ID de processo inválido' }, { status: 400 })
  }

  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const admin = createAdminClient()

  // Carregar processo + consultor do imóvel para validar autorização + kind.
  const { data: proc, error: procErr } = await admin
    .from('proc_instances')
    .select('id, process_type, external_ref, property:dev_properties(consultant_id)')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (procErr || !proc) {
    return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
  }

  const processType = (proc as unknown as { process_type: string | null }).process_type
  const externalRef = (proc as unknown as { external_ref: string | null }).external_ref

  const isAngariacao =
    processType === 'angariacao' ||
    (externalRef ? externalRef.startsWith('PROC-ANG-') : false)

  if (!isAngariacao) {
    return NextResponse.json(
      { error: 'Este endpoint só aplica a processos de angariação' },
      { status: 400 }
    )
  }

  const consultantId =
    (proc as unknown as { property: { consultant_id: string | null } | null })
      .property?.consultant_id ?? null

  const hasPipelinePermission = auth.permissions.pipeline === true
  const isConsultant = consultantId === auth.user.id

  if (!hasPipelinePermission && !isConsultant) {
    return NextResponse.json(
      { error: 'Apenas o consultor do processo ou utilizadores com permissão "pipeline" podem popular subtarefas' },
      { status: 403 }
    )
  }

  const result = await populateSubtasks(admin, id, 'angariacao')

  // Emitir activity 'subtasks_populated' quando houve inserts novos.
  // Agregada na primeira proc_task que recebeu rows (reflecte o evento
  // como um único acontecimento de auditoria).
  if (result.inserted > 0) {
    const { data: firstTask } = await admin
      .from('proc_tasks')
      .select('id')
      .eq('proc_instance_id', id)
      .order('order_index', { ascending: true })
      .limit(1)
      .single()

    if (firstTask?.id) {
      await logTaskActivity(
        admin,
        firstTask.id,
        auth.user.id,
        'subtasks_populated' as never,
        `Subtarefas hardcoded materializadas (${result.inserted})`,
        {
          count: result.inserted,
          skipped: result.skipped,
          failed: result.failed,
          process_type: 'angariacao',
        }
      )
    }
  }

  // Auditoria log_audit
  await admin.from('log_audit').insert({
    user_id: auth.user.id,
    entity_type: 'proc_subtask',
    entity_id: id,
    action: 'subtask.populate',
    new_data: { process_type: 'angariacao', ...result },
  })

  return NextResponse.json({
    ok: true,
    inserted: result.inserted,
    skipped: result.skipped,
    failed: result.failed,
  })
}
