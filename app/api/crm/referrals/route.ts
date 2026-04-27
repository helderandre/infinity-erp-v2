import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { createReferralSchema } from '@/lib/validations/leads-crm'
import { NextResponse } from 'next/server'

const DEFAULT_REFERRAL_PCT = 25

async function resolveDefaultPct(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<number> {
  const { data } = await supabase
    .from('temp_agency_settings')
    .select('value')
    .eq('key', 'default_referral_pct')
    .maybeSingle()
  const v = parseFloat(data?.value ?? '')
  return Number.isFinite(v) ? v : DEFAULT_REFERRAL_PCT
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const contact_id = searchParams.get('contact_id')
    const from_consultant_id = searchParams.get('from_consultant_id')
    const to_consultant_id = searchParams.get('to_consultant_id')
    const partner_id = searchParams.get('partner_id')
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const per_page = Math.max(1, parseInt(searchParams.get('per_page') ?? '25', 10))
    const from = (page - 1) * per_page

    const supabase = createCrmAdminClient()

    // leads_referrals.contact_id FK points to leads(id)
    // leads_referrals.negocio_id FK points to negocios(id)
    let query = supabase
      .from('leads_referrals')
      .select(
        `*,
        contact:leads!contact_id(id, nome, email, telemovel),
        from_user:dev_users!from_consultant_id(id, commercial_name),
        to_user:dev_users!to_consultant_id(id, commercial_name),
        partner:leads_partners!partner_id(id, name, company),
        negocio:negocios!negocio_id(id, tipo, pipeline_stage_id, expected_value)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, from + per_page - 1)

    if (contact_id) query = query.eq('contact_id', contact_id)
    if (from_consultant_id) query = query.eq('from_consultant_id', from_consultant_id)
    if (to_consultant_id) query = query.eq('to_consultant_id', to_consultant_id)
    if (partner_id) query = query.eq('partner_id', partner_id)
    if (status) query = query.eq('status', status)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data, total: count ?? 0, page, per_page })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * Create a referral. For internal user → user referrals this also performs
 * the hand-off side-effects on the underlying entity:
 *
 *  - entry_id  → transfer leads_entries to recipient + flag the contact's
 *                referred_by_consultant_id so future négocios are auditable
 *  - negocio_id → transfer the négocio to recipient + record commission slice
 *                 (referrer_consultant_id + referral_pct) — contacto stays
 *  - else (contact only) → reassign agent_id + flag referred_by_consultant_id
 *
 * Side-effects after the insert are best-effort. If any of them fail the
 * audit row is rolled back so the UI never shows a half-done referral.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const parsed = createReferralSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const input = parsed.data
    const supabase = createCrmAdminClient()

    // Self-referral guard — internal referrals must have two distinct
    // consultores. The dialog already filters the current user from the
    // recipient list; this is the API-side enforcement.
    if (
      input.referral_type === 'internal' &&
      input.from_consultant_id &&
      input.to_consultant_id &&
      input.from_consultant_id === input.to_consultant_id
    ) {
      return NextResponse.json(
        { error: 'Não podes referenciar a ti próprio' },
        { status: 400 },
      )
    }

    // Resolve effective referral_pct for internal referrals — null means
    // "use agency default". Stored on the leads_referrals row so future
    // changes to the agency setting don't retroactively rewrite history.
    let effectivePct: number | null = null
    if (input.referral_type === 'internal') {
      effectivePct = input.referral_pct ?? (await resolveDefaultPct(supabase))
    }

    // Supersede previous active agreements between the same (contact,
    // recipient) pair — keeps the audit table clean and avoids "lookup
    // picks newest, older row still pending forever" ambiguity. Only
    // active states get cancelled; converted/lost rows are historical and
    // shouldn't be touched.
    if (
      input.referral_type === 'internal' &&
      input.contact_id &&
      input.to_consultant_id
    ) {
      await supabase
        .from('leads_referrals')
        .update({ status: 'cancelled' })
        .eq('contact_id', input.contact_id)
        .eq('to_consultant_id', input.to_consultant_id)
        .in('status', ['pending', 'accepted'])
    }

    // Insert audit row first.
    const { data: audit, error: insertError } = await supabase
      .from('leads_referrals')
      .insert({
        ...input,
        referral_pct: effectivePct,
      })
      .select()
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    // Side-effects only for internal referrals (partner_inbound has its
    // own flow upstream — see /api/parceiro/submit-lead).
    //
    // Behaviour, per the simplified rules:
    //  - lead_entry referral → flip leads_entries.assigned_consultant_id
    //    (so the entry shows up in the recipient's "Tens X leads" inbox).
    //    The contacto stays with whoever owns it; the recipient gets read
    //    access via the entry-side relationship. No leads.agent_id change.
    //  - négocio referral → flip negocios.assigned_consultant_id and
    //    record the commission slice on that specific deal. Contacto stays.
    //  - contact-only referral (no entry, no négocio) → audit row only.
    //    Future négocios that pair this contacto with the recipient pick
    //    up the slice automatically via the négocio creation handler.
    if (input.referral_type === 'internal' && input.to_consultant_id) {
      try {
        if (input.entry_id) {
          await supabase
            .from('leads_entries')
            .update({ assigned_consultant_id: input.to_consultant_id })
            .eq('id', input.entry_id)
        } else if (input.negocio_id) {
          await supabase
            .from('negocios')
            .update({
              assigned_consultant_id: input.to_consultant_id,
              referrer_consultant_id: input.from_consultant_id,
              referral_pct: effectivePct,
            })
            .eq('id', input.negocio_id)
        }
        // contact-only branch: nothing to mutate. The leads_referrals row
        // is the agreement; négocio creation will look it up.
      } catch (sideEffectErr) {
        // Roll back the audit row so we never leave a referral row pointing
        // at an entity whose ownership wasn't actually transferred.
        await supabase.from('leads_referrals').delete().eq('id', audit.id)
        return NextResponse.json(
          {
            error:
              sideEffectErr instanceof Error
                ? sideEffectErr.message
                : 'Erro ao executar a referência',
          },
          { status: 500 },
        )
      }
    }

    return NextResponse.json(audit, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
