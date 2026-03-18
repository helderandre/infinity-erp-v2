# PRD-01: Database Schema & Edge Functions

> WhatsApp Web — Sistema completo de mensagens bidireccional
> Projecto: ERP Infinity v2 | Data: 2026-03-18

---

## 1. Novas Tabelas (Supabase / PostgreSQL)

### 1.1 `wpp_contacts` — Contactos de todas as instâncias

```sql
CREATE TABLE wpp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES auto_wpp_instances(id) ON DELETE CASCADE,
  wa_contact_id TEXT NOT NULL,           -- JID: 5511999999999@s.whatsapp.net
  phone TEXT,                             -- Apenas dígitos: 5511999999999
  name TEXT,                              -- pushName do WhatsApp
  short_name TEXT,                        -- Nome curto
  profile_pic_url TEXT,
  is_business BOOLEAN DEFAULT false,
  is_group BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  -- Vinculação ao ERP
  owner_id UUID REFERENCES owners(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  -- Metadados
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instance_id, wa_contact_id)
);

CREATE INDEX idx_wpp_contacts_instance ON wpp_contacts(instance_id);
CREATE INDEX idx_wpp_contacts_phone ON wpp_contacts(phone);
CREATE INDEX idx_wpp_contacts_owner ON wpp_contacts(owner_id);
CREATE INDEX idx_wpp_contacts_lead ON wpp_contacts(lead_id);
```

**Notas:**
- `ON DELETE CASCADE` em `instance_id` — quando instância é removida, todos os contactos são eliminados
- `owner_id` e `lead_id` permitem vincular contacto a proprietário ou lead do ERP
- `wa_contact_id` é o JID completo (usado pelo WhatsApp internamente)
- `phone` é extraído do JID para pesquisa rápida

### 1.2 `wpp_chats` — Conversas (1 por contacto por instância)

```sql
CREATE TABLE wpp_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES auto_wpp_instances(id) ON DELETE CASCADE,
  wa_chat_id TEXT NOT NULL,               -- JID do chat (igual ao contacto para 1:1)
  contact_id UUID REFERENCES wpp_contacts(id) ON DELETE SET NULL,
  phone TEXT,
  name TEXT,
  image TEXT,
  is_group BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  is_muted BOOLEAN DEFAULT false,
  mute_until TIMESTAMPTZ,
  unread_count INT DEFAULT 0,
  -- Última mensagem (desnormalizado para listagem rápida)
  last_message_text TEXT,
  last_message_type TEXT DEFAULT 'text',
  last_message_timestamp BIGINT,
  last_message_from_me BOOLEAN DEFAULT false,
  -- Metadados
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instance_id, wa_chat_id)
);

CREATE INDEX idx_wpp_chats_instance ON wpp_chats(instance_id);
CREATE INDEX idx_wpp_chats_contact ON wpp_chats(contact_id);
CREATE INDEX idx_wpp_chats_last_msg ON wpp_chats(instance_id, last_message_timestamp DESC);
CREATE INDEX idx_wpp_chats_phone ON wpp_chats(phone);
```

### 1.3 `wpp_messages` — Mensagens (enviadas e recebidas)

```sql
CREATE TABLE wpp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES wpp_chats(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES auto_wpp_instances(id) ON DELETE CASCADE,
  wa_message_id TEXT NOT NULL,            -- ID da mensagem no WhatsApp
  -- Remetente
  sender TEXT,                             -- JID do remetente (em grupos)
  sender_name TEXT,                        -- pushName
  from_me BOOLEAN DEFAULT false,
  -- Conteúdo
  message_type TEXT NOT NULL DEFAULT 'text',  -- text, image, video, audio, document, sticker, location, contact, reaction, poll
  text TEXT DEFAULT '',                    -- Texto ou legenda (caption)
  media_url TEXT DEFAULT '',               -- URL do media (após desencriptar e fazer upload ao R2)
  media_mime_type TEXT,
  media_file_name TEXT,
  media_file_size BIGINT,
  media_duration INT,                      -- Duração em segundos (áudio/vídeo)
  -- Metadados de mensagem
  quoted_message_id TEXT DEFAULT '',       -- wa_message_id da mensagem citada
  is_group BOOLEAN DEFAULT false,
  is_forwarded BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  -- Status: sent → delivered → read → played
  status TEXT DEFAULT 'sent',
  -- Soft delete: mensagem removida no WhatsApp mas mantida no backend
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,                          -- 'sender' | 'receiver' | 'admin'
  -- Localização (para LocationMessage)
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  -- Contacto (para ContactMessage)
  vcard TEXT,
  -- Reacções (desnormalizado para consulta rápida)
  reactions JSONB DEFAULT '[]',            -- [{emoji: "👍", sender: "jid", timestamp: 123}]
  -- Dados brutos do UAZAPI
  timestamp BIGINT NOT NULL,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instance_id, wa_message_id)
);

CREATE INDEX idx_wpp_messages_chat ON wpp_messages(chat_id, timestamp DESC);
CREATE INDEX idx_wpp_messages_instance ON wpp_messages(instance_id);
CREATE INDEX idx_wpp_messages_type ON wpp_messages(chat_id, message_type);
CREATE INDEX idx_wpp_messages_status ON wpp_messages(instance_id, status);
CREATE INDEX idx_wpp_messages_quoted ON wpp_messages(instance_id, quoted_message_id) WHERE quoted_message_id != '';
```

**Notas sobre soft delete:**
- Quando uma mensagem é apagada (pelo remetente ou destinatário), `is_deleted = true` e `deleted_at` é preenchido
- O conteúdo original (`text`, `media_url`) é MANTIDO no backend
- No frontend, mensagens com `is_deleted = true` mostram "Esta mensagem foi apagada" (como WhatsApp Web)
- Admins podem ver o conteúdo original

### 1.4 `wpp_message_media` — Media processada (desencriptada)

```sql
CREATE TABLE wpp_message_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES wpp_messages(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES auto_wpp_instances(id) ON DELETE CASCADE,
  -- Ficheiro original (encriptado do UAZAPI)
  original_url TEXT,                       -- URL .enc do UAZAPI
  -- Ficheiro processado (desencriptado no R2)
  r2_key TEXT NOT NULL,                    -- Path no R2: wpp-media/{instance_id}/{chat_id}/{filename}
  r2_url TEXT NOT NULL,                    -- URL pública do R2
  mime_type TEXT,
  file_size BIGINT,
  file_name TEXT,
  -- Thumbnail (para imagens/vídeos)
  thumbnail_r2_key TEXT,
  thumbnail_r2_url TEXT,
  -- Transcrição (para áudios)
  transcription TEXT,
  -- Metadados
  width INT,
  height INT,
  duration INT,                            -- segundos
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wpp_message_media_message ON wpp_message_media(message_id);
CREATE INDEX idx_wpp_message_media_instance ON wpp_message_media(instance_id);
```

### 1.5 `wpp_labels` — Etiquetas do WhatsApp Business

```sql
CREATE TABLE wpp_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES auto_wpp_instances(id) ON DELETE CASCADE,
  wa_label_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,                              -- Hex ou nome da cor
  predefined_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instance_id, wa_label_id)
);

CREATE TABLE wpp_chat_labels (
  chat_id UUID NOT NULL REFERENCES wpp_chats(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES wpp_labels(id) ON DELETE CASCADE,
  PRIMARY KEY(chat_id, label_id)
);
```

### 1.6 `_debug_wpp_payloads` — Debug de webhooks (opcional, para desenvolvimento)

```sql
CREATE TABLE _debug_wpp_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT DEFAULT 'whatsapp',
  event_type TEXT,
  instance_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-cleanup: eliminar payloads com mais de 7 dias
-- (configurar via pg_cron ou política de retenção)
```

### 1.7 Migração: Alterar `auto_wpp_instances`

```sql
-- Adicionar campo de webhook URL para rastreamento
ALTER TABLE auto_wpp_instances
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS webhook_registered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_events TEXT[] DEFAULT ARRAY['messages', 'messages_update', 'connection', 'contacts', 'presence', 'labels']::TEXT[];
```

### 1.8 Cascade Delete — Trigger

```sql
-- Quando uma instância é eliminada, ON DELETE CASCADE já trata as tabelas filhas.
-- Porém, precisamos também eliminar os ficheiros do R2.
-- Isso será feito via trigger + edge function ou via API route no momento do delete.

CREATE OR REPLACE FUNCTION cleanup_instance_media()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir na fila de limpeza para processamento assíncrono
  INSERT INTO _cleanup_queue (entity_type, entity_id, metadata)
  VALUES ('wpp_instance', OLD.id, jsonb_build_object('r2_prefix', 'wpp-media/' || OLD.id));
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cleanup_instance_media
  BEFORE DELETE ON auto_wpp_instances
  FOR EACH ROW EXECUTE FUNCTION cleanup_instance_media();
```

**Alternativa mais simples (sem fila):** O `handleDelete` na API route já pode listar e apagar ficheiros do R2 antes de eliminar a instância do DB.

---

## 2. Edge Functions Adaptadas

### Diferenças-chave entre Leve Mãe e ERP Infinity

| Conceito | Leve Mãe (`.temp/edge/`) | ERP Infinity (adaptar para) |
|---|---|---|
| Tabela de instâncias | `automa_whatsapp_instances` | `auto_wpp_instances` |
| Campo token | `uzapi_token` | `uazapi_token` |
| Campo instance ID | `uzapi_instance_id` | `uazapi_instance_id` |
| Tabela de chats | `whatsapp_chats` | `wpp_chats` |
| Tabela de mensagens | `whatsapp_messages` | `wpp_messages` |
| Leads/Contactos | `task_field_values` | `wpp_contacts` → `owners` / `leads` |

### 2.1 Edge Function: `whatsapp-webhook-receiver`

**Propósito:** Receber webhooks do UAZAPI, processar e guardar mensagens/eventos.

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ── Normalizar tipo de mensagem UAZAPI → tipo simplificado ──
function normalizeMessageType(uazapiType: string): string {
  const map: Record<string, string> = {
    "Conversation": "text",
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
    const headerToken = req.headers.get("token")

    // ── Resolver instância ──
    let instanceId: string | null = null

    // Tentativa 1: pelo token no payload
    if (instanceToken) {
      const { data: inst } = await supabase
        .from("auto_wpp_instances")
        .select("id")
        .eq("uazapi_token", instanceToken)  // ADAPTADO: uzapi_token → uazapi_token
        .maybeSingle()
      if (inst) instanceId = inst.id
    }

    // Tentativa 2: pelo instance ID no payload
    if (!instanceId && payload.instance) {
      const { data: inst } = await supabase
        .from("auto_wpp_instances")
        .select("id")
        .eq("uazapi_instance_id", payload.instance)  // ADAPTADO: uzapi_instance_id → uazapi_instance_id
        .maybeSingle()
      if (inst) instanceId = inst.id
    }

    // Tentativa 3: pelo token no header
    if (!instanceId && headerToken) {
      const { data: inst } = await supabase
        .from("auto_wpp_instances")
        .select("id")
        .eq("uazapi_token", headerToken)
        .maybeSingle()
      if (inst) instanceId = inst.id
    }

    if (!instanceId) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // ── Processar evento ──
    switch (rawEvent) {
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
```

### 2.2 Edge Function: `whatsapp-messaging`

**Propósito:** Enviar mensagens, reagir, apagar, download de media — tudo via UAZAPI.

```typescript
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

    switch (action) {
      case "send_text":       return await handleSendText(body)
      case "send_media":      return await handleSendMedia(body)
      case "send_audio":      return await handleSendAudio(body)
      case "send_location":   return await handleSendLocation(body)
      case "send_contact":    return await handleSendContact(body)
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
  const { instance_id, wa_chat_id, type, file_url, caption, doc_name, reply_id } = body
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
  const endpoint = ptt ? "/send/ptt" : "/send/myaudio"
  const uazapiBody: Record<string, any> = {
    number: wa_chat_id, file: file_url, readchat: true,
  }
  if (reply_id) uazapiBody.replyid = reply_id

  const result = await callUazapi(token, endpoint, uazapiBody)
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
  const { instance_id, wa_chat_id, contact_name, contact_phone } = body
  if (!instance_id || !wa_chat_id || !contact_name || !contact_phone) {
    return jsonResponse({ error: "Campos obrigatórios em falta" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const result = await callUazapi(token, "/send/contact", {
    number: wa_chat_id,
    contact: [{ name: contact_name, number: contact_phone }],
  })

  const waMessageId = result?.messageid || result?.id || result?.key?.id || ""
  const savedMsg = await saveOutgoingMessage({
    instanceId: instance_id, waChatId: wa_chat_id, waMessageId,
    text: contact_name, messageType: "contact",
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
  const result = await callUazapi(token, "/message/markread", {
    number: wa_chat_id,
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

  const token = await getInstanceToken(instance_id)
  const result = await callUazapi(token, "/message/forward", {
    id: wa_message_id, number: to_chat_id,
  })

  return jsonResponse({ ok: true, uazapi_response: result })
}

// ── HELPER: Salvar mensagem enviada ──
async function saveOutgoingMessage(params: {
  instanceId: string; waChatId: string; waMessageId: string;
  text: string; messageType: string; mediaUrl?: string; quotedId?: string;
}) {
  const { instanceId, waChatId, waMessageId, text, messageType, mediaUrl, quotedId } = params
  const now = Date.now()

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
        quoted_message_id: quotedId || "",
        status: "sent",
        timestamp: now,
      }, { onConflict: "instance_id,wa_message_id" })
      .select("*")
      .single()
    return msg
  }
  return null
}
```

### 2.3 Edge Function: `whatsapp-media-processor`

**Propósito:** Desencriptar media `.enc`, fazer upload ao R2, actualizar URL na mensagem.

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const UAZAPI_URL = (Deno.env.get("UAZAPI_URL") || "").replace(/\/$/, "")

Deno.serve(async (req: Request) => {
  try {
    const { message_id, instance_id, media_url, media_type, mime_type, file_name } = await req.json()

    if (!message_id || !instance_id || !media_url) {
      return new Response("Missing params", { status: 400 })
    }

    // 1. Buscar token da instância
    const { data: inst } = await supabase
      .from("auto_wpp_instances")
      .select("uazapi_token")
      .eq("id", instance_id)
      .single()

    if (!inst) return new Response("Instance not found", { status: 404 })

    // 2. Se a URL é .enc, usar UAZAPI /message/download para obter URL desencriptada
    let finalUrl = media_url
    if (media_url.endsWith(".enc") || media_url.includes("enc.")) {
      try {
        const downloadRes = await fetch(`${UAZAPI_URL}/message/download`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: inst.uazapi_token },
          body: JSON.stringify({
            id: message_id,
            return_link: true,
          }),
        })
        if (downloadRes.ok) {
          const downloadData = await downloadRes.json()
          finalUrl = downloadData.url || downloadData.file || media_url
        }
      } catch (e) {
        console.error("[media-processor] Download decrypt failed:", e)
      }
    }

    // 3. Descarregar ficheiro
    const mediaRes = await fetch(finalUrl)
    if (!mediaRes.ok) {
      console.error("[media-processor] Failed to fetch media:", mediaRes.status)
      return new Response("Media fetch failed", { status: 502 })
    }

    const mediaBuffer = await mediaRes.arrayBuffer()
    const contentType = mime_type || mediaRes.headers.get("content-type") || "application/octet-stream"

    // 4. Determinar extensão
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3",
      "application/pdf": "pdf",
    }
    const ext = extMap[contentType] || file_name?.split(".").pop() || "bin"
    const fileName = `${Date.now()}-${message_id.replace(/[^a-zA-Z0-9]/g, "")}.${ext}`
    const r2Key = `wpp-media/${instance_id}/${fileName}`

    // 5. Upload ao R2 via API route do Next.js
    // ALTERNATIVA: Fazer upload directo ao R2 via S3 SDK no Deno
    // Por simplicidade, chamar a API do Next.js
    const NEXT_URL = Deno.env.get("NEXT_PUBLIC_URL") || Deno.env.get("SUPABASE_URL")!.replace("supabase.co", "vercel.app")

    // Na prática, usar S3Client directamente no Deno para evitar dependência do Next.js
    // Exemplo com upload directo:
    const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT") || ""
    const R2_ACCESS_KEY = Deno.env.get("R2_ACCESS_KEY_ID") || ""
    const R2_SECRET_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || ""
    const R2_BUCKET = Deno.env.get("R2_BUCKET_NAME") || "public"
    const R2_PUBLIC_DOMAIN = Deno.env.get("R2_PUBLIC_DOMAIN") || ""

    // Se R2 está configurado no edge function, fazer upload directo
    if (R2_ENDPOINT && R2_ACCESS_KEY) {
      // Nota: No Deno, usar aws4fetch para assinar requests S3
      // import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17"
      // const aws = new AwsClient({ accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY })
      // const putUrl = `${R2_ENDPOINT}/${R2_BUCKET}/${r2Key}`
      // await aws.fetch(putUrl, { method: "PUT", body: new Uint8Array(mediaBuffer), headers: { "Content-Type": contentType } })

      const publicUrl = `${R2_PUBLIC_DOMAIN}/${r2Key}`

      // 6. Guardar referência na tabela de media
      await supabase.from("wpp_message_media").insert({
        message_id: null, // Será preenchido após buscar o UUID
        instance_id,
        original_url: media_url,
        r2_key: r2Key,
        r2_url: publicUrl,
        mime_type: contentType,
        file_size: mediaBuffer.byteLength,
        file_name: file_name || fileName,
      })

      // 7. Actualizar media_url na mensagem
      await supabase
        .from("wpp_messages")
        .update({ media_url: publicUrl })
        .eq("instance_id", instance_id)
        .eq("wa_message_id", message_id)
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err: any) {
    console.error("[media-processor] Error:", err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
```

**Nota:** O processamento de media é complexo e pode ser feito de 3 formas:
1. **UAZAPI `/message/download`** — Pede ao UAZAPI para desencriptar e retornar link (mais simples)
2. **`baileys-decode-enc-by-url`** — Desencriptar localmente (mais controlo, mas requer chaves)
3. **UAZAPI `fileURL`** — Já vem desencriptado em muitos casos (depende da configuração do webhook)

**Recomendação:** Usar opção 1 (UAZAPI download) como default, com fallback para fileURL.

### 2.4 Edge Function: `whatsapp-chats-api`

**Propósito:** Gestão de chats — listar, sincronizar, arquivar, etc.

```typescript
// Acções disponíveis (adaptado de .temp/edge/whatsapp-chats-api.md):
//
// sync_chats      — Sincronizar chats do UAZAPI
// list_chats      — Listar chats com filtros (paginação, busca)
// get_messages    — Mensagens de um chat (com paginação cursor-based)
// force_sync_msgs — Sincronizar mensagens de um chat do UAZAPI
// chat_details    — Detalhes de um chat via UAZAPI
// mark_read       — Marcar chat como lido
// archive_chat    — Arquivar/desarquivar chat
// pin_chat        — Fixar/desfixar chat
// mute_chat       — Silenciar/dessilenciar chat
// delete_chat     — Eliminar chat (soft delete)
// get_chat_media  — Listar media de um chat (filtro por tipo)
// sync_contacts   — Sincronizar contactos da instância
// link_owner      — Vincular contacto a proprietário
// unlink_owner    — Desvincular contacto de proprietário
// link_lead       — Vincular contacto a lead
// unlink_lead     — Desvincular contacto de lead
// auto_match      — Auto-vincular contactos por telefone (owners + leads)

// O código segue o mesmo padrão das outras edge functions.
// Ver implementação completa em .temp/edge/whatsapp-chats-api.md
// As principais adaptações são:
//   - automa_whatsapp_instances → auto_wpp_instances
//   - uzapi_token → uazapi_token
//   - whatsapp_chats → wpp_chats
//   - whatsapp_messages → wpp_messages
//   - task_field_values (leads Leve Mãe) → owners / leads (ERP Infinity)
```

---

## 3. Webhook Registration — Padrão

### 3.1 Registar webhook durante Sync

Adicionar ao `handleSync` existente em `app/api/automacao/instancias/route.ts`:

```typescript
// Após sincronizar cada instância conectada, registar webhook
if (connectionStatus === "connected" && token) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook-receiver`

  try {
    await fetchUazapi("/webhook", {
      method: "POST",
      token,
      body: {
        enabled: true,
        url: webhookUrl,
        events: [
          "messages", "messages_update", "connection",
          "contacts", "presence", "labels", "chats",
        ],
      },
    })

    // Registar no DB
    await supabase
      .from("auto_wpp_instances")
      .update({
        webhook_url: webhookUrl,
        webhook_registered_at: new Date().toISOString(),
      })
      .eq("uazapi_token", token)

    console.log(`[sync] Webhook registrado para instância ${token.slice(0, 8)}...`)
  } catch (e) {
    console.error(`[sync] Erro ao registar webhook:`, e)
  }
}
```

### 3.2 Registar webhook durante Connect

Já existe no padrão de `.temp/edge/whatsapp-instances.md`. Adicionar ao `handleConnect`:

```typescript
// Após conectar, registar webhook
const webhookUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-webhook-receiver`
await fetchUazapi("/webhook", {
  method: "POST",
  token: inst.uazapi_token,
  body: {
    enabled: true,
    url: webhookUrl,
    events: ["messages", "messages_update", "connection", "contacts", "presence", "labels"],
  },
}).catch((e) => console.error("[connect] Webhook registration failed:", e))
```

### 3.3 Configuração do Webhook UAZAPI (da documentação)

```yaml
# Opções do webhook UAZAPI v2.0
POST /webhook
Headers: { token: <instance_token> }
Body:
  enabled: true
  url: "https://<supabase-url>/functions/v1/whatsapp-webhook-receiver"
  events:
    - messages           # Novas mensagens
    - messages_update    # Status updates (delivered/read/played)
    - connection         # Mudanças de conexão
    - contacts           # Contactos actualizados
    - presence           # Composing/recording/online
    - labels             # Etiquetas (Business)
    - chats              # Chats actualizados
    - call               # Chamadas recebidas (opcional)
  excludeMessages:       # Filtros opcionais
    fromMeYes: false     # Incluir mensagens enviadas
    fromMeNo: false      # Incluir mensagens recebidas
    isGroupYes: false    # Incluir mensagens de grupo
    isGroupNo: false     # Incluir mensagens individuais
```

---

## 4. Fluxo de Media — Diagrama

```
UAZAPI Webhook (mensagem com media)
  │
  ├── msg.fileURL existe? (UAZAPI já desencriptou)
  │     │
  │     ├── SIM → Guardar fileURL como media_url na wpp_messages
  │     │         └── Disparar whatsapp-media-processor (assíncrono)
  │     │               ├── Descarregar ficheiro do fileURL
  │     │               ├── Upload ao Cloudflare R2
  │     │               ├── Guardar em wpp_message_media
  │     │               └── Actualizar media_url com URL do R2
  │     │
  │     └── NÃO → URL é .enc (encriptado)
  │               └── Disparar whatsapp-media-processor (assíncrono)
  │                     ├── Chamar UAZAPI /message/download (desencripta)
  │                     ├── Descarregar ficheiro desencriptado
  │                     ├── Upload ao Cloudflare R2
  │                     ├── Guardar em wpp_message_media
  │                     └── Actualizar media_url com URL do R2
  │
  └── Frontend: Mostrar media_url (R2) quando disponível
      └── Se media_url ainda é .enc → mostrar placeholder "A processar..."
```

### R2 Storage Path

```
bucket/
├── wpp-media/
│   ├── {instance_id}/
│   │   ├── 1710756000-msgid123.jpg      ← imagens
│   │   ├── 1710756001-msgid456.mp4      ← vídeos
│   │   ├── 1710756002-msgid789.ogg      ← áudios
│   │   ├── 1710756003-msgid012.pdf      ← documentos
│   │   └── thumbnails/
│   │       └── 1710756000-msgid123.webp  ← thumbnails
```

---

## 5. Status de Mensagens — Fluxo

```
Mensagem enviada pelo ERP:
  send_text/send_media → UAZAPI → WhatsApp
  │
  ├── status: "sent" (imediatamente após envio)
  │
  ├── Webhook messages_update (status: 2) → "delivered" (✓✓)
  │
  ├── Webhook messages_update (status: 3) → "read" (✓✓ azul)
  │
  └── Webhook messages_update (status: 4) → "played" (áudio/vídeo reproduzido)

Regra: Só actualizar status se novo > actual (sent < delivered < read < played)
```

---

## 6. Referências

### Ficheiros fonte (Leve Mãe)
- `.temp/edge/whatsapp-webhook-receiver.md` — Base do webhook receiver
- `.temp/edge/whatsapp-messaging.md` — Base do messaging
- `.temp/edge/whatsapp-chats-api.md` — Base da API de chats
- `.temp/edge/whatsapp-instances.md` — Padrão de webhook registration
- `.temp/edge/whatsapp-debug.md` — Debug utility

### Ficheiros do codebase a modificar
- `app/api/automacao/instancias/route.ts` — Adicionar webhook registration no sync/connect
- `lib/types/whatsapp-template.ts` — Adicionar tipos de mensagens/chats/contactos

### Documentação UAZAPI
- `.temp/documentação-uazpi.yaml` — OpenAPI spec completa
- Endpoints chave: `/webhook`, `/send/*`, `/message/download`, `/message/react`, `/message/delete`, `/message/edit`, `/message/find`, `/message/markread`, `/contacts/list`
