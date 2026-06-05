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

    // 2. Create entry with configurable SLA (default 2 minutes)
    const body = await req.json().catch(() => ({}))
    const slaMinutes = body.minutes ?? 2
    const now = new Date()
    const deadline = new Date(now.getTime() + slaMinutes * 60 * 1000)

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
      sla_minutes: slaMinutes,
      message: `Entrada criada com SLA de ${slaMinutes} minuto(s). O cron check-sla irá detectar automaticamente.`,
      timeline: {
        "agora": "SLA status: pending",
        [`~${Math.round(slaMinutes * 0.5)}min`]: "SLA warning → push + in-app notification",
        [`~${slaMinutes}min`]: "SLA breached → push + in-app + email notification",
        [`~${Math.round(slaMinutes * 1.5)}min`]: "SLA escalation → push + in-app + email to gestoras",
      },
    })
  } catch (err) {
    console.error("[Test SLA]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
