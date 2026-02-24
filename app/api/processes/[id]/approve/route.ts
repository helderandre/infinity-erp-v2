import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { autoCompleteTasks, recalculateProgress } from '@/lib/process-engine'
import { z } from 'zod'
import { notificationService } from '@/lib/notifications/service'

const approveSchema = z.object({
  tpl_process_id: z.string().min(1, 'Template obrigatório').regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    'Formato de ID inválido'
  ),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('[APPROVE] Início — process id:', id)

    const supabase = await createClient()

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log('[APPROVE] Auth falhou:', authError?.message)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    console.log('[APPROVE] User autenticado:', user.id)

    // Verificar permissões (apenas Broker/CEO ou Gestora Processual)
    const { data: devUser, error: devUserError } = await supabase
      .from('dev_users')
      .select(
        `
        *,
        user_roles!user_roles_user_id_fkey!inner(
          role:roles(name, permissions)
        )
      `
      )
      .eq('id', user.id)
      .single()

    console.log('[APPROVE] devUser:', devUser ? 'encontrado' : 'null', 'erro:', devUserError?.message)

    const userRoles = ((devUser as any)?.user_roles || []).map(
      (ur: any) => ur.role?.name
    ) as string[]
    console.log('[APPROVE] Roles do user:', userRoles)

    const canApprove = userRoles.some((role) =>
      ['Broker/CEO', 'Gestora Processual', 'admin'].includes(role)
    )

    if (!canApprove) {
      console.log('[APPROVE] Sem permissão — roles:', userRoles)
      return NextResponse.json(
        { error: 'Sem permissão para aprovar processos' },
        { status: 403 }
      )
    }

    // Parse e validação do body
    console.log('[APPROVE] Request method:', request.method)
    console.log('[APPROVE] Content-Type:', request.headers.get('content-type'))
    console.log('[APPROVE] Content-Length:', request.headers.get('content-length'))
    console.log('[APPROVE] Body used?:', request.bodyUsed)

    const rawText = await request.text()
    console.log('[APPROVE] Raw body text:', JSON.stringify(rawText))
    console.log('[APPROVE] Raw body length:', rawText.length)

    if (!rawText || rawText.length === 0) {
      return NextResponse.json(
        { error: 'Body vazio — nenhum dado recebido' },
        { status: 400 }
      )
    }

    const body = JSON.parse(rawText)
    console.log('[APPROVE] Body parsed:', JSON.stringify(body))

    const validation = approveSchema.safeParse(body)
    if (!validation.success) {
      console.log('[APPROVE] Validação falhou:', validation.error.flatten())
      return NextResponse.json(
        { error: 'Template de processo obrigatório', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { tpl_process_id } = validation.data
    console.log('[APPROVE] Template ID validado:', tpl_process_id)

    // Verificar se o template existe e está activo
    const { data: template, error: templateError } = await supabase
      .from('tpl_processes')
      .select('id, name, is_active')
      .eq('id', tpl_process_id)
      .single()

    console.log('[APPROVE] Template:', template, 'erro:', templateError?.message)

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template não encontrado' },
        { status: 404 }
      )
    }

    if (!template.is_active) {
      console.log('[APPROVE] Template inactivo')
      return NextResponse.json(
        { error: 'O template seleccionado está inactivo' },
        { status: 400 }
      )
    }

    // Verificar se o processo existe e está em pending_approval ou returned
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('*, property:dev_properties(id)')
      .eq('id', id)
      .single()

    console.log('[APPROVE] Processo:', proc ? { id: proc.id, status: proc.current_status, tpl: proc.tpl_process_id, property: proc.property } : 'null', 'erro:', procError?.message)

    if (procError || !proc) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    if (
      !proc.current_status ||
      !['pending_approval', 'returned'].includes(proc.current_status)
    ) {
      console.log('[APPROVE] Status inválido para aprovação:', proc.current_status)
      return NextResponse.json(
        { error: 'Apenas processos pendentes ou devolvidos podem ser aprovados' },
        { status: 400 }
      )
    }

    // Se o processo já tem tarefas (re-aprovação após devolução com template diferente),
    // apagar tarefas antigas antes de repopular
    if (proc.tpl_process_id) {
      console.log('[APPROVE] Processo já tinha template — a limpar tarefas antigas')
      const { error: deleteTasksError } = await supabase
        .from('proc_tasks')
        .delete()
        .eq('proc_instance_id', id)

      if (deleteTasksError) {
        console.error('[APPROVE] Erro ao limpar tarefas antigas:', deleteTasksError)
      }
    }

    // Actualizar processo: associar template e mudar para active
    console.log('[APPROVE] A actualizar proc_instances...')
    const { error: updateError } = await supabase
      .from('proc_instances')
      .update({
        tpl_process_id,
        current_status: 'active',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        started_at: proc.started_at || new Date().toISOString(),
        returned_reason: null,
        percent_complete: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('[APPROVE] Erro ao actualizar processo:', updateError)
      return NextResponse.json(
        { error: 'Erro ao aprovar processo', details: updateError.message },
        { status: 500 }
      )
    }
    console.log('[APPROVE] Processo actualizado com sucesso')

    // Popular tarefas do template seleccionado
    console.log('[APPROVE] A popular tarefas via RPC...')
    const { error: populateError } = await (supabase as any).rpc(
      'populate_process_tasks',
      { p_instance_id: id }
    )

    if (populateError) {
      console.error('[APPROVE] Erro ao popular tarefas:', populateError)
    } else {
      console.log('[APPROVE] Tarefas populadas com sucesso')
    }

    // Auto-completar tarefas UPLOAD que já têm documentos existentes
    console.log('[APPROVE] A executar autoCompleteTasks...')
    try {
      const autoCompleteResult = await autoCompleteTasks(id, proc.property.id)
      console.log('[APPROVE] Auto-complete result:', autoCompleteResult)
    } catch (autoError) {
      console.error('[APPROVE] Erro no auto-complete:', autoError)
    }

    // Recalcular progresso
    console.log('[APPROVE] A executar recalculateProgress...')
    try {
      const progressResult = await recalculateProgress(id)
      console.log('[APPROVE] Progress result:', progressResult)
    } catch (progressError) {
      console.error('[APPROVE] Erro ao recalcular progresso:', progressError)
    }

    // Actualizar status do imóvel para in_process
    console.log('[APPROVE] A actualizar status do imóvel...')
    const { error: propertyError } = await supabase
      .from('dev_properties')
      .update({ status: 'in_process' })
      .eq('id', proc.property.id)

    if (propertyError) {
      console.error('[APPROVE] Erro ao actualizar status do imóvel:', propertyError)
    }

    console.log('[APPROVE] Aprovação concluída com sucesso!')

    // Notificar consultor que criou o processo (evento #2)
    try {
      if (proc.requested_by && proc.requested_by !== user.id) {
        await notificationService.create({
          recipientId: proc.requested_by,
          senderId: user.id,
          notificationType: 'process_approved',
          entityType: 'proc_instance',
          entityId: id,
          title: 'Processo aprovado',
          body: `O processo ${proc.external_ref || ''} foi aprovado com o template "${template.name}"`,
          actionUrl: `/dashboard/processos/${id}`,
          metadata: {
            process_ref: proc.external_ref,
            template_name: template.name,
          },
        })
      }
    } catch (notifError) {
      console.error('[APPROVE] Erro ao enviar notificação:', notifError)
    }

    return NextResponse.json({
      success: true,
      message: 'Processo aprovado com sucesso',
      template_name: template.name,
    })
  } catch (error) {
    console.error('[APPROVE] ERRO FATAL (catch geral):', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
