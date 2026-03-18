import { createClient } from '@/lib/supabase/server'
import { ContactsPageClient } from './contacts-page-client'

export default async function WhatsAppContactsPage() {
  const supabase = await createClient()

  const { data: instances } = await (supabase as any)
    .from('auto_wpp_instances')
    .select('id, name, connection_status, phone')
    .eq('status', 'active')
    .order('name')

  return <ContactsPageClient instances={instances || []} />
}
