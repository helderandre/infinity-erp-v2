import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Singleton — every call to createClient() returns the same browser client
// instance. Creating new clients on every hook render caused Navigator
// LockManager contention on `lock:sb-<project>-auth-token`: each client tried
// to acquire the auth-token lock concurrently, and when enough pages-worth of
// useUser()/useSupabase() calls fired at once (e.g. opening a consultant
// sheet with detail + internal chat + email + WhatsApp sheets), the lock
// timed out after 10s.
let browserClient: SupabaseClient<Database> | null = null

export function createClient() {
  if (typeof window === 'undefined') {
    // SSR / build-time: return a one-off instance (no singleton — different request).
    return createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return browserClient
}
