import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

type SupabaseAny = any

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const supabase = createAdminClient() as SupabaseAny
    const { key } = await params

    let payload: unknown
    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      payload = await request.json()
    } else {
      payload = { raw: await request.text() }
    }

    // Find associated trigger
    const { data: trigger } = await supabase
      .from("auto_triggers")
      .select("flow_id, auto_flows!inner(name)")
      .eq("trigger_source", key)
      .eq("source_type", "webhook")
      .single()

    // Store capture for Realtime inspection in the editor
    await supabase.from("auto_webhook_captures").upsert({
      source_id: key,
      flow_name: trigger?.auto_flows?.name || "Desconhecido",
      payload,
      received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    return NextResponse.json({
      ok: true,
      mode: trigger ? "captured" : "unknown_key",
    })
  } catch (error) {
    console.error("Webhook receiver error:", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao processar webhook" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Webhook endpoint activo" })
}
