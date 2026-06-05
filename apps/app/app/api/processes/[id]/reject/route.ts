import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/permissions'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

const rejectSchema = z.object({
  reason: z.string().min(5, 'Indica o motivo da rejeição').max(2000),
})

/**
 * POST /api/processes/[id]/reject
 *
 * Rejeição definitiva do processo. Setta `current_status='rejected'` +
 * grava motivo em `returned_reason` (reuso de coluna existente). O imóvel
 * volta a `pending_approval` se estava `in_process`.
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
    const validation = rejectSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('current_status, property_id')
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

    const { error: updateError } = await supabase
      .from('proc_instances')
      .update({
        current_status: 'rejected',
        returned_reason: validation.data.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao rejeitar processo', details: updateError.message },
        { status: 500 }
      )
    }

    // Reverter status do imóvel se aplicável
    if (proc.property_id) {
      const { data: property } = await supabase
        .from('dev_properties')
        .select('status')
        .eq('id', proc.property_id)
        .single()
      if (property?.status === 'in_process') {
        await supabase
          .from('dev_properties')
          .update({ status: 'pending_approval' })
          .eq('id', proc.property_id)
      }
    }

    return NextResponse.json({ success: true, message: 'Processo rejeitado' })
  } catch (error) {
    console.error('Erro ao rejeitar processo:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
