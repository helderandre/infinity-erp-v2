import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { notificationService } from '@/lib/notifications/service'
import { requireRoles } from '@/lib/auth/permissions'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

const returnSchema = z.object({
  reason: z.string().min(10, 'O motivo deve ter pelo menos 10 caracteres'),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Autenticação + verificação de roles
    const auth = await requireRoles(PROCESS_MANAGER_ROLES)
    if (!auth.authorized) return auth.response
    const user = auth.user

    const supabase = await createClient()

    // Parse e validação
    const body = await request.json()
    const validation = returnSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { reason } = validation.data

    // Verificar se o processo existe e está em pending_approval
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('current_status, requested_by, external_ref')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (procError || !proc) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    if (proc.current_status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'Apenas processos pendentes podem ser devolvidos' },
        { status: 400 }
      )
    }

    // Actualizar processo para returned
    const { error: updateError } = await supabase
      .from('proc_instances')
      .update({
        current_status: 'returned',
        returned_reason: reason,
        returned_at: new Date().toISOString(),
        returned_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao devolver processo', details: updateError.message },
        { status: 500 }
      )
    }

    // Notificar consultor que criou o processo
    try {
      if ((proc as any).requested_by && (proc as any).requested_by !== user.id) {
        await notificationService.create({
          recipientId: (proc as any).requested_by,
          senderId: user.id,
          notificationType: 'process_returned',
          entityType: 'proc_instance',
          entityId: id,
          title: 'Processo devolvido',
          body: `O processo ${(proc as any).external_ref || ''} foi devolvido: ${reason}`,
          actionUrl: `/dashboard/processos/${id}`,
          metadata: {
            process_ref: (proc as any).external_ref,
            reason,
          },
        })
      }
    } catch (notifError) {
      console.error('[RETURN] Erro ao enviar notificação:', notifError)
    }

    return NextResponse.json({
      success: true,
      message: 'Processo devolvido com sucesso',
    })
  } catch (error) {
    console.error('Erro ao devolver processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
