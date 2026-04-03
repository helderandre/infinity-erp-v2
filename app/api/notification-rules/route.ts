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
 * GET /api/notification-rules
 * Lista todas as regras de routing de notificações, com joins para role e user.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const db = getDb()
    const { data, error } = await (db.from('notification_routing_rules') as SA)
      .select(`
        *,
        recipient_role:roles!notification_routing_rules_recipient_role_id_fkey(id, name),
        recipient_user:dev_users!notification_routing_rules_recipient_user_id_fkey(id, commercial_name)
      `)
      .order('module')
      .order('event_key')
      .order('priority')

    if (error) {
      // Fallback sem joins explícitos (caso os nomes FK não correspondam)
      const { data: fallbackData, error: fallbackError } = await (db.from('notification_routing_rules') as SA)
        .select('*')
        .order('module')
        .order('event_key')
        .order('priority')

      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 })
      }

      // Enriquecer manualmente com role e user
      const adminClient = createAdminClient()
      const roleIds = [...new Set((fallbackData as SA[]).filter((r: SA) => r.recipient_role_id).map((r: SA) => r.recipient_role_id))]
      const userIds = [...new Set((fallbackData as SA[]).filter((r: SA) => r.recipient_user_id).map((r: SA) => r.recipient_user_id))]

      const [rolesRes, usersRes] = await Promise.all([
        roleIds.length > 0
          ? adminClient.from('roles').select('id, name').in('id', roleIds)
          : { data: [] },
        userIds.length > 0
          ? adminClient.from('dev_users').select('id, commercial_name').in('id', userIds)
          : { data: [] },
      ])

      const rolesMap = new Map((rolesRes.data || []).map((r: SA) => [r.id, r]))
      const usersMap = new Map((usersRes.data || []).map((u: SA) => [u.id, u]))

      const enriched = (fallbackData as SA[]).map((rule: SA) => ({
        ...rule,
        recipient_role: rule.recipient_role_id ? rolesMap.get(rule.recipient_role_id) || null : null,
        recipient_user: rule.recipient_user_id ? usersMap.get(rule.recipient_user_id) || null : null,
      }))

      return NextResponse.json(enriched)
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[notification-rules GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST /api/notification-rules
 * Cria uma nova regra de routing.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()

    const {
      event_key,
      module,
      label,
      description,
      recipient_type,
      recipient_role_id,
      recipient_user_id,
      channel_in_app = true,
      channel_email = false,
      channel_whatsapp = false,
      is_active = true,
      priority = 0,
    } = body

    if (!event_key || !module || !label || !recipient_type) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: event_key, module, label, recipient_type' },
        { status: 400 }
      )
    }

    if (recipient_type === 'role' && !recipient_role_id) {
      return NextResponse.json({ error: 'recipient_role_id é obrigatório para tipo "role"' }, { status: 400 })
    }

    if (recipient_type === 'user' && !recipient_user_id) {
      return NextResponse.json({ error: 'recipient_user_id é obrigatório para tipo "user"' }, { status: 400 })
    }

    const db = getDb()
    const { data, error } = await (db.from('notification_routing_rules') as SA)
      .insert({
        event_key,
        module,
        label,
        description: description || null,
        recipient_type,
        recipient_role_id: recipient_type === 'role' ? recipient_role_id : null,
        recipient_user_id: recipient_type === 'user' ? recipient_user_id : null,
        channel_in_app,
        channel_email,
        channel_whatsapp,
        is_active,
        priority,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[notification-rules POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
