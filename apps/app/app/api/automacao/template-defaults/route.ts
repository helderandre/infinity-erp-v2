import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions"
import { z } from "zod"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

const setDefaultSchema = z.object({
  category: z.string().min(1),
  channel: z.enum(["email", "whatsapp"]),
  template_id: z.string().uuid(),
})

// GET /api/automacao/template-defaults — list consultant's defaults
export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createAdminClient() as SA
    const { data, error } = await supabase
      .from("consultant_template_defaults")
      .select("*")
      .eq("consultant_id", auth.user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ defaults: data ?? [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 })
  }
}

// POST /api/automacao/template-defaults — set a default template
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const parsed = setDefaultSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = createAdminClient() as SA
    const { data, error } = await supabase
      .from("consultant_template_defaults")
      .upsert({
        consultant_id: auth.user.id,
        category: parsed.data.category,
        channel: parsed.data.channel,
        template_id: parsed.data.template_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "consultant_id,category,channel" })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ default: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 })
  }
}
