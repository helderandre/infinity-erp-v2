import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { autoCompleteTasks, recalculateProgress } from '@/lib/process-engine'
import { z } from 'zod'
import { notificationService } from '@/lib/notifications/service'
import { requireRoles } from '@/lib/auth/permissions'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

const reTemplateSchema = z.object({
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
    // Autenticação + verificação de roles
    const auth = await requireRoles(PROCESS_MANAGER_ROLES)
    if (!auth.authorized) return auth.response
    const user = auth.user

    const supabase = await createClient()

    // Parse e validação do body
    const rawText = await request.text()
    if (!rawText || rawText.length === 0) {
      return NextResponse.json(
        { error: 'Body vazio — nenhum dado recebido' },
        { status: 400 }
      )
    }

    const body = JSON.parse(rawText)
    const validation = reTemplateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Template de processo obrigatório', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { tpl_process_id } = validation.data

    // Verificar se o template existe e está activo
    const { data: template, error: templateError } = await supabase
      .from('tpl_processes')
      .select('id, name, is_active')
      .eq('id', tpl_process_id)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template não encontrado' },
        { status: 404 }
      )
    }

    if (!template.is_active) {
      return NextResponse.json(
        { error: 'O template seleccionado está inactivo' },
        { status: 400 }
      )
    }

    // Verificar se o processo existe e está activo/pausado
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('*, property:dev_properties(id)')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (procError || !proc) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    if (!proc.current_status || !['active', 'on_hold'].includes(proc.current_status)) {
      return NextResponse.json(
        { error: 'Apenas processos activos ou pausados podem ter o template alterado' },
        { status: 400 }
      )
    }

    // Eliminar tarefas antigas (cascade apaga proc_subtasks automaticamente)
    const { error: deleteTasksError } = await supabase
      .from('proc_tasks')
      .delete()
      .eq('proc_instance_id', id)

    if (deleteTasksError) {
      console.error('[RE-TEMPLATE] Erro ao limpar tarefas antigas:', deleteTasksError)
      return NextResponse.json(
        { error: 'Erro ao limpar tarefas existentes', details: deleteTasksError.message },
        { status: 500 }
      )
    }

    // Actualizar proc_instances com novo template (manter status, approved_by, etc.)
    const { error: updateError } = await supabase
      .from('proc_instances')
      .update({
        tpl_process_id,
        percent_complete: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('[RE-TEMPLATE] Erro ao actualizar processo:', updateError)
      return NextResponse.json(
        { error: 'Erro ao actualizar processo', details: updateError.message },
        { status: 500 }
      )
    }

    // Popular tarefas do novo template
    const { error: populateError } = await supabase.rpc(
      'populate_process_tasks',
      { p_instance_id: id }
    )

    if (populateError) {
      console.error('[RE-TEMPLATE] Erro ao popular tarefas:', populateError)
    }

    // Resolver dependências
    const { error: depsError } = await supabase.rpc(
      'resolve_process_dependencies' as any,
      { p_instance_id: id }
    )
    if (depsError) {
      console.error('[RE-TEMPLATE] Erro ao resolver dependências:', depsError)
    }

    // Auto-completar tarefas UPLOAD que já têm documentos existentes
    try {
      await autoCompleteTasks(id, proc.property.id)
    } catch (autoError) {
      console.error('[RE-TEMPLATE] Erro no auto-complete:', autoError)
    }

    // Recalcular progresso
    try {
      await recalculateProgress(id)
    } catch (progressError) {
      console.error('[RE-TEMPLATE] Erro ao recalcular progresso:', progressError)
    }

    // Notificar consultor que criou o processo
    try {
      if (proc.requested_by && proc.requested_by !== user.id) {
        await notificationService.create({
          recipientId: proc.requested_by,
          senderId: user.id,
          notificationType: 'process_approved',
          entityType: 'proc_instance',
          entityId: id,
          title: 'Template do processo alterado',
          body: `O template do processo ${proc.external_ref || ''} foi alterado para "${template.name}"`,
          actionUrl: `/dashboard/processos/${id}`,
          metadata: {
            process_ref: proc.external_ref,
            template_name: template.name,
          },
        })
      }
    } catch (notifError) {
      console.error('[RE-TEMPLATE] Erro ao enviar notificação:', notifError)
    }

    return NextResponse.json({
      success: true,
      message: 'Template alterado com sucesso',
      template_name: template.name,
    })
  } catch (error) {
    console.error('[RE-TEMPLATE] ERRO FATAL:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
