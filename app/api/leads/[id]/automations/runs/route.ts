// @ts-nocheck
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermission } from "@/lib/auth/permissions"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const { id: leadId } = await params
  const admin = createAdminClient()

  const { data: automations, error: autoErr } = await admin
    .from("contact_automations")
    .select("id")
    .eq("contact_id", leadId)

  if (autoErr) return NextResponse.json({ error: autoErr.message }, { status: 500 })
  const ids = (automations ?? []).map((a: any) => a.id)
  if (ids.length === 0) return NextResponse.json([])

  const { data: runs, error } = await admin
    .from("contact_automation_runs")
    .select(
      "id, contact_automation_id, scheduled_for, sent_at, status, skip_reason, error",
    )
    .in("contact_automation_id", ids)
    .order("scheduled_for", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(runs ?? [])
}
