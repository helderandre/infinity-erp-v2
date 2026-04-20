import { createAdminClient } from '@/lib/supabase/admin'

export type InviteStatus = 'pending' | 'completed' | 'expired' | 'revoked'

export interface OwnerInviteRow {
  id: string
  token: string
  property_id: string
  status: InviteStatus
  expires_at: string
  submitted_at: string | null
  submitted_owner_ids: string[]
  created_by: string
  note: string | null
  created_at: string
}

export async function loadInviteByToken(
  token: string
): Promise<OwnerInviteRow | null> {
  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('property_owner_invites')
    .select(
      'id, token, property_id, status, expires_at, submitted_at, submitted_owner_ids, created_by, note, created_at'
    )
    .eq('token', token)
    .maybeSingle()

  if (error) {
    console.error('loadInviteByToken error:', error)
    return null
  }
  return data
}

export function isInviteUsable(invite: OwnerInviteRow): {
  ok: boolean
  reason?: 'expired' | 'completed' | 'revoked'
} {
  if (invite.status === 'completed') return { ok: false, reason: 'completed' }
  if (invite.status === 'revoked') return { ok: false, reason: 'revoked' }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' }
  }
  return { ok: true }
}
