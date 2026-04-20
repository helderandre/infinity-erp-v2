import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { autoCompleteTasks, recalculateProgress, resolveTemplate } from '@/lib/process-engine'
import { z } from 'zod'
import { notificationService } from '@/lib/notifications/service'
import { requireRoles } from '@/lib/auth/permissions'
import { PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'

const approveSchema = z.object({
  // Optional — when absent, server auto-resolves the matching active template
  // based on process_type. Consultants never see a picker; admins may override.
  tpl_process_id: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      'Formato de ID inválido'
    )
    .optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('[APPROVE] Início — process id:', id)

    // Autenticação + verificação de roles
    const auth = await requireRoles(PROCESS_MANAGER_ROLES)
    if (!auth.authorized) return auth.response
    const user = auth.user

    const supabase = await createClient()

    // Parse e validação do body
    console.log('[APPROVE] Request method:', request.method)
    console.log('[APPROVE] Content-Type:', request.headers.get('content-type'))
    console.log('[APPROVE] Content-Length:', request.headers.get('content-length'))
    console.log('[APPROVE] Body used?:', request.bodyUsed)

    const rawText = await request.text()
    const body = rawText && rawText.length > 0 ? JSON.parse(rawText) : {}
    console.log('[APPROVE] Body parsed:', JSON.stringify(body))

    const validation = approveSchema.safeParse(body)
    if (!validation.success) {
      console.log('[APPROVE] Validação falhou:', validation.error.flatten())
      return NextResponse.json(
        { error: 'Corpo inválido', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const providedTemplateId = validation.data.tpl_process_id
    console.log('[APPROVE] Template ID fornecido:', providedTemplateId ?? '(auto-resolve)')

    // Verificar se o processo existe e está em pending_approval ou returned
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('*, property:dev_properties(id)')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    console.log('[APPROVE] Processo:', proc ? { id: proc.id, status: proc.current_status, tpl: proc.tpl_process_id, property: proc.property, type: (proc as any).process_type } : 'null', 'erro:', procError?.message)

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

    const procType = (proc as any).process_type as string | undefined

    // Resolver template: ou o explicitamente fornecido ou o auto-resolvido
    let tpl_process_id: string
    let template: any

    if (providedTemplateId) {
      const { data: tpl, error: templateError } = await supabase
        .from('tpl_processes')
        .select('*')
        .eq('id', providedTemplateId)
        .single()

      if (templateError || !tpl) {
        return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
      }
      if (!tpl.is_active) {
        return NextResponse.json({ error: 'O template seleccionado está inactivo' }, { status: 400 })
      }
      if ((tpl as any).process_type && procType && (tpl as any).process_type !== procType) {
        return NextResponse.json(
          { error: 'O template seleccionado não é compatível com este tipo de processo' },
          { status: 400 }
        )
      }
      template = tpl
      tpl_process_id = providedTemplateId
    } else {
      if (!procType) {
        return NextResponse.json(
          { error: 'Processo sem tipo definido — não é possível resolver o template automaticamente' },
          { status: 400 }
        )
      }
      const resolved = await resolveTemplate(supabase as any, { process_type: procType })
      if (!resolved.ok) {
        return NextResponse.json(
          {
            error:
              resolved.reason === 'no_candidates'
                ? 'Nenhum template activo para este tipo de processo'
                : 'Mais do que um template activo — é necessário escolher',
            reason: resolved.reason,
            candidates: resolved.candidates,
          },
          { status: resolved.reason === 'no_candidates' ? 404 : 409 }
        )
      }
      tpl_process_id = resolved.template.id
      const { data: tpl } = await supabase
        .from('tpl_processes')
        .select('*')
        .eq('id', tpl_process_id)
        .single()
      template = tpl
      console.log('[APPROVE] Template auto-resolvido:', template?.name, tpl_process_id)
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
    const { error: populateError } = await supabase.rpc(
      'populate_process_tasks',
      { p_instance_id: id }
    )

    if (populateError) {
      console.error('[APPROVE] Erro ao popular tarefas:', populateError)
    } else {
      console.log('[APPROVE] Tarefas populadas com sucesso')
    }

    // Resolver dependências (mapear IDs de template para IDs de instância + marcar is_blocked)
    console.log('[APPROVE] A resolver dependências...')
    const { error: depsError } = await supabase.rpc(
      'resolve_process_dependencies' as any,
      { p_instance_id: id }
    )
    if (depsError) {
      console.error('[APPROVE] Erro ao resolver dependências:', depsError)
    } else {
      console.log('[APPROVE] Dependências resolvidas com sucesso')
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
