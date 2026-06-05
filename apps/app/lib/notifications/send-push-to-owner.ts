/**
 * Send Web Push notifications to an owner's subscribed devices.
 * Mirrors lib/crm/send-push.ts (sendPushToUser) but reads owner_push_subscriptions.
 */

import webpush from 'web-push'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>

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

export async function sendPushToOwner(
  supabase: SupabaseClient,
  ownerId: string,
  payload: PushPayload
): Promise<number> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return 0

  const { data: subs } = await supabase
    .from('owner_push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('owner_id', ownerId)

  if (!subs?.length) return 0

  let sent = 0
  for (const sub of subs as { id: string; endpoint: string; p256dh: string; auth: string }[]) {
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
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 410 || statusCode === 404) {
        await supabase.from('owner_push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  return sent
}
