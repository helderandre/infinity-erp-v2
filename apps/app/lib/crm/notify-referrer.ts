/**
 * Notify the referenced partner (referrer) about events on a négocio they're
 * owed a slice of: when a referred lead becomes an oportunidade, and on every
 * stage move of that oportunidade.
 *
 * The partner is a real `dev_users` account (role Parceiro) and may have web
 * push registered via the Parceiros portal, so we both:
 *   • write a row to `leads_notifications` (their in-portal feed), and
 *   • fire a best-effort web push via sendPushToUser.
 *
 * Links point at the Parceiros portal surface (`/oportunidades`) — that's where
 * the partner is allowed to see the deal. Never throws; failures are swallowed
 * so they can't block the consultor's action.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

interface ReferrerEventArgs {
  referrerId: string
  negocioId: string
  leadId: string | null
  leadName: string | null
  /** The consultor who triggered the event — skip self-notifications. */
  actorId?: string | null
}

async function pushAndFeed(
  db: Db,
  referrerId: string,
  negocioId: string,
  leadId: string | null,
  title: string,
  body: string,
): Promise<void> {
  try {
    await db.from('leads_notifications').insert({
      recipient_id: referrerId,
      type: 'referral_update',
      title,
      body,
      link: '/oportunidades',
      contact_id: leadId,
      negocio_id: negocioId,
    })
  } catch {
    /* best-effort feed */
  }

  try {
    const { sendPushToUser } = await import('@/lib/crm/send-push')
    await sendPushToUser(db, referrerId, {
      title,
      body,
      url: '/oportunidades',
      tag: `referral-${negocioId}`,
    })
  } catch {
    /* best-effort push */
  }
}

/** A referred lead was qualified into an oportunidade. */
export async function notifyReferrerQualified(db: Db, args: ReferrerEventArgs): Promise<void> {
  const { referrerId, negocioId, leadId, leadName, actorId } = args
  if (!referrerId || referrerId === actorId) return
  const who = leadName ? `"${leadName}"` : 'Uma das suas referências'
  await pushAndFeed(
    db,
    referrerId,
    negocioId,
    leadId,
    'Nova oportunidade',
    `${who} tornou-se uma oportunidade.`,
  )
}

/** A referred oportunidade moved to a new pipeline stage. */
export async function notifyReferrerStageMove(
  db: Db,
  args: ReferrerEventArgs & { toStageName: string | null },
): Promise<void> {
  const { referrerId, negocioId, leadId, leadName, actorId, toStageName } = args
  if (!referrerId || referrerId === actorId) return
  const who = leadName ? `"${leadName}"` : 'Uma oportunidade sua'
  const stage = toStageName ? ` para "${toStageName}"` : ''
  await pushAndFeed(
    db,
    referrerId,
    negocioId,
    leadId,
    'Oportunidade actualizada',
    `${who} avançou${stage}.`,
  )
}
