import { createClient } from '@/lib/supabase/server'
import { ChatLayout } from '@/components/whatsapp/chat-layout'

export default async function WhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string }>
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Business rule: on the WhatsApp simulation page every user (including
  // Broker/CEO, admin, Gestor Processual) sees only instances they own.
  // Admins manage all instances via the automation module, but they never
  // see other users' conversations here.
  const { data: instances } = await (supabase as any)
    .from('auto_wpp_instances')
    .select('id, name, connection_status, phone, profile_name, profile_pic_url, user_id, is_business, created_at')
    .eq('status', 'active')
    .eq('user_id', user.id)
    .order('name')

  const { chat: initialChatId } = await searchParams

  return (
    <ChatLayout
      instances={instances || []}
      userId={user.id}
      initialChatId={initialChatId}
    />
  )
}
