import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { createClient } from "@/lib/supabase/server"
import { resolveRulePropertyLinkage } from "@/lib/crm/resolve-rule-property"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await req.json() as Record<string, unknown>
    const db = createCrmAdminClient()

    // Only run linkage resolution when the caller actually touched property_*.
    // PUT is partial — toggling `is_active` shouldn't trigger an unrelated lookup.
    const touchedProperty =
      Object.prototype.hasOwnProperty.call(body, 'property_external_ref') ||
      Object.prototype.hasOwnProperty.call(body, 'property_id')

    let updatePayload: Record<string, unknown> = body
    if (touchedProperty) {
      const linkage = await resolveRulePropertyLinkage(db, {
        property_external_ref: (body.property_external_ref ?? null) as string | null,
        property_id: (body.property_id ?? null) as string | null,
      })
      if (linkage.error) {
        return NextResponse.json({ error: linkage.error }, { status: 400 })
      }
      updatePayload = {
        ...body,
        property_external_ref: linkage.property_external_ref,
        property_id: linkage.property_id,
      }
    }

    const { data, error } = await db
      .from("leads_assignment_rules")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const db = createCrmAdminClient()
    const { error } = await db.from("leads_assignment_rules").delete().eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
