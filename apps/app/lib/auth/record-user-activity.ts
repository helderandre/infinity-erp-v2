import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

const DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000 // 4h

type RecordResult = { ok: true; recorded: boolean }

/**
 * Records a "user activity" ping in `dev_user_logins`. Deduped per user inside
 * a 4h sliding window so opening the app multiple times a day doesn't spam.
 *
 * Used by both the explicit login endpoint and the OAuth/magic-link callback,
 * plus the on-mount client recorder. Failures are swallowed (caller decides
 * whether to surface them) — this is observability, never block auth.
 */
export async function recordUserActivity(
  userId: string,
  ip: string | null,
  userAgent: string | null
): Promise<RecordResult> {
  const admin = createCrmAdminClient()

  const { data: latest } = await admin
    .from('dev_user_logins')
    .select('logged_in_at')
    .eq('user_id', userId)
    .order('logged_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest?.logged_in_at) {
    const ageMs = Date.now() - new Date(latest.logged_in_at).getTime()
    if (ageMs < DEDUP_WINDOW_MS) {
      return { ok: true, recorded: false }
    }
  }

  const { error } = await admin.from('dev_user_logins').insert({
    user_id: userId,
    ip_address: ip,
    user_agent: userAgent,
  })

  if (error) {
    console.error('[record-user-activity] insert failed', error)
    return { ok: true, recorded: false }
  }

  return { ok: true, recorded: true }
}
