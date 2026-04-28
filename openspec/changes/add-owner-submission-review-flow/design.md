## Context

A app `infinity-cliente` é o front-end do proprietário no fluxo de angariação. Hoje envia para o ERP através de três Route Handlers (`/api/process-subtasks/upload`, `/sign-cmi`, `/edit-field`) que escrevem directamente em `doc_registry` (com `metadata.uploaded_via='owner_angariacao_checklist' | 'owner_app'`) e em `owners` (UPDATE directo, sem audit).

O ERP consome este estado de duas formas:
1. **Card hardcoded da subtask de angariação** ([lib/processes/subtasks/rules/angariacao/](lib/processes/subtasks/rules/angariacao/)) lê `doc_registry` para mostrar o que está submetido — mas não tem acções de aprovação.
2. **Painel de owners** lê `owners` para mostrar dados — mas não vê histórico.

**Tabelas canónicas existentes que esta change reusa:**
- `notifications` (recipient_id, sender_id, notification_type, entity_type, entity_id, title, body, action_url, is_read, metadata) — tipos definidos em [lib/notifications/types.ts](lib/notifications/types.ts).
- `proc_task_activities` (proc_task_id, user_id, activity_type, description, metadata, created_at) — append-only, accepts new TEXT activity_type values; UI config em `TASK_ACTIVITY_TYPE_CONFIG` ([lib/constants.ts](lib/constants.ts)).
- `owner_notifications` — canal já em uso pela app cliente para entregar notificações ao owner.
- `proc_subtasks` — colunas `is_completed`, `completed_at`, `completed_by`, dedup index `(proc_task_id, subtask_key, COALESCE(owner_id, uuid_nil))`.
- `propagateDueDates()` em [lib/processes/subtasks/propagate-due-dates.ts](lib/processes/subtasks/propagate-due-dates.ts) — destrava sucessoras quando uma rule completa.

**Constraints inegociáveis:**
- Toda a lógica de mutação corre via Route Handlers Node + admin client (CLAUDE.md raiz §13). Sem novas Edge Functions.
- App cliente não pode ser alterado nesta change — o trigger SQL detecta `auth.uid()` sozinho.
- Idempotência total (re-aprovar não duplica activity nem reverte estado).

## Goals / Non-Goals

**Goals:**
- Notificação determinística e idempotente ao consultor por cada submissão do owner — entregue em **3 canais**: in-app (badge na sidebar), email (canal existente) e **push** (Web Push para ERP web/PWA via service worker já em uso).
- Push notification ao owner no app cliente quando o consultor rejeita um documento, via tabela `owner_push_subscriptions` (mirrors `push_subscriptions`).
- Fila de análise inline (no card hardcoded existente, sem nova página de "Inbox") com Aprovar/Rejeitar — **sem remover** nenhuma funcionalidade actual do card (upload pelo consultor, análise IA, anotações, marcação manual mantêm-se intactas).
- Auto-completion da `proc_subtasks` ao Aprovar + propagação de due-dates atómica.
- Audit trail server-side dos UPDATEs em `owners` para colunas-whitelist, sem requerer mudanças na app cliente.
- Timeline visível de edições no painel do owner com agrupamento por subtask + janela temporal.

**Non-Goals:**
- Re-arquitectura do card legacy de upload — apenas extensão aditiva.
- Inbox global de submissões pendentes (a fila é per-subtask, dentro do card existente).
- Bulk approve / batch review — fica para fase 2 quando o volume justificar.
- Suporte a fluxos do owner que NÃO sejam angariação (negócios, processos, etc.) — só `process_type='angariacao'` nesta change.
- Notificação por SMS/WhatsApp — só in-app + email + push.
- Instrumentar o registo de push subscriptions no app cliente — assume-se que já existe; se não, é change separada.

## Decisions

### D1. Watcher de submissões: trigger SQL `AFTER INSERT` em `doc_registry` (não Route Handler)

**Decisão:** Trigger SQL `AFTER INSERT` em `doc_registry` filtrado por `metadata->>'uploaded_via' IN ('owner_angariacao_checklist','owner_app')` chama `notify_consultant_owner_submission(NEW.id)` (SECURITY DEFINER) que faz lookup do `assigned_to` da `proc_task` pai e INSERTa em `notifications` + `proc_task_activities`.

**Alternativas consideradas:**
- (a) Realtime listener no ERP — descartado: requer processo Node sempre activo, fora do modelo serverless.
- (b) Polling do ERP a cada N segundos — descartado: latência inaceitável e custo de DB.
- (c) Webhook do app cliente para o ERP — descartado: aumenta acoplamento entre apps; duplica a lógica em dois sítios.

**Porquê SQL:** A app cliente já INSERTa em `doc_registry` via service_role. O trigger é o único ponto onde podemos garantir que toda submissão (independentemente do path da app) emite notificação, sem requerer cooperação do app cliente.

**Filtro idempotência:** O lookup `WHERE entity_id = NEW.id AND notification_type IN ('owner_doc_submitted','owner_cmi_signed') LIMIT 1` antes do INSERT garante que retries do app cliente não duplicam. Não usamos UNIQUE constraint em `notifications` porque a tabela é genérica e tem outros usos legítimos com mesmo `entity_id`.

### D2. Aprovar/Rejeitar: endpoint único `POST /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/review`

**Decisão:** Um endpoint Node handler com body `{ doc_id: string, action: 'approve'|'reject', reason?: string }`. A operação interna é uma transacção lógica:
1. UPDATE `doc_registry` (status + notes).
2. Se approve → UPDATE `proc_subtasks SET is_completed=true` (idempotente: WHERE is_completed IS NOT TRUE).
3. Se approve → invoca `propagateDueDates({completedKey, procInstanceId})` no mesmo handler.
4. INSERT em `proc_task_activities` (sempre).
5. Se reject → INSERT em `owner_notifications` para o owner.

**Alternativas:**
- (a) Dois endpoints separados (`/approve`, `/reject`) — descartado: duplica auth/permission checks; a UI já passa `action` como discriminator.
- (b) Mover toda a lógica para uma stored procedure SQL — descartado: a propagação de due-dates já vive em TS e usa `holidays_pt`; portar para PL/pgSQL seria duplicação. SQL fica para o trigger de notificação onde não há lógica de negócio.

**Idempotência:** Re-aprovar um doc já `approved` é no-op silencioso (200 OK + `{ idempotent: true }` no body). Re-rejeitar com motivo diferente actualiza `notes` e regista nova activity (caso legítimo: consultor afina o motivo). UPDATE de `proc_subtasks` é guarded por `WHERE is_completed IS NOT TRUE` para nunca reverter `completed_at`/`completed_by`.

### D3. CMI assinado satisfaz duas subtasks

**Decisão:** Quando o doc tem `metadata.signature_method='canvas_png_stamped'` E `metadata.signed_from_subtask_id`, a UI mostra "Aceitar assinatura" em vez de "Aprovar". O endpoint `/review` com `action='approve'` aplicado a este doc:
1. Marca `proc_subtasks.is_completed=true` para a subtask `geracao_cmi` (a que está na metadata `signed_from_subtask_id`).
2. Marca também `is_completed=true` para a subtask `upload_cmi_digitalizado` da MESMA `proc_instance` (lookup por `subtask_key='upload_cmi_digitalizado'` + `proc_instance_id` igual).
3. Move `metadata.role='cmi_digitalizado_official'` no doc filho para deixar pista de que ele é a versão oficial digitalizada.

**Porquê inline e não em duas operações separadas:** O fluxo de UX que o stakeholder pediu é "uma assinatura → uma decisão do consultor". Quebrar em dois passos perde esse insight. O vínculo programático já existe em `metadata.signed_from_*` portanto a server-side tem informação suficiente.

**Risco:** Se o template do processo evoluir e a subtask `upload_cmi_digitalizado` deixar de existir, o lookup falha silenciosamente (no rows updated) — aceitável; trataremos como "subtask não está no processo, nada a fazer".

### D4. Audit trail de `owners`: trigger SQL com captura de `auth.uid()`

**Decisão:** Opção (B) recomendada do briefing — trigger `AFTER UPDATE OF naturality, address, marital_status, legal_rep_naturality, legal_rep_address, legal_rep_marital_status` em `owners`. A função `audit_owner_field_change()` (SECURITY DEFINER):
1. Itera as 6 colunas-whitelist.
2. Para cada coluna alterada (OLD.<col> IS DISTINCT FROM NEW.<col>) INSERTa em `owner_field_audit`.
3. Captura `auth.uid()` quando disponível (NULL para mutações via service role sem JWT — caso ERP, expected).
4. Captura `subtask_id` via `current_setting('app.current_subtask_id', true)` — NULL quando o app cliente não definir.
5. Capta `edited_via` via `current_setting('app.edited_via', true)` (default 'unknown').

**Alternativas:**
- (A) Coluna `metadata jsonb` em `owners` — descartado: requer cooperação do app cliente (que viola constraint inegociável). Também perde queryability (audit em jsonb é desconfortável).
- Colunas separadas em `owners` (`last_edited_field`, `last_edited_at`, etc.) — descartado: perde histórico, só guarda última edição.

**Porquê não escrever directamente em `proc_task_activities`:** O audit é de `owners`, não de uma `proc_task` específica. Quando há `subtask_id`, podemos opcionalmente também emitir activity, mas o audit canónico fica numa tabela própria (`owner_field_audit`) para queries do painel de owners.

### D5. Rate-limit da notificação `owner_field_edited`

**Decisão:** No INSERT do `owner_field_audit`, a função `audit_owner_field_change()` faz lookup pré-INSERT:
```
SELECT 1 FROM notifications
WHERE notification_type = 'owner_field_edited'
  AND entity_type = 'proc_task'
  AND entity_id = <proc_task_id resolvido via subtask>
  AND metadata->>'field_name' = <field_name>
  AND metadata->>'subtask_id' = <subtask_id>
  AND created_at > now() - interval '5 minutes'
LIMIT 1;
```
Se existe → não cria nova notificação (audit row é sempre criado). Se não existe → cria notificação com `metadata.field_count=1`.

**Alternativas:**
- Debounce client-side na app cliente — descartado: requer cooperação do cliente.
- Job batch que junta edições da última hora num resumo — descartado: latência maior; complica failure recovery.

**Trade-off:** O rate-limit por `(subtask_id, field_name)` significa que o owner pode editar 6 campos diferentes em rápida sucessão e gerar 6 notificações. Isto é aceitável — são 6 eventos semanticamente distintos. Edições repetidas do MESMO campo é que ficam silenciadas. Se quando há `subtask_id=NULL` (app cliente não passa o setting), tratamos como rate-limit por `(owner_id, field_name)` em vez de `(subtask_id, field_name)`.

### D6. Auto-completion vs. revisão manual: campos editados não auto-completam subtasks

**Decisão explícita:** Editar um campo em `owners` (mesmo que tenha `subtask_id`) NÃO marca a subtask correspondente como `is_completed=true`. A confirmação humana fica com o consultor que vê a edição na timeline e decide.

**Porquê:** Os campos têm múltiplos owners (um campo só "completa" quando todos os owners relevantes editaram), e o owner pode meter dados errados que o consultor precisa de revisar. Diferente de uploads, onde há sempre um doc tangível com `under_review` → `approved`.

**Excepção possível futura:** Se o briefing pedir "auto-aprovar quando todos os owners da subtask preencheram o campo X", isso fica para fase 2.

### D7. Activity types e notification types

**Novos `notification_type`:**
- `owner_doc_submitted` — upload de documento (não-CMI).
- `owner_cmi_signed` — assinatura do CMI.
- `owner_field_edited` — edição de campo no `owners` (rate-limited).

**Novos `activity_type` em `proc_task_activities`:**
- `owner_doc_submitted`
- `owner_cmi_signed`
- `owner_doc_approved`
- `owner_doc_rejected`
- `owner_field_edited` (registado no `proc_task` quando há `subtask_id` resolvível)

Os 5 são adicionados a `TASK_ACTIVITY_TYPE_CONFIG` em [lib/constants.ts](lib/constants.ts) com ícones (FileUp, PenLine, FileCheck2, FileX, UserPen) e cores. Nenhum é marcado como system event (ficam visíveis por defeito na timeline).

### D8. Push fan-out: SQL trigger para `notifications`, cron Node para push, e push imediato em handlers TS

**Contexto:** A infra de push já existe e é canónica:
- Tabela `push_subscriptions` (migration `20260329_push_subscriptions.sql`) para `dev_users`.
- Helper `lib/crm/send-push.ts` com `sendPushToUser(supabase, userId, payload)` — usa `web-push` v3.6.7, gere VAPID keys, faz auto-cleanup de subs expiradas.
- Service worker em [public/sw.js](public/sw.js) registado por [hooks/use-push-subscription.ts](hooks/use-push-subscription.ts).
- Padrão actual: handlers Node TS chamam `sendPushToUser()` + insert em `notifications` em sequência (eager). Exemplos em [lib/visits/notifications.ts](lib/visits/notifications.ts) e `/api/cron/calendar-reminders`.

O problema novo: o **watcher é um SQL trigger** (D1) — não pode chamar `web-push` directamente porque a função vive em PL/pgSQL, não tem acesso a HTTP outbound. As alternativas:

- (a) **Substituir o trigger por um webhook Node** que o app cliente chama após cada upload. Push imediato. → Descartado pelo motivo já discutido em D1: requer cooperação do app cliente.
- (b) **Postgres `pg_notify` + Node listener** que escuta em background. → Descartado: não-serverless; precisa de processo permanente.
- (c) **Trigger insere notification + cron Node faz fan-out de push** (Option A do scratchpad). → **Escolhido.** Cron varre `notifications WHERE push_dispatched IS NOT TRUE` a cada 1min. Latência ≤60s aceitável para "owner submeteu doc" — não é chat real-time.
- (d) **Edge function PostgREST → web-push** dentro do trigger via `http` extension. → Descartado: violou constraint "sem novas Edge Functions". Também adiciona latência ao INSERT do `doc_registry` (overhead de HTTP no commit), e falhas de rede atómicas com o INSERT são frágeis.

**Implementação:**
- Adicionar coluna `notifications.push_dispatched bool DEFAULT false`. Index parcial `idx_notifications_push_pending ON (created_at) WHERE push_dispatched IS NOT TRUE` (mantém o scan O(submissões pendentes), não O(total notifications)).
- Cron `/api/cron/dispatch-pending-push` (Node Route Handler):
  ```
  SELECT id, recipient_id, notification_type, title, body, action_url
  FROM notifications
  WHERE push_dispatched IS NOT TRUE
    AND notification_type IN ('owner_doc_submitted','owner_cmi_signed','owner_field_edited')
    AND created_at > now() - interval '24 hours'  -- safety: não tentar push de notifs antigas
  ORDER BY created_at ASC
  LIMIT 100;
  ```
  Para cada row: `await sendPushToUser(supabase, recipient_id, payload)` → `UPDATE notifications SET push_dispatched=true WHERE id=<id>`. Falhas individuais loggadas mas não revertem o batch.
- Configurar como **Coolify Scheduled Task** (1min). Reusar pattern dos crons existentes (`spawn-runs`, `calendar-reminders`).
- **IMPORTANTE:** o cron NÃO inclui notificações criadas por handlers TS (como o endpoint `/review`) porque essas já foram dispatchadas inline. O filtro por `notification_type IN (...3 novos tipos)` mais o flag `push_dispatched` evita duplicação.

**Push imediato em handlers TS (sem cron):**
- O endpoint `/review` (Aprovar/Rejeitar) corre em Node — pode chamar `sendPushToUser`/`sendPushToOwner` directamente:
  - Aprovar: nenhum push porque o consultor é quem está a actuar (não notificar a si próprio).
  - Rejeitar: push **ao owner** via `sendPushToOwner` (helper novo), `+` insert em `owner_notifications`. Marca `push_dispatched=true` ao criar a notification de owner para que o cron não duplique (caso futuramente também atravessa a tabela `notifications`).

**`sendPushToOwner` helper:**
- Mirror de `sendPushToUser` que consulta `owner_push_subscriptions` por `owner_id`.
- Se a tabela não existir (verificar com Helder antes do apply), criar via migration aditiva: schema espelhado de `push_subscriptions` com `owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE` + UNIQUE `(owner_id, endpoint)`.
- VAPID keys são as mesmas — não há separação por audiência.

**Trade-off de latência:** Submissões do owner têm 0–60s de latência no push (cron 1min). Para o consultor isto é aceitável: não é workflow time-critical. As acções do consultor (Aprovar/Rejeitar) são imediatas porque correm em Node.

## Risks / Trade-offs

- **[Risco] Trigger SQL falha silenciosamente** se `proc_task_id` na metadata não existe ou a `proc_task.assigned_to` for NULL. → **Mitigação:** Trigger faz `INSERT ... WHERE assigned_to IS NOT NULL`; falha de lookup loga warning no `pg_stat_statements` mas não bloqueia o INSERT em `doc_registry`. Adicionar coluna `last_warning` à activity para visibilidade.
- **[Risco] `auth.uid()` retorna NULL** quando o app cliente usa service role (que é o que faz hoje). → **Mitigação:** Escrever `metadata.auth_user_id` em `doc_registry` já é o contrato actual da app cliente. O trigger do `owners` pode aceitar `auth.uid()` NULL e gravar `edited_by_auth_user_id=NULL` — a UI mostra "via app cliente" em vez do nome. Esta é a versão honesta.
- **[Risco] `propagateDueDates` falha após o UPDATE de `proc_subtasks`** — como a propagação corre no handler TS após o UPDATE SQL, uma falha intermédia deixa estado inconsistente (subtask completa mas siblings não destravados). → **Mitigação:** Reaproveitar o pattern existente do completer de subtasks ([app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts](app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts)) que já faz isso e tem retries silenciosos via try/catch isolados. A próxima conclusão de subtask na mesma instance volta a chamar propagate e fixa o estado.
- **[Risco] Notificações duplicadas em retries** do app cliente. → **Mitigação:** Ver D1 — lookup pré-INSERT em `notifications` por `entity_id` (= doc_registry.id) + tipo.
- **[Risco] Audit trail explode em volume** se um owner editar campos repetidamente (ex.: erros de digitação). → **Mitigação:** Índice `(owner_id, created_at DESC)` mantém queries O(1) por owner; tamanho da tabela é função do produto (owners × edições) que cresce devagar.
- **[Trade-off] Sem auto-completion para field-edits.** Decisão consciente (D6); aceita-se mais 1 clique do consultor em troca de menor risco de aceitar dados errados.
- **[Trade-off] Sem inbox global.** A revisão é per-subtask. Se o consultor quiser ver "tudo o que está pendente" agrega via filtro nas notificações (já existe na sidebar de notifs). Inbox dedicado fica para fase 2.
- **[Risco] Push do owner pode falhar silenciosamente** se `owner_push_subscriptions` estiver vazia para esse `owner_id`. → **Mitigação:** `sendPushToOwner` retorna `{ sent: 0 }` mas não lança; a notificação em `owner_notifications` (canal in-app do PWA cliente) é sempre criada como fallback. O owner abre o PWA e vê na lista de notificações.
- **[Risco] Cron de push corre tarde demais** (Coolify atrasado, deploy a meio do minuto, etc.). → **Mitigação:** O filtro `created_at > now() - interval '24h'` permite que um cron que ficou atrás durante a noite recupere as 24h sem push. O `LIMIT 100` per tick garante que não há cascata em caso de backlog gigante.
- **[Risco] Duplicação de push** se um cron run cair a meio do `UPDATE push_dispatched=true`. → **Mitigação:** Sem transacção atómica entre `web-push` HTTP e o UPDATE; aceita-se duplicação rara (ordem de 1 push duplicado por incidente). O SW pode mostrar 2 cards mas é não-crítico. Para mitigar mais, `UPDATE ... RETURNING id` antes do `sendPushToUser` (claim-and-send) tornaria o operador idempotente, mas duplica risco do oposto (push perdido se o handler crashar entre UPDATE e send). Trade-off escolhido: claim-after-send (favorece entrega).
- **[Risco] App cliente nunca chama o endpoint que regista push subscription.** → **Mitigação:** Fora do âmbito desta change verificar — apenas listar como pré-condição. Se `owner_push_subscriptions` ficar vazia em produção, push do owner é no-op silencioso e o owner depende do badge in-app na app cliente.

## Migration Plan

1. **DB migration `20260522_owner_submission_review_flow.sql`** (aditiva, idempotente):
   - `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_dispatched bool DEFAULT false`.
   - `CREATE INDEX IF NOT EXISTS idx_notifications_push_pending ON notifications (created_at) WHERE push_dispatched IS NOT TRUE`.
   - CREATE TABLE `owner_field_audit`.
   - CREATE TABLE `owner_push_subscriptions` (apenas se a tabela ainda não existir — verificar com `\d owner_push_subscriptions` ou `pg_class` antes; usar `CREATE TABLE IF NOT EXISTS`).
   - CREATE FUNCTION `audit_owner_field_change()`.
   - CREATE TRIGGER `trg_owners_field_audit` AFTER UPDATE OF (6 cols) ON `owners`.
   - CREATE FUNCTION `notify_consultant_owner_submission(p_doc_id uuid)`.
   - CREATE TRIGGER `trg_doc_registry_owner_submission_notify` AFTER INSERT ON `doc_registry`.
   - GRANT USAGE on settings ('app.current_subtask_id', 'app.edited_via').
2. **Code deploy** com:
   - Novo endpoint `/review`.
   - Novo cron handler `/api/cron/dispatch-pending-push`.
   - Novo helper `lib/notifications/send-push-to-owner.ts`.
   - Extensões aditivas nos cards hardcoded.
   - Novo `<OwnerFieldAuditTimeline>` no painel do owner.
   - Tipos novos em `lib/notifications/types.ts` + `lib/constants.ts`.
3. **Coolify Scheduled Task** para o novo cron — 1min interval. Reusar a config de outras crons existentes (ver memory `coolify_no_curl` — usar `wget` ou `node fetch`, não curl).
4. **Backfill** (one-shot script): para `doc_registry` rows existentes com `status='under_review'` e `metadata.uploaded_via='owner_angariacao_checklist'`, gerar notificações retroactivas (≤30 dias) — opcional, decidir com Helder se vale o ruído.
5. **Rollback:** Migration tem header com revert (DROP TRIGGER, DROP FUNCTION, DROP TABLE, DROP INDEX, DROP COLUMN `push_dispatched`). Code revert via PR atrás. Notificações + activities geradas durante o teste são inofensivas — ficam no DB sem efeitos colaterais.

## Open Questions

1. **Localização da timeline de owners no UI.** O painel actual de owners está em `app/dashboard/proprietarios/[id]/page.tsx` ou no detalhe do imóvel via tab "Proprietários"? — A confirmar antes de começar; provavelmente ambos.
2. **Backfill retroactivo de notificações** — vale o ruído inicial para o consultor? Por defeito, NÃO faz (só aplica daqui para a frente). Aguarda decisão.
3. **Nome do canal de notificação ao owner ao rejeitar** — `owner_notifications` é o canal certo? Confirmar formato esperado pela app cliente (campos `title`, `message`, `action_url`?).
4. **Quando há múltiplos consultores no processo** (ex.: angariação interna + comprador externo na fase futura PROC-NEG) o `assigned_to` da `proc_task` é unívoco? Para PROC-ANG actual sim; reconfirmar para garantir.
5. **`owner_push_subscriptions` já existe?** A migration `20260508` (RLS) referencia-a mas o explorador não encontrou a migration de criação. Verificar antes do apply: se existe → reusar; se não → criar com schema espelhado de `push_subscriptions`.
6. **App cliente já tem service worker que regista push subscriptions?** Pré-condição para o push do owner funcionar. Se não, o `sendPushToOwner` é no-op silencioso até essa change ser feita no app cliente. Push do consultor (ERP) funciona independentemente.
