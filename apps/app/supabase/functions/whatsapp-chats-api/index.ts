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
  const isGet = method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD"
  const res = await fetch(`${UAZAPI_URL}${endpoint}`, {
    method,
    headers: { "Content-Type": "application/json", token },
    ...(body && !isGet ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) throw new Error(`UAZAPI Error ${res.status}: ${await res.text()}`)
  return res.json()
}

async function getInstanceToken(instanceId: string): Promise<string> {
  const { data, error } = await supabase
    .from("auto_wpp_instances")
    .select("uazapi_token")
    .eq("id", instanceId)
    .single()
  if (error || !data) throw new Error("Instância não encontrada")
  return data.uazapi_token
}

// ── Extrair telefone do JID ──
function extractPhone(jid: string): string {
  return jid.includes("@") ? jid.split("@")[0] : ""
}

// ── Limpar nome: evitar JIDs e números puros como nome ──
function cleanName(name: string): string {
  if (!name) return ""
  if (name.includes("@")) return ""
  if (/^\+?\d+$/.test(name.trim())) return ""
  return name.trim()
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const body = await req.json()
    const { action } = body

    switch (action) {
      case "sync_chats":       return await handleSyncChats(body)
      case "sync_contacts":    return await handleSyncContacts(body)
      case "archive_chat":     return await handleArchiveChat(body)
      case "pin_chat":         return await handlePinChat(body)
      case "mute_chat":        return await handleMuteChat(body)
      case "auto_match":       return await handleAutoMatch(body)
      default:
        return jsonResponse({ error: `Acção inválida: ${action}` }, 400)
    }
  } catch (err: any) {
    console.error("[whatsapp-chats-api] Error:", err)
    return jsonResponse({ error: err.message || "Erro interno" }, 500)
  }
})

// ═══════════════════════════════════════════════════════════════
// SYNC CHATS — Sincronizar chats do UAZAPI para o DB
// ═══════════════════════════════════════════════════════════════

async function handleSyncChats(body: any) {
  const { instance_id } = body
  if (!instance_id) {
    return jsonResponse({ error: "instance_id é obrigatório" }, 400)
  }

  const token = await getInstanceToken(instance_id)

  // Buscar chats do UAZAPI via /chat/find (POST) com paginação
  const allChats: any[] = []
  let offset = 0
  const pageSize = 100
  const maxPages = 20

  for (let page = 0; page < maxPages; page++) {
    const response = await callUazapi(token, "/chat/find", {
      sort: "-wa_lastMsgTimestamp",
      limit: pageSize,
      offset,
    })
    const chatsArray = response?.chats || (Array.isArray(response) ? response : [])
    if (!Array.isArray(chatsArray) || chatsArray.length === 0) break
    allChats.push(...chatsArray)
    if (response?.pagination?.hasNextPage === false) break
    if (chatsArray.length < pageSize) break
    offset += pageSize
  }

  let synced = 0
  let errors = 0

  // Processar em batches para upsert
  const upsertBatch: Record<string, unknown>[] = []

  for (const chat of allChats) {
    try {
      // Campos UAZAPI: wa_chatid, wa_contactName, wa_name, wa_isGroup, wa_archived, etc.
      const waChatId = chat.wa_chatid || chat.chatid || chat.id || ""
      if (!waChatId) continue

      const phone = chat.phone || extractPhone(waChatId)
      const isGroup = chat.wa_isGroup || waChatId.includes("@g.us")
      const chatName = cleanName(chat.name || chat.wa_contactName || chat.wa_name || "")
      const chatImage = chat.imagePreview || chat.image || chat.imgUrl || chat.profilePicUrl || ""

      // Buscar ou criar contacto para vincular ao chat
      let contactId: string | null = null
      if (!isGroup && phone) {
        const { data: contactRow } = await supabase
          .from("wpp_contacts")
          .upsert({
            instance_id,
            wa_contact_id: waChatId,
            phone,
            name: chatName || undefined,
            profile_pic_url: chatImage || undefined,
            is_group: isGroup,
            updated_at: new Date().toISOString(),
          }, { onConflict: "instance_id,wa_contact_id", ignoreDuplicates: false })
          .select("id")
          .single()
        contactId = contactRow?.id || null
      }

      // Normalizar timestamp (UAZAPI envia em ms)
      let lastMsgTs = chat.wa_lastMsgTimestamp ? Number(chat.wa_lastMsgTimestamp) : 0
      if (lastMsgTs > 10_000_000_000) lastMsgTs = Math.floor(lastMsgTs / 1000)

      // Normalizar tipo de mensagem
      const rawType = (chat.wa_lastMessageType || "").toLowerCase().replace("message", "")
      const typeMap: Record<string, string> = {
        conversation: "text", extendedtext: "text",
        image: "image", video: "video", audio: "audio",
        document: "document", sticker: "sticker",
        location: "location", livelocation: "location",
        contact: "contact", contactsarray: "contact",
        poll: "poll", pollcreation: "poll", viewonce: "view_once",
      }
      const lastMessageType = typeMap[rawType] || rawType || "text"

      upsertBatch.push({
        instance_id,
        wa_chat_id: waChatId,
        contact_id: contactId,
        phone,
        name: chatName || undefined,
        image: chatImage,
        is_group: isGroup,
        is_archived: chat.wa_archived || false,
        is_pinned: chat.wa_isPinned || false,
        is_muted: chat.wa_isMuted || false,
        unread_count: chat.wa_unreadCount || 0,
        last_message_text: chat.wa_lastMessageTextVote || "",
        last_message_type: lastMessageType,
        last_message_timestamp: lastMsgTs,
        updated_at: new Date().toISOString(),
      })
      synced++
    } catch (e) {
      console.error("[sync_chats] Error processing chat:", e)
      errors++
    }
  }

  // Upsert em batches de 50
  for (let i = 0; i < upsertBatch.length; i += 50) {
    const batch = upsertBatch.slice(i, i + 50)
    const { error } = await supabase
      .from("wpp_chats")
      .upsert(batch, { onConflict: "instance_id,wa_chat_id" })
    if (error) {
      console.error("[sync_chats] Upsert batch error:", error)
    }
  }

  return jsonResponse({
    ok: true,
    synced,
    errors,
    total: allChats.length,
  })
}

// ═══════════════════════════════════════════════════════════════
// SYNC CONTACTS — Sincronizar contactos do UAZAPI para o DB
// ═══════════════════════════════════════════════════════════════

async function handleSyncContacts(body: any) {
  const { instance_id } = body
  if (!instance_id) {
    return jsonResponse({ error: "instance_id é obrigatório" }, 400)
  }

  const token = await getInstanceToken(instance_id)

  // Buscar contactos individuais via /chat/find (não existe endpoint /contacts/list)
  const allChats: any[] = []
  let offset = 0
  const pageSize = 100
  const maxPages = 20

  for (let page = 0; page < maxPages; page++) {
    const response = await callUazapi(token, "/chat/find", {
      sort: "-wa_lastMsgTimestamp",
      limit: pageSize,
      offset,
      wa_isGroup: false,
    })
    const chatsArray = response?.chats || (Array.isArray(response) ? response : [])
    if (!Array.isArray(chatsArray) || chatsArray.length === 0) break
    allChats.push(...chatsArray)
    if (response?.pagination?.hasNextPage === false) break
    if (chatsArray.length < pageSize) break
    offset += pageSize
  }

  let synced = 0
  let errors = 0

  for (const chat of allChats) {
    try {
      const jid = chat.wa_chatid || chat.chatid || chat.id || ""
      if (!jid || jid.includes("@broadcast") || jid.includes("@g.us")) continue

      const phone = chat.phone || extractPhone(jid)
      const name = cleanName(chat.name || chat.wa_contactName || chat.wa_name || "")

      await supabase
        .from("wpp_contacts")
        .upsert({
          instance_id,
          wa_contact_id: jid,
          phone,
          name: name || undefined,
          profile_pic_url: chat.imagePreview || chat.image || chat.imgUrl || "",
          is_group: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "instance_id,wa_contact_id", ignoreDuplicates: false })

      synced++
    } catch (e) {
      console.error("[sync_contacts] Error syncing contact:", e)
      errors++
    }
  }

  return jsonResponse({
    ok: true,
    synced,
    errors,
    total: allChats.length,
  })
}

// ═══════════════════════════════════════════════════════════════
// ARCHIVE CHAT — Arquivar/desarquivar chat
// ═══════════════════════════════════════════════════════════════

async function handleArchiveChat(body: any) {
  const { instance_id, wa_chat_id, archive } = body
  if (!instance_id || !wa_chat_id) {
    return jsonResponse({ error: "instance_id e wa_chat_id são obrigatórios" }, 400)
  }

  const shouldArchive = archive !== false

  const token = await getInstanceToken(instance_id)

  // Chamar UAZAPI para arquivar/desarquivar
  await callUazapi(token, "/chat/archive", {
    number: wa_chat_id,
    archive: shouldArchive,
  })

  // Actualizar no DB
  await supabase
    .from("wpp_chats")
    .update({
      is_archived: shouldArchive,
      updated_at: new Date().toISOString(),
    })
    .eq("instance_id", instance_id)
    .eq("wa_chat_id", wa_chat_id)

  return jsonResponse({
    ok: true,
    archived: shouldArchive,
  })
}

// ═══════════════════════════════════════════════════════════════
// PIN CHAT — Fixar/desfixar chat
// ═══════════════════════════════════════════════════════════════

async function handlePinChat(body: any) {
  const { instance_id, wa_chat_id, pin } = body
  if (!instance_id || !wa_chat_id) {
    return jsonResponse({ error: "instance_id e wa_chat_id são obrigatórios" }, 400)
  }

  const shouldPin = pin !== false

  const token = await getInstanceToken(instance_id)

  // Chamar UAZAPI para fixar/desfixar
  await callUazapi(token, "/chat/pin", {
    number: wa_chat_id,
    pin: shouldPin,
  })

  // Actualizar no DB
  await supabase
    .from("wpp_chats")
    .update({
      is_pinned: shouldPin,
      updated_at: new Date().toISOString(),
    })
    .eq("instance_id", instance_id)
    .eq("wa_chat_id", wa_chat_id)

  return jsonResponse({
    ok: true,
    pinned: shouldPin,
  })
}

// ═══════════════════════════════════════════════════════════════
// MUTE CHAT — Silenciar/dessilenciar chat
// ═══════════════════════════════════════════════════════════════

async function handleMuteChat(body: any) {
  const { instance_id, wa_chat_id, mute, mute_duration } = body
  if (!instance_id || !wa_chat_id) {
    return jsonResponse({ error: "instance_id e wa_chat_id são obrigatórios" }, 400)
  }

  const shouldMute = mute !== false

  const token = await getInstanceToken(instance_id)

  // Chamar UAZAPI para silenciar/dessilenciar
  await callUazapi(token, "/chat/mute", {
    number: wa_chat_id,
    mute: shouldMute,
    ...(mute_duration ? { duration: mute_duration } : {}),
  })

  // Calcular mute_until
  let muteUntil: string | null = null
  if (shouldMute && mute_duration) {
    const until = new Date()
    until.setSeconds(until.getSeconds() + mute_duration)
    muteUntil = until.toISOString()
  }

  // Actualizar no DB
  await supabase
    .from("wpp_chats")
    .update({
      is_muted: shouldMute,
      mute_until: shouldMute ? muteUntil : null,
      updated_at: new Date().toISOString(),
    })
    .eq("instance_id", instance_id)
    .eq("wa_chat_id", wa_chat_id)

  return jsonResponse({
    ok: true,
    muted: shouldMute,
    mute_until: muteUntil,
  })
}

// ═══════════════════════════════════════════════════════════════
// AUTO MATCH — Auto-vincular contactos por telefone (owners + leads)
// ═══════════════════════════════════════════════════════════════

async function handleAutoMatch(body: any) {
  const { instance_id } = body
  if (!instance_id) {
    return jsonResponse({ error: "instance_id é obrigatório" }, 400)
  }

  // Buscar todos os contactos da instância que ainda não têm owner_id nem lead_id
  const { data: contacts, error } = await supabase
    .from("wpp_contacts")
    .select("id, phone")
    .eq("instance_id", instance_id)
    .is("owner_id", null)
    .is("lead_id", null)
    .not("phone", "is", null)
    .not("phone", "eq", "")

  if (error || !contacts || contacts.length === 0) {
    return jsonResponse({
      ok: true,
      matched_owners: 0,
      matched_leads: 0,
      total_contacts: 0,
    })
  }

  // Extrair todos os telefones dos contactos
  const phones = contacts.map((c) => c.phone).filter(Boolean)

  // Buscar owners que correspondem por telefone
  const { data: owners } = await supabase
    .from("owners")
    .select("id, phone")
    .not("phone", "is", null)
    .not("phone", "eq", "")

  // Buscar leads que correspondem por phone_primary ou phone_secondary
  const { data: leads } = await supabase
    .from("leads")
    .select("id, phone_primary, phone_secondary")

  // Criar mapas de telefone → ID para matching rápido
  const ownerPhoneMap = new Map<string, string>()
  if (owners) {
    for (const owner of owners) {
      if (owner.phone) {
        // Normalizar: remover espaços, +, traços
        const normalized = owner.phone.replace(/[\s\-+()]/g, "")
        ownerPhoneMap.set(normalized, owner.id)
        // Também sem código de país (últimos 9 dígitos para PT)
        if (normalized.length > 9) {
          ownerPhoneMap.set(normalized.slice(-9), owner.id)
        }
      }
    }
  }

  const leadPhoneMap = new Map<string, string>()
  if (leads) {
    for (const lead of leads) {
      for (const phone of [lead.phone_primary, lead.phone_secondary]) {
        if (phone) {
          const normalized = phone.replace(/[\s\-+()]/g, "")
          leadPhoneMap.set(normalized, lead.id)
          if (normalized.length > 9) {
            leadPhoneMap.set(normalized.slice(-9), lead.id)
          }
        }
      }
    }
  }

  let matchedOwners = 0
  let matchedLeads = 0

  for (const contact of contacts) {
    if (!contact.phone) continue

    const normalizedPhone = contact.phone.replace(/[\s\-+()]/g, "")
    const shortPhone = normalizedPhone.length > 9 ? normalizedPhone.slice(-9) : normalizedPhone

    // Tentar match com owners primeiro
    const ownerId = ownerPhoneMap.get(normalizedPhone) || ownerPhoneMap.get(shortPhone)
    if (ownerId) {
      await supabase
        .from("wpp_contacts")
        .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
        .eq("id", contact.id)
      matchedOwners++
      continue
    }

    // Tentar match com leads
    const leadId = leadPhoneMap.get(normalizedPhone) || leadPhoneMap.get(shortPhone)
    if (leadId) {
      await supabase
        .from("wpp_contacts")
        .update({ lead_id: leadId, updated_at: new Date().toISOString() })
        .eq("id", contact.id)
      matchedLeads++
    }
  }

  return jsonResponse({
    ok: true,
    matched_owners: matchedOwners,
    matched_leads: matchedLeads,
    total_contacts: contacts.length,
  })
}
