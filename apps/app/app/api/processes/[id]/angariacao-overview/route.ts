import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/processes/[id]/angariacao-overview
 *
 * Calcula o estado dos 5 passos do modelo plano de angariação a partir do
 * estado REAL das proc_subtasks (mapeadas por subtask_key). Devolve o
 * `progressOrder` (1..6) para a timeline da "Nova vista".
 *
 * Um passo está concluído quando tem ≥1 subtarefa correspondente e todas
 * estão completas. progressOrder = primeiro passo não-concluído (1-based);
 * 6 quando todos concluídos.
 */

const STEP_MAP: { key: string; subtaskKeys: string[] }[] = [
  { key: 'pedido_documentacao', subtaskKeys: ['email_pedido_doc'] },
  {
    key: 'recolha_documentos',
    subtaskKeys: [
      'upload_certificado_energetico',
      'upload_caderneta_predial_urbana',
      'upload_certidao_permanente',
      'upload_licenca_utilizacao',
      'upload_ficha_tecnica_habitacao',
      'upload_planta_imovel',
      'upload_cc_passaporte_singular',
      'upload_cc_passaporte_representante_legal',
      'upload_certidao_comercial_empresa',
      'upload_rcbe',
      'upload_ficha_branqueamento_capitais_singular',
      'upload_ficha_branqueamento_empresa',
    ],
  },
  { key: 'geracao_cmi', subtaskKeys: ['geracao_cmi'] },
  { key: 'envio_cmi', subtaskKeys: ['email_envio_cmi'] },
  { key: 'cmi_assinado', subtaskKeys: ['upload_cmi_digitalizado'] },
]

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
    }

    const { data: tasks } = await (
      db.from('proc_tasks') as ReturnType<typeof supabase.from>
    )
      .select('id')
      .eq('proc_instance_id', id)

    const taskIds = ((tasks ?? []) as { id: string }[]).map((t) => t.id)

    let subs: { subtask_key: string; is_completed: boolean | null }[] = []
    if (taskIds.length > 0) {
      const { data } = await (
        db.from('proc_subtasks') as ReturnType<typeof supabase.from>
      )
        .select('subtask_key, is_completed')
        .in('proc_task_id', taskIds)
      subs = (data ?? []) as typeof subs
    }

    const steps = STEP_MAP.map(({ key, subtaskKeys }) => {
      const matching = subs.filter((s) => subtaskKeys.includes(s.subtask_key))
      const total = matching.length
      const done = matching.filter((s) => s.is_completed).length
      const complete = total > 0 && done === total
      return { key, total, done, complete }
    })

    const firstIncomplete = steps.findIndex((s) => !s.complete)
    const progressOrder =
      firstIncomplete === -1 ? steps.length + 1 : firstIncomplete + 1

    return NextResponse.json({ progressOrder, steps })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
