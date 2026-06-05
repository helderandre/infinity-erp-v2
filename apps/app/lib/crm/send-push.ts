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

/**
 * Send a push notification to all devices of a user.
 * Silently fails if VAPID keys aren't configured.
 */
export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<number> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return 0

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return 0

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      )
      sent++
    } catch (err: unknown) {
      // If subscription expired (410 Gone), remove it
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 410 || statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  return sent
}
