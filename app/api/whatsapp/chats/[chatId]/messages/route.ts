import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const UAZAPI_URL = (process.env.UAZAPI_URL ?? "").replace(/\/$/, "")

// ── Normalizar tipo de mensagem UAZAPI → tipo interno ──
function normalizeMessageType(uazapiType: string): string {
  const map: Record<string, string> = {
    conversation: "text",
    extendedTextMessage: "text",
    ExtendedTextMessage: "text",
    ImageMessage: "image",
    VideoMessage: "video",
    AudioMessage: "audio",
    DocumentMessage: "document",
    StickerMessage: "sticker",
    LocationMessage: "location",
    ContactMessage: "contact",
    ContactsArrayMessage: "contact",
    PollCreationMessage: "poll",
    LiveLocationMessage: "location",
    ViewOnceMessage: "view_once",
  }
  return map[uazapiType] || uazapiType.toLowerCase().replace("message", "") || "text"
}

// ── Buscar mensagens do UAZAPI e guardar no DB ──
async function fetchAndStoreMessages(
  supabase: SupabaseAny,
  chatId: string,
  instanceId: string,
  waChatId: string,
  token: string
) {
  try {
    const requestBody = { chatid: waChatId, limit: 100, offset: 0 }
    console.log(`[messages] 🔍 Fetching from UAZAPI /message/find`, {
      url: `${UAZAPI_URL}/message/find`,
      chatId,
      instanceId,
      waChatId,
      requestBody,
      tokenPrefix: token.slice(0, 8) + "...",
    })

    const res = await fetch(`${UAZAPI_URL}/message/find`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify(requestBody),
    })

    console.log(`[messages] 📡 UAZAPI response status: ${res.status}`)

    if (!res.ok) {
      const errorText = await res.text().catch(() => "")
      console.error(`[messages] ❌ UAZAPI /message/find error ${res.status}:`, errorText)
      return
    }

    const result = await res.json()
    console.log(`[messages] 📦 UAZAPI response keys:`, Object.keys(result))
    console.log(`[messages] 📦 returnedMessages:`, result.returnedMessages ?? "N/A")
    console.log(`[messages] 📦 hasMore:`, result.hasMore ?? "N/A")
    console.log(`[messages] 📦 messages array length:`, result?.messages?.length ?? "no .messages")
    console.log(`[messages] 📦 isArray(result):`, Array.isArray(result))

    // Log first message structure for debugging
    const firstMsg = result?.messages?.[0] || (Array.isArray(result) ? result[0] : null)
    if (firstMsg) {
      console.log(`[messages] 📋 First message sample:`, JSON.stringify({
        messageid: firstMsg.messageid,
        id: firstMsg.id,
        chatid: firstMsg.chatid,
        from: firstMsg.from,
        fromMe: firstMsg.fromMe,
        messageType: firstMsg.messageType,
        type: firstMsg.type,
        text: firstMsg.text?.slice(0, 50),
        body: firstMsg.body?.slice(0, 50),
        messageTimestamp: firstMsg.messageTimestamp,
        keys: Object.keys(firstMsg),
      }))
    } else {
      console.log(`[messages] ⚠️ No messages found in response`)
    }

    const uazapiMessages = result?.messages || (Array.isArray(result) ? result : [])

    if (!Array.isArray(uazapiMessages) || uazapiMessages.length === 0) {
      console.log(`[messages] ⚠️ Empty messages array, skipping DB insert`)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = uazapiMessages.map((msg: any) => {
      const fromMe = msg.fromMe === true
      const rawType = msg.messageType || msg.type || "text"
      const messageType = normalizeMessageType(rawType)
      const waMessageId = msg.messageid || msg.id || ""
      // Normalizar timestamp para segundos (UAZAPI pode enviar em ms ou s)
      let timestamp = msg.messageTimestamp ? Number(msg.messageTimestamp) : Math.floor(Date.now() / 1000)
      if (timestamp > 10_000_000_000) timestamp = Math.floor(timestamp / 1000)

      const content = (typeof msg.content === "object" && msg.content !== null) ? msg.content : {}
      const isMedia = ["image", "video", "audio", "document", "sticker"].includes(messageType)

      let text = ""
      if (isMedia) {
        text = msg.caption || content.caption || ""
      } else {
        text = msg.text || msg.body || ""
        if (typeof text === "object") text = ""
      }

      return {
        chat_id: chatId,
        instance_id: instanceId,
        wa_message_id: waMessageId,
        sender: msg.sender || msg.participant || "",
        sender_name: msg.senderName || msg.pushName || "",
        from_me: fromMe,
        message_type: messageType,
        text,
        media_url: msg.fileURL || msg.mediaUrl || "",
        media_mime_type: msg.mimetype || content.mimetype || "",
        media_file_name: msg.fileName || content.fileName || "",
        media_file_size: msg.fileLength || content.fileLength || null,
        media_duration: msg.seconds || content.seconds || null,
        quoted_message_id: msg.quoted || content?.contextInfo?.stanzaId || "",
        status: fromMe ? "sent" : "received",
        is_group: msg.isGroup === true || waChatId.includes("@g.us"),
        is_forwarded: msg.isForwarded === true || content?.contextInfo?.isForwarded === true,
        latitude: content.degreesLatitude || msg.latitude || null,
        longitude: content.degreesLongitude || msg.longitude || null,
        location_name: content.name || msg.locationName || null,
        vcard: content.vcard || msg.vcard || null,
        timestamp,
        raw_data: msg,
      }
    }).filter((r: { wa_message_id: string }) => r.wa_message_id)

    if (rows.length === 0) return

    // Batch upsert (ignore conflicts — webhook may have inserted some already)
    const { error: upsertError } = await supabase
      .from("wpp_messages")
      .upsert(rows, { onConflict: "instance_id,wa_message_id", ignoreDuplicates: true })

    if (upsertError) {
      console.error(`[messages] ❌ Upsert error:`, upsertError.message, upsertError.details)
    } else {
      console.log(`[messages] ✅ Synced ${rows.length} messages from UAZAPI for chat ${waChatId}`)
    }
  } catch (err) {
    console.error("[messages] fetchAndStoreMessages error:", err)
  }
}

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

    // Check if we have enough messages for this chat
    const { count } = await supabase
      .from("wpp_messages")
      .select("id", { count: "exact", head: true })
      .eq("chat_id", chatId)

    console.log(`[messages] 📊 GET chatId=${chatId} | DB count=${count} | before=${before} | after=${after}`)

    // If few messages and first load (no pagination), fetch history from UAZAPI
    // Threshold of 10: webhook may have added a few recent messages but
    // historical messages haven't been synced yet
    if ((count ?? 0) < 10 && !before && !after) {
      console.log(`[messages] 🚀 Triggering UAZAPI fetch (count=${count} < 10)`)

      const { data: chat, error: chatErr } = await supabase
        .from("wpp_chats")
        .select("instance_id, wa_chat_id")
        .eq("id", chatId)
        .single()

      console.log(`[messages] 💬 Chat lookup:`, chat ? { instance_id: chat.instance_id, wa_chat_id: chat.wa_chat_id } : `Error: ${chatErr?.message}`)

      if (chat) {
        const { data: inst, error: instErr } = await supabase
          .from("auto_wpp_instances")
          .select("uazapi_token")
          .eq("id", chat.instance_id)
          .single()

        console.log(`[messages] 🔑 Instance token:`, inst?.uazapi_token ? `${inst.uazapi_token.slice(0, 8)}...` : `Error: ${instErr?.message}`)

        if (inst?.uazapi_token) {
          await fetchAndStoreMessages(supabase, chatId, chat.instance_id, chat.wa_chat_id, inst.uazapi_token)
        } else {
          console.error(`[messages] ❌ No token found for instance ${chat.instance_id}`)
        }
      } else {
        console.error(`[messages] ❌ Chat not found: ${chatId}`)
      }
    } else {
      console.log(`[messages] ⏭️ Skipping UAZAPI fetch (count=${count}, before=${before}, after=${after})`)
    }

    // Now query messages from DB
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
