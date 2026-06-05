import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth } from "@/lib/auth/permissions"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

/**
 * GET /api/automacao/channel-availability
 *
 * Devolve o número de contas de email activas e instâncias WhatsApp
 * conectadas do consultor autenticado. Consumido pelo Sheet para
 * decidir se cada chip de canal está "activo" ou "indisponível".
 *
 * Cache: `private, max-age=60` — módulo-level no cliente também.
 */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const supabase = createAdminClient() as SA

  const [{ count: emailCount }, { count: wppCount }] = await Promise.all([
    supabase
      .from("consultant_email_accounts")
      .select("id", { count: "exact", head: true })
      .eq("consultant_id", auth.user.id)
      .eq("is_active", true),
    supabase
      .from("auto_wpp_instances")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .eq("connection_status", "connected"),
  ])

  const account_count = emailCount ?? 0
  const instance_count = wppCount ?? 0

  return NextResponse.json(
    {
      email: { available: account_count > 0, account_count },
      whatsapp: { available: instance_count > 0, instance_count },
    },
    {
      headers: { "Cache-Control": "private, max-age=60" },
    },
  )
}
