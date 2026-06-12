/**
 * Send Web Push notifications to a user's subscribed devices.
 */

import webpush from 'web-push'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>

// Configure VAPID keys (generate once with: npx web-push generate-vapid-keys)
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@infinitygroup.pt'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

// Status codes that mean the subscription is permanently unusable and should be
// deleted so the user is forced to re-subscribe (and we stop wasting sends):
//   404 Not Found / 410 Gone   → endpoint expired or unsubscribed at the browser
//   403 Forbidden              → VAPID auth mismatch (typically a rotated server
//                                key vs. a subscription created with the old one).
//                                Previously these were SILENTLY kept forever — the
//                                user saw "notificações activas" but every push
//                                failed in the background. Pruning forces a fresh,
//                                working subscription on their next visit.
const PRUNE_STATUS = new Set([403, 404, 410])

/**
 * Send a push notification to all devices of a user.
 *
 * Returns the number of devices the push was accepted by. Silently returns 0 if
 * VAPID keys aren't configured or the user has no subscriptions. Per-device
 * failures are logged (console + best-effort `log_audit`) so background-delivery
 * problems are diagnosable instead of invisible, and dead subscriptions are
 * pruned.
 */
export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<number> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('[push] VAPID keys not configured — skipping send for user', userId)
    return 0
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return 0

  let sent = 0
  const failures: Array<{ id: string; status: number | null; endpoint: string; message: string }> = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
        // TTL: keep the push queued at the push service for up to 24h so a
        // device that is briefly offline still receives it when it reconnects.
        { TTL: 60 * 60 * 24 }
      )
      sent++
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode ?? null
      const message = err instanceof Error ? err.message : String(err)
      failures.push({
        id: sub.id,
        status: statusCode,
        endpoint: sub.endpoint.slice(0, 60),
        message,
      })

      // Remove subscriptions that can never succeed again.
      if (statusCode !== null && PRUNE_STATUS.has(statusCode)) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  if (failures.length) {
    // Always surface in server logs (Coolify captures stdout/stderr).
    console.warn(
      `[push] ${failures.length}/${subs.length} device(s) failed for user ${userId}:`,
      failures.map((f) => `${f.status ?? '?'} ${f.endpoint}`).join(' | ')
    )
    // Best-effort durable record so failures can be inspected via SQL
    // (entity_type='push_delivery_error'). Never throws.
    try {
      await supabase.from('log_audit').insert({
        user_id: userId,
        entity_type: 'push_delivery_error',
        entity_id: userId,
        action: 'push_failed',
        new_data: {
          title: payload.title,
          attempted: subs.length,
          sent,
          failures: failures.map((f) => ({
            status: f.status,
            endpoint: f.endpoint,
            message: f.message.slice(0, 200),
          })),
        },
      })
    } catch {
      // logging must never break delivery
    }
  }

  return sent
}
