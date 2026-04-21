## 1. Migração SQL — FKs em cascata

- [x] 1.1 Criar `supabase/migrations/<YYYYMMDD>_wpp_instance_cascade.sql` com `DROP/ADD CONSTRAINT ... ON DELETE CASCADE` para `wpp_chats.instance_id`, `wpp_messages.instance_id`, `wpp_contacts.instance_id`, `wpp_message_media.instance_id`, `wpp_labels.instance_id`. → `supabase/migrations/20260426_wpp_instance_cascade.sql`
- [x] 1.2 Adicionar na mesma migração `ON DELETE CASCADE` para `wpp_messages.chat_id → wpp_chats(id)` e `wpp_message_media.message_id → wpp_messages(id)`.
- [x] 1.3 Adicionar `ON DELETE SET NULL` para `wpp_chats.contact_id → wpp_contacts(id)` (apagar contacto não deve apagar chat, mas chat deve continuar elegível para cascata via `instance_id`).
- [x] 1.4 Incluir nota de cabeçalho no estilo de `20260425_wpp_debug_log_cascade.sql` explicando a razão.
- [ ] 1.5 Correr `supabase db push` (ou via painel Supabase) e confirmar sucesso em staging. **(operacional — a correr pelo utilizador)**
- [ ] 1.6 Regenerar tipos: `npx supabase gen types typescript --project-id umlndumjfamfsswwjgoo > types/database.ts` e commitar. **(operacional — a correr pelo utilizador após 1.5)**

## 2. API — handler `handleDelete` actualizado

- [x] 2.1 Em `app/api/automacao/instancias/route.ts`, antes do `DELETE` em banco, fazer `Promise.all` de quatro `SELECT count(*)` com `head: true` em `wpp_chats`, `wpp_messages`, `wpp_contacts`, `wpp_message_media` filtrados por `instance_id`.
- [x] 2.2 Enumerar `wpp_message_media` da instância (`select r2_key, thumbnail_r2_key`) e iterar com `pLimit(10)` chamando `deleteImageFromR2` (de `lib/r2/images.ts`) para cada chave; envolver cada delete num `try/catch` que loga mas não rejeita.
- [x] 2.3 Confirmar (ou adicionar) `Promise.allSettled` para que uma rejeição individual não aborte o batch.
- [x] 2.4 Manter o `fetchUazapi('/instance', { method: 'DELETE', ... })` existente e o unbind de `auto_flows`. Manter a ordem: unbind flows → R2 cleanup → Uazapi delete → banco delete (cascata).
- [x] 2.5 Actualizar a resposta JSON para incluir `deletedCounts: { chats, messages, contacts, media }` (os counts foram lidos em 2.1).
- [ ] 2.6 Testar localmente com uma instância de teste que tenha chats e mensagens; confirmar que todas as linhas desaparecem e o endpoint devolve os counts correctos. **(teste manual — a correr pelo utilizador)**

## 3. Escopo por utilizador — superfícies em falta

- [x] 3.1 Em `app/dashboard/whatsapp/contactos/page.tsx`, replicar o padrão de `app/dashboard/whatsapp/page.tsx`: ler roles do `dev_users` + `user_roles`, calcular `isWppAdmin`, e adicionar `.eq('user_id', user.id)` à query se `!isWppAdmin`.
- [x] 3.2 Em `app/api/whatsapp/instances/[id]/contacts/route.ts`, adicionar check de ownership: buscar `user_id` da instância antes da query de contactos; se `!isAdmin && instance.user_id !== auth.user.id` responder 403 com "Sem permissão para esta instância".
- [x] 3.3 Auditar outras rotas que leiam `auto_wpp_instances` sem filtrar.

  **Findings (2026-04-21):** as seguintes rotas carregam `auto_wpp_instances` por `id` sem verificar ownership. Não estão cobertas por este change (o pedido original foi a página de contactos + eliminação), mas ficam anotadas como follow-up:

  - `app/api/whatsapp/save-to-erp/route.ts` (user-facing) — consulta `uazapi_token` para uma `instance_id` vinda do body.
  - `app/api/whatsapp/media/download/route.ts` (user-facing) — idem.
  - `app/api/whatsapp/resolve-chat/route.ts` (user-facing).
  - `app/api/whatsapp/groups/[groupJid]/route.ts` (user-facing).
  - `app/api/whatsapp/instances/[id]/webhook/route.ts` (admin — registar webhook; provavelmente já correcto mas merece check).
  - `app/api/whatsapp/debug/route.ts` (admin-only de facto, não urgente).
  - `app/api/whatsapp/sync-all/route.ts` (iteração global; aceitável porque sincroniza todas as instâncias contra Uazapi).

  Recomendação: abrir change separado `secure-whatsapp-api-ownership` para adicionar `assertInstanceOwnership` nos 4 primeiros endpoints user-facing. Fora do escopo deste change.

## 4. UI — diálogo e toast

- [x] 4.1 Em `app/dashboard/automacao/instancias/page.tsx`, reescrever o texto do `AlertDialogDescription` listando o que vai ser apagado (instância Uazapi, conversas, mensagens, contactos, media) e incluindo uma linha a sugerir "Desconectar" como alternativa reversível.
- [x] 4.2 No mesmo ficheiro, actualizar `handleDelete` para consumir `deletedCounts` do response e construir a mensagem de toast: se soma > 0, usar `toast.success` com texto "Instância eliminada — X conversas, Y mensagens, Z contactos removidos"; caso contrário o texto actual "Instância eliminada com sucesso".
- [x] 4.3 Em `hooks/use-whatsapp-instances.ts`, estender o tipo de retorno de `deleteInstance` com `deletedCounts?: { chats: number; messages: number; contacts: number; media: number }` e passá-lo através do hook.

## 5. Validação

- [x] 5.1 `openspec validate fix-whatsapp-instance-cleanup` sem erros.
- [ ] 5.2 Teste manual no browser: eliminar uma instância com histórico e confirmar no Supabase Studio que `wpp_chats`, `wpp_messages`, `wpp_contacts`, `wpp_message_media`, `wpp_labels`, `wpp_scheduled_messages`, `wpp_activity_sessions`, `wpp_debug_log` filtradas por esse `instance_id` não têm linhas. **(teste manual)**
- [ ] 5.3 Teste manual: desconectar uma instância com histórico e confirmar que os chats continuam visíveis ao reconectar. **(teste manual)**
- [ ] 5.4 Teste manual com conta não-admin: confirmar que `/dashboard/whatsapp/contactos` só mostra a instância do próprio utilizador. **(teste manual)**
- [ ] 5.5 Teste manual de API: chamar `GET /api/whatsapp/instances/<outra-instance-id>/contacts` com conta não-admin e confirmar resposta 403. **(teste manual)**
- [ ] 5.6 Verificar bucket R2 (ou logs) após eliminação de uma instância com media — confirmar que os objectos foram removidos ou logados como falhas. **(teste manual)**
