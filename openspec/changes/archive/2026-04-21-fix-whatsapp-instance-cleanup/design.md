## Context

O módulo WhatsApp do ERP assenta em sete tabelas `wpp_*` que partilham uma `instance_id uuid NOT NULL REFERENCES auto_wpp_instances(id)`:

| Tabela | Propósito | FK actual |
|---|---|---|
| `wpp_chats` | Lista de conversas por instância | `NO ACTION` |
| `wpp_messages` | Histórico de mensagens | `NO ACTION` (+ `chat_id → wpp_chats NO ACTION`) |
| `wpp_contacts` | Agenda da instância | `NO ACTION` |
| `wpp_message_media` | Ficheiros em R2 + metadados | `NO ACTION` (+ `message_id → wpp_messages NO ACTION`) |
| `wpp_labels` | Etiquetas nativas WhatsApp | `NO ACTION` |
| `wpp_activity_sessions` | Tracking CRM de actividade | **já** `ON DELETE CASCADE` (vem do `20260417_whatsapp_enhancements.sql`) |
| `wpp_scheduled_messages` | Mensagens agendadas pg_cron | **já** `ON DELETE CASCADE` |
| `wpp_debug_log` | Diagnósticos | **já** `ON DELETE CASCADE` (`20260425_wpp_debug_log_cascade.sql`) |

Só três tabelas foram corrigidas. As outras cinco (`wpp_chats`, `wpp_messages`, `wpp_contacts`, `wpp_message_media`, `wpp_labels`) ficam com FK restritiva, o que na prática significa que hoje `DELETE FROM auto_wpp_instances WHERE id = ?` falha silenciosamente se há dados — e o código em `handleDelete` (`app/api/automacao/instancias/route.ts:692`) não detecta isso porque o único `error` testado é o da operação final em `auto_wpp_instances`. O resultado observado pelo utilizador é "botão Eliminar diz sucesso mas a lista de chats continua lá".

O escopo por utilizador também está incompleto: três superfícies lêem `auto_wpp_instances`:

1. `GET /api/whatsapp/instances` — filtra `user_id` para não-admin ✅
2. `GET /api/automacao/instancias` — filtra `user_id` para não-admin ✅
3. `app/dashboard/whatsapp/page.tsx` — filtra `user_id` para não-admin ✅
4. `app/dashboard/whatsapp/contactos/page.tsx` — **não filtra** ❌
5. `app/api/whatsapp/instances/[id]/contacts/route.ts` — (a verificar)

Roles admin: `WHATSAPP_ADMIN_ROLES` em `lib/auth/roles.ts` (Broker/CEO, Office Manager, etc.).

## Goals / Non-Goals

**Goals:**
- Ao eliminar uma instância, todo o histórico derivado (chats, mensagens, contactos, media, labels, agendados, sessões, debug log) é apagado numa só transacção.
- Ficheiros em Cloudflare R2 apontados por `wpp_message_media.r2_key` e `thumbnail_r2_key` são removidos best-effort antes do `DELETE` — falhas R2 não bloqueiam o delete em banco.
- Utilizadores não-admin só vêem e só podem tocar na sua própria instância em **todas** as superfícies (listagem, contactos, detalhe, contagem).
- Desconectar continua a ser uma operação reversível sem perda de dados.
- O consultor entende a diferença no UI: o `AlertDialog` de eliminação enumera o que será apagado.

**Non-Goals:**
- Soft-delete de instâncias (o requisito é hard-delete).
- Audit log retroactivo dos dados apagados (se fizer falta no futuro, entra em change separado).
- Alterações a `auto_flows.wpp_instance_id` (já se desvincula no `handleDelete` actual — mantém-se).
- Mudança no fluxo de webhook da Uazapi ou no scheduler de mensagens.
- Exposição de RLS para `wpp_*` (continua a usar admin client; a validação de ownership é aplicacional).

## Decisions

### D1 — Limpeza via `ON DELETE CASCADE` (não via código aplicacional)

**Escolha:** alterar as 5 FKs restantes para `ON DELETE CASCADE` e deixar o Postgres apagar linhas em cascata.

**Alternativa rejeitada:** acrescentar `.delete().eq('instance_id', id)` em `handleDelete` para cada tabela antes do `DELETE` da instância.

**Porquê cascata:**
- Atómica por default — não é possível ficar com `wpp_messages` órfãos se o request morrer a meio.
- Não precisa de conhecimento da ordem topológica (`wpp_message_media → wpp_messages → wpp_chats`).
- Robusta contra novas tabelas `wpp_*` que adicionem `instance_id` no futuro — o autor da migração decide o comportamento ao escrever a FK.
- O Postgres já executa cascata sobre os índices `(instance_id)` existentes, portanto a performance é equivalente a `DELETE` manual.

**Trade-off:** perde-se a oportunidade de retornar contagens ricas por tabela sem um `SELECT` prévio. Resolve-se no D3.

### D2 — Limpeza R2 **antes** do `DELETE` em banco, best-effort

**Escolha:**
```ts
// 1. listar todas as r2_key + thumbnail_r2_key da instância
// 2. correr deleteObject em paralelo com pLimit(10), engolir erros individuais
// 3. só depois: DELETE FROM auto_wpp_instances → cascata apaga linhas
```

**Porquê:** depois do `DELETE` não há como enumerar os ficheiros órfãos. Um `Promise.allSettled` com erros ignorados mantém o contrato "eliminar é irreversível" sem bloquear se o R2 falhar num objecto individual.

**Alternativas rejeitadas:**
- Trigger PL/pgSQL + `pg_net` para chamar um endpoint de limpeza: acrescenta dependência pg_net/edge, difícil de testar localmente.
- Job assíncrono (BullMQ/pg-boss): o projecto não tem worker dedicado fora do `app/api/automacao/worker/route.ts`; adicionar uma fila só para isto é excessivo.

**Observação:** `deleteImageFromR2` (`lib/r2/images.ts`) já existe e apaga por `key`. Reutilizar.

### D3 — Endpoint devolve contagens apagadas

Antes da cascata, `handleDelete` executa `SELECT count(*)` em cada tabela filtrada por `instance_id`:

```ts
const [{ count: chats }, { count: msgs }, { count: contacts }, { count: mediaRows }] =
  await Promise.all([
    supabase.from('wpp_chats').select('*', { count: 'exact', head: true }).eq('instance_id', id),
    // ...
  ])
```

Devolve `{ success, unboundFlowsCount, deletedCounts: { chats, messages, contacts, media } }`.

**Porquê:** o toast na UI ganha especificidade ("3 conversas, 412 mensagens, 2 contactos removidos") sem custo real (count com índice é barato, paralelo).

### D4 — Ownership por utilizador: filtrar em 2 sítios em falta

- `app/dashboard/whatsapp/contactos/page.tsx` — adicionar leitura de roles + filtro `user_id = user.id` para não-admin. Mesma receita de `app/dashboard/whatsapp/page.tsx`.
- `app/api/whatsapp/instances/[id]/contacts/route.ts` — validar ownership (buscar `user_id` da instância, rejeitar 403 se não-admin e `user_id !== auth.user.id`).

**Não altera RLS** porque o admin client bypassa. Mantém-se validação aplicacional, consistente com `app/api/automacao/instancias/route.ts:264-281`.

### D5 — Copy do `AlertDialog` fica explícito

Texto novo:

> Eliminar instância `<Nome>`?
>
> Esta acção é **irreversível** e vai remover:
> - a instância da Uazapi
> - todas as conversas, mensagens e contactos desta instância
> - os ficheiros de media associados em armazenamento
>
> Se quer apenas parar de receber mensagens, use **Desconectar** — o histórico fica preservado para reconexão.

**Porquê:** diferencia eliminar vs. desconectar, que o utilizador pediu explicitamente ("Quando desconectada OK pode ficar assim, mas quando solicitado a eliminação é necessário remover").

### D6 — Uma única migração SQL

`supabase/migrations/YYYYMMDD_wpp_instance_cascade.sql` com um `DROP CONSTRAINT` + `ADD CONSTRAINT ON DELETE CASCADE` por FK afectada. Inclui também as FKs internas `wpp_messages.chat_id → wpp_chats` e `wpp_message_media.message_id → wpp_messages` e `wpp_chats.contact_id → wpp_contacts (ON DELETE SET NULL)` — apagar um contacto não deve apagar o chat; setar `contact_id = null` para o chat permanecer apagável pela cascata principal.

Segue o estilo de `20260425_wpp_debug_log_cascade.sql`.

## Risks / Trade-offs

- **[R1] Cascata lenta em instâncias grandes** → Mitigação: os índices `(instance_id)` existem em todas as tabelas `wpp_*` (confirmado no schema). Para instâncias com 100k+ mensagens, DELETE demora segundos mas é aceitável num fluxo administrativo raro. Se aparecer um caso real, considerar batch DELETE num edge function em change separado.
- **[R2] Ficheiros R2 órfãos se o `DELETE` em banco falhar depois do R2 delete** → Mitigação: a probabilidade é baixa (o `DELETE` em `auto_wpp_instances` é uma query simples). Alternativamente, aceita-se o risco — perde-se acesso a media já perdida, sem consequências de segurança porque o bucket é privado ao ERP.
- **[R3] Consultor elimina instância por engano** → Mitigação: `AlertDialog` com texto explícito (D5); botão em `destructive` variant; sem "Enter" por default. Não se implementa undo porque a feature é explicitamente irreversível.
- **[R4] A migração SQL corre enquanto um webhook está a inserir em `wpp_messages`** → Mitigação: `ALTER TABLE ... DROP/ADD CONSTRAINT` adquire `ACCESS EXCLUSIVE` brevemente. O receptor de webhook é idempotente e fará retry; em produção correr em janela de pouco tráfego.
- **[R5] Filtragem aplicacional em vez de RLS** → continua a ser a política do projecto (ver `app/api/automacao/instancias/route.ts`). Risco de esquecer filtro numa nova rota: documentar em CLAUDE.md e em spec.

## Migration Plan

1. **Deploy SQL** — `supabase db push` (ou via painel) aplicando `YYYYMMDD_wpp_instance_cascade.sql`. A migração é idempotente (`DROP CONSTRAINT IF EXISTS`).
2. **Deploy código** — Vercel/Coolify com `handleDelete` actualizado + UI ajustada.
3. **Regenerar tipos** — `npx supabase gen types typescript` e commitar `types/database.ts`.
4. **Rollback** — reverter a migração substitui `ON DELETE CASCADE` por `NO ACTION`. Os dados já apagados não voltam, mas a estrutura volta ao estado anterior. Preparar migração inversa `YYYYMMDD_wpp_instance_cascade_rollback.sql` pronta mas não commitada.

## Open Questions

- Deve `wpp_activity_sessions.lead_id → leads` continuar a `ON DELETE CASCADE`? Sim — mantém o comportamento actual. Sem mudança.
- Fica por decidir se se deve também apagar `log_audit` com `entity_type = 'whatsapp_instance' AND entity_id = <id>`. **Proposta:** manter (log_audit é histórico de auditoria, não deve cascatar). Registar esta decisão no spec.
