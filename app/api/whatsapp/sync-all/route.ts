import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { WHATSAPP_ADMIN_ROLES } from '@/lib/auth/roles'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Trigger a chats sync for every active WhatsApp instance the current user
 * owns (or all active instances, if the user is a WhatsApp admin).
 *
 * Fires each sync in parallel — this endpoint returns once all syncs have
 * finished (or failed quietly). Auto-match then runs per instance via the
 * regular /api/whatsapp/sync pipeline.
 *
 * Intended to be called once per app session to refresh unread counts and
 * pick up any new chats/contacts since the last time the user was here.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const adminDb = createAdminClient()

    // Role check for WhatsApp admins
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: devUser } = await (adminDb as any)
      .from('dev_users')
      .select('role_id, roles:role_id(name)')
      .eq('id', user.id)
      .single()
    const roleName = (devUser?.roles as { name?: string } | null)?.name || ''
    const isAdmin = WHATSAPP_ADMIN_ROLES.some(
      (r) => r.toLowerCase() === roleName.toLowerCase()
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (adminDb as any)
      .from('auto_wpp_instances')
      .select('id')
      .eq('status', 'active')
      .eq('connection_status', 'connected')
    if (!isAdmin) query = query.eq('user_id', user.id)

    const { data: instances } = await query
    if (!instances?.length) {
      return NextResponse.json({ synced: 0, instances: 0 })
    }

    const results = await Promise.allSettled(
      instances.map(async (inst: { id: string }) => {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-chats-api`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({ action: 'sync_chats', instance_id: inst.id }),
        })
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
    )

    const okCount = results.filter((r) => r.status === 'fulfilled').length

    return NextResponse.json({
      synced: okCount,
      instances: instances.length,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
