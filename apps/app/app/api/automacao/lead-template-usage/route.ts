import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions"

// GET /api/automacao/lead-template-usage
// Returns distinct template IDs that are assigned to leads via contact_automation_lead_settings
// for the authenticated consultant's leads
export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any

    // Get all lead settings for leads assigned to this consultant
    const { data, error } = await supabase
      .from("contact_automation_lead_settings")
      .select("email_template_id, wpp_template_id, leads!inner(agent_id)")
      .eq("leads.agent_id", auth.user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const emailIds = new Set<string>()
    const wppIds = new Set<string>()

    for (const row of data ?? []) {
      if (row.email_template_id) emailIds.add(row.email_template_id)
      if (row.wpp_template_id) wppIds.add(row.wpp_template_id)
    }

    return NextResponse.json({
      email_template_ids: [...emailIds],
      wpp_template_ids: [...wppIds],
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 })
  }
}
