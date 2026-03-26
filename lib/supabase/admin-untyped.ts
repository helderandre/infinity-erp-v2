import { createClient } from '@supabase/supabase-js'

// Untyped admin client for tables not yet in the generated Database type
// (e.g. leads_* tables). Use this instead of createAdminClient() in CRM routes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCrmAdminClient() {
  return createClient(
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
