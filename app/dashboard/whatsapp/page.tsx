import { createClient } from '@/lib/supabase/server'
import { ChatLayout } from '@/components/whatsapp/chat-layout'
import { WHATSAPP_ADMIN_ROLES } from '@/lib/auth/roles'

export default async function WhatsAppPage() {
  const supabase = await createClient()

  // Get current user + role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: devUser } = await (supabase as any)
    .from('dev_users')
    .select('id, role_id, roles:role_id(name)')
    .eq('id', user.id)
    .single()

  const roleName = (devUser?.roles as any)?.name || ''
  const isWppAdmin = WHATSAPP_ADMIN_ROLES.some(
    (r) => r.toLowerCase() === roleName.toLowerCase()
  )

  // Admins see all instances, regular users only their own
  let query = (supabase as any)
    .from('auto_wpp_instances')
    .select('id, name, connection_status, phone, profile_name, profile_pic_url, user_id')
    .eq('status', 'active')
    .order('name')

  if (!isWppAdmin) {
    query = query.eq('user_id', user.id)
  }

  const { data: instances } = await query

  return (
    <ChatLayout
      instances={instances || []}
      userId={user.id}
      isAdmin={isWppAdmin}
    />
  )
}
