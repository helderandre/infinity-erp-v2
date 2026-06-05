import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

function getDb() {
  const supabase = createAdminClient()
  return supabase as unknown as {
    from: (table: string) => ReturnType<typeof supabase.from>
  }
}

/**
 * PUT /api/notification-rules/[id]
 * Actualiza uma regra existente.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Campos actualizáveis
    const updateData: Record<string, SA> = {}

    if (body.recipient_type !== undefined) updateData.recipient_type = body.recipient_type
    if (body.recipient_role_id !== undefined) updateData.recipient_role_id = body.recipient_role_id
    if (body.recipient_user_id !== undefined) updateData.recipient_user_id = body.recipient_user_id
    if (body.channel_in_app !== undefined) updateData.channel_in_app = body.channel_in_app
    if (body.channel_email !== undefined) updateData.channel_email = body.channel_email
    if (body.channel_whatsapp !== undefined) updateData.channel_whatsapp = body.channel_whatsapp
    if (body.is_active !== undefined) updateData.is_active = body.is_active
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.label !== undefined) updateData.label = body.label
    if (body.description !== undefined) updateData.description = body.description

    // Limpar campos quando muda recipient_type
    if (updateData.recipient_type === 'role') {
      updateData.recipient_user_id = null
    } else if (updateData.recipient_type === 'user') {
      updateData.recipient_role_id = null
    } else if (updateData.recipient_type === 'assigned_agent' || updateData.recipient_type === 'entity_owner') {
      updateData.recipient_role_id = null
      updateData.recipient_user_id = null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para actualizar' }, { status: 400 })
    }

    const db = getDb()
    const { data, error } = await (db.from('notification_routing_rules') as SA)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[notification-rules PUT]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/notification-rules/[id]
 * Elimina uma regra.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id } = await params
    const db = getDb()

    const { error } = await (db.from('notification_routing_rules') as SA)
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notification-rules DELETE]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
