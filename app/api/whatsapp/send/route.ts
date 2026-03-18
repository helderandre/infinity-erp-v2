import { NextResponse } from "next/server"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const TYPE_TO_ACTION: Record<string, string> = {
  text: "send_text",
  image: "send_media",
  video: "send_media",
  document: "send_media",
  audio: "send_audio",
  ptt: "send_audio",
  location: "send_location",
  contact: "send_contact",
  sticker: "send_sticker",
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { instance_id, wa_chat_id, type = "text", ...rest } = body

    if (!instance_id || !wa_chat_id) {
      return NextResponse.json(
        { error: "instance_id e wa_chat_id são obrigatórios" },
        { status: 400 }
      )
    }

    const action = TYPE_TO_ACTION[type]
    if (!action) {
      return NextResponse.json(
        { error: `Tipo "${type}" não suportado` },
        { status: 400 }
      )
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-messaging`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ action, instance_id, wa_chat_id, type, ...rest }),
    })

    const result = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: result.error || "Erro ao enviar mensagem" }, { status: res.status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[whatsapp/send] Erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
