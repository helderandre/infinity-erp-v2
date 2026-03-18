import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

const UAZAPI_URL = (process.env.UAZAPI_URL ?? "").replace(/\/$/, "")
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instanceId } = await params
    const supabase = createAdminClient() as SupabaseAny

    // Fetch instance to get uazapi_token
    const { data: instance, error: instError } = await supabase
      .from("auto_wpp_instances")
      .select("uazapi_token")
      .eq("id", instanceId)
      .single()

    if (instError || !instance) {
      return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 })
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook-receiver`

    // Register webhook on UAZAPI
    const res = await fetch(`${UAZAPI_URL}/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: instance.uazapi_token,
      },
      body: JSON.stringify({
        enabled: true,
        url: webhookUrl,
        events: [
          "messages",
          "messages_update",
          "connection",
          "contacts",
          "presence",
          "labels",
          "chats",
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return NextResponse.json(
        { error: "Erro ao registar webhook no UAZAPI", details: text },
        { status: 502 }
      )
    }

    // Update instance with webhook info
    await supabase
      .from("auto_wpp_instances")
      .update({
        webhook_url: webhookUrl,
        webhook_registered_at: new Date().toISOString(),
      })
      .eq("id", instanceId)

    return NextResponse.json({ success: true, webhook_url: webhookUrl })
  } catch (error) {
    console.error("[whatsapp/instances/webhook] Erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
