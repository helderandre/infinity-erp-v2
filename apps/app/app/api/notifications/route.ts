import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { markAllReadScopeSchema, notificationQuerySchema } from '@/lib/validations/notification'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const params = notificationQuerySchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      unread_only: searchParams.get('unread_only') ?? undefined,
      type: searchParams.get('type') || undefined,
    })

    // Query notificações com sender join
    let query = (db.from('notifications') as ReturnType<typeof supabase.from>)
      .select(
        '*, sender:dev_users!notifications_sender_id_fkey(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url))',
        { count: 'exact' }
      )
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .range((params.page - 1) * params.limit, params.page * params.limit - 1)

    if (params.unread_only) {
      query = query.eq('is_read', false)
    }

    if (params.type) {
      const types = params.type.split(',')
      query = query.in('notification_type', types)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Contagem de não lidas (query separada, lightweight)
    const { count: unreadCount } = await (db.from('notifications') as ReturnType<typeof supabase.from>)
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false)

    return NextResponse.json({
      notifications: data,
      total: count ?? 0,
      unread_count: unreadCount ?? 0,
      page: params.page,
      limit: params.limit,
    })
  } catch (error) {
    console.error('Erro ao carregar notificações:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    let scope: { notification_types?: string[]; exclude_notification_types?: string[] } = {}
    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const raw = await request.text()
      if (raw.trim().length > 0) {
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
        }
        const result = markAllReadScopeSchema.safeParse(parsed)
        if (!result.success) {
          return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Pedido inválido' }, { status: 400 })
        }
        scope = result.data
      }
    }

    let query = (db.from('notifications') as ReturnType<typeof supabase.from>)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .eq('is_read', false)

    if (scope.notification_types && scope.notification_types.length > 0) {
      query = query.in('notification_type', scope.notification_types)
    } else if (scope.exclude_notification_types && scope.exclude_notification_types.length > 0) {
      const list = scope.exclude_notification_types.map((t) => `"${t}"`).join(',')
      query = query.not('notification_type', 'in', `(${list})`)
    }

    const { data, error } = await query.select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: data?.length ?? 0 })
  } catch (error) {
    console.error('Erro ao marcar notificações como lidas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
