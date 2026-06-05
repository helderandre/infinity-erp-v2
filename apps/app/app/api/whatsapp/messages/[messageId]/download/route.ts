import { NextResponse } from "next/server"
import { assertMessageOwner } from "@/lib/whatsapp/authorize"

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
    const { transcribe, generate_mp3 } = body

    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-messaging`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        action: "download_media",
        instance_id: auth.data.instanceId,
        wa_message_id: auth.data.waMessageId,
        transcribe,
        generate_mp3,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: result.error || "Erro ao descarregar media" }, { status: res.status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[whatsapp/messages/download] Erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
