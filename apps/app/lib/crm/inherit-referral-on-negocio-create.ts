/**
 * Helper used by every négocio creation path so a deal automatically
 * inherits the active referral agreement, if any, between the contacto
 * and the consultor assigned to the new deal.
 *
 * Rule (simplified, post-clarification):
 *  - When consultor X refers something (lead_entry / négocio / contacto)
 *    to consultor Y, an active leads_referrals row is recorded with
 *    contact_id = Z, from_consultant_id = X, to_consultant_id = Y.
 *  - From that point on, ANY négocio Y creates where lead_id = Z gets
 *    `referrer_consultant_id = X` and `referral_pct = (row.pct or default)`.
 *  - There is no "first négocio only" exception — every future deal the
 *    recipient does with the referred contacto pays X the slice.
 *  - If a different consultor takes over the deal, the slice on THAT
 *    négocio still belongs to whoever was the referrer at create time,
 *    but new agreements only fire for the to_consultant_id named in the
 *    audit row.
 */

const DEFAULT_REFERRAL_PCT = 25

export interface InheritedReferral {
  referrer_consultant_id: string
  referral_pct: number
  referral_row_id: string | null
}

export async function resolveInheritedReferralForNegocio(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  leadId: string,
  recipientConsultantId: string | null | undefined,
): Promise<InheritedReferral | null> {
  if (!leadId || !recipientConsultantId) return null

  // Look up the most recent active referral agreement that pairs this
  // contacto with this recipient. status is the agreement state — only
  // 'pending' / 'accepted' are still in force.
  const { data: row } = await supabase
    .from('leads_referrals')
    .select('id, from_consultant_id, referral_pct')
    .eq('contact_id', leadId)
    .eq('to_consultant_id', recipientConsultantId)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row || !row.from_consultant_id) return null

  let pct: number = DEFAULT_REFERRAL_PCT
  if (typeof row.referral_pct === 'number') {
    pct = row.referral_pct
  } else {
    const { data: setting } = await supabase
      .from('temp_agency_settings')
      .select('value')
      .eq('key', 'default_referral_pct')
      .maybeSingle()
    const parsed = parseFloat(setting?.value ?? '')
    if (Number.isFinite(parsed)) pct = parsed
  }

  return {
    referrer_consultant_id: row.from_consultant_id as string,
    referral_pct: pct,
    referral_row_id: (row.id as string | null) ?? null,
  }
}

/**
 * Best-effort link of the audit row → resulting négocio + activity-timeline
 * marker so the recipient can see *why* the deal was credited to a referrer.
 * The denormalised columns on negocios are the source of truth for money;
 * the leads_activities row is purely for audit/visibility.
 */
export async function linkReferralToNewNegocio(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  referralRowId: string,
  negocioId: string,
  inherited: { referrer_consultant_id: string; referral_pct: number },
  // Used to write the activity row (lead_id + recipient consultant_id).
  context: { lead_id: string | null; recipient_consultant_id: string | null },
): Promise<void> {
  try {
    await supabase
      .from('leads_referrals')
      .update({ negocio_id: negocioId, status: 'accepted' })
      .eq('id', referralRowId)
  } catch {
    // silent — denormalised columns on negocios are the source of truth.
  }

  // Activity timeline — show the recipient that this deal automatically
  // picked up an existing referral agreement. Best-effort.
  if (context.lead_id) {
    try {
      await supabase.from('leads_activities').insert({
        contact_id: context.lead_id,
        negocio_id: negocioId,
        activity_type: 'referral_inherited',
        subject: `Referência aplicada: ${inherited.referral_pct}% para o consultor referenciador`,
        metadata: {
          referrer_consultant_id: inherited.referrer_consultant_id,
          referral_pct: inherited.referral_pct,
          recipient_consultant_id: context.recipient_consultant_id,
        },
      })
    } catch {
      // silent
    }
  }
}
