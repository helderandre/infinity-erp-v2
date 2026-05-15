import { NextResponse } from 'next/server'

/**
 * GET /api/push/public-key — expose the VAPID public key at runtime.
 *
 * The VAPID public key is, by definition, public; exposing it via an
 * unauthenticated endpoint is safe.
 *
 * Why this exists: Next.js inlines NEXT_PUBLIC_* vars at BUILD time. When the
 * Coolify build doesn't have the env (a frequent oversight), the bundle ships
 * with `undefined`. Reading the env in a route handler avoids that pitfall —
 * the server reads it at request time, so as long as the env exists at
 * runtime, push works.
 *
 * To revert: delete this file and revert the resolveVapidKey() call in
 * hooks/use-push-subscription.ts.
 */
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null
  return NextResponse.json(
    { key },
    {
      headers: {
        // Public, immutable per build; cache for 5 minutes on edge/CDN.
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    },
  )
}
