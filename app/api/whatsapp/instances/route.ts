import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'
import { WHATSAPP_ADMIN_ROLES } from '@/lib/auth/roles'

export async function GET() {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const isWhatsappAdmin = auth.roles.some((r) =>
    WHATSAPP_ADMIN_ROLES.some(
      (allowed) => allowed.toLowerCase() === r.toLowerCase()
    )
  )

  const admin = createAdminClient()
  let query = admin
    .from('auto_wpp_instances')
    .select('id, name, phone, profile_name, status, connection_status, user_id')
    .eq('status', 'active')
    .eq('connection_status', 'connected')
    .order('created_at', { ascending: true })

  if (!isWhatsappAdmin) {
    query = query.eq('user_id', auth.user.id)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ instances: data ?? [] })
}
