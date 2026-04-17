import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions"

export async function GET() {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const supabase = createAdminClient()
  const userId = auth.user.id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [smtpRes, wppRes] = await Promise.all([
    (supabase as any)
      .from("consultant_email_accounts")
      .select("id, email_address, display_name, is_active, is_verified, is_default, created_at")
      .eq("consultant_id", userId)
      .order("created_at", { ascending: true }),
    (supabase as any)
      .from("auto_wpp_instances")
      .select("id, name, phone, connection_status, is_default, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ])

  return NextResponse.json({
    smtp: smtpRes.data ?? [],
    wpp: wppRes.data ?? [],
  })
}
