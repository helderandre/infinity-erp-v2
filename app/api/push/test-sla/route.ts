import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/push/test-sla
 * Creates a fake lead entry with a 1-minute SLA assigned to the current user.
 * After ~30 seconds the SLA cron will trigger a warning, after ~1 minute a breach.
 *
 * For development/testing only.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createCrmAdminClient()

    // 1. Find or create a test contact
    let contactId: string
    const { data: existing } = await db
      .from("leads")
      .select("id")
      .eq("email", "teste-sla@exemplo.pt")
      .single()

    if (existing) {
      contactId = existing.id
    } else {
      const { data: newContact } = await db
        .from("leads")
        .insert({ nome: "Teste SLA Push", email: "teste-sla@exemplo.pt", telemovel: "+351999999999", origem: "other" })
        .select("id")
        .single()
      contactId = newContact!.id
    }

    // 2. Create entry with 1-minute SLA (warning at 30s, breach at 1min)
    const now = new Date()
    const deadline = new Date(now.getTime() + 60 * 1000) // 1 minute from now

    const { data: entry, error } = await db
      .from("leads_entries")
      .insert({
        contact_id: contactId,
        source: "other",
        assigned_agent_id: user.id,
        sector: "real_estate_buy",
        is_reactivation: false,
        status: "new",
        priority: "urgent",
        sla_deadline: deadline.toISOString(),
        sla_status: "pending",
        notes: "Entrada de teste para push notifications",
      })
      .select("id")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      entry_id: entry!.id,
      contact_id: contactId,
      sla_deadline: deadline.toISOString(),
      message: "Entrada criada com SLA de 1 minuto. O cron check-sla irá detectar e enviar notificações. Execute manualmente: curl <URL>/api/cron/check-sla",
      timeline: {
        "agora": "SLA status: pending",
        "~30s": "SLA warning → push + email + in-app notification",
        "~1min": "SLA breached → push + email + in-app notification to you + gestoras",
      },
    })
  } catch (err) {
    console.error("[Test SLA]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
