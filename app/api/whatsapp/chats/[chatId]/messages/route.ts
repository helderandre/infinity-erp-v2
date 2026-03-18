import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params
    const supabase = createAdminClient() as SupabaseAny
    const { searchParams } = new URL(request.url)

    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const before = searchParams.get("before")
    const after = searchParams.get("after")

    let query = supabase
      .from("wpp_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("timestamp", { ascending: false })
      .limit(limit)

    if (before) {
      query = query.lt("timestamp", parseInt(before, 10))
    }

    if (after) {
      query = query.gt("timestamp", parseInt(after, 10))
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Reverse to chronological order
    const messages = (data ?? []).reverse()

    // Fetch quoted messages
    const quotedIds = messages
      .map((m: { quoted_message_id?: string | null }) => m.quoted_message_id)
      .filter((id: string | null | undefined): id is string => !!id)

    let quotedMessages: Record<string, unknown> = {}

    if (quotedIds.length > 0) {
      const { data: quotedData } = await supabase
        .from("wpp_messages")
        .select("wa_message_id, text, message_type, sender_name, from_me, media_url")
        .in("wa_message_id", quotedIds)

      if (quotedData) {
        quotedMessages = Object.fromEntries(
          quotedData.map((q: { wa_message_id: string; text: string | null; message_type: string; sender_name: string | null; from_me: boolean; media_url: string | null }) => [
            q.wa_message_id,
            { text: q.text, message_type: q.message_type, sender_name: q.sender_name, from_me: q.from_me, media_url: q.media_url },
          ])
        )
      }
    }

    return NextResponse.json({
      messages,
      quoted_messages: quotedMessages,
      has_more: (data ?? []).length === limit,
    })
  } catch (error) {
    console.error("[whatsapp/chats/messages] GET erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params
    const supabase = createAdminClient() as SupabaseAny
    const body = await request.json()

    // Fetch chat to get instance_id and wa_chat_id
    const { data: chat, error: chatError } = await supabase
      .from("wpp_chats")
      .select("instance_id, wa_chat_id")
      .eq("id", chatId)
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
        action: body.action || "send_text",
        instance_id: chat.instance_id,
        wa_chat_id: chat.wa_chat_id,
        ...body,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: result.error || "Erro ao enviar mensagem" }, { status: res.status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[whatsapp/chats/messages] POST erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
