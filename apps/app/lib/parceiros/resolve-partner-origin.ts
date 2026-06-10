/**
 * Resolve whether a lead (contacto) or negócio (oportunidade) originated from a
 * PARCEIRO that has app access — i.e. a `dev_users` account holding the
 * 'Parceiro' role. Only these partners can approve a deletion (they are the
 * ones who can log into the portal). External magic-link-only partners
 * (leads_partners) are intentionally NOT covered here.
 *
 * Link paths checked:
 *   - negócio → parceiro: negocios.referrer_consultant_id
 *   - lead    → parceiro: referrer_consultant_id on any of the lead's negócios,
 *                         OR leads_referrals.from_consultant_id on any of the
 *                         lead's entries (status != 'cancelled')
 *
 * Uses an untyped admin client so cross-table reads bypass RLS reliably (the
 * caller may be a consultant scoped away from referral rows).
 */

import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export interface PartnerOrigin {
  partnerId: string
  partnerName: string | null
}

/** Returns partner display name if `userId` is an active 'Parceiro', else null. */
async function asPartner(db: Db, userId: string): Promise<{ name: string | null } | null> {
  const { data } = await db
    .from('dev_users')
    .select('id, commercial_name, is_active, user_roles!user_roles_user_id_fkey(role:roles(name))')
    .eq('id', userId)
    .maybeSingle()
  if (!data) return null
  if (data.is_active === false) return null
  const roles: string[] = (data.user_roles || [])
    .map((ur: { role?: { name?: string } }) => ur.role?.name)
    .filter(Boolean)
  const isPartner = roles.some((r) => r.toLowerCase() === 'parceiro')
  return isPartner ? { name: data.commercial_name ?? null } : null
}

export async function resolvePartnerOriginForNegocio(
  negocioId: string,
  db: Db = createCrmAdminClient(),
): Promise<PartnerOrigin | null> {
  const { data: neg } = await db
    .from('negocios')
    .select('referrer_consultant_id')
    .eq('id', negocioId)
    .maybeSingle()
  const referrer = neg?.referrer_consultant_id as string | null | undefined
  if (!referrer) return null
  const p = await asPartner(db, referrer)
  return p ? { partnerId: referrer, partnerName: p.name } : null
}

export async function resolvePartnerOriginForLead(
  leadId: string,
  db: Db = createCrmAdminClient(),
): Promise<PartnerOrigin | null> {
  // 1) Via any negócio under this lead with a partner referrer.
  const { data: negs } = await db
    .from('negocios')
    .select('referrer_consultant_id')
    .eq('lead_id', leadId)
    .not('referrer_consultant_id', 'is', null)
  for (const n of (negs || []) as Array<{ referrer_consultant_id: string }>) {
    const p = await asPartner(db, n.referrer_consultant_id)
    if (p) return { partnerId: n.referrer_consultant_id, partnerName: p.name }
  }

  // 2) Via leads_referrals on the lead's entries.
  const { data: entries } = await db
    .from('leads_entries')
    .select('id')
    .eq('contact_id', leadId)
  const entryIds = ((entries || []) as Array<{ id: string }>).map((e) => e.id)
  if (entryIds.length > 0) {
    const { data: refs } = await db
      .from('leads_referrals')
      .select('from_consultant_id')
      .in('entry_id', entryIds)
      .neq('status', 'cancelled')
      .not('from_consultant_id', 'is', null)
    for (const r of (refs || []) as Array<{ from_consultant_id: string }>) {
      const p = await asPartner(db, r.from_consultant_id)
      if (p) return { partnerId: r.from_consultant_id, partnerName: p.name }
    }
  }

  return null
}
