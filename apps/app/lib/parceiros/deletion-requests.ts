/**
 * Create/notify helpers for the partner-approved deletion flow.
 *
 * - createDeletionRequest: idempotent insert (returns the existing pending row
 *   if one already exists for the entity) + notifies the parceiro.
 * - notifyDeletionDecision: notifies the original requester when the parceiro
 *   approves/rejects.
 *
 * Notifications reuse the existing `leads_notifications` feed (the parceiro is a
 * real dev_users account) + best-effort web push via sendPushToUser.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export type DeletionEntityType = 'lead' | 'negocio'

interface CreateArgs {
  entityType: DeletionEntityType
  entityId: string
  partnerId: string
  requestedBy: string
  reason?: string | null
  /** Display data shown in the portal (name, value, etc.). */
  snapshot?: Record<string, unknown>
}

export interface CreateResult {
  id: string | null
  existing: boolean
  error: string | null
}

const ENTITY_LABEL: Record<DeletionEntityType, string> = {
  lead: 'contacto',
  negocio: 'oportunidade',
}

export async function createDeletionRequest(db: Db, args: CreateArgs): Promise<CreateResult> {
  const { entityType, entityId, partnerId, requestedBy, reason, snapshot } = args

  // Idempotent: reuse an existing pending request for the same entity.
  const { data: existing } = await db
    .from('deletion_requests')
    .select('id')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing?.id) {
    return { id: existing.id as string, existing: true, error: null }
  }

  const { data: created, error } = await db
    .from('deletion_requests')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      partner_id: partnerId,
      requested_by: requestedBy,
      reason: reason?.trim() || null,
      snapshot: snapshot ?? {},
    })
    .select('id')
    .single()

  if (error) {
    // Lost a race against the partial unique index — fetch the winner.
    const { data: winner } = await db
      .from('deletion_requests')
      .select('id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('status', 'pending')
      .maybeSingle()
    if (winner?.id) return { id: winner.id as string, existing: true, error: null }
    return { id: null, existing: false, error: error.message }
  }

  const label = ENTITY_LABEL[entityType]
  const name = (snapshot?.name as string | undefined) || `${label}`
  const title = 'Pedido de eliminação'
  const body = `Foi pedido para eliminar ${label === 'contacto' ? 'o contacto' : 'a oportunidade'} "${name}". A sua aprovação é necessária.`

  // In-app feed (recipient = parceiro).
  await db.from('leads_notifications').insert({
    recipient_id: partnerId,
    type: 'deletion_request',
    title,
    body,
    link: `/pedidos-eliminacao`,
    contact_id: entityType === 'lead' ? entityId : null,
    negocio_id: entityType === 'negocio' ? entityId : null,
  })

  // Web push (best-effort).
  import('@/lib/crm/send-push')
    .then(({ sendPushToUser }) => {
      sendPushToUser(db, partnerId, {
        title,
        body,
        url: '/pedidos-eliminacao',
        tag: `deletion-${created.id}`,
      }).catch(() => {})
    })
    .catch(() => {})

  return { id: created.id as string, existing: false, error: null }
}

export async function notifyDeletionDecision(
  db: Db,
  args: {
    requestedBy: string
    entityType: DeletionEntityType
    approved: boolean
    name?: string | null
    partnerName?: string | null
    notes?: string | null
  },
): Promise<void> {
  const { requestedBy, entityType, approved, name, partnerName, notes } = args
  const label = ENTITY_LABEL[entityType]
  const who = partnerName || 'O parceiro'
  const title = approved ? 'Eliminação aprovada' : 'Eliminação recusada'
  const subject = name ? `"${name}"` : `a ${label}`
  const body = approved
    ? `${who} aprovou a eliminação de ${subject}.`
    : `${who} recusou a eliminação de ${subject}.${notes ? ` Motivo: ${notes}` : ''}`

  await db.from('leads_notifications').insert({
    recipient_id: requestedBy,
    type: 'deletion_decision',
    title,
    body,
    link: '/dashboard/crm',
  })

  import('@/lib/crm/send-push')
    .then(({ sendPushToUser }) => {
      sendPushToUser(db, requestedBy, { title, body, url: '/dashboard/crm' }).catch(() => {})
    })
    .catch(() => {})
}
