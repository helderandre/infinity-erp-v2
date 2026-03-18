import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ── Normalizar tipo de mensagem UAZAPI → tipo interno ──
function normalizeMessageType(uazapiType: string): string {
  const map: Record<string, string> = {
    "conversation": "text",
    "extendedTextMessage": "text",
    "ExtendedTextMessage": "text",
    "ImageMessage": "image",
    "VideoMessage": "video",
    "AudioMessage": "audio",
    "DocumentMessage": "document",
    "StickerMessage": "sticker",
    "LocationMessage": "location",
    "ContactMessage": "contact",
    "ContactsArrayMessage": "contact",
    "ReactionMessage": "reaction",
    "PollCreationMessage": "poll",
    "LiveLocationMessage": "location",
    "PollUpdateMessage": "poll",
    "ViewOnceMessage": "view_once",
    "EditedMessage": "edited",
    "ProtocolMessage": "protocol",
  }
  return map[uazapiType] || uazapiType.toLowerCase().replace("message", "") || "text"
}

// ── Limpar nome: evitar JIDs e números puros como nome ──
function cleanName(name: string): string {
  if (!name) return ""
  if (name.includes("@")) return ""
  if (/^\+?\d+$/.test(name.trim())) return ""
  return name.trim()
}

// ── Extrair telefone do JID ──
function extractPhone(jid: string): string {
  return jid.includes("@") ? jid.split("@")[0] : ""
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const payload = await req.json()

    // Debug: salvar payload cru (apenas em desenvolvimento)
    await supabase
      .from("_debug_wpp_payloads")
      .insert({
        source: "whatsapp",
        event_type: payload.EventType || payload.event || "unknown",
        payload,
      })
      .then(() => {})
      .catch(() => {})

    const rawEvent = (payload.EventType || payload.event || "").toLowerCase().trim()
    const instanceToken = payload.token || ""

    // Buscar instância pelo token
    const { data: instance } = await supabase
      .from("auto_wpp_instances")
      .select("id")
      .eq("uazapi_token", instanceToken)
      .maybeSingle()

    if (!instance) {
      console.warn("[webhook] Instance not found for token:", instanceToken.slice(0, 8))
      return new Response(JSON.stringify({ ok: false, reason: "instance_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const instanceId = instance.id

    // Normalizar evento
    const event = rawEvent
      .replace("messages.upsert", "messages")
      .replace("messages.update", "messages_update")

    switch (event) {
      case "messages":
      case "message":
      case "messages.upsert": {
        const msgData = payload.message || payload.data
        await handleNewMessage(instanceId, msgData, payload.chat)
        break
      }
      case "messages_update":
      case "status":
      case "messages.update": {
        const msgData = payload.message || payload.data
        await handleMessageUpdate(instanceId, msgData)
        break
      }
      case "connection": {
        await handleConnection(instanceId, payload.data || payload)
        break
      }
      case "contacts": {
        await handleContacts(instanceId, payload.data || payload.contacts || [])
        break
      }
      case "presence": {
        // Presença é tratada via Supabase Broadcast (não persiste no DB)
        await handlePresence(instanceId, payload.data || payload)
        break
      }
      case "labels": {
        await handleLabels(instanceId, payload.data || payload.labels || [])
        break
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err: any) {
    console.error("[webhook-receiver] Error:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

// ═══════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════

async function handleNewMessage(instanceId: string, msg: any, chatInfo?: any) {
  if (!msg) return

  const waChatId = msg.chatid || msg.from || ""
  if (!waChatId) return

  const fromMe = msg.fromMe === true
  const rawMessageType = msg.messageType || msg.type || "text"
  const messageType = normalizeMessageType(rawMessageType)
  const phone = extractPhone(waChatId)
  const isGroup = msg.isGroup === true || waChatId.includes("@g.us")
  const sender = msg.sender || msg.participant || ""
  const senderName = msg.senderName || msg.pushName || ""
  const waMessageId = msg.messageid || msg.id || ""
  const messageTimestamp = msg.messageTimestamp ? Number(msg.messageTimestamp) : Date.now()
  const quotedId = msg.quoted || msg.content?.contextInfo?.stanzaId || ""
  const isForwarded = msg.isForwarded === true || msg.content?.contextInfo?.isForwarded === true

  // ── Extrair conteúdo ──
  const content = (typeof msg.content === "object" && msg.content !== null) ? msg.content : {}
  const isMedia = ["image", "video", "audio", "document", "sticker"].includes(messageType)

  let text = ""
  if (isMedia) {
    text = msg.caption || content.caption || ""
  } else {
    text = msg.text || msg.body || ""
    if (typeof text === "object") text = ""
  }

  // Media URL: UAZAPI fileURL (já desencriptado pelo UAZAPI quando disponível)
  const mediaUrl = msg.fileURL || msg.mediaUrl || ""
  const mediaMimeType = msg.mimetype || content.mimetype || ""
  const mediaFileName = msg.fileName || content.fileName || ""
  const mediaFileSize = msg.fileLength || content.fileLength || null
  const mediaDuration = msg.seconds || content.seconds || null

  // Localização
  const latitude = content.degreesLatitude || msg.latitude || null
  const longitude = content.degreesLongitude || msg.longitude || null
  const locationName = content.name || msg.locationName || null

  // vCard
  const vcard = content.vcard || msg.vcard || null

  const status = fromMe ? "sent" : "received"

  // ── Tratar reacções como update na mensagem alvo ──
  if (messageType === "reaction") {
    const reactionTargetId = msg.reaction || content?.key?.id || ""
    const reactionEmoji = msg.text || content?.text || ""
    if (reactionTargetId && reactionEmoji) {
      await handleReaction(instanceId, reactionTargetId, reactionEmoji, sender || waChatId, fromMe, messageTimestamp)
    }
    return
  }

  // ── Mensagem editada ──
  if (messageType === "edited") {
    const editedMsgId = content?.protocolMessage?.key?.id || msg.editedMessageId || ""
    const newText = content?.protocolMessage?.editedMessage?.conversation ||
                    content?.protocolMessage?.editedMessage?.extendedTextMessage?.text || ""
    if (editedMsgId && newText) {
      await supabase
        .from("wpp_messages")
        .update({ text: newText, raw_data: msg })
        .eq("instance_id", instanceId)
        .eq("wa_message_id", editedMsgId)
    }
    return
  }

  // ── Mensagem apagada (ProtocolMessage com type = 0) ──
  if (messageType === "protocol") {
    const deletedMsgId = content?.protocolMessage?.key?.id || ""
    const protocolType = content?.protocolMessage?.type
    if (deletedMsgId && protocolType === 0) {
      await supabase
        .from("wpp_messages")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: fromMe ? "sender" : "receiver",
        })
        .eq("instance_id", instanceId)
        .eq("wa_message_id", deletedMsgId)
    }
    return
  }

  // ── Upsert contacto ──
  const contactJid = isGroup ? sender : waChatId
  if (contactJid && !isGroup) {
    await supabase
      .from("wpp_contacts")
      .upsert({
        instance_id: instanceId,
        wa_contact_id: contactJid,
        phone: extractPhone(contactJid),
        name: cleanName(senderName) || undefined,
        updated_at: new Date().toISOString(),
      }, { onConflict: "instance_id,wa_contact_id", ignoreDuplicates: false })
  }

  // ── Upsert chat ──
  const rawChatName = chatInfo?.wa_contactName || chatInfo?.name || chatInfo?.wa_name || senderName || ""
  const chatName = cleanName(rawChatName)
  const chatImage = chatInfo?.imagePreview || chatInfo?.image || ""

  // Buscar ou criar contacto para vincular ao chat
  let contactId: string | null = null
  if (!isGroup) {
    const { data: contactRow } = await supabase
      .from("wpp_contacts")
      .select("id")
      .eq("instance_id", instanceId)
      .eq("wa_contact_id", waChatId)
      .maybeSingle()
    contactId = contactRow?.id || null
  }

  const chatUpsertData: Record<string, unknown> = {
    instance_id: instanceId,
    wa_chat_id: waChatId,
    contact_id: contactId,
    phone,
    image: chatImage,
    is_group: isGroup,
    last_message_text: text || (isMedia ? `[${messageType}]` : ""),
    last_message_type: messageType,
    last_message_timestamp: messageTimestamp,
    last_message_from_me: fromMe,
    updated_at: new Date().toISOString(),
  }
  if (chatName) chatUpsertData.name = chatName

  const { data: chat } = await supabase
    .from("wpp_chats")
    .upsert(chatUpsertData, { onConflict: "instance_id,wa_chat_id" })
    .select("id, unread_count, name")
    .single()

  if (!chat) return

  // Se o chat não tem nome, usar o telefone
  if (!chat.name && phone) {
    await supabase.from("wpp_chats").update({ name: phone }).eq("id", chat.id)
  }

  // Incrementar unread_count se não é mensagem minha
  if (!fromMe) {
    await supabase
      .from("wpp_chats")
      .update({ unread_count: (chat.unread_count || 0) + 1 })
      .eq("id", chat.id)
  }

  // ── Inserir mensagem ──
  if (waMessageId) {
    await supabase
      .from("wpp_messages")
      .upsert({
        chat_id: chat.id,
        instance_id: instanceId,
        wa_message_id: waMessageId,
        sender,
        sender_name: senderName,
        from_me: fromMe,
        message_type: messageType,
        text,
        media_url: mediaUrl,
        media_mime_type: mediaMimeType,
        media_file_name: mediaFileName,
        media_file_size: mediaFileSize,
        media_duration: mediaDuration,
        quoted_message_id: quotedId,
        status,
        is_group: isGroup,
        is_forwarded: isForwarded,
        latitude,
        longitude,
        location_name: locationName,
        vcard,
        timestamp: messageTimestamp,
        raw_data: msg,
      }, { onConflict: "instance_id,wa_message_id", ignoreDuplicates: true })

    // ── Se tem media, disparar processamento assíncrono ──
    // (desencriptar .enc + upload ao R2)
    if (isMedia && mediaUrl) {
      // Chamar edge function de processamento de media de forma assíncrona
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
      const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      fetch(`${SUPABASE_URL}/functions/v1/whatsapp-media-processor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          message_id: waMessageId,
          instance_id: instanceId,
          media_url: mediaUrl,
          media_type: messageType,
          mime_type: mediaMimeType,
          file_name: mediaFileName,
        }),
      }).catch((e) => console.error("[webhook] Media processor call failed:", e))
    }
  }
}

async function handleReaction(
  instanceId: string,
  targetMessageId: string,
  emoji: string,
  senderJid: string,
  fromMe: boolean,
  timestamp: number
) {
  // Buscar mensagem alvo
  const { data: msg } = await supabase
    .from("wpp_messages")
    .select("id, reactions")
    .eq("instance_id", instanceId)
    .eq("wa_message_id", targetMessageId)
    .maybeSingle()

  if (!msg) return

  const reactions = Array.isArray(msg.reactions) ? [...msg.reactions] : []

  // Remover reacção anterior do mesmo remetente
  const filtered = reactions.filter((r: any) => r.sender !== senderJid)

  // Emoji vazio = remover reacção
  if (emoji) {
    filtered.push({ emoji, sender: senderJid, from_me: fromMe, timestamp })
  }

  await supabase
    .from("wpp_messages")
    .update({ reactions: filtered })
    .eq("id", msg.id)
}

async function handleMessageUpdate(instanceId: string, msg: any) {
  if (!msg) return

  const waMessageId = msg.messageid || msg.id || ""
  const newStatus = msg.status || msg.type || ""
  if (!waMessageId || !newStatus) return

  let statusText = newStatus
  if (typeof newStatus === "number") {
    const statusMap: Record<number, string> = {
      1: "sent",
      2: "delivered",
      3: "read",
      4: "played",
    }
    statusText = statusMap[newStatus] || String(newStatus)
  }

  statusText = String(statusText).toLowerCase()

  // Só actualizar se o novo status é "superior" ao actual
  // sent < delivered < read < played
  const statusOrder: Record<string, number> = { sent: 1, delivered: 2, read: 3, played: 4 }

  const { data: existing } = await supabase
    .from("wpp_messages")
    .select("status")
    .eq("instance_id", instanceId)
    .eq("wa_message_id", waMessageId)
    .maybeSingle()

  if (!existing) return

  const currentOrder = statusOrder[existing.status] || 0
  const newOrder = statusOrder[statusText] || 0

  if (newOrder > currentOrder) {
    await supabase
      .from("wpp_messages")
      .update({ status: statusText })
      .eq("instance_id", instanceId)
      .eq("wa_message_id", waMessageId)
  }
}

async function handleConnection(instanceId: string, data: any) {
  if (!data) return

  const connectionStatus = data.status || data.state || "disconnected"
  await supabase
    .from("auto_wpp_instances")
    .update({
      connection_status: connectionStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", instanceId)
}

async function handleContacts(instanceId: string, contacts: any[]) {
  if (!Array.isArray(contacts) || contacts.length === 0) return

  for (const contact of contacts) {
    const jid = contact.id || contact.jid || ""
    if (!jid || jid.includes("@broadcast") || jid === "status@broadcast") continue

    await supabase
      .from("wpp_contacts")
      .upsert({
        instance_id: instanceId,
        wa_contact_id: jid,
        phone: extractPhone(jid),
        name: cleanName(contact.name || contact.pushName || contact.notify || ""),
        short_name: contact.shortName || "",
        profile_pic_url: contact.imgUrl || contact.profilePicUrl || "",
        is_business: contact.isBusiness || false,
        is_group: jid.includes("@g.us"),
        raw_data: contact,
        updated_at: new Date().toISOString(),
      }, { onConflict: "instance_id,wa_contact_id", ignoreDuplicates: false })
  }
}

async function handlePresence(instanceId: string, data: any) {
  // Broadcast via Supabase Realtime — não persiste no DB
  const channel = supabase.channel(`wpp-presence-${instanceId}`)
  channel.send({
    type: "broadcast",
    event: "presence",
    payload: {
      instance_id: instanceId,
      chat_id: data.chatId || data.id || "",
      type: data.type || data.presence || "unavailable",  // composing, recording, paused, unavailable
      participant: data.participant || "",
    },
  })
}

async function handleLabels(instanceId: string, labels: any[]) {
  if (!Array.isArray(labels) || labels.length === 0) return

  for (const label of labels) {
    const labelId = label.id || ""
    if (!labelId) continue

    await supabase
      .from("wpp_labels")
      .upsert({
        instance_id: instanceId,
        wa_label_id: labelId,
        name: label.name || "",
        color: label.color || "",
        predefined_id: label.predefinedId || "",
      }, { onConflict: "instance_id,wa_label_id" })
  }
}
