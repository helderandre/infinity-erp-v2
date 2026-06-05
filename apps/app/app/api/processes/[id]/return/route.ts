import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/permissions'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

const returnSchema = z.object({
  reason: z.string().min(5, 'Indica o motivo da devolução').max(2000),
})

/**
 * POST /api/processes/[id]/return
 *
 * Devolve o processo ao consultor para corrigir/completar dados, sem
 * o rejeitar definitivamente. Setta `current_status='returned'` +
 * `returned_reason`. O consultor pode editar e re-submeter.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireRoles(PROCESS_MANAGER_ROLES)
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const body = await request.json()
    const validation = returnSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('current_status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (procError || !proc) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    if (proc.current_status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'Este processo não está pendente de aprovação' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from('proc_instances')
      .update({
        current_status: 'returned',
        returned_reason: validation.data.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao devolver processo', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Processo devolvido' })
  } catch (error) {
    console.error('Erro ao devolver processo:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
