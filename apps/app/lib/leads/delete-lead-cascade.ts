/**
 * Single source of truth for deleting a lead (contacto) + its cascade.
 *
 * Used by BOTH the direct delete path (DELETE /api/leads/[id], management /
 * non-partner leads) and the partner-approved path
 * (POST /api/deletion-requests/[id]/approve). Keep all cascade quirks here so
 * the two paths can never drift.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export async function deleteLeadCascade(db: Db, leadId: string): Promise<{ error: string | null }> {
  // `calendar_events.lead_id` has FK ON DELETE NO ACTION — would block the
  // delete if any event references this lead. Decouple first by NULLing the FK;
  // the events themselves stay (they belong to the consultant's calendar).
  await db.from('calendar_events').update({ lead_id: null }).eq('lead_id', leadId)

  // Everything else cascades or sets-null automatically:
  //   CASCADE: negocios, leads_activities, leads_entries, lead_attachments,
  //            contact_automations*, contact_property_sends, custom_event_leads,
  //            leads_referrals, temp_acompanhamentos, temp_pedidos_credito,
  //            wpp_activity_sessions
  //   SET NULL: visits, wpp_contacts, leads_notifications, property_propostas,
  //             client_satisfaction_surveys
  const { error } = await db.from('leads').delete().eq('id', leadId)
  return { error: error?.message ?? null }
}
