import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

/**
 * POST /api/debug/push-log — receives client-side push subscription logs.
 *
 * Used to debug iOS PWA push flow when Safari Web Inspector is unavailable.
 * Persists to log_audit so we can query the timeline via SQL.
 *
 * Body: { stage: string, payload?: any }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { stage, payload } = await req.json().catch(() => ({}))
    if (!stage || typeof stage !== 'string') {
      return NextResponse.json({ error: 'stage required' }, { status: 400 })
    }

    const ua = req.headers.get('user-agent') || null
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? null

    const db = createCrmAdminClient()
    await db.from('log_audit').insert({
      user_id: user.id,
      entity_type: 'push_debug',
      entity_id: user.id,
      action: stage,
      new_data: {
        stage,
        payload: payload ?? null,
        user_agent: ua,
      },
      ip_address: ip,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
