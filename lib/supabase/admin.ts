import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Cliente com service role — bypassa RLS
// Usar APENAS em Route Handlers do lado do servidor
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
