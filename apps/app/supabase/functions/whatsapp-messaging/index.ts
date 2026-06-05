import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const UAZAPI_URL = (Deno.env.get("UAZAPI_URL") || "").replace(/\/$/, "")

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

async function callUazapi(token: string, endpoint: string, body?: any, method = "POST") {
  const res = await fetch(`${UAZAPI_URL}${endpoint}`, {
    method,
    headers: { "Content-Type": "application/json", token },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) throw new Error(`UAZAPI Error ${res.status}: ${await res.text()}`)
  return res.json()
}

async function getInstanceToken(instanceId: string): Promise<string> {
  const { data, error } = await supabase
    .from("auto_wpp_instances")           // ADAPTADO
    .select("uazapi_token")              // ADAPTADO
    .eq("id", instanceId)
    .single()
  if (error || !data) throw new Error("Instância não encontrada")
  return data.uazapi_token               // ADAPTADO
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const body = await req.json()
    const { action } = body

    // Debug: salvar payload de envio na tabela _debug_wpp_payloads
    if (body.instance_id) {
      await supabase
        .from("_debug_wpp_payloads")
        .insert({
          source: "messaging_outbound",
          event_type: action,
          instance_id: body.instance_id,
          payload: body,
        })
        .then(() => {})
        .catch(() => {})
    }

    switch (action) {
      case "send_text":       return await handleSendText(body)
      case "send_media":      return await handleSendMedia(body)
      case "send_audio":      return await handleSendAudio(body)
      case "send_location":   return await handleSendLocation(body)
      case "send_contact":    return await handleSendContact(body)
      case "send_poll":       return await handleSendPoll(body)
      case "send_sticker":    return await handleSendSticker(body)
      case "react":           return await handleReact(body)
      case "delete_message":  return await handleDeleteMessage(body)
      case "edit_message":    return await handleEditMessage(body)
      case "download_media":  return await handleDownloadMedia(body)
      case "send_presence":   return await handleSendPresence(body)
      case "mark_read":       return await handleMarkRead(body)
      case "forward":         return await handleForward(body)
      default:
        return jsonResponse({ error: `Acção inválida: ${action}` }, 400)
    }
  } catch (err: any) {
    console.error("[whatsapp-messaging] Error:", err)
    return jsonResponse({ error: err.message || "Erro interno" }, 500)
  }
})

// ── SEND TEXT ──
async function handleSendText(body: any) {
  const { instance_id, wa_chat_id, text, reply_id } = body
  if (!instance_id || !wa_chat_id || !text) {
    return jsonResponse({ error: "instance_id, wa_chat_id e text são obrigatórios" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const uazapiBody: Record<string, any> = { number: wa_chat_id, text, readchat: true }
  if (reply_id) uazapiBody.replyid = reply_id

  const result = await callUazapi(token, "/send/text", uazapiBody)
  const waMessageId = result?.messageid || result?.id || result?.key?.id || ""
  const savedMsg = await saveOutgoingMessage({
    instanceId: instance_id, waChatId: wa_chat_id, waMessageId,
    text, messageType: "text", quotedId: reply_id || "",
  })

  return jsonResponse({ message: savedMsg, uazapi_response: result })
}

// ── SEND MEDIA (image, video, document) ──
async function handleSendMedia(body: any) {
  const { instance_id, wa_chat_id, type, file_url, caption, doc_name, reply_id, file_name, mime_type, file_size } = body
  if (!instance_id || !wa_chat_id || !type || !file_url) {
    return jsonResponse({ error: "instance_id, wa_chat_id, type e file_url são obrigatórios" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const uazapiBody: Record<string, any> = {
    number: wa_chat_id, type, file: file_url, readchat: true,
  }
  if (caption) uazapiBody.text = caption
  if (doc_name) uazapiBody.docName = doc_name
  if (reply_id) uazapiBody.replyid = reply_id

  const result = await callUazapi(token, "/send/media", uazapiBody)
  const waMessageId = result?.messageid || result?.id || result?.key?.id || ""
  const savedMsg = await saveOutgoingMessage({
    instanceId: instance_id, waChatId: wa_chat_id, waMessageId,
    text: caption || "", messageType: type, mediaUrl: file_url, quotedId: reply_id || "",
    mediaFileName: file_name || doc_name || "",
    mediaMimeType: mime_type || "",
    mediaFileSize: file_size || null,
  })

  return jsonResponse({ message: savedMsg, uazapi_response: result })
}

// ── SEND AUDIO (ptt/myaudio) ──
async function handleSendAudio(body: any) {
  const { instance_id, wa_chat_id, file_url, ptt, reply_id } = body
  if (!instance_id || !wa_chat_id || !file_url) {
    return jsonResponse({ error: "instance_id, wa_chat_id e file_url são obrigatórios" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const mediaType = ptt ? "ptt" : "audio"
  const uazapiBody: Record<string, any> = {
    number: wa_chat_id, type: mediaType, file: file_url, readchat: true,
  }
  if (reply_id) uazapiBody.replyid = reply_id

  const result = await callUazapi(token, "/send/media", uazapiBody)
  const waMessageId = result?.messageid || result?.id || result?.key?.id || ""
  const savedMsg = await saveOutgoingMessage({
    instanceId: instance_id, waChatId: wa_chat_id, waMessageId,
    text: "", messageType: "audio", mediaUrl: file_url, quotedId: reply_id || "",
  })

  return jsonResponse({ message: savedMsg, uazapi_response: result })
}

// ── SEND LOCATION ──
async function handleSendLocation(body: any) {
  const { instance_id, wa_chat_id, latitude, longitude, name, address } = body
  if (!instance_id || !wa_chat_id || !latitude || !longitude) {
    return jsonResponse({ error: "instance_id, wa_chat_id, latitude e longitude são obrigatórios" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const result = await callUazapi(token, "/send/location", {
    number: wa_chat_id, lat: latitude, lng: longitude, name: name || "", address: address || "",
  })

  const waMessageId = result?.messageid || result?.id || result?.key?.id || ""
  const savedMsg = await saveOutgoingMessage({
    instanceId: instance_id, waChatId: wa_chat_id, waMessageId,
    text: name || address || "Localização", messageType: "location",
  })

  return jsonResponse({ message: savedMsg, uazapi_response: result })
}

// ── SEND CONTACT (vCard) ──
async function handleSendContact(body: any) {
  const { instance_id, wa_chat_id, contact_name, contact_phone, organization, email, url } = body
  if (!instance_id || !wa_chat_id || !contact_name || !contact_phone) {
    return jsonResponse({ error: "Campos obrigatórios em falta" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const result = await callUazapi(token, "/send/contact", {
    number: wa_chat_id,
    fullName: contact_name,
    phoneNumber: contact_phone,
    ...(organization && { organization }),
    ...(email && { email }),
    ...(url && { url }),
  })

  const waMessageId = result?.messageid || result?.id || result?.key?.id || ""
  const savedMsg = await saveOutgoingMessage({
    instanceId: instance_id, waChatId: wa_chat_id, waMessageId,
    text: contact_name, messageType: "contact",
  })

  return jsonResponse({ message: savedMsg, uazapi_response: result })
}

// ── SEND POLL ──
async function handleSendPoll(body: any) {
  const { instance_id, wa_chat_id, poll_question, poll_options, poll_selectable_count } = body
  if (!instance_id || !wa_chat_id || !poll_question || !poll_options?.length) {
    return jsonResponse({ error: "Campos obrigatórios em falta" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const result = await callUazapi(token, "/send/menu", {
    number: wa_chat_id,
    type: "poll",
    text: poll_question,
    choices: poll_options,
    selectableCount: poll_selectable_count || 1,
  })

  const waMessageId = result?.messageid || result?.id || result?.key?.id || ""
  const savedMsg = await saveOutgoingMessage({
    instanceId: instance_id, waChatId: wa_chat_id, waMessageId,
    text: poll_question, messageType: "poll",
    extra: {
      poll_data: {
        name: poll_question,
        options: poll_options.map((o: string) => ({ name: o, votes: 0, voters: [] })),
        selectableCount: poll_selectable_count || 1,
      },
    },
  })

  return jsonResponse({ message: savedMsg, uazapi_response: result })
}

// ── SEND STICKER ──
async function handleSendSticker(body: any) {
  const { instance_id, wa_chat_id, file_url } = body
  if (!instance_id || !wa_chat_id || !file_url) {
    return jsonResponse({ error: "Campos obrigatórios em falta" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const result = await callUazapi(token, "/send/sticker", {
    number: wa_chat_id, file: file_url,
  })

  return jsonResponse({ ok: true, uazapi_response: result })
}

// ── REACT ──
async function handleReact(body: any) {
  const { instance_id, wa_chat_id, wa_message_id, emoji } = body
  if (!instance_id || !wa_chat_id || !wa_message_id || emoji === undefined) {
    return jsonResponse({ error: "Campos obrigatórios em falta" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const result = await callUazapi(token, "/message/react", {
    number: wa_chat_id, text: emoji, id: wa_message_id,
  })

  return jsonResponse({ ok: true, uazapi_response: result })
}

// ── DELETE MESSAGE ──
async function handleDeleteMessage(body: any) {
  const { instance_id, wa_message_id, for_everyone } = body
  if (!instance_id || !wa_message_id) {
    return jsonResponse({ error: "Campos obrigatórios em falta" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const result = await callUazapi(token, "/message/delete", {
    id: wa_message_id, forEveryone: for_everyone !== false,
  })

  // Soft delete no backend
  await supabase
    .from("wpp_messages")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: "sender",
    })
    .eq("instance_id", instance_id)
    .eq("wa_message_id", wa_message_id)

  return jsonResponse({ ok: true, uazapi_response: result })
}

// ── EDIT MESSAGE ──
async function handleEditMessage(body: any) {
  const { instance_id, wa_message_id, new_text } = body
  if (!instance_id || !wa_message_id || !new_text) {
    return jsonResponse({ error: "Campos obrigatórios em falta" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const result = await callUazapi(token, "/message/edit", {
    id: wa_message_id, text: new_text,
  })

  await supabase
    .from("wpp_messages")
    .update({ text: new_text })
    .eq("instance_id", instance_id)
    .eq("wa_message_id", wa_message_id)

  return jsonResponse({ ok: true, uazapi_response: result })
}

// ── DOWNLOAD MEDIA ──
async function handleDownloadMedia(body: any) {
  const { instance_id, wa_message_id, transcribe, generate_mp3 } = body
  if (!instance_id || !wa_message_id) {
    return jsonResponse({ error: "Campos obrigatórios em falta" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const downloadBody: Record<string, any> = { id: wa_message_id }
  if (transcribe) downloadBody.transcribe = true
  if (generate_mp3) downloadBody.generate_mp3 = true

  const result = await callUazapi(token, "/message/download", downloadBody)

  return jsonResponse({
    url: result?.url || result?.file || null,
    transcription: result?.transcription || null,
    uazapi_response: result,
  })
}

// ── SEND PRESENCE (composing/recording) ──
async function handleSendPresence(body: any) {
  const { instance_id, wa_chat_id, type } = body
  if (!instance_id || !wa_chat_id || !type) {
    return jsonResponse({ error: "Campos obrigatórios em falta" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const result = await callUazapi(token, "/message/presence", {
    number: wa_chat_id, presence: type,
  })

  return jsonResponse({ ok: true, uazapi_response: result })
}

// ── MARK READ ──
async function handleMarkRead(body: any) {
  const { instance_id, wa_chat_id } = body
  if (!instance_id || !wa_chat_id) {
    return jsonResponse({ error: "Campos obrigatórios em falta" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const result = await callUazapi(token, "/chat/read", {
    number: wa_chat_id,
    read: true,
  })

  // Reset unread count no DB
  await supabase
    .from("wpp_chats")
    .update({ unread_count: 0 })
    .eq("instance_id", instance_id)
    .eq("wa_chat_id", wa_chat_id)

  return jsonResponse({ ok: true, uazapi_response: result })
}

// ── FORWARD MESSAGE ──
async function handleForward(body: any) {
  const { instance_id, wa_message_id, to_chat_id } = body
  if (!instance_id || !wa_message_id || !to_chat_id) {
    return jsonResponse({ error: "Campos obrigatórios em falta" }, 400)
  }

  // Fetch original message from DB
  const { data: origMsg, error: msgErr } = await supabase
    .from("wpp_messages")
    .select("*")
    .eq("instance_id", instance_id)
    .eq("wa_message_id", wa_message_id)
    .single()

  if (msgErr || !origMsg) {
    return jsonResponse({ error: "Mensagem original não encontrada" }, 404)
  }

  const token = await getInstanceToken(instance_id)
  const msgType = origMsg.message_type || "text"
  let result: any

  if (msgType === "text") {
    // Forward text
    result = await callUazapi(token, "/send/text", {
      number: to_chat_id,
      text: origMsg.text || "",
      forward: true,
      readchat: true,
    })
  } else if (["image", "video", "audio", "document", "sticker", "ptt"].includes(msgType)) {
    // Forward media — need the file URL
    let fileUrl = origMsg.media_url || ""

    // If no URL stored, try to download from UAZAPI
    if (!fileUrl) {
      try {
        const dlResult = await callUazapi(token, "/message/download", { id: wa_message_id })
        fileUrl = dlResult?.url || dlResult?.file || dlResult?.fileURL || ""
      } catch {
        // ignore download errors
      }
    }

    if (!fileUrl) {
      return jsonResponse({ error: "Não foi possível obter o ficheiro da mensagem" }, 400)
    }

    const sendType = msgType === "ptt" ? "ptt" : msgType
    result = await callUazapi(token, "/send/media", {
      number: to_chat_id,
      type: sendType,
      file: fileUrl,
      text: origMsg.text || "",
      forward: true,
      readchat: true,
    })
  } else if (msgType === "location") {
    result = await callUazapi(token, "/send/location", {
      number: to_chat_id,
      lat: origMsg.latitude,
      lng: origMsg.longitude,
      name: origMsg.location_name || "",
      forward: true,
    })
  } else {
    // Fallback: send text content with forward flag
    result = await callUazapi(token, "/send/text", {
      number: to_chat_id,
      text: origMsg.text || `[${msgType}]`,
      forward: true,
      readchat: true,
    })
  }

  return jsonResponse({ ok: true, uazapi_response: result })
}

// ── HELPER: Salvar mensagem enviada ──
async function saveOutgoingMessage(params: {
  instanceId: string; waChatId: string; waMessageId: string;
  text: string; messageType: string; mediaUrl?: string; quotedId?: string;
  mediaFileName?: string; mediaMimeType?: string; mediaFileSize?: number | null;
  extra?: Record<string, unknown>;
}) {
  const { instanceId, waChatId, waMessageId, text, messageType, mediaUrl, quotedId, mediaFileName, mediaMimeType, mediaFileSize, extra } = params
  const now = Math.floor(Date.now() / 1000)

  const { data: chat } = await supabase
    .from("wpp_chats")
    .upsert({
      instance_id: instanceId,
      wa_chat_id: waChatId,
      last_message_text: text,
      last_message_type: messageType,
      last_message_timestamp: now,
      last_message_from_me: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "instance_id,wa_chat_id" })
    .select("id")
    .single()

  if (!chat) return null

  if (waMessageId) {
    const { data: msg } = await supabase
      .from("wpp_messages")
      .upsert({
        chat_id: chat.id,
        instance_id: instanceId,
        wa_message_id: waMessageId,
        from_me: true,
        message_type: messageType,
        text,
        media_url: mediaUrl || "",
        media_file_name: mediaFileName || "",
        media_mime_type: mediaMimeType || "",
        media_file_size: mediaFileSize || null,
        quoted_message_id: quotedId || "",
        status: "sent",
        timestamp: now,
        ...(extra || {}),
      }, { onConflict: "instance_id,wa_message_id" })
      .select("*")
      .single()
    return msg
  }
  return null
}
