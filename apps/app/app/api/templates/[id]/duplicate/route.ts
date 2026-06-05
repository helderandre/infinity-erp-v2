import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('settings')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const admin = createAdminClient() as any

    // 1. Get the original template with stages and tasks
    const { data: original, error: fetchError } = await admin
      .from('tpl_processes')
      .select(`
        *,
        tpl_stages (
          *,
          tpl_tasks (*)
        )
      `)
      .eq('id', id)
      .single()

    if (fetchError || !original) {
      return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 })
    }

    // 2. Create the duplicated template
    const { data: newTemplate, error: insertError } = await admin
      .from('tpl_processes')
      .insert({
        name: `${original.name} (cópia)`,
        description: original.description,
        is_active: false, // Start as inactive
        process_type: original.process_type,
      })
      .select()
      .single()

    if (insertError || !newTemplate) {
      console.error('[templates/duplicate] insert error:', insertError)
      return NextResponse.json({ error: 'Erro ao duplicar template.' }, { status: 500 })
    }

    // 3. Copy stages and tasks
    const stages = original.tpl_stages || []
    const sortedStages = [...stages].sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))

    for (const stage of sortedStages) {
      const { data: newStage, error: stageError } = await admin
        .from('tpl_stages')
        .insert({
          tpl_process_id: newTemplate.id,
          name: stage.name,
          order_index: stage.order_index,
        })
        .select()
        .single()

      if (stageError || !newStage) {
        console.error('[templates/duplicate] stage error:', stageError)
        continue
      }

      // Copy tasks for this stage
      const tasks = stage.tpl_tasks || []
      const sortedTasks = [...tasks].sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))

      for (const task of sortedTasks) {
        await admin
          .from('tpl_tasks')
          .insert({
            tpl_stage_id: newStage.id,
            title: task.title,
            description: task.description,
            action_type: task.action_type,
            is_mandatory: task.is_mandatory,
            sla_days: task.sla_days,
            config: task.config,
            order_index: task.order_index,
            doc_type_id: task.doc_type_id,
            subtasks: task.subtasks,
          })
      }
    }

    return NextResponse.json({ data: newTemplate }, { status: 201 })
  } catch (err) {
    console.error('[templates/duplicate POST]', err)
    return NextResponse.json({ error: 'Erro interno ao duplicar template.' }, { status: 500 })
  }
}
