import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { calculateCurrentStages } from '@/lib/process-engine'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  const { id: procId, stageId } = await params
  const adminClient = createAdminClient()

  try {
    // 1. Buscar instância
    const { data: instance, error: instError } = await adminClient
      .from('proc_instances')
      .select('id, tpl_process_id, completed_stage_ids, current_stage_ids, current_status')
      .eq('id', procId)
      .single()

    if (instError || !instance) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    if (instance.current_status !== 'active') {
      return NextResponse.json({ error: 'Processo não está activo' }, { status: 400 })
    }

    // 2. Verificar que o estágio é actual
    const currentStageIds: string[] = instance.current_stage_ids || []
    if (!currentStageIds.includes(stageId)) {
      return NextResponse.json({ error: 'Estágio não é actual' }, { status: 400 })
    }

    // 3. Verificar dependências satisfeitas
    const { data: stage, error: stageError } = await adminClient
      .from('tpl_stages')
      .select('id, depends_on_stages')
      .eq('id', stageId)
      .single()

    if (stageError || !stage) {
      return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
    }

    const completedSet = new Set<string>(instance.completed_stage_ids || [])
    const deps: string[] = stage.depends_on_stages || []
    const depsOk = deps.every((depId: string) => completedSet.has(depId))
    if (!depsOk) {
      return NextResponse.json({ error: 'Dependências de estágio não satisfeitas' }, { status: 400 })
    }

    // 4. Adicionar aos concluídos
    const newCompleted = [...(instance.completed_stage_ids || []), stageId]

    // 5. Recalcular estágios actuais
    const { data: allStages } = await adminClient
      .from('tpl_stages')
      .select('id, order_index, depends_on_stages')
      .eq('tpl_process_id', instance.tpl_process_id!)
      .order('order_index')

    const newCurrent = allStages
      ? calculateCurrentStages(
          allStages.map((s) => ({
            id: s.id,
            order_index: s.order_index,
            depends_on_stages: s.depends_on_stages || [],
          })),
          newCompleted
        )
      : []

    // 6. Actualizar
    const { error: updateError } = await adminClient
      .from('proc_instances')
      .update({
        completed_stage_ids: newCompleted,
        current_stage_ids: newCurrent,
        current_stage_id: newCurrent[0] || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', procId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      completed_stage_ids: newCompleted,
      current_stage_ids: newCurrent,
    })
  } catch (error: any) {
    console.error('Error completing stage:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
