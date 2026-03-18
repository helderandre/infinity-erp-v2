import { createClient } from '@/lib/supabase/server'
import { ChatLayout } from '@/components/whatsapp/chat-layout'

export default async function WhatsAppPage() {
  const supabase = await createClient()

  const { data: instances } = await (supabase as any)
    .from('auto_wpp_instances')
    .select('id, name, connection_status, phone, profile_name, profile_pic_url')
    .eq('status', 'active')
    .order('name')

  return <ChatLayout instances={instances || []} />
}
