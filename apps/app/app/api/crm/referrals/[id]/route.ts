import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { updateReferralStatusSchema } from '@/lib/validations/leads-crm'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const parsed = updateReferralStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = createCrmAdminClient()

    const updates: Record<string, unknown> = { status: parsed.data.status }
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes

    const { data, error } = await supabase
      .from('leads_referrals')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Referência não encontrada' }, { status: 404 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * Cancel a referral and reverse any hand-off side-effects.
 *
 * Either party (referrer or recipient) can cancel at any time. Cancellation
 * only affects future deals — négocios already stamped with the slice keep
 * paying the referrer until they close. The agreement row stays in the table
 * with `status='cancelled'` so the audit trail is preserved.
 *
 * Side-effects reverted, mirroring POST:
 *  - entry_id   → leads_entries.assigned_consultant_id back to the sender
 *  - negocio_id → négocio: assigned back to sender, clear slice
 *  - else       → no entity-level mutation happened, nothing to revert
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const supabase = createCrmAdminClient()

    const { data: ref, error: fetchError } = await supabase
      .from('leads_referrals')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!ref) return NextResponse.json({ error: 'Referência não encontrada' }, { status: 404 })

    const isReferrer = ref.from_consultant_id === user.id
    const isRecipient = ref.to_consultant_id === user.id

    if (!isReferrer && !isRecipient) {
      return NextResponse.json(
        { error: 'Sem permissão para cancelar esta referência' },
        { status: 403 },
      )
    }

    if (ref.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Referência já cancelada' },
        { status: 400 },
      )
    }

    // Reverse the hand-off, mirroring the POST side-effects:
    //  - entry_id  → leads_entries.assigned_consultant_id back to the sender
    //  - negocio_id → négocio: assigned back to sender, clear referrer slice
    //  - contact-only → no entity-level mutation happened; cancelling the
    //    audit row alone is enough to break future inheritance.
    if (ref.entry_id) {
      await supabase
        .from('leads_entries')
        .update({ assigned_consultant_id: ref.from_consultant_id })
        .eq('id', ref.entry_id)
    } else if (ref.negocio_id) {
      await supabase
        .from('negocios')
        .update({
          assigned_consultant_id: ref.from_consultant_id,
          referrer_consultant_id: null,
          referral_pct: null,
        })
        .eq('id', ref.negocio_id)
    }

    await supabase
      .from('leads_referrals')
      .update({ status: 'cancelled' })
      .eq('id', id)

    return NextResponse.json({ ok: true, cancelled_by: isRecipient ? 'recipient' : 'referrer' })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
