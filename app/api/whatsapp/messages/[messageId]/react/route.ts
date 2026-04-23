import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { assertMessageOwner } from "@/lib/whatsapp/authorize"

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

    const auth = await assertMessageOwner(messageId)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { emoji } = body

    if (!emoji) {
      return NextResponse.json({ error: "emoji é obrigatório" }, { status: 400 })
    }

    const supabase = createAdminClient() as SupabaseAny

    // Fetch chat wa_chat_id (already know ownership via message → instance)
    const { data: chat, error: chatError } = await supabase
      .from("wpp_chats")
      .select("wa_chat_id")
      .eq("id", auth.data.chatId)
      .single()

    if (chatError || !chat) {
      return NextResponse.json({ error: "Chat não encontrado" }, { status: 404 })
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-messaging`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        action: "react",
        instance_id: auth.data.instanceId,
        wa_chat_id: chat.wa_chat_id,
        wa_message_id: auth.data.waMessageId,
        emoji,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: result.error || "Erro ao reagir" }, { status: res.status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[whatsapp/messages/react] Erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
