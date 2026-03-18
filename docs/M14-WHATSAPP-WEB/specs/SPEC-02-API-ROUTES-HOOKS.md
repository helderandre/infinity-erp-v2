# SPEC-02: API Routes & Hooks

> WhatsApp Web — API Routes (Next.js) e Custom Hooks
> Projecto: ERP Infinity v2 | Data: 2026-03-18

---

## Ficheiros a Criar

### 1. `src/app/api/whatsapp/chats/route.ts`

**Criar ficheiro.** GET para listar chats.

**O que fazer:**
- Import `createAdminClient` de `@/lib/supabase/admin`
- `GET(request)`:
  - Extrair `searchParams`: `instance_id` (obrigatório), `search`, `archived` (default `false`), `limit` (default `50`), `offset` (default `0`)
  - Query `wpp_chats` com select incluindo join a `wpp_contacts` (e nested `owners` + `leads`):
    ```
    *, contact:wpp_contacts(id, name, phone, profile_pic_url, is_business, owner_id, lead_id, owner:owners(id, name, phone, email), lead:leads(id, name, email, phone_primary))
    ```
  - Filtro: `.eq("instance_id", instanceId)`, `.eq("is_archived", archived)`
  - Order: `last_message_timestamp DESC nullsFirst: false`
  - Se `search`: `.or(\`name.ilike.%${search}%,phone.ilike.%${search}%\`)`
  - Paginação: `.range(offset, offset + limit - 1)` com `{ count: "exact" }`
  - Retornar `{ chats: data, total: count }`

---

### 2. `src/app/api/whatsapp/chats/[chatId]/messages/route.ts`

**Criar ficheiro.** GET para mensagens paginadas, POST para enviar.

**GET(request, { params }):**
- Extrair `chatId` de `await params`
- Query params: `limit` (default `50`), `before` (cursor timestamp), `after` (cursor timestamp)
- Query `wpp_messages` onde `chat_id = chatId`, order `timestamp DESC`, limit
- Se `before`: `.lt("timestamp", parseInt(before))`
- Se `after`: `.gt("timestamp", parseInt(after))`
- Reverter array para ordem cronológica: `data.reverse()`
- Buscar mensagens citadas: filtrar `quoted_message_id` não vazios, query `wpp_messages` por `.in("wa_message_id", quotedIds)`, construir mapa `{ wa_message_id → { text, message_type, sender_name, from_me, media_url } }`
- Retornar `{ messages, quoted_messages, has_more: data.length === limit }`

**POST(request, { params }):**
- Extrair `chatId`, buscar chat em `wpp_chats` para obter `instance_id` e `wa_chat_id`
- Fazer fetch para `${SUPABASE_URL}/functions/v1/whatsapp-messaging` com `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` e body `{ action: body.action || "send_text", instance_id, wa_chat_id, ...body }`
- Retornar resultado

---

### 3. `src/app/api/whatsapp/chats/[chatId]/read/route.ts`

**Criar ficheiro.** POST para marcar como lido.

**POST(request, { params }):**
- Buscar chat em `wpp_chats` para obter `instance_id` e `wa_chat_id`
- Chamar edge function `whatsapp-messaging` com `{ action: "mark_read", instance_id, wa_chat_id }`
- Retornar resultado

---

### 4. `src/app/api/whatsapp/chats/[chatId]/presence/route.ts`

**Criar ficheiro.** POST para enviar presença (typing).

**POST(request, { params }):**
- Buscar chat para obter `instance_id` e `wa_chat_id`
- Chamar edge function `whatsapp-messaging` com `{ action: "send_presence", instance_id, wa_chat_id, type: body.type }`
- Retornar resultado

---

### 5. `src/app/api/whatsapp/send/route.ts`

**Criar ficheiro.** POST genérico para enviar qualquer tipo de mensagem.

**POST(request):**
- Extrair `{ instance_id, wa_chat_id, type = "text" }` do body
- Validar `instance_id` e `wa_chat_id` obrigatórios
- Mapear `type` para `action`: `{ text: "send_text", image: "send_media", video: "send_media", document: "send_media", audio: "send_audio", ptt: "send_audio", location: "send_location", contact: "send_contact", sticker: "send_sticker" }`
- Chamar edge function `whatsapp-messaging` com `{ action, ...body }`
- Retornar resultado

---

### 6. `src/app/api/whatsapp/messages/[messageId]/route.ts`

**Criar ficheiro.** GET detalhe, PUT editar, DELETE apagar.

**GET(request, { params }):**
- Query `wpp_messages` por `id = messageId` com `.single()`
- Retornar mensagem

**PUT(request, { params }):**
- Extrair `{ new_text }` do body
- Buscar mensagem para obter `instance_id`, `wa_message_id`
- Chamar edge function `whatsapp-messaging` com `{ action: "edit_message", instance_id, wa_message_id, new_text }`
- Retornar resultado

**DELETE(request, { params }):**
- Extrair `{ for_everyone }` do body
- Buscar mensagem para obter `instance_id`, `wa_message_id`
- Chamar edge function `whatsapp-messaging` com `{ action: "delete_message", instance_id, wa_message_id, for_everyone }`
- Retornar resultado

---

### 7. `src/app/api/whatsapp/messages/[messageId]/react/route.ts`

**Criar ficheiro.** POST para reagir a mensagem.

**POST(request, { params }):**
- Extrair `messageId`, buscar mensagem em `wpp_messages` para obter `instance_id`, `wa_message_id`, `chat_id`
- Buscar `wa_chat_id` do chat em `wpp_chats`
- Chamar edge function `whatsapp-messaging` com `{ action: "react", instance_id, wa_chat_id, wa_message_id, emoji }`
- Retornar resultado

---

### 8. `src/app/api/whatsapp/messages/[messageId]/forward/route.ts`

**Criar ficheiro.** POST para reencaminhar mensagem.

**POST(request, { params }):**
- Extrair `messageId`, buscar mensagem para obter `instance_id`, `wa_message_id`
- Extrair `{ to_chat_id }` do body
- Chamar edge function `whatsapp-messaging` com `{ action: "forward", instance_id, wa_message_id, to_chat_id }`
- Retornar resultado

---

### 9. `src/app/api/whatsapp/messages/[messageId]/download/route.ts`

**Criar ficheiro.** POST para download de media.

**POST(request, { params }):**
- Buscar mensagem para obter `instance_id`, `wa_message_id`
- Extrair `{ transcribe, generate_mp3 }` do body
- Chamar edge function `whatsapp-messaging` com `{ action: "download_media", instance_id, wa_message_id, transcribe, generate_mp3 }`
- Retornar resultado

---

### 10. `src/app/api/whatsapp/instances/[id]/contacts/route.ts`

**Criar ficheiro.** GET listar contactos, POST sincronizar.

**GET(request, { params }):**
- Extrair `instanceId` de params
- Query params: `search`, `linked` (`"owner"` | `"lead"` | `"none"` | null), `limit` (default `100`), `offset` (default `0`)
- Query `wpp_contacts` com join a `owners` e `leads`, filtro `instance_id`, `is_group = false`
- Se `search`: `.or(\`name.ilike.%${search}%,phone.ilike.%${search}%\`)`
- Se `linked === "owner"`: `.not("owner_id", "is", null)`
- Se `linked === "lead"`: `.not("lead_id", "is", null)`
- Se `linked === "none"`: `.is("owner_id", null).is("lead_id", null)`
- Retornar `{ contacts, total }`

**POST(request, { params }):**
- Chamar edge function `whatsapp-chats-api` com `{ action: "sync_contacts", instance_id: instanceId }`
- Retornar resultado

---

### 11. `src/app/api/whatsapp/instances/[id]/contacts/[contactId]/route.ts`

**Criar ficheiro.** GET detalhe, PUT vincular.

**GET(request, { params }):**
- Query `wpp_contacts` por id com joins a `owners` e `leads`

**PUT(request, { params }):**
- Extrair `{ owner_id, lead_id }` do body
- Update em `wpp_contacts` por id com `updated_at`
- Select com joins após update
- Retornar contacto actualizado

---

### 12. `src/app/api/whatsapp/instances/[id]/webhook/route.ts`

**Criar ficheiro.** POST para registar/desregistar webhook.

**POST(request, { params }):**
- Extrair `instanceId`, buscar instância para obter `uazapi_token`
- Construir `webhookUrl = ${SUPABASE_URL}/functions/v1/whatsapp-webhook-receiver`
- Chamar UAZAPI `/webhook/set` com `{ url: webhookUrl, events: [...] }`
- Actualizar `auto_wpp_instances` com `webhook_url`, `webhook_registered_at`
- Retornar resultado

---

### 13. `src/app/api/whatsapp/chats/[chatId]/media/route.ts`

**Criar ficheiro.** GET para listar media de um chat.

**GET(request, { params }):**
- Query `wpp_messages` onde `chat_id = chatId` e `message_type` in `('image', 'video', 'audio', 'document')`
- Select: `id, message_type, media_url, media_mime_type, media_file_name, media_file_size, media_duration, timestamp, text`
- Order `timestamp DESC`
- Retornar `{ media }`

---

### 14. `src/app/api/whatsapp/media/upload/route.ts`

**Criar ficheiro.** POST para upload de ficheiro ao R2 (para envio).

**POST(request):**
- Extrair `formData`: `file` (File), `instance_id` (string), `chat_id` (string opcional)
- Validar `file` e `instance_id`
- `S3Client` com endpoint R2 (reutilizar padrão de `app/api/automacao/media/upload/route.ts`)
- Sanitizar nome: `file.name.replace(/[^a-zA-Z0-9._-]/g, "_")`
- Key: `wpp-media/${instance_id}/outgoing/${Date.now()}-${sanitizedName}`
- `PutObjectCommand` com `ContentType: file.type`
- Retornar `{ url, key, file_name, mime_type, size }`

---

## Hooks a Criar

### 15. `src/hooks/use-whatsapp-chats.ts`

**Criar ficheiro.**

**Interface:** `useWhatsAppChats({ instanceId, search?, archived? })`

**O que fazer:**
- State: `chats` (WppChat[]), `isLoading`, `total`
- `fetchChats()`: GET `/api/whatsapp/chats?instance_id=X&archived=Y&search=Z`
- Supabase Realtime: subscribir a `postgres_changes` em `wpp_chats` filtrado por `instance_id` — em qualquer evento (`*`), refetch
- Cleanup: `supabase.removeChannel(channel)` no return do useEffect
- Retornar `{ chats, isLoading, total, refetch }`

---

### 16. `src/hooks/use-whatsapp-messages.ts`

**Criar ficheiro.**

**Interface:** `useWhatsAppMessages(chatId)`

**O que fazer:**
- State: `messages` (WppMessage[]), `quotedMessages` (Record), `isLoading`, `isSending`, `hasMore`
- `fetchMessages(opts?)`: GET `/api/whatsapp/chats/${chatId}/messages?limit=50&before=X`
  - Se `opts.append`: prepend mensagens antigas ao array
  - Senão: substituir array
  - Merge `quoted_messages` no state
- `loadMore()`: chamar fetchMessages com `before` = timestamp da mensagem mais antiga
- Supabase Realtime: subscribir a `wpp_messages` filtrado por `chat_id`:
  - INSERT: adicionar ao array (com deduplicação por `id`)
  - UPDATE: merge no item existente (status, reactions, is_deleted)
- **Acções:**
  - `sendText(text, replyId?)`: POST `/api/whatsapp/chats/${chatId}/messages` com `{ action: "send_text", text, reply_id }` — optimistic add
  - `sendMedia(file, type, caption?, replyId?)`: upload ao R2 via POST `/api/whatsapp/media/upload` (FormData) → POST `/api/whatsapp/chats/${chatId}/messages` com `{ action: "send_media", type, file_url, caption }` — optimistic add
  - `react(messageId, emoji)`: POST `/api/whatsapp/messages/${messageId}/react` com `{ emoji }`
  - `deleteMessage(messageId, forEveryone?)`: DELETE `/api/whatsapp/messages/${messageId}` — optimistic set `is_deleted = true`
  - `markRead()`: POST `/api/whatsapp/chats/${chatId}/read`
- Retornar `{ messages, quotedMessages, isLoading, isSending, hasMore, loadMore, sendText, sendMedia, react, deleteMessage, markRead, refetch }`

---

### 17. `src/hooks/use-whatsapp-presence.ts`

**Criar ficheiro.**

**Interface:** `useWhatsAppPresence(instanceId)`

**O que fazer:**
- State: `presences` (Record<string, PresenceState>)
- Supabase Realtime: subscribir a broadcast channel `wpp-presence-${instanceId}` evento `presence`
  - Se `type === 'unavailable' || 'paused'`: remover do state
  - Senão: adicionar ao state + auto-clear com setTimeout 30s
- `sendPresence(chatId, type)`: POST `/api/whatsapp/chats/${chatId}/presence` com `{ type }`
- `isTyping(chatId)`: verificar se existe presença `composing` ou `recording` para o chatId
- Cleanup: removeChannel + clearTimeout de todos os timeouts
- Retornar `{ presences, sendPresence, isTyping }`

---

### 18. `src/hooks/use-whatsapp-contacts.ts`

**Criar ficheiro.**

**Interface:** `useWhatsAppContacts(instanceId)`

**O que fazer:**
- State: `contacts` (WppContact[]), `isLoading`, `total`
- `fetchContacts(opts?)`: GET `/api/whatsapp/instances/${instanceId}/contacts?search=X&linked=Y`
- `linkOwner(contactId, ownerId)`: PUT `/api/whatsapp/instances/${instanceId}/contacts/${contactId}` com `{ owner_id }` → update state
- `linkLead(contactId, leadId)`: PUT `/api/whatsapp/instances/${instanceId}/contacts/${contactId}` com `{ lead_id }` → update state
- `syncContacts()`: POST `/api/whatsapp/instances/${instanceId}/contacts` → refetch
- Retornar `{ contacts, isLoading, total, fetchContacts, linkOwner, linkLead, syncContacts }`

---

## Tipos a Criar

### 19. `src/lib/types/whatsapp-web.ts`

**Criar ficheiro.**

**O que definir:**
- `WppMessageType` = `'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact' | 'reaction' | 'poll' | 'view_once'`
- `WppMessageStatus` = `'sent' | 'delivered' | 'read' | 'played' | 'failed'`
- `WppMessage` interface — todos os campos de `wpp_messages` + `WppReaction[]`
- `WppReaction` interface — `{ emoji, sender, from_me, timestamp }`
- `WppChat` interface — todos os campos de `wpp_chats` + `contact: WppContact | null`
- `WppContact` interface — todos os campos de `wpp_contacts` + nested `owner?` e `lead?`
- `MESSAGE_TYPE_LABELS: Record<WppMessageType, string>` — labels PT-PT (Texto, Imagem, Vídeo, etc.)
- `MESSAGE_STATUS_LABELS: Record<WppMessageStatus, string>` — labels PT-PT (Enviada, Entregue, Lida, etc.)

**Código completo:** Ver PRD-02 secção 4.

---

## Padrões a Seguir

### Padrão: Route Handler com Admin Client
- Referência: `app/api/automacao/instancias/route.ts`
- Usar `createAdminClient()` para bypass RLS
- Cast `SupabaseAny` para tabelas sem types gerados

### Padrão: Edge Function call
```typescript
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const res = await fetch(`${SUPABASE_URL}/functions/v1/<function-name>`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_KEY}`,
  },
  body: JSON.stringify({ action: "...", ...params }),
})
```

### Padrão: Hook com Realtime
- Referência: `hooks/use-chat-messages.ts`
- `useRef` para channel
- Cleanup com `supabase.removeChannel(channel)`
- `postgres_changes` para INSERT e UPDATE
- Optimistic updates no send

### Padrão: Upload R2
- Referência: `app/api/automacao/media/upload/route.ts`
- `S3Client` com endpoint R2
- `PutObjectCommand` com ContentType
- URL pública: `${R2_PUBLIC_DOMAIN}/${key}`
