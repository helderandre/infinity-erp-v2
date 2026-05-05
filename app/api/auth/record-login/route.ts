import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextRequest, NextResponse } from 'next/server'

const DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000 // 4h

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const admin = createCrmAdminClient()

  const { data: latest } = await admin
    .from('dev_user_logins')
    .select('logged_in_at')
    .eq('user_id', user.id)
    .order('logged_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest?.logged_in_at) {
    const ageMs = Date.now() - new Date(latest.logged_in_at).getTime()
    if (ageMs < DEDUP_WINDOW_MS) {
      return NextResponse.json({ ok: true, deduped: true })
    }
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
  const userAgent = req.headers.get('user-agent') || null

  const { error } = await admin.from('dev_user_logins').insert({
    user_id: user.id,
    ip_address: ip,
    user_agent: userAgent,
  })

  if (error) {
    console.error('[record-login] insert failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recorded: true })
}
