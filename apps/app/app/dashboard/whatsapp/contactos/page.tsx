import { createClient } from '@/lib/supabase/server'
import { ContactsPageClient } from './contacts-page-client'
import { WHATSAPP_ADMIN_ROLES } from '@/lib/auth/roles'

export default async function WhatsAppContactsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: devUser } = await (supabase as any)
    .from('dev_users')
    .select(`
      id,
      user_roles!user_roles_user_id_fkey(
        role:roles(name)
      )
    `)
    .eq('id', user.id)
    .single()

  const userRoles: string[] = ((devUser as any)?.user_roles || [])
    .map((ur: any) => ur.role?.name)
    .filter(Boolean)

  const isWppAdmin = userRoles.some((r) =>
    WHATSAPP_ADMIN_ROLES.some((a) => a.toLowerCase() === r.toLowerCase())
  )

  let query = (supabase as any)
    .from('auto_wpp_instances')
    .select('id, name, connection_status, phone')
    .eq('status', 'active')
    .order('name')

  if (!isWppAdmin) {
    query = query.eq('user_id', user.id)
  }

  const { data: instances } = await query

  return <ContactsPageClient instances={instances || []} />
}
