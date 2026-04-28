## Why

A app cliente (`infinity-cliente`) já permite ao proprietário (1) fazer upload de documentos pedidos pela checklist da angariação, (2) assinar o CMI no canvas, e (3) editar campos pessoais (estado civil, naturalidade, morada — singular e representante legal). O ERP recebe estes envios em silêncio: nada notifica o consultor responsável, não há fila de análise, e o `proc_subtasks.is_completed` continua a `false` mesmo depois de o documento estar em `doc_registry` com `status='under_review'`. Pior, os UPDATEs em `owners` feitos pela app cliente não deixam audit trail, pelo que não há forma de o ERP saber quem alterou o quê e quando.

Esta change fecha o ciclo: notificação ao consultor → fila de análise com Aprovar/Rejeitar → marcação automática da subtask + propagação de due-dates → audit trail das edições de campos do owner com timeline visível no painel.

## What Changes

- **Watcher SQL `AFTER INSERT` em `doc_registry`** para `metadata.uploaded_via IN ('owner_angariacao_checklist','owner_app')`: cria notificação ao `assigned_to` da `proc_task` pai (resolvida via `metadata.proc_task_id`) e regista entrada de timeline em `proc_task_activities`. Idempotente por `doc_registry.id`.
- **Extensão ADITIVA do card de upload** (NÃO há remoção/redesign — todas as funcionalidades actuais permanecem: upload pelo consultor, análise IA, anotações, marcação manual de concluído, etc.). A change apenas ADICIONA acções "Aprovar" / "Rejeitar (com motivo)" QUANDO o doc tem `status='under_review'` E `metadata.uploaded_via='owner_angariacao_checklist'`. Para docs criados pelo próprio consultor (que continuam a ser o caso geral), a UI fica exactamente como está hoje. Aprovar: `doc_registry.status='approved'` + `proc_subtasks.is_completed=true` + `propagateDueDates()`. Rejeitar: `doc_registry.status='rejected'` + `notes=<motivo>` + notificação para `owner_notifications` + push para o owner.
- **Card destacado para CMI assinado** (`metadata.signature_method='canvas_png_stamped'`): "Aceitar assinatura" satisfaz simultaneamente a subtask `geracao_cmi` E a sucessora `upload_cmi_digitalizado` (mesma `proc_instance`), arquivando o doc filho como o digitalizado oficial. O vínculo programático já existe em `metadata.signed_from_subtask_id` + `metadata.signed_from_doc_id`.
- **Trigger SQL `AFTER UPDATE` em `owners`** (filtrado por whitelist de 6 colunas: `naturality`, `address`, `marital_status`, `legal_rep_naturality`, `legal_rep_address`, `legal_rep_marital_status`) que insere uma linha em `owner_field_audit` capturando `old_value`, `new_value`, `auth.uid()`, e `subtask_id` (extraído via parâmetro de sessão `app.current_subtask_id` quando a app cliente o passa, NULL caso contrário). Notificação ao consultor por campo editado, com **rate-limit de 5min por `(subtask_id, field_name)`** para evitar spam.
- **Timeline de edições no painel de owners do ERP** consumindo `owner_field_audit` (componente novo `<OwnerFieldAuditTimeline>`), agrupando edições da mesma subtask num só item expandível.
- **Endpoint `POST /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/review`** com `action: 'approve' | 'reject'` + `reason?: string`. Idempotente: re-aprovar não duplica activity nem reverte `is_completed`.
- **Push notifications em todos os 3 canais** (in-app + email continuam, e ADICIONAMOS push):
  - **ERP web/PWA** (consultor): reusa `lib/crm/send-push.ts` (`sendPushToUser`) + tabela existente `push_subscriptions` + service worker `public/sw.js` + VAPID keys já configuradas. Os novos `notification_type` (`owner_doc_submitted`, `owner_cmi_signed`, `owner_field_edited`) entram no fluxo de push sem ajustes ao SW.
  - **App cliente (proprietário)**: novo helper `sendPushToOwner` que mirrors `sendPushToUser` mas consulta `owner_push_subscriptions` (verificar se a tabela existe; criar se não — schema espelhado com `owner_id` em vez de `user_id`). Disparado quando o consultor rejeita um doc, para notificar o owner directamente no PWA dele.
  - **Fan-out do trigger SQL**: porque o watcher é SQL e não pode chamar `web-push` directamente, adicionamos coluna `push_dispatched bool default false` à tabela `notifications` + cron Node `/api/cron/dispatch-pending-push` (Coolify, cada 1min) que varre notificações não-despachadas dos novos tipos e envia push. Aceita-se latência ≤60s para submissões do owner. Para acções iniciadas pelo consultor (Aprovar/Rejeitar), o push é despachado imediatamente no próprio Route Handler (sem cron).

## Capabilities

### New Capabilities

- `owner-submission-review-flow`: Notificação ao consultor quando a app cliente regista um envio (upload, assinatura) em `doc_registry`; fila de análise com Aprovar/Rejeitar no card da subtask; auto-completion da `proc_subtasks` ao aprovar com propagação de due-dates; tratamento especial do CMI assinado que satisfaz duas subtasks num só gesto.
- `owner-field-audit`: Trigger SQL que captura UPDATEs em colunas-whitelist de `owners`, tabela `owner_field_audit` para o histórico, notificação rate-limited ao consultor, e timeline UI no painel do owner.

### Modified Capabilities

(nenhuma — `process-subtask-completion` não existe como spec autónoma; a auto-completion ao Aprovar fica encapsulada dentro de `owner-submission-review-flow` porque é intrínseca ao fluxo de review)

## Impact

- **DB (aditivo):**
  - Nova tabela `public.owner_field_audit` com FK `owner_id → owners(id) ON DELETE CASCADE`, índice por `(owner_id, created_at DESC)` e por `(subtask_id, field_name, created_at DESC)` para o rate-limit.
  - Trigger `trg_doc_registry_owner_submission_notify` em `doc_registry`.
  - Trigger `trg_owners_field_audit` em `owners` (`AFTER UPDATE OF naturality, address, marital_status, legal_rep_naturality, legal_rep_address, legal_rep_marital_status`).
  - Função `public.notify_consultant_owner_submission(p_doc_id uuid)` (SECURITY DEFINER) chamada pelo trigger acima.
  - Função `public.audit_owner_field_change()` (SECURITY DEFINER) chamada pelo trigger.
  - Novos `notification_type`: `owner_doc_submitted`, `owner_cmi_signed`, `owner_field_edited` (extender union em [lib/notifications/types.ts](lib/notifications/types.ts)).
  - Novos `activity_type` em `proc_task_activities`: `owner_doc_submitted`, `owner_cmi_signed`, `owner_doc_approved`, `owner_doc_rejected`, `owner_field_edited` (registar em `TASK_ACTIVITY_TYPE_CONFIG` em [lib/constants.ts](lib/constants.ts)).
  - Coluna nova `notifications.push_dispatched bool DEFAULT false` para o cron de fan-out. Index parcial `idx_notifications_push_pending ON (created_at) WHERE push_dispatched IS NOT TRUE` para keep o scan barato.
  - Tabela `owner_push_subscriptions` (verificar se já existe — referenciada na migration RLS `20260508` mas o schema canónico não foi encontrado em migrations actuais). Schema esperado: `id, owner_id (FK ON DELETE CASCADE), endpoint, p256dh, auth, user_agent, created_at` + UNIQUE `(owner_id, endpoint)`.

- **Código:**
  - Novo endpoint `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/review/route.ts` (POST).
  - Extensão dos cards hardcoded de upload em `lib/processes/subtasks/rules/angariacao/` (apenas adicionar acções Aprovar/Rejeitar; toda a UX existente preservada).
  - Novo componente `<OwnerFieldAuditTimeline>` no detalhe do owner (a localização do painel actual está em `app/dashboard/proprietarios/` ou no detalhe do imóvel — confirmar no design).
  - Novo helper `lib/notifications/send-push-to-owner.ts` (mirror de `lib/crm/send-push.ts`).
  - Novo cron handler `app/api/cron/dispatch-pending-push/route.ts` (Node) — varre notificações não-despachadas, chama `sendPushToUser`/`sendPushToOwner` consoante o `recipient_id` (dev_users vs. owners), marca `push_dispatched=true`. Configurar como Scheduled Task no Coolify, intervalo 1min (ver memory `coolify_no_curl` — usar `wget` ou `node fetch`, não curl).
  - `lib/notifications/create.ts` (ou helper equivalente) chamado a partir do endpoint de review, com push imediato.
  - **NÃO há mudanças no app cliente nesta change** — o trigger SQL detecta `auth.uid()` e captura sem coordenação. O app cliente já regista push subscriptions via SW próprio na app PWA (verificar com Helder se a tabela `owner_push_subscriptions` já é populada; se não, primeira tarefa do owner-side é instrumentar o SW da app cliente — fora desta change, mas necessário para o push chegar).

- **Integração com o app cliente:**
  - O contrato de `metadata.uploaded_via`, `metadata.signed_from_*`, `metadata.proc_task_id`, `metadata.subtask_id` em `doc_registry` é o ÚNICO ponto de acoplamento. Esta change não pede mudanças no app cliente.
  - Opcional (futuro): a app cliente pode passar `SET LOCAL app.current_subtask_id = '<uuid>'` antes do UPDATE em `owners` para enriquecer o audit. Quando NULL, o audit funciona na mesma; só perde o vínculo à subtask.

- **Out of scope (explícito):**
  - Reescrita ou redesign do card legacy de upload — esta change é **estritamente aditiva**, não remove ou altera funcionalidades existentes (upload pelo consultor, análise IA, anotações, marcação manual, eliminação, etc. mantêm-se idênticos).
  - Notificação por SMS ou WhatsApp — só in-app + email + push (web/PWA + app cliente).
  - Instrumentar o registo de subscriptions push no app cliente (assumimos que já existe; caso `owner_push_subscriptions` esteja vazia, o consultor vê só a notificação rejection na app cliente via `owner_notifications` sem push). Se for necessário implementar do zero, fica para change separada.
  - Bulk approve / batch review.
  - Comentários linha-a-linha no documento.
