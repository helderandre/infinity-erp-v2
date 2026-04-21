import { createClient } from '@/lib/supabase/server'
import { ChatLayout } from '@/components/whatsapp/chat-layout'
import { WHATSAPP_ADMIN_ROLES } from '@/lib/auth/roles'

export default async function WhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string }>
}) {
  const supabase = await createClient()

  // Get current user + all roles (cumulative)
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

  // Admins see all instances, regular users only their own
  let query = (supabase as any)
    .from('auto_wpp_instances')
    .select('id, name, connection_status, phone, profile_name, profile_pic_url, user_id, is_business, created_at')
    .eq('status', 'active')
    .order('name')

  if (!isWppAdmin) {
    query = query.eq('user_id', user.id)
  }

  const { data: instances } = await query
  const { chat: initialChatId } = await searchParams

  return (
    <ChatLayout
      instances={instances || []}
      userId={user.id}
      isAdmin={isWppAdmin}
      initialChatId={initialChatId}
    />
  )
}
