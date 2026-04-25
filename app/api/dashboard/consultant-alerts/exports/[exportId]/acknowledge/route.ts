import { NextResponse } from 'next/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireRoles } from '@/lib/auth/permissions'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ exportId: string }> },
) {
  const auth = await requireRoles(['Broker/CEO', 'admin'])
  if (!auth.authorized) return auth.response

  const { exportId } = await params

  let note: string | undefined
  try {
    const body = await req.json()
    if (typeof body?.note === 'string' && body.note.trim()) note = body.note.trim().slice(0, 500)
  } catch {
    // no body is fine
  }

  const db = createCrmAdminClient()
  const { data, error } = await db
    .from('consultant_export_events')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: auth.user.id,
      acknowledged_note: note ?? null,
    })
    .eq('id', exportId)
    .is('acknowledged_at', null)
    .select('id, user_id, acknowledged_at, acknowledged_by')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Evento não encontrado ou já reconhecido' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, event: data })
}
