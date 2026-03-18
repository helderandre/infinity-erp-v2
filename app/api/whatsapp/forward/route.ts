import { NextResponse } from "next/server"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { instance_id, wa_message_id, to_wa_chat_id } = body

    if (!instance_id || !wa_message_id || !to_wa_chat_id) {
      return NextResponse.json(
        { error: "instance_id, wa_message_id e to_wa_chat_id são obrigatórios" },
        { status: 400 }
      )
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-messaging`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        action: "forward",
        instance_id,
        wa_message_id,
        to_chat_id: to_wa_chat_id,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: result.error || "Erro ao reencaminhar mensagem" },
        { status: res.status }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[whatsapp/forward] Erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
