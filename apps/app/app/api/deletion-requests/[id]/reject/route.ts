import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { notifyDeletionDecision } from '@/lib/parceiros/deletion-requests'

/**
 * POST /api/deletion-requests/[id]/reject
 *
 * The target parceiro (or a manager with the `users` permission) rejects a
 * pending deletion request. Nothing is deleted; the request is marked rejected
 * and the original requester is notified. Idempotent.
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
    if (req.partner_id !== auth.user.id && !canOverride) {
      return NextResponse.json({ error: 'Sem permissão para este pedido' }, { status: 403 })
    }

    if (req.status !== 'pending') {
      return NextResponse.json({ ok: true, status: req.status, already_decided: true })
    }

    const body = (await request.json().catch(() => ({}))) as { notes?: string }

    await db
      .from('deletion_requests')
      .update({
        status: 'rejected',
        decided_by: auth.user.id,
        decided_at: new Date().toISOString(),
        decision_notes: body?.notes?.trim() || null,
      })
      .eq('id', id)

    await notifyDeletionDecision(db, {
      requestedBy: req.requested_by,
      entityType: req.entity_type,
      approved: false,
      name: (req.snapshot?.name as string | undefined) ?? null,
      partnerName: (req.snapshot?.partner_name as string | undefined) ?? null,
      notes: body?.notes?.trim() || null,
    })

    return NextResponse.json({ ok: true, status: 'rejected' })
  } catch (err) {
    console.error('[deletion-requests reject]', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
