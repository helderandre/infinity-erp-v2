import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { createClient } from "@/lib/supabase/server"
import { createAssignmentRuleSchema } from "@/lib/validations/leads-crm"
import { resolveRulePropertyLinkage } from "@/lib/crm/resolve-rule-property"

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createCrmAdminClient()
    const { data, error } = await db
      .from("leads_assignment_rules")
      .select("*")
      .order("priority", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const parsed = createAssignmentRuleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const db = createCrmAdminClient()

    // Resolve external_ref ↔ UUID so both columns stay in sync. Returns 400
    // when the gestora supplied a ref/id that doesn't exist in dev_properties.
    const linkage = await resolveRulePropertyLinkage(db, {
      property_external_ref: parsed.data.property_external_ref ?? null,
      property_id: parsed.data.property_id ?? null,
    })
    if (linkage.error) {
      return NextResponse.json({ error: linkage.error }, { status: 400 })
    }

    const insertPayload = {
      ...parsed.data,
      property_external_ref: linkage.property_external_ref,
      property_id: linkage.property_id,
    }

    const { data, error } = await db
      .from("leads_assignment_rules")
      .insert(insertPayload)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
