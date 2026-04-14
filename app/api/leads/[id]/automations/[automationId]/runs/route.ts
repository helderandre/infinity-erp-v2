// @ts-nocheck
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermission } from "@/lib/auth/permissions"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; automationId: string }> },
) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response
  const { id: leadId, automationId } = await params
  const admin = createAdminClient()

  const { data: owner } = await admin
    .from("contact_automations")
    .select("id")
    .eq("id", automationId)
    .eq("contact_id", leadId)
    .maybeSingle()
  if (!owner) return NextResponse.json({ error: "Automatismo não encontrado" }, { status: 404 })

  const { data, error } = await admin
    .from("contact_automation_runs")
    .select("*")
    .eq("contact_automation_id", automationId)
    .order("scheduled_for", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
