import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { notificationService } from '@/lib/notifications/service'

/**
 * GET  /api/processes/[id]/media-task   → devolve a tarefa Media existente OU null.
 * POST /api/processes/[id]/media-task   → find-or-create. Idempotente: se já
 *                                         existir uma tarefa não concluída para
 *                                         o mesmo imóvel, devolve essa.
 *
 * A tarefa fica em `tasks` com:
 *   category   = 'media_capture'
 *   entity_type= 'property'
 *   entity_id  = property_id
 *   assigned_to= property.consultant_id
 *   created_by = auth.user.id
 *   due_date   = hoje (00:00 UTC) → fica visível na to-do e atrasada nos
 *                dias seguintes
 *
 * Auth: só gestão (Broker/CEO + Office Manager + Gestor Processual via
 * isManagementRole) pode criar.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    const { id: procId } = await params
    const supabase = await createClient()

    const { data: proc } = await supabase
      .from('proc_instances')
      .select('id, property_id')
      .eq('id', procId)
      .maybeSingle()
    if (!proc?.property_id) {
      return NextResponse.json({ task: null })
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .select('id, title, due_date, is_completed, completed_at, assigned_to, entity_type, entity_id, category, created_at')
      .eq('category', 'media_capture')
      .eq('entity_type', 'property')
      .eq('entity_id', proc.property_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task: task ?? null })
  } catch (error) {
    console.error('[media-task] GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    if (!isManagementRole(auth.roles)) {
      return NextResponse.json(
        { error: 'Apenas a gestão pode criar a tarefa Media.' },
        { status: 403 }
      )
    }

    const { id: procId } = await params
    const supabase = await createClient()

    // 1) Carregar processo + imóvel + título
    const { data: proc } = await supabase
      .from('proc_instances')
      .select('id, property_id')
      .eq('id', procId)
      .maybeSingle()
    if (!proc?.property_id) {
      return NextResponse.json({ error: 'Processo sem imóvel associado.' }, { status: 404 })
    }

    const { data: property } = await supabase
      .from('dev_properties')
      .select('id, title, consultant_id, external_ref')
      .eq('id', proc.property_id)
      .maybeSingle()
    if (!property) {
      return NextResponse.json({ error: 'Imóvel não encontrado.' }, { status: 404 })
    }

    // 2) Idempotência — se já existe tarefa não concluída, devolve-a.
    const { data: existing } = await supabase
      .from('tasks')
      .select('id, title, due_date, is_completed, completed_at, assigned_to, entity_type, entity_id, category, created_at')
      .eq('category', 'media_capture')
      .eq('entity_type', 'property')
      .eq('entity_id', property.id)
      .eq('is_completed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ task: existing, created: false })
    }

    // 3) Criar tarefa.
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = today.toISOString()

    const propertyLabel = property.title || property.external_ref || 'Imóvel'
    const { data: created, error: createErr } = await supabase
      .from('tasks')
      .insert({
        title: 'Upload de Media do Imóvel',
        description:
          `Recolha de fotografias, vídeos, plantas e descrição publicável para ${propertyLabel}.`,
        category: 'media_capture',
        entity_type: 'property',
        entity_id: property.id,
        assigned_to: property.consultant_id,
        created_by: auth.user.id,
        due_date: dueDate,
        priority: 2, // medium (1=baixa, 2=média, 3=alta) — ajustar à convenção do projecto
        is_completed: false,
        is_recurring: false,
        is_private: false,
        order_index: 0,
        reminders: [],
      } as any)
      .select('id, title, due_date, is_completed, completed_at, assigned_to, entity_type, entity_id, category, created_at')
      .single()

    if (createErr || !created) {
      return NextResponse.json(
        { error: 'Erro ao criar tarefa Media.', details: createErr?.message },
        { status: 500 }
      )
    }

    // 4) Notificar o consultor responsável que a tarefa foi atribuída.
    //    Falhas isoladas — não revertem a criação.
    if (property.consultant_id && property.consultant_id !== auth.user.id) {
      try {
        await notificationService.create({
          recipientId: property.consultant_id,
          senderId: auth.user.id,
          notificationType: 'task_assigned',
          entityType: 'task',
          entityId: created.id,
          title: 'Upload de Media do Imóvel',
          body: `${propertyLabel} — fotos, vídeos, plantas e descrição. Vence hoje.`,
          actionUrl: `/dashboard/tarefas?task=${created.id}`,
          metadata: {
            kind: 'media_capture_assigned',
            property_id: property.id,
            property_title: property.title,
          },
        })
      } catch (notifyErr) {
        console.error('[media-task] failed to notify consultor:', notifyErr)
      }
    }

    return NextResponse.json({ task: created, created: true })
  } catch (error) {
    console.error('[media-task] POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
