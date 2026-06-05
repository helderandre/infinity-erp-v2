import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'

// GET /api/whatsapp/instances — list instances the caller owns.
//
// Every user (including admins) only sees instances where user_id === self.
// This endpoint feeds the WhatsApp simulation page, where conversations of
// other users must remain inaccessible even to admins. Instance management
// for admins lives in the automation module.
export async function GET() {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('auto_wpp_instances')
    .select('id, name, phone, profile_name, status, connection_status, user_id')
    .eq('status', 'active')
    .eq('connection_status', 'connected')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ instances: data ?? [] })
}
