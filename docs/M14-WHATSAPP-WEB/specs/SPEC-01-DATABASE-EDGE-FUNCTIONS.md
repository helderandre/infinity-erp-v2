# SPEC-01: Database Schema & Edge Functions

> WhatsApp Web — Migrações SQL e Edge Functions Supabase
> Projecto: ERP Infinity v2 | Data: 2026-03-18

---

## Ficheiros a Criar

### 1. Migração SQL: `wpp_contacts`

**Executar via:** Supabase MCP `execute_sql` ou Dashboard SQL Editor

```sql
CREATE TABLE wpp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES auto_wpp_instances(id) ON DELETE CASCADE,
  wa_contact_id TEXT NOT NULL,
  phone TEXT,
  name TEXT,
  short_name TEXT,
  profile_pic_url TEXT,
  is_business BOOLEAN DEFAULT false,
  is_group BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  owner_id UUID REFERENCES owners(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
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

---

### 2. Migração SQL: `wpp_chats`

**Executar via:** Supabase MCP `execute_sql`

```sql
CREATE TABLE wpp_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES auto_wpp_instances(id) ON DELETE CASCADE,
  wa_chat_id TEXT NOT NULL,
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
  last_message_text TEXT,
  last_message_type TEXT DEFAULT 'text',
  last_message_timestamp BIGINT,
  last_message_from_me BOOLEAN DEFAULT false,
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

---

### 3. Migração SQL: `wpp_messages`

**Executar via:** Supabase MCP `execute_sql`

```sql
CREATE TABLE wpp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES wpp_chats(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES auto_wpp_instances(id) ON DELETE CASCADE,
  wa_message_id TEXT NOT NULL,
  sender TEXT,
  sender_name TEXT,
  from_me BOOLEAN DEFAULT false,
  message_type TEXT NOT NULL DEFAULT 'text',
  text TEXT DEFAULT '',
  media_url TEXT DEFAULT '',
  media_mime_type TEXT,
  media_file_name TEXT,
  media_file_size BIGINT,
  media_duration INT,
  quoted_message_id TEXT DEFAULT '',
  is_group BOOLEAN DEFAULT false,
  is_forwarded BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'sent',
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  vcard TEXT,
  reactions JSONB DEFAULT '[]',
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

---

### 4. Migração SQL: `wpp_message_media`

**Executar via:** Supabase MCP `execute_sql`

```sql
CREATE TABLE wpp_message_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES wpp_messages(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES auto_wpp_instances(id) ON DELETE CASCADE,
  original_url TEXT,
  r2_key TEXT NOT NULL,
  r2_url TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  file_name TEXT,
  thumbnail_r2_key TEXT,
  thumbnail_r2_url TEXT,
  transcription TEXT,
  width INT,
  height INT,
  duration INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wpp_message_media_message ON wpp_message_media(message_id);
CREATE INDEX idx_wpp_message_media_instance ON wpp_message_media(instance_id);
```

---

### 5. Migração SQL: `wpp_labels` + `wpp_chat_labels`

**Executar via:** Supabase MCP `execute_sql`

```sql
CREATE TABLE wpp_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES auto_wpp_instances(id) ON DELETE CASCADE,
  wa_label_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
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

---

### 6. Migração SQL: `_debug_wpp_payloads`

**Executar via:** Supabase MCP `execute_sql`

```sql
CREATE TABLE _debug_wpp_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT DEFAULT 'whatsapp',
  event_type TEXT,
  instance_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 7. Migração SQL: ALTER `auto_wpp_instances`

**Executar via:** Supabase MCP `execute_sql`

```sql
ALTER TABLE auto_wpp_instances
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS webhook_registered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_events TEXT[] DEFAULT ARRAY[
    'messages', 'messages_update', 'connection', 'contacts', 'presence', 'labels'
  ]::TEXT[];
```

---

### 8. Migração SQL: Trigger de cleanup

**Executar via:** Supabase MCP `execute_sql`

```sql
CREATE OR REPLACE FUNCTION cleanup_instance_media()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO _cleanup_queue (entity_type, entity_id, metadata)
  VALUES ('wpp_instance', OLD.id, jsonb_build_object('r2_prefix', 'wpp-media/' || OLD.id));
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cleanup_instance_media
  BEFORE DELETE ON auto_wpp_instances
  FOR EACH ROW EXECUTE FUNCTION cleanup_instance_media();
```

**Nota:** Se a tabela `_cleanup_queue` não existir, criar primeiro ou usar abordagem alternativa de limpeza directa na API route de delete.

---

### 9. Migração SQL: Habilitar Realtime

**Executar via:** Supabase MCP `execute_sql`

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE wpp_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE wpp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE wpp_contacts;
```

---

### 10. Edge Function: `supabase/functions/whatsapp-webhook-receiver/index.ts`

**Criar ficheiro:** `supabase/functions/whatsapp-webhook-receiver/index.ts`

**O que faz:**
- Recebe webhooks POST do UAZAPI
- Resolve `instance_id` a partir do token no payload/header (tabela `auto_wpp_instances`, campo `uazapi_token`)
- Salva payload cru em `_debug_wpp_payloads` (desenvolvimento)
- Processa eventos por tipo:
  - `messages` / `messages.upsert` → `handleNewMessage()`: upsert contacto em `wpp_contacts`, upsert chat em `wpp_chats` (com `last_message_*`), insert mensagem em `wpp_messages`, incrementar `unread_count` se `!fromMe`, disparar `whatsapp-media-processor` se tem media
  - `messages_update` / `messages.update` → `handleMessageUpdate()`: actualizar `status` em `wpp_messages` (respeitar ordem: sent < delivered < read < played)
  - `connection` → `handleConnection()`: actualizar `connection_status` em `auto_wpp_instances`
  - `contacts` → `handleContacts()`: upsert batch em `wpp_contacts`
  - `presence` → `handlePresence()`: broadcast via Supabase Realtime channel `wpp-presence-{instanceId}` (não persiste no DB)
  - `labels` → `handleLabels()`: upsert em `wpp_labels`

**Helpers internos:**
- `normalizeMessageType(uazapiType)` — mapeia tipos UAZAPI (Conversation, ImageMessage, etc.) para tipos simples (text, image, etc.)
- `cleanName(name)` — evita JIDs e números puros como nome
- `extractPhone(jid)` — extrai telefone do JID (`5511999@s.whatsapp.net` → `5511999`)
- `handleReaction()` — actualiza array `reactions` em `wpp_messages` (add/remove por sender)
- Mensagens editadas: update `text` em `wpp_messages` por `wa_message_id`
- Mensagens apagadas (ProtocolMessage type=0): set `is_deleted=true`, `deleted_at`, `deleted_by`

**Código completo:** Ver PRD-01 secção 2.1 — copiar na íntegra, adaptando:
- `automa_whatsapp_instances` → `auto_wpp_instances`
- `uzapi_token` → `uazapi_token`
- `uzapi_instance_id` → `uazapi_instance_id`

---

### 11. Edge Function: `supabase/functions/whatsapp-messaging/index.ts`

**Criar ficheiro:** `supabase/functions/whatsapp-messaging/index.ts`

**O que faz:**
- Recebe POST com `{ action, instance_id, ... }`
- Resolve token via `getInstanceToken(instance_id)` → query `auto_wpp_instances.uazapi_token`
- Chama endpoint UAZAPI correspondente via `callUazapi(token, endpoint, body)`
- Salva mensagem enviada em `wpp_messages` e actualiza `wpp_chats` via `saveOutgoingMessage()`

**Acções suportadas:**
| Acção | Endpoint UAZAPI | Params obrigatórios |
|---|---|---|
| `send_text` | `/send/text` | `instance_id, wa_chat_id, text` |
| `send_media` | `/send/media` | `instance_id, wa_chat_id, type, file_url` |
| `send_audio` | `/send/ptt` ou `/send/myaudio` | `instance_id, wa_chat_id, file_url` |
| `send_location` | `/send/location` | `instance_id, wa_chat_id, latitude, longitude` |
| `send_contact` | `/send/contact` | `instance_id, wa_chat_id, contact_name, contact_phone` |
| `send_sticker` | `/send/sticker` | `instance_id, wa_chat_id, file_url` |
| `react` | `/message/react` | `instance_id, wa_chat_id, wa_message_id, emoji` |
| `delete_message` | `/message/delete` | `instance_id, wa_message_id` + soft delete no DB |
| `edit_message` | `/message/edit` | `instance_id, wa_message_id, new_text` + update no DB |
| `download_media` | `/message/download` | `instance_id, wa_message_id` |
| `send_presence` | `/message/presence` | `instance_id, wa_chat_id, type` |
| `mark_read` | `/message/markread` | `instance_id, wa_chat_id` + reset `unread_count=0` |
| `forward` | `/message/forward` | `instance_id, wa_message_id, to_chat_id` |

**Código completo:** Ver PRD-01 secção 2.2 — copiar na íntegra.

---

### 12. Edge Function: `supabase/functions/whatsapp-media-processor/index.ts`

**Criar ficheiro:** `supabase/functions/whatsapp-media-processor/index.ts`

**O que faz:**
1. Recebe `{ message_id, instance_id, media_url, media_type, mime_type, file_name }`
2. Busca token da instância em `auto_wpp_instances`
3. Se URL é `.enc`, chama UAZAPI `/message/download` com `return_link: true` para obter URL desencriptada
4. Descarrega ficheiro via `fetch(finalUrl)`
5. Determina extensão pelo `mime_type`
6. Faz upload ao R2 com path `wpp-media/{instance_id}/{timestamp}-{message_id}.{ext}`
   - Usar `aws4fetch` no Deno: `import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17"`
   - PUT para `{R2_ENDPOINT}/{R2_BUCKET}/{r2Key}`
7. Insere registo em `wpp_message_media` com `r2_key`, `r2_url`, `mime_type`, `file_size`
8. Actualiza `media_url` em `wpp_messages` com URL pública do R2

**Env vars necessárias no Supabase Edge Functions:**
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN`
- `UAZAPI_URL`

**Código completo:** Ver PRD-01 secção 2.3.

---

### 13. Edge Function: `supabase/functions/whatsapp-chats-api/index.ts`

**Criar ficheiro:** `supabase/functions/whatsapp-chats-api/index.ts`

**O que faz:**
- API de gestão de chats via POST com `{ action, instance_id, ... }`

**Acções:**
| Acção | O que faz |
|---|---|
| `sync_chats` | Busca chats do UAZAPI e faz upsert em `wpp_chats` |
| `sync_contacts` | Busca contactos do UAZAPI (paginado) e faz upsert em `wpp_contacts` |
| `archive_chat` | Toggle `is_archived` em `wpp_chats` |
| `pin_chat` | Toggle `is_pinned` em `wpp_chats` |
| `mute_chat` | Toggle `is_muted` em `wpp_chats` + set `mute_until` |
| `auto_match` | Auto-vincular contactos sem vinculação a owners/leads por telefone |

**Adaptações do Leve Mãe:**
- `automa_whatsapp_instances` → `auto_wpp_instances`
- `uzapi_token` → `uazapi_token`
- `whatsapp_chats` → `wpp_chats`
- `whatsapp_messages` → `wpp_messages`
- Vinculação a `owners` e `leads` (em vez de `task_field_values`)

---

## Ficheiros a Modificar

### 14. `app/api/automacao/instancias/route.ts`

**Modificar:** Na acção `connect` ou `sync`, após conectar a instância com sucesso, registar o webhook URL do `whatsapp-webhook-receiver`:

```typescript
// Após conexão bem-sucedida, registar webhook
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook-receiver`

await fetch(`${UAZAPI_URL}/webhook/set`, {
  method: "POST",
  headers: { "Content-Type": "application/json", token: instance.uazapi_token },
  body: JSON.stringify({
    url: webhookUrl,
    events: ["messages", "messages_update", "connection", "contacts", "presence", "labels"],
  }),
})

// Guardar no DB
await supabase
  .from("auto_wpp_instances")
  .update({
    webhook_url: webhookUrl,
    webhook_registered_at: new Date().toISOString(),
  })
  .eq("id", instanceId)
```

---

## Ordem de Execução

1. Executar migrações SQL (tabelas 1-8) — ordem importa por FKs
2. Habilitar Realtime (migração 9)
3. Deploy edge function `whatsapp-webhook-receiver`
4. Deploy edge function `whatsapp-messaging`
5. Deploy edge function `whatsapp-media-processor`
6. Deploy edge function `whatsapp-chats-api`
7. Modificar `instancias/route.ts` para registar webhook
8. Testar: conectar instância → enviar mensagem → verificar se chega ao DB

---

## Variáveis de Ambiente (Edge Functions)

Configurar no Supabase Dashboard → Edge Functions → Secrets:

```
UAZAPI_URL=<url-do-uazapi>
R2_ENDPOINT=https://<account-id>.eu.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET_NAME=public
R2_PUBLIC_DOMAIN=https://pub-xxx.r2.dev
```
