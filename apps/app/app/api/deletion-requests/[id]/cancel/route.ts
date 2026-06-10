import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

/**
 * POST /api/deletion-requests/[id]/cancel
 *
 * The original requester (or a manager with the `users` permission) withdraws a
 * pending deletion request before the parceiro acts. Nothing is deleted.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const db = createCrmAdminClient()

    const { data: req, error: loadErr } = await db
      .from('deletion_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
    if (!req) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    const canOverride = auth.permissions.users === true
    if (req.requested_by !== auth.user.id && !canOverride) {
      return NextResponse.json({ error: 'Sem permissão para este pedido' }, { status: 403 })
    }

    if (req.status !== 'pending') {
      return NextResponse.json({ ok: true, status: req.status, already_decided: true })
    }

    await db
      .from('deletion_requests')
      .update({
        status: 'cancelled',
        decided_by: auth.user.id,
        decided_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({ ok: true, status: 'cancelled' })
  } catch (err) {
    console.error('[deletion-requests cancel]', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
