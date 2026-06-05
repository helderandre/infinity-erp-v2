import { createAdminClient } from '@/lib/supabase/admin'

const STAFF_ROLE_NAMES = new Set([
  'Broker/CEO',
  'admin',
  'Office Manager',
  'Gestora Processual',
  'team_leader',
  'Team Leader',
])

export async function isPartnersStaff(userId: string): Promise<boolean> {
  const admin = createAdminClient() as any
  const { data } = await admin
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', userId)

  if (!Array.isArray(data)) return false
  return data.some((row: any) => STAFF_ROLE_NAMES.has(row?.roles?.name))
}

export { STAFF_ROLE_NAMES }
