import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/auth/permissions"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const schema = z.object({
  type: z.enum(["smtp", "wpp"]),
  id: z.string().regex(UUID_REGEX),
})

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { type, id } = parsed.data
  const userId = auth.user.id

  if (type === "smtp") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: acc } = await (supabase as any)
      .from("consultant_email_accounts")
      .select("id, consultant_id")
      .eq("id", id)
      .maybeSingle()
    if (!acc || acc.consultant_id !== userId) {
      return NextResponse.json({ error: "Conta não encontrada ou não lhe pertence" }, { status: 404 })
    }

    // Unset previous default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("consultant_email_accounts")
      .update({ is_default: false })
      .eq("consultant_id", userId)
      .eq("is_default", true)

    // Set new default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("consultant_email_accounts")
      .update({ is_default: true })
      .eq("id", id)

    return NextResponse.json({ ok: true })
  }

  if (type === "wpp") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inst } = await (supabase as any)
      .from("auto_wpp_instances")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle()
    if (!inst || inst.user_id !== userId) {
      return NextResponse.json({ error: "Instância não encontrada ou não lhe pertence" }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("auto_wpp_instances")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("is_default", true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("auto_wpp_instances")
      .update({ is_default: true })
      .eq("id", id)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })
}
