import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { createReferralSchema } from '@/lib/validations/leads-crm'
import { notifyPartnerNewLead } from '@/lib/parceiros/notify-partner'
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

/**
 * The referrer (who keeps the commission slice) is the CURRENT owner of the
 * entity being referred — NEVER the caller. A management user may run the
 * hand-off on the owner's behalf, and the slice must stay with the consultor
 * who actually owns the lead, not whoever clicked "Referenciar".
 *
 * Resolution order: the most specific owner wins (entry/négocio), falling
 * back to the contacto owner. Returns null only for a truly orphan lead.
 */
async function resolveReferrerOwner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  input: { entry_id?: string | null; negocio_id?: string | null; contact_id: string },
): Promise<string | null> {
  if (input.entry_id) {
    const { data } = await supabase
      .from('leads_entries')
      .select('assigned_consultant_id')
      .eq('id', input.entry_id)
      .maybeSingle()
    if (data?.assigned_consultant_id) return data.assigned_consultant_id as string
  } else if (input.negocio_id) {
    const { data } = await supabase
      .from('negocios')
      .select('assigned_consultant_id')
      .eq('id', input.negocio_id)
      .maybeSingle()
    if (data?.assigned_consultant_id) return data.assigned_consultant_id as string
  }
  if (input.contact_id) {
    const { data } = await supabase
      .from('leads')
      .select('agent_id')
      .eq('id', input.contact_id)
      .maybeSingle()
    if (data?.agent_id) return data.agent_id as string
  }
  return null
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
 *  - entry_id  → hand the lead over to the recipient: reassign the entry
 *                (assigned_consultant_id + assigned_agent_id) AND the
 *                underlying contacto (leads.agent_id), and denormalize the
 *                referral onto the entry (has_referral / referral_pct /
 *                referral_consultant_id) so the recipient sees the badge.
 *                The referrer's note stays in leads_referrals.notes.
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

    // Resolve the effective referrer: the entity's current owner, not the
    // caller. The body's from_consultant_id is only a fallback for orphan
    // leads (no owner anywhere). partner_inbound keeps its body value.
    let effectiveReferrerId: string | null = input.from_consultant_id ?? null
    if (input.referral_type === 'internal') {
      effectiveReferrerId =
        (await resolveReferrerOwner(supabase, input)) ?? input.from_consultant_id ?? null
    }

    // Self-referral guard — internal referrals must have two distinct
    // consultores. With the owner-derived referrer this also blocks referring
    // a lead to the consultor who already owns it.
    if (
      input.referral_type === 'internal' &&
      effectiveReferrerId &&
      input.to_consultant_id &&
      effectiveReferrerId === input.to_consultant_id
    ) {
      return NextResponse.json(
        { error: 'O destinatário já é o responsável por esta lead' },
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

    // Insert audit row first. from_consultant_id is forced to the resolved
    // owner so the slice never lands on a management caller.
    const { data: audit, error: insertError } = await supabase
      .from('leads_referrals')
      .insert({
        ...input,
        from_consultant_id: effectiveReferrerId,
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
          // Full ownership hand-off: the recipient gets this AS A LEAD, not a
          // borrowed entry. Flip the entry to the recipient AND denormalize the
          // referral onto it so the recipient's inbox/sheet shows the
          // "Referenciação" badge + % + referrer. The free-text note stays in
          // leads_referrals.notes (surfaced read-only by the inbox queries).
          const { error: entryErr } = await supabase
            .from('leads_entries')
            .update({
              assigned_consultant_id: input.to_consultant_id,
              // Mirror onto assigned_agent_id — the column that feeds the
              // Gestora "Por atribuir" page, the SLA engine and the
              // active_lead_count trigger. Without this the entry would still
              // surface in the unassigned pool. Same person, two columns.
              assigned_agent_id: input.to_consultant_id,
              has_referral: true,
              referral_consultant_id: effectiveReferrerId,
              referral_pct: effectivePct,
            })
            .eq('id', input.entry_id)
          if (entryErr) throw new Error(entryErr.message)

          // Reassign the underlying contacto to the recipient too — so it's
          // genuinely their lead, not just an entry pointing at someone else's
          // contact. Future négocios on this contacto already inherit the
          // slice via the négocio-creation handler.
          if (input.contact_id) {
            const { error: contactErr } = await supabase
              .from('leads')
              .update({ agent_id: input.to_consultant_id })
              .eq('id', input.contact_id)
            if (contactErr) throw new Error(contactErr.message)
          }
        } else if (input.negocio_id) {
          await supabase
            .from('negocios')
            .update({
              assigned_consultant_id: input.to_consultant_id,
              referrer_consultant_id: effectiveReferrerId,
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

    // Notifica por email quando o referenciador creditado é um Parceiro — a
    // lead passa a aparecer no portal de Parceiros. No-op para referenciadores
    // internos (o helper valida o role 'Parceiro'). Best-effort.
    if (effectiveReferrerId) {
      const { data: contact } = await supabase
        .from('leads')
        .select('nome, telemovel, email')
        .eq('id', input.contact_id)
        .maybeSingle()
      await notifyPartnerNewLead(supabase, {
        partnerId: effectiveReferrerId,
        leadName: contact?.nome ?? null,
        contactPhone: contact?.telemovel ?? null,
        contactEmail: contact?.email ?? null,
      })
    }

    return NextResponse.json(audit, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
