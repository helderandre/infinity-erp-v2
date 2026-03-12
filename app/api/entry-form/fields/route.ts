import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Public endpoint — no auth required
export async function GET() {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("recruitment_form_fields")
    .select("field_key, label, section, field_type, options, placeholder, is_visible, is_required, is_ai_extractable, order_index")
    .eq("is_visible", true)
    .order("order_index")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fields: data ?? [] })
}
