import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"

/**
 * GET /api/crm/notifications — list notifications for the current user
 * Query params: unread_only (boolean), limit (number), offset (number)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = req.nextUrl
    const unreadOnly = searchParams.get("unread_only") === "true"
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50)
    const offset = parseInt(searchParams.get("offset") || "0")

    const db = createCrmAdminClient()

    let query = db
      .from("leads_notifications")
      .select("*", { count: "exact" })
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.eq("is_read", false)
    }

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Also get unread count
    const { count: unreadCount } = await db
      .from("leads_notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false)

    return NextResponse.json({
      notifications: data,
      total: count,
      unread_count: unreadCount ?? 0,
    })
  } catch (err) {
    console.error("[Notifications GET]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

/**
 * PUT /api/crm/notifications — mark notifications as read
 * Body: { ids: string[] } or { all: true }
 */
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()

    const db = createCrmAdminClient()

    if (body.all === true) {
      const { error } = await db
        .from("leads_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("recipient_id", user.id)
        .eq("is_read", false)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ status: "ok" })
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const { error } = await db
        .from("leads_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("recipient_id", user.id)
        .in("id", body.ids)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ status: "ok" })
    }

    return NextResponse.json({ error: "Provide ids array or all: true" }, { status: 400 })
  } catch (err) {
    console.error("[Notifications PUT]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
