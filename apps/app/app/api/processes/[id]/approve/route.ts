import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/permissions'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'
import { autoActivateProcess } from '@/lib/processes/auto-activate'

/**
 * POST /api/processes/[id]/approve
 *
 * Aprovação manual pela gestão. Reusa o helper `autoActivateProcess` —
 * resolve o template, popula tasks/subtasks, marca approved_by/at, flipa
 * o imóvel para `in_process`. Idempotente: se o processo já estiver
 * `active` ou `completed`, devolve 400.
 *
 * Reintroduzido em 2026-06-XX após o refactor que removeu este endpoint
 * (4918230) — a UI de gestão precisa de um botão para destrancar processos
 * presos em `pending_approval`/`returned`.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireRoles(PROCESS_MANAGER_ROLES)
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('current_status, property_id, process_type')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (procError || !proc) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    if (!['pending_approval', 'returned'].includes(proc.current_status ?? '')) {
      return NextResponse.json(
        { error: 'Este processo não está pendente de aprovação' },
        { status: 400 }
      )
    }

    const processType = (proc.process_type as 'angariacao' | 'negocio') ?? 'angariacao'

    try {
      const result = await autoActivateProcess({
        instanceId: id,
        processType,
        approverId: auth.user.id,
        propertyId: proc.property_id ?? null,
      })
      return NextResponse.json({
        success: true,
        message: 'Processo aprovado com sucesso',
        template_name: result.template_name,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao aprovar processo'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  } catch (error) {
    console.error('Erro ao aprovar processo:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
