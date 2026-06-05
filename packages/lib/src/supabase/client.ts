import { createBrowserClient } from '@supabase/ssr'
import { processLock, type SupabaseClient } from '@supabase/supabase-js'

// Singleton browser client (one per tab) using an in-process auth lock to
// avoid Navigator LockManager contention. Shared by all Infinity apps.
let browserClient: SupabaseClient | null = null

export function createClient() {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { lock: processLock } }
    )
  }
  return browserClient
}
