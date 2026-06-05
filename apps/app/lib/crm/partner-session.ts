/**
 * Partner session helper — reads the magic link cookie and validates.
 */

import { cookies } from 'next/headers'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

interface PartnerSession {
  id: string
  name: string
  email: string | null
  company: string | null
  partner_type: string
}

export async function getPartnerFromSession(): Promise<PartnerSession | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get('partner_session')?.value
  if (!session) return null

  const [partnerId, token] = session.split(':')
  if (!partnerId || !token) return null

  const db = createCrmAdminClient()
  const { data } = await db
    .from('leads_partners')
    .select('id, name, email, company, partner_type, is_active, magic_link_token')
    .eq('id', partnerId)
    .eq('magic_link_token', token)
    .eq('is_active', true)
    .single()

  if (!data) return null
  return { id: data.id, name: data.name, email: data.email, company: data.company, partner_type: data.partner_type }
}
