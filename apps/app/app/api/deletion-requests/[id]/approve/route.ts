import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { deleteLeadCascade } from '@/lib/leads/delete-lead-cascade'
import { deleteNegocioCascade } from '@/lib/negocios/delete-negocio-cascade'
import { notifyDeletionDecision } from '@/lib/parceiros/deletion-requests'

/**
 * POST /api/deletion-requests/[id]/approve
 *
 * The target parceiro (or a manager with the `users` permission) approves a
 * pending deletion request. Runs the actual cascade delete via the shared lib,
 * marks the request approved, and notifies the original requester. Idempotent.
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

    // Idempotent: already decided → return current state.
    if (req.status !== 'pending') {
      return NextResponse.json({ ok: true, status: req.status, already_decided: true })
    }

    const body = (await request.json().catch(() => ({}))) as { notes?: string }

    const result =
      req.entity_type === 'lead'
        ? await deleteLeadCascade(db, req.entity_id)
        : await deleteNegocioCascade(db, req.entity_id)

    if (result.error) {
      return NextResponse.json(
        { error: 'Erro ao eliminar', details: result.error },
        { status: 500 },
      )
    }

    await db
      .from('deletion_requests')
      .update({
        status: 'approved',
        decided_by: auth.user.id,
        decided_at: new Date().toISOString(),
        decision_notes: body?.notes?.trim() || null,
      })
      .eq('id', id)

    await notifyDeletionDecision(db, {
      requestedBy: req.requested_by,
      entityType: req.entity_type,
      approved: true,
      name: (req.snapshot?.name as string | undefined) ?? null,
      partnerName: (req.snapshot?.partner_name as string | undefined) ?? null,
    })

    return NextResponse.json({ ok: true, status: 'approved' })
  } catch (err) {
    console.error('[deletion-requests approve]', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
