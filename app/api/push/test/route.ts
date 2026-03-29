import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { createClient } from "@/lib/supabase/server"
import { sendPushToUser } from "@/lib/crm/send-push"

/**
 * POST /api/push/test
 * Sends a test push notification to the current user.
 * For development/testing only.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createCrmAdminClient()

    // Check if user has any push subscriptions
    const { data: subs, error } = await db
      .from("push_subscriptions")
      .select("id, endpoint")
      .eq("user_id", user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!subs?.length) {
      return NextResponse.json({
        error: "Sem subscriptions. Active as notificações primeiro (banner no topo do dashboard).",
        subscriptions: 0,
      }, { status: 400 })
    }

    // Send test push
    const sent = await sendPushToUser(db, user.id, {
      title: "🔔 Teste de Notificação",
      body: "Se está a ver isto, as push notifications estão a funcionar!",
      url: "/dashboard/crm/gestora",
      tag: "test",
    })

    // Also create an in-app notification
    await db.from("leads_notifications").insert({
      recipient_id: user.id,
      type: "system",
      title: "Teste de notificação push",
      body: `Push enviado para ${sent} dispositivo(s).`,
      link: "/dashboard/crm/gestora",
    })

    return NextResponse.json({
      success: true,
      subscriptions: subs.length,
      pushes_sent: sent,
    })
  } catch (err) {
    console.error("[Push Test]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
