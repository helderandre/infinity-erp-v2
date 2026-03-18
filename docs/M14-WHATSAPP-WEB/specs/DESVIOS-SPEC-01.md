# Desvios da Implementação — SPEC-01-DATABASE-EDGE-FUNCTIONS

> Data: 2026-03-18

---

## Migração 8: Trigger de Cleanup — OMITIDO

**Spec:** Criar trigger `trg_cleanup_instance_media` que insere em `_cleanup_queue`.

**Implementação:** Trigger **não foi criado** porque a tabela `_cleanup_queue` não existe no schema actual.

**Alternativa:** Conforme a própria spec sugere (secção 1.8 nota), a limpeza de ficheiros R2 será feita directamente na API route `handleDelete` em `app/api/automacao/instancias/route.ts`, listando e apagando ficheiros do R2 antes de eliminar a instância do DB. O `ON DELETE CASCADE` nas FK já trata a limpeza das tabelas filhas (`wpp_contacts`, `wpp_chats`, `wpp_messages`, etc.).

---

## Edge Function `whatsapp-media-processor` — R2 Upload via aws4fetch

**Spec (PRD-01 secção 2.3):** O código original continha upload ao R2 comentado como exemplo, sem implementação funcional.

**Implementação:** Upload ao R2 **totalmente implementado** usando `aws4fetch@1.0.17` (assinatura S3 compatível com Deno). O fluxo completo:
1. Busca o UUID da mensagem via `wa_message_id` para preencher a FK `message_id` em `wpp_message_media`
2. Faz upload com `AwsClient.fetch(putUrl, { method: "PUT", ... })`
3. Insere registo em `wpp_message_media` com FK correcta
4. Actualiza `media_url` em `wpp_messages` com URL pública do R2

---

## Edge Function `whatsapp-webhook-receiver` — JWT desactivado

**Justificação:** Esta edge function recebe webhooks POST directamente do UAZAPI (serviço externo), que não envia JWT do Supabase. Por isso, `verify_jwt: false`. A autenticação é feita por **token da instância** no payload/header — o webhook receiver valida contra `auto_wpp_instances.uazapi_token`.

---

## Edge Function `whatsapp-chats-api` — Acções implementadas

**Spec:** Referencia código de `.temp/edge/whatsapp-chats-api.md` (Leve Mãe) com 16+ acções.

**Implementação:** Implementadas as 6 acções prioritárias da SPEC-01:
- `sync_chats` — Sincronizar chats do UAZAPI + upsert contactos
- `sync_contacts` — Sincronizar contactos paginados
- `archive_chat` — Toggle `is_archived`
- `pin_chat` — Toggle `is_pinned`
- `mute_chat` — Toggle `is_muted` + `mute_until`
- `auto_match` — Vincular contactos a `owners`/`leads` por telefone

As acções restantes (`list_chats`, `get_messages`, `force_sync_msgs`, `chat_details`, `delete_chat`, `get_chat_media`, `link_owner`, `unlink_owner`, `link_lead`, `unlink_lead`) serão implementadas nas API routes Next.js (SPEC-02) pois envolvem queries com filtros/paginação mais adequadas para route handlers.

---

## Webhook Registration — Padrão

**Spec:** Sugere registar no `handleConnect` e no `handleSync`.

**Implementação:** Registado em ambos, conforme spec:
- `handleSync`: Após update de cada instância conectada
- `handleConnect`: Imediatamente após iniciar a conexão

Adicionada uma função helper `registerWebhook()` reutilizável no route handler.

O endpoint UAZAPI usado é `POST /webhook` (conforme PRD-01 secção 3.3), com `enabled: true` e todos os eventos configurados.

---

## Variáveis de Ambiente (Edge Functions)

As seguintes secrets precisam ser configuradas no Supabase Dashboard → Edge Functions → Secrets:

```
UAZAPI_URL=<url-do-uazapi>
R2_ENDPOINT=https://<account-id>.eu.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET_NAME=public
R2_PUBLIC_DOMAIN=https://pub-xxx.r2.dev
```

**Nota:** `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já estão disponíveis automaticamente nas edge functions.
