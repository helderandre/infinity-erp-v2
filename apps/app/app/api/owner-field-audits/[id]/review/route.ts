import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const FIELD_WHITELIST = [
  'naturality',
  'address',
  'marital_status',
  'marital_regime',
  'legal_rep_naturality',
  'legal_rep_address',
  'legal_rep_marital_status',
] as const

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
})

/**
 * POST /api/owner-field-audits/[id]/review
 * Body: { action: 'approve' | 'reject' }
 *
 * - approve: marks audit row as decision='approved'. Owner's value stays.
 *            Also acknowledges any earlier pending audits for the same
 *            (owner_id, field_name) so the chain settles in one click.
 * - reject:  reverts owners.<field> to audit.old_value AND marks audit as
 *            decision='rejected'. Earlier pending audits are also rejected
 *            (we only keep the consultor-approved value).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id: auditId } = await params
    if (!UUID_RE.test(auditId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { action } = parsed.data

    const admin = createAdminClient() as unknown as {
      from: (t: string) => ReturnType<typeof supabase.from>
    }

    // Load the audit row + verify it's still pending.
    const { data: audit, error: auditErr } = await admin
      .from('owner_field_audit')
      .select('id, owner_id, field_name, old_value, new_value, acknowledged_at')
      .eq('id', auditId)
      .single() as { data: any; error: any }

    if (auditErr || !audit) {
      return NextResponse.json(
        { error: 'Audit row não encontrada' },
        { status: 404 }
      )
    }

    if (audit.acknowledged_at) {
      return NextResponse.json(
        { ok: true, idempotent: true, decision: audit.decision },
        { status: 200 }
      )
    }

    if (!FIELD_WHITELIST.includes(audit.field_name)) {
      return NextResponse.json(
        { error: 'Campo não suportado' },
        { status: 400 }
      )
    }

    // Reject: revert owners.<field> to old_value BEFORE marking acknowledged.
    if (action === 'reject') {
      const update = { [audit.field_name]: audit.old_value ?? null }
      const { error: ownerErr } = await admin
        .from('owners')
        .update(update)
        .eq('id', audit.owner_id) as { error: any }

      if (ownerErr) {
        console.error('[field-review/reject] owners update:', ownerErr.message)
        return NextResponse.json({ error: ownerErr.message }, { status: 500 })
      }
    }

    // Mark this audit + any earlier pending audits for same (owner, field)
    // as decided. Earlier rows get the SAME decision: when consultor approves
    // the latest, all pending edits in that chain are considered ok; when
    // rejected, all earlier pending edits are also rejected (the value was
    // reverted to the oldest old_value via the most recent audit row).
    const nowIso = new Date().toISOString()
    const { error: ackErr } = await admin
      .from('owner_field_audit')
      .update({
        acknowledged_at: nowIso,
        acknowledged_by: user.id,
        decision: action === 'approve' ? 'approved' : 'rejected',
      })
      .eq('owner_id', audit.owner_id)
      .eq('field_name', audit.field_name)
      .is('acknowledged_at', null) as { error: any }

    if (ackErr) {
      console.error('[field-review] ack:', ackErr.message)
      return NextResponse.json({ error: ackErr.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      decision: action === 'approve' ? 'approved' : 'rejected',
      reverted_to: action === 'reject' ? audit.old_value ?? null : undefined,
    })
  } catch (err: any) {
    console.error('[field-review] error:', err?.message ?? err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
