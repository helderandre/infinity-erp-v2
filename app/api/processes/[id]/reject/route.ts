import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { notificationService } from '@/lib/notifications/service'

const rejectSchema = z.object({
  reason: z.string().min(10, 'O motivo deve ter pelo menos 10 caracteres'),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar permissões
    const { data: devUser } = await supabase
      .from('dev_users')
      .select(
        `
        *,
        user_roles!user_roles_user_id_fkey!inner(
          role:roles(name)
        )
      `
      )
      .eq('id', user.id)
      .single()

    const userRoles = ((devUser as any)?.user_roles || []).map(
      (ur: any) => ur.role?.name
    ) as string[]
    const canReject = userRoles.some((role) =>
      ['Broker/CEO', 'Gestora Processual', 'admin'].includes(role)
    )

    if (!canReject) {
      return NextResponse.json(
        { error: 'Sem permissão para rejeitar processos' },
        { status: 403 }
      )
    }

    // Parse e validação
    const body = await request.json()
    const validation = rejectSchema.safeParse(body)
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
      .select('current_status, requested_by, external_ref, property:dev_properties(id)')
      .eq('id', id)
      .single()

    if (procError || !proc) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    if (proc.current_status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'Apenas processos pendentes podem ser rejeitados' },
        { status: 400 }
      )
    }

    // Actualizar processo para rejected
    const { error: updateError } = await supabase
      .from('proc_instances')
      .update({
        current_status: 'rejected',
        rejected_reason: reason,
        rejected_at: new Date().toISOString(),
        rejected_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao rejeitar processo', details: updateError.message },
        { status: 500 }
      )
    }

    // Actualizar status do imóvel para cancelled
    const { error: propertyError } = await supabase
      .from('dev_properties')
      .update({ status: 'cancelled' })
      .eq('id', (proc as any).property.id)

    if (propertyError) {
      console.error('Erro ao actualizar status do imóvel:', propertyError)
    }

    // Notificar consultor que criou o processo
    try {
      if ((proc as any).requested_by && (proc as any).requested_by !== user.id) {
        await notificationService.create({
          recipientId: (proc as any).requested_by,
          senderId: user.id,
          notificationType: 'process_rejected',
          entityType: 'proc_instance',
          entityId: id,
          title: 'Processo rejeitado',
          body: `O processo ${(proc as any).external_ref || ''} foi rejeitado: ${reason}`,
          actionUrl: `/dashboard/processos/${id}`,
          metadata: {
            process_ref: (proc as any).external_ref,
            reason,
          },
        })
      }
    } catch (notifError) {
      console.error('[REJECT] Erro ao enviar notificação:', notifError)
    }

    return NextResponse.json({
      success: true,
      message: 'Processo rejeitado com sucesso',
    })
  } catch (error) {
    console.error('Erro ao rejeitar processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
