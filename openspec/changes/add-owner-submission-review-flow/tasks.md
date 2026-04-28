## 1. DB migration — schema, triggers e funções

- [x] 1.1 Criar `supabase/migrations/20260522_owner_submission_review_flow.sql` com header (descrição, revert enumerado).
- [x] 1.2 `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_dispatched bool DEFAULT false`.
- [x] 1.3 `CREATE INDEX IF NOT EXISTS idx_notifications_push_pending ON notifications (created_at) WHERE push_dispatched IS NOT TRUE`.
- [x] 1.4 Verificar via `mcp__supabase__list_tables` se `owner_push_subscriptions` existe. Se não → `CREATE TABLE public.owner_push_subscriptions (id uuid PK default gen_random_uuid(), owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE, endpoint text NOT NULL, p256dh text NOT NULL, auth text NOT NULL, user_agent text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id, endpoint))` + index `(owner_id)` + RLS service-role-only.
- [x] 1.5 `CREATE TABLE public.owner_field_audit` (10 colunas conforme spec `owner-field-audit`).
- [x] 1.6 Criar índices `idx_owner_field_audit_owner_created` e `idx_owner_field_audit_subtask_field_created`.
- [x] 1.7 `CREATE OR REPLACE FUNCTION public.audit_owner_field_change()` (SECURITY DEFINER) — itera 6 colunas, INSERT em `owner_field_audit`, lookup `proc_task_id` via `proc_subtasks`, INSERT condicional em `proc_task_activities`, INSERT condicional em `notifications` (com `push_dispatched=false`) com lookup de rate-limit (5min).
- [x] 1.8 `CREATE TRIGGER trg_owners_field_audit AFTER UPDATE OF naturality, address, marital_status, legal_rep_naturality, legal_rep_address, legal_rep_marital_status ON owners FOR EACH ROW EXECUTE FUNCTION audit_owner_field_change()`.
- [x] 1.9 `CREATE OR REPLACE FUNCTION public.notify_consultant_owner_submission(p_doc_id uuid)` (SECURITY DEFINER) — resolve `assigned_to` via `proc_task_id` na metadata, lookup pré-INSERT de idempotência por `entity_id`, INSERT em `notifications` (com `push_dispatched=false`) + `proc_task_activities`. Discrimina `owner_doc_submitted` vs. `owner_cmi_signed` por `metadata.signature_method`.
- [x] 1.10 `CREATE TRIGGER trg_doc_registry_owner_submission_notify AFTER INSERT ON doc_registry FOR EACH ROW WHEN (NEW.metadata->>'uploaded_via' IN ('owner_angariacao_checklist','owner_app')) EXECUTE FUNCTION notify_consultant_owner_submission(NEW.id)`.
- [x] 1.11 Aplicar a migration via `mcp__supabase__apply_migration` e validar com `\d+ owner_field_audit` + `\d+ owners` (triggers list) + `\d+ notifications` (coluna `push_dispatched` + index).
- [x] 1.12 Smoke-test SQL: INSERT manual em `doc_registry` simulando submissão do owner → verificar 1 row em `notifications` (`push_dispatched=false`) + 1 em `proc_task_activities`. Re-execute do trigger → verificar idempotência.
- [x] 1.13 Smoke-test SQL: UPDATE manual em `owners.address` → verificar 1 row em `owner_field_audit` + 1 row em `notifications`. Repetir UPDATE com mesmo valor → verificar 0 rows novas.
- [x] 1.14 Smoke-test SQL: 2 UPDATEs sequenciais em `owners.address` em <5min → verificar 2 rows em `owner_field_audit` mas apenas 1 em `notifications`.

## 2. Backend — tipos, constantes e endpoint de review

- [x] 2.1 Estender `NotificationType` em [lib/notifications/types.ts](lib/notifications/types.ts) com `'owner_doc_submitted' | 'owner_cmi_signed' | 'owner_field_edited'`.
- [x] 2.2 Estender `TASK_ACTIVITY_TYPE_CONFIG` em [lib/constants.ts](lib/constants.ts) com 6 novos tipos (icon + color conforme design D7). Não adicionar a `SYSTEM_EVENT_ACTIVITY_TYPES`.
- [x] 2.3 Criar `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/review/route.ts` com handler POST.
- [x] 2.4 Validar body com Zod: `{ doc_id: z.string().regex(uuidRegex), action: z.enum(['approve','reject']), reason: z.string().min(5).optional() }` + refinement (`action='reject'` requer `reason`).
- [x] 2.5 Auth check: caller deve ser `assigned_to` da `proc_task` OU ter permissão `processes`. Reusar [lib/auth/check-permission-server.ts](lib/auth/check-permission-server.ts).
- [x] 2.6 Validar que `doc_registry.metadata.subtask_id` bate com o `subtaskId` do path (400 caso contrário).
- [x] 2.7 Implementar branch Aprovar: UPDATE `doc_registry`, UPDATE guarded `proc_subtasks`, invocar `propagateDueDates` (try/catch), INSERT activity. Detectar caso CMI assinado (signature_method + signed_from_subtask_id) e completar AMBAS as subtasks + role na metadata.
- [x] 2.8 Implementar branch Rejeitar: UPDATE `doc_registry` (status + notes), INSERT em `owner_notifications` (confirmar schema com Helder antes), `await sendPushToOwner(owner_id, payload)` IMEDIATAMENTE, INSERT activity.
- [x] 2.9 Retorno consistente: `{ ok: boolean, idempotent?: boolean, propagated_due_dates?: number, propagation_error?: string, owner_notified?: boolean, push_sent_to_owner?: boolean }`.
- [x] 2.10 Criar `GET /api/owners/[id]/audit` em `app/api/owners/[id]/audit/route.ts` retornando rows ordenadas por `created_at DESC` com `limit` (default 50, max 200). Auth: relacionado ao owner OU permissão `properties|processes`.

## 3. Frontend — extensão dos cards de subtask

- [x] 3.1 Identificar os card components afectados em [lib/processes/subtasks/rules/angariacao/](lib/processes/subtasks/rules/angariacao/) — pelo menos as rules de upload (`armazenar_documentos_*`, `upload_*`) e a de geração de CMI (`geracao_cmi`).
- [x] 3.2 Estender `<HardcodedCardBase>` (ou criar `<OwnerSubmissionReviewActions>` reutilizável) que recebe `docs` e renderiza badge + botões Aprovar/Rejeitar para cada doc com `status='under_review'` e `metadata.uploaded_via='owner_angariacao_checklist'`.
- [x] 3.3 Implementar Dialog de rejeição com `<Textarea>` + validação `minLength=5` + botão `Rejeitar` (variant destructive).
- [x] 3.4 Implementar variante "Aceitar assinatura" para docs com `signature_method='canvas_png_stamped'`: badge `CMI assinado pelo proprietário`, preview inline do PDF (signed URL via `/api/documents/proxy?url=<key>`), botão `Aceitar assinatura`.
- [x] 3.5 Hook client `useSubtaskReview(procId, taskId, subtaskId)` que invoca o endpoint POST e dispara refetch da subtask + toast PT-PT em sucesso/erro.
- [x] 3.6 Toast PT-PT: sucesso (`'Documento aprovado.'` / `'Documento rejeitado e proprietário notificado.'`), erro com mensagem do servidor.
- [x] 3.7 Garantir que docs aprovados/rejeitados não voltam a mostrar os botões (status check).

## 4. Frontend — timeline de audit no painel do owner

- [x] 4.1 Identificar a localização canónica do painel do owner — investigar `app/dashboard/proprietarios/` E `components/owners/` para o detalhe per-imóvel. Confirmar com Helder se aplica em ambos.
- [x] 4.2 Criar `components/owners/owner-field-audit-timeline.tsx` que faz fetch a `/api/owners/[id]/audit` via `useSWR` ou hook próprio.
- [x] 4.3 Implementar agrupamento: rows com mesmo `subtask_id` E `created_at` dentro de janela de 30min agrupam num item expandível `"<n> alterações em <Xmin>"`.
- [x] 4.4 Render por row: ícone `UserPen` amber, linha 1 (`<label>: <old> → <new>`), linha 2 (`<via PT> · <rel time PT>` usando `date-fns` com locale `pt`).
- [x] 4.5 Empty state PT-PT: `"Sem alterações registadas neste proprietário."` com ícone `History`.
- [x] 4.6 Wirar o componente nos painéis de owner identificados em 4.1.

## 5. Idempotência, edge cases e robustez

- [x] 5.1 Verificar comportamento quando `doc_registry.metadata.proc_task_id` não existe — trigger não bloqueia INSERT, apenas não gera notificação. Smoke-test.
- [x] 5.2 Verificar comportamento quando `proc_task.assigned_to IS NULL` — activity é criada na mesma com `user_id=NULL`. Smoke-test.
- [x] 5.3 Verificar Aceitar Assinatura quando `upload_cmi_digitalizado` não existe na proc_instance — apenas `geracao_cmi` é completed, sem erro.
- [x] 5.4 Verificar re-aprovação de doc já approved — endpoint retorna 200 com `idempotent: true`, `proc_subtasks.completed_at` não muda.
- [x] 5.5 Verificar que UPDATE de `owners.email` (fora da whitelist) não dispara trigger de audit.
- [x] 5.6 Verificar que o consultor a editar `owners` no ERP NÃO se notifica a si próprio (`auth.uid() = proc_task.assigned_to` skipped).

## 6. Documentação e CLAUDE.md

- [x] 6.1 Adicionar bloco no topo de [CLAUDE.md](CLAUDE.md) (`## 📊 Estado Actual do Projecto`) descrevendo a entrega: link para a migration, endpoint, novo trigger, contrato de `metadata.uploaded_via`, e fluxo de push (cron + handlers).
- [x] 6.2 Documentar em comentário SQL da migration o contrato de `app.current_subtask_id`, `app.edited_via`, e `notifications.push_dispatched` (futuro PR no `infinity-cliente` poderá usar os settings).
- [x] 6.3 Mencionar limitação conhecida: rate-limit de 5min por `(subtask_id, field_name)` é por consultor — se múltiplos consultores partilham a `proc_task` (cenário futuro), cada um receberia uma notificação independentemente do rate-limit (não é problema actual).
- [x] 6.4 Documentar que push do owner depende do app cliente registar subscriptions em `owner_push_subscriptions` — se não está implementado lá, push do owner é silencioso (in-app continua a funcionar via `owner_notifications`).

## 7. Validação manual antes de fechar

- [ ] 7.1 Criar processo de angariação → submeter doc via app cliente → verificar notificação in-app no ERP **+ push notification chegou ao browser/PWA do consultor (≤60s)** → Aprovar → verificar `proc_subtasks.is_completed=true` E sucessoras destravadas via `propagateDueDates`.
- [ ] 7.2 Submeter outro doc → Rejeitar com motivo → verificar `owner_notifications` recebeu a mensagem (na app cliente, se acessível em dev) **+ push imediato no PWA do owner (se subscription existir)** E activity `owner_doc_rejected` na timeline.
- [ ] 7.3 Assinar CMI via app cliente → no ERP usar "Aceitar assinatura" → verificar AMBAS as subtasks (`geracao_cmi` E `upload_cmi_digitalizado`) ficam completed.
- [ ] 7.4 Editar `owners.address` via app cliente → verificar audit row em `owner_field_audit` E notificação `owner_field_edited` para o consultor (in-app + push). Editar de novo em <5min → verificar 2.ª audit row mas só 1 notificação (push silenciado também).
- [ ] 7.5 Abrir painel do owner no ERP → verificar `<OwnerFieldAuditTimeline>` renderiza as edições com agrupamento correcto.
- [ ] 7.6 Validar que cron `/api/cron/dispatch-pending-push` está agendado e a correr no Coolify (logs do Scheduled Task). Verificar que rows com `push_dispatched=false` mais antigas que 24h não são processadas (filtro de safety).
- [ ] 7.7 Em browser sem subscription push, validar que falta de push **NÃO bloqueia** o fluxo — in-app + email continuam a funcionar.

## 8. Push integration — fan-out via cron + push imediato + helper para owner

- [x] 8.1 Verificar com `mcp__supabase__list_tables` se `owner_push_subscriptions` existe (ver task 1.4). Se já existe, skip a criação.
- [x] 8.2 Criar `lib/notifications/send-push-to-owner.ts` espelhado em [lib/crm/send-push.ts](lib/crm/send-push.ts) — função `sendPushToOwner(supabase, ownerId, payload)` que SELECT em `owner_push_subscriptions` por `owner_id`, itera, chama `webpush.sendNotification`, auto-elimina subs com 410/404. Retorna `{ sent: number, failed: number }`.
- [x] 8.3 Garantir que `webpush.setVapidDetails(...)` é chamado no helper (idempotente — module-scope) ou reusar o setup já feito por `lib/crm/send-push.ts` via shared init.
- [x] 8.4 Criar `app/api/cron/dispatch-pending-push/route.ts` (Node Route Handler GET ou POST). Body do handler:
  ```
  - Auth: validar token de cron (env CRON_SECRET ou similar — alinhar com pattern existente em outras crons como spawn-runs).
  - SELECT id, recipient_id, notification_type, title, body, action_url, metadata
    FROM notifications
    WHERE push_dispatched IS NOT TRUE
      AND notification_type IN ('owner_doc_submitted','owner_cmi_signed','owner_field_edited')
      AND created_at > now() - interval '24 hours'
    ORDER BY created_at ASC
    LIMIT 100;
  - Para cada row: payload = { title, body: body ?? '', icon: '/icons/icon-192.png', data: { url: action_url }, tag: `${notification_type}:${entity_id}` }
  - await sendPushToUser(supabase, recipient_id, payload)
  - UPDATE notifications SET push_dispatched=true WHERE id=<id> (sempre — mesmo se sendPushToUser teve 0 sent, marcamos para não tentar de novo).
  - Logs: warn por failed, info por sent.
  - Retornar { processed: <count>, sent_total, failed_total }
  ```
- [x] 8.5 Configurar Coolify Scheduled Task para o novo cron — intervalo 1min. Reusar pattern dos crons existentes (`/api/scheduler/spawn-runs`, `/api/cron/calendar-reminders`); usar `wget` ou node fetch (curl não disponível no container — ver memory `coolify_no_curl`).
- [x] 8.6 Smoke-test do cron via `mcp__supabase__execute_sql` simulando: INSERT em `doc_registry` com metadata correcta → trigger cria `notifications` row → invocar manualmente o cron handler local → verificar push enviado (em ambiente DEV com browser subscrito) E `push_dispatched=true` na DB.
- [x] 8.7 Confirmar que o SW [public/sw.js](public/sw.js) lida correctamente com os payloads dos novos `notification_type` — idealmente sem alterações ao SW (usa `data.url` para abrir e `tag` para coalesce). Se alguma adaptação for necessária ao SW (ex.: ícones por tipo), criar tarefa nova; tentativa actual: nenhuma alteração ao SW.
- [x] 8.8 Para o push imediato no endpoint `/review` (Rejeitar): garantir que `sendPushToOwner` é chamado **antes** do retorno HTTP (não fire-and-forget) para que o retorno reflicta `push_sent_to_owner: true|false`. Aceitar timeout de até 3s sobre o request.
- [x] 8.9 Validar VAPID env vars: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Adicionar à `.env.example` se em falta.
- [x] 8.10 Documentar no header da migration o contrato `push_dispatched` e como o cron interage com ele.

## 9. Open questions resolvidas pela investigação inicial

- [x] 9.1 Painel canónico do owner: `app/dashboard/proprietarios/[id]/page.tsx` — adicionada nova tab "Histórico" com `<OwnerFieldAuditTimeline>`.
- [x] 9.2 Schema de `owner_notifications` confirmado em prod: `id, owner_id, notification_type, entity_type, entity_id, title, body, action_url (nullable), is_read, read_at, metadata, created_at`. Endpoint `/review` (rejeitar) usa este shape.
- [x] 9.3 Backfill retroactivo: NÃO. Decisão default — só dispara para submissões novas. Se necessário, criar script à parte.
- [x] 9.4 `proc_tasks.assigned_to` é `uuid NULL`. Código handles NULL gracefully: trigger SQL e endpoint `/review` saltam silenciosamente quando NULL.
- [x] 9.5 `owner_push_subscriptions` existe em prod com 1 sub registada — app cliente já está a registar. Push do owner funciona out-of-the-box.
- [ ] 9.6 Confirmar VAPID keys configuradas em produção (Coolify env). **Pré-deploy** — se não estão setadas, push é silently no-op (helpers retornam 0 sem erro).
