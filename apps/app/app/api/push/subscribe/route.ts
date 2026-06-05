import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/push/subscribe — save a push subscription for the current user.
 * DELETE /api/push/subscribe — remove subscription (user opted out).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { subscription } = await req.json()
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
    }

    const db = createCrmAdminClient()
    const { error } = await db.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: req.headers.get("user-agent") || null,
      },
      { onConflict: "user_id,endpoint" }
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { endpoint } = await req.json()
    const db = createCrmAdminClient()

    if (endpoint) {
      await db.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint)
    } else {
      await db.from("push_subscriptions").delete().eq("user_id", user.id)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
