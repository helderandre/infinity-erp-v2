import { NextResponse } from "next/server"
import { assertChatOwner } from "@/lib/whatsapp/authorize"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params

    const auth = await assertChatOwner(chatId)
    if (!auth.ok) return auth.response

    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-messaging`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        action: "mark_read",
        instance_id: auth.data.instanceId,
        wa_chat_id: auth.data.waChatId,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: result.error || "Erro ao marcar como lido" }, { status: res.status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[whatsapp/chats/read] Erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
