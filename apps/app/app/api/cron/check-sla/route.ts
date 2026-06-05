import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkSlaStatuses } from "@/lib/crm/sla-engine"

/**
 * Cron job — runs every 5 minutes.
 * Checks all active lead entries for SLA violations and creates
 * warning/breach/escalation notifications.
 */
export async function GET(req: NextRequest) {
  // Verify cron authorization
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const result = await checkSlaStatuses(supabase)

    console.log(
      `[Cron SLA Check] Done: ${result.entries_checked} checked, ` +
      `${result.warnings_created} warnings, ${result.breaches_created} breaches, ` +
      `${result.escalations_created} escalations`
    )

    return NextResponse.json(result)
  } catch (err) {
    console.error("[Cron SLA Check] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
