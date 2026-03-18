import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params
    const supabase = createAdminClient() as SupabaseAny
    const body = await request.json()
    const { to_chat_id } = body

    if (!to_chat_id) {
      return NextResponse.json({ error: "to_chat_id é obrigatório" }, { status: 400 })
    }

    const { data: message, error: msgError } = await supabase
      .from("wpp_messages")
      .select("instance_id, wa_message_id")
      .eq("id", messageId)
      .single()

    if (msgError || !message) {
      return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 })
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-messaging`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        action: "forward",
        instance_id: message.instance_id,
        wa_message_id: message.wa_message_id,
        to_chat_id,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: result.error || "Erro ao reencaminhar" }, { status: res.status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[whatsapp/messages/forward] Erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
