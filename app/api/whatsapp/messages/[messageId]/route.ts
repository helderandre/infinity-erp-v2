import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params
    const supabase = createAdminClient() as SupabaseAny

    const { data, error } = await supabase
      .from("wpp_messages")
      .select("*")
      .eq("id", messageId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("[whatsapp/messages] GET erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params
    const supabase = createAdminClient() as SupabaseAny
    const body = await request.json()
    const { new_text } = body

    if (!new_text) {
      return NextResponse.json({ error: "new_text é obrigatório" }, { status: 400 })
    }

    // Fetch message to get instance_id and wa_message_id
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
        action: "edit_message",
        instance_id: message.instance_id,
        wa_message_id: message.wa_message_id,
        new_text,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: result.error || "Erro ao editar mensagem" }, { status: res.status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[whatsapp/messages] PUT erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params
    const supabase = createAdminClient() as SupabaseAny
    const body = await request.json()
    const { for_everyone } = body

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
        action: "delete_message",
        instance_id: message.instance_id,
        wa_message_id: message.wa_message_id,
        for_everyone,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: result.error || "Erro ao eliminar mensagem" }, { status: res.status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[whatsapp/messages] DELETE erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
