import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

/**
 * GET /api/leads/[id]/custom-events
 * Returns custom commemorative events that this lead is enrolled in.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: leadId } = await params
    const supabase = createAdminClient() as SA

    // Fetch enrollments for this lead, joining to the event
    const { data: enrollments, error } = await supabase
      .from("custom_event_leads")
      .select(`
        event_id,
        added_at,
        event:custom_commemorative_events(
          id, consultant_id, name, description, event_date, send_hour,
          is_recurring, channels, email_template_id, wpp_template_id,
          smtp_account_id, wpp_instance_id, status, last_triggered_year,
          created_at, updated_at
        )
      `)
      .eq("lead_id", leadId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Flatten: extract the event from each enrollment
    const events = (enrollments ?? [])
      .filter((e: SA) => e.event !== null)
      .map((e: SA) => ({
        ...e.event,
        enrolled_at: e.added_at,
      }))

    return NextResponse.json({ events })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
