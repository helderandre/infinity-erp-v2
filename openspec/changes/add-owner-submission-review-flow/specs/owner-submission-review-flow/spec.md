## ADDED Requirements

### Requirement: Watcher notifica consultor em submissões do owner

O sistema SHALL emitir uma notificação in-app ao consultor responsável (`proc_tasks.assigned_to`) sempre que o app cliente regista uma submissão em `doc_registry` cuja `metadata.uploaded_via` seja um dos valores `'owner_angariacao_checklist'` ou `'owner_app'`. A operação MUST ser idempotente por `doc_registry.id` — retries do app cliente que produzam o mesmo `id` não emitem notificação adicional.

A notificação MUST conter:
- `notification_type`: `'owner_doc_submitted'` quando `metadata.uploaded_via='owner_angariacao_checklist'`; `'owner_cmi_signed'` quando `metadata.signature_method='canvas_png_stamped'`.
- `entity_type`: `'proc_task'`.
- `entity_id`: o `proc_task_id` extraído de `metadata.proc_task_id`.
- `recipient_id`: o `assigned_to` da `proc_task` correspondente.
- `title`: `<commercial_name do owner> enviou <doc_type.name>` (ou `assinou o CMI` para o caso de signed).
- `action_url`: `/dashboard/imoveis/{property_id}?tab=processos&subtask={subtask_id}`.
- `metadata`: objecto com `doc_id`, `subtask_id`, `subtask_key`, `proc_instance_id`, `owner_id`.

Em paralelo, MUST criar uma linha em `proc_task_activities` com `activity_type='owner_doc_submitted'` (ou `'owner_cmi_signed'`) para alimentar a timeline da `proc_task`.

#### Scenario: Owner faz upload de documento standard

- **WHEN** o app cliente INSERTa em `doc_registry` com `metadata.uploaded_via='owner_angariacao_checklist'`, `metadata.proc_task_id=<uuid>`, `status='under_review'`
- **THEN** o trigger cria uma notificação `owner_doc_submitted` para o `assigned_to` da `proc_task` correspondente, com `entity_id=<proc_task_id>` e `metadata.doc_id=<doc_registry.id>`
- **AND** cria uma linha em `proc_task_activities` com `activity_type='owner_doc_submitted'`, `metadata.doc_id=<doc_registry.id>` e `metadata.uploaded_via='owner_angariacao_checklist'`

#### Scenario: Owner assina CMI

- **WHEN** o app cliente INSERTa em `doc_registry` com `metadata.signature_method='canvas_png_stamped'`, `metadata.signed_from_subtask_id=<uuid>`, `status='signed'`
- **THEN** a notificação criada tem `notification_type='owner_cmi_signed'`
- **AND** o `title` contém `assinou o CMI` em vez de `enviou`

#### Scenario: Submissão sem proc_task_id resolvível na metadata

- **WHEN** o INSERT em `doc_registry` tem `metadata.uploaded_via='owner_angariacao_checklist'` mas `metadata.proc_task_id` é NULL ou aponta para uma `proc_task` inexistente
- **THEN** o trigger não cria notificação (não bloqueia o INSERT) e regista warning em `pg_stat_statements`

#### Scenario: assigned_to está NULL na proc_task

- **WHEN** a `proc_task` resolvida tem `assigned_to IS NULL`
- **THEN** nenhuma notificação é criada (não há a quem enviar) e a activity em `proc_task_activities` é criada na mesma com `user_id=NULL`

#### Scenario: Retry idempotente do app cliente

- **WHEN** uma `doc_registry` row com `id=X` já gerou uma notificação `owner_doc_submitted` e o app cliente faz um INSERT novamente com o mesmo `id` (impossível por PK, mas representa o caso de re-execução do trigger via `pg_notify` recovery)
- **THEN** nenhuma notificação adicional é criada (o lookup pré-INSERT por `entity_id=X AND notification_type='owner_doc_submitted'` impede a duplicação)

#### Scenario: Submissão pelo próprio consultor não dispara watcher

- **WHEN** o ERP (não o app cliente) INSERTa em `doc_registry` com `metadata.uploaded_via` ausente ou diferente de `'owner_angariacao_checklist'`/`'owner_app'`
- **THEN** o trigger não emite notificação (filtro de `uploaded_via`)

---

### Requirement: Endpoint de revisão Aprovar/Rejeitar para subtask de upload

O sistema SHALL expor `POST /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/review` que aceita `{ doc_id: string, action: 'approve'|'reject', reason?: string }`.

Permissão requerida: o caller MUST ser o `assigned_to` da `proc_task` ou ter permissão `processes` no role.

Validação:
- `doc_id` MUST corresponder a uma row em `doc_registry` com `metadata.subtask_id=<subtaskId>`.
- Para `action='reject'`, `reason` MUST ter pelo menos 5 caracteres.

Comportamento ao **Aprovar**:
1. UPDATE `doc_registry SET status='approved' WHERE id=<doc_id>` (se já `approved`, NO-OP).
2. UPDATE `proc_subtasks SET is_completed=true, completed_at=now(), completed_by=<auth.uid()> WHERE id=<subtaskId> AND is_completed IS NOT TRUE`.
3. Invocar `propagateDueDates({completedKey: <subtask_key>, procInstanceId})` (try/catch isolado — falhas não revertem o UPDATE).
4. INSERT em `proc_task_activities` com `activity_type='owner_doc_approved'`, `metadata.doc_id`, `metadata.subtask_id`.
5. Retornar 200 com `{ ok: true, propagated_due_dates: <count>, idempotent: <bool> }`.

Comportamento ao **Rejeitar**:
1. UPDATE `doc_registry SET status='rejected', notes=<reason> WHERE id=<doc_id>`.
2. INSERT em `owner_notifications` para o `owner_id` extraído de `doc_registry.metadata.owner_id` com mensagem do motivo + `action_url` para o checklist na app cliente.
3. INSERT em `proc_task_activities` com `activity_type='owner_doc_rejected'`, `metadata.doc_id`, `metadata.reason`.
4. `proc_subtasks.is_completed` permanece inalterado.
5. Retornar 200 com `{ ok: true, owner_notified: true }`.

#### Scenario: Aprovar documento under_review marca subtask completa

- **WHEN** o consultor envia `POST /api/processes/.../review` com `{ doc_id, action: 'approve' }` para um doc com `status='under_review'` e a `proc_subtasks` correspondente tem `is_completed=false`
- **THEN** `doc_registry.status` muda para `'approved'`
- **AND** `proc_subtasks.is_completed=true, completed_at=<now>, completed_by=<consultor.id>`
- **AND** `propagateDueDates` corre e destrava sucessoras com `dueRule.after=<subtask_key>`
- **AND** uma activity `owner_doc_approved` é registada
- **AND** a resposta tem `{ ok: true, idempotent: false }`

#### Scenario: Re-aprovar documento já approved é idempotente

- **WHEN** o consultor envia `action='approve'` para um doc que já tem `status='approved'`
- **THEN** o endpoint retorna 200 com `{ ok: true, idempotent: true }`
- **AND** `proc_subtasks.completed_at` e `completed_by` permanecem inalterados (UPDATE guarded por `is_completed IS NOT TRUE`)
- **AND** nenhuma nova activity é registada

#### Scenario: Rejeitar com motivo notifica owner

- **WHEN** o consultor envia `action='reject', reason='Documento ilegível'` para um doc `under_review`
- **THEN** `doc_registry.status='rejected'` e `notes='Documento ilegível'`
- **AND** uma row é criada em `owner_notifications` para o `owner_id` da metadata
- **AND** uma activity `owner_doc_rejected` é registada com `metadata.reason='Documento ilegível'`

#### Scenario: Reject sem reason ou reason demasiado curta

- **WHEN** o consultor envia `action='reject'` sem `reason` ou com `reason.length < 5`
- **THEN** o endpoint retorna 400 com `{ error: 'Motivo é obrigatório (min 5 caracteres)' }`
- **AND** nenhuma mutação ocorre

#### Scenario: doc_id pertence a outra subtask

- **WHEN** o consultor envia `doc_id` cuja `metadata.subtask_id` não bate com o `subtaskId` do path
- **THEN** o endpoint retorna 400 com `{ error: 'Documento não pertence a esta subtarefa' }`

#### Scenario: Caller não tem permissão

- **WHEN** o caller não é o `assigned_to` da proc_task nem tem permissão `processes`
- **THEN** o endpoint retorna 403

#### Scenario: propagateDueDates falha mas approve já foi commited

- **WHEN** após aprovar com sucesso, `propagateDueDates` lança exceção
- **THEN** o endpoint retorna 200 com `{ ok: true, propagated_due_dates: 0, propagation_error: <msg> }`
- **AND** `doc_registry` e `proc_subtasks` mantêm o estado aprovado (não há rollback)

---

### Requirement: Aceitar assinatura do CMI satisfaz duas subtasks

Quando o documento sob revisão tem `metadata.signature_method='canvas_png_stamped'` E `metadata.signed_from_subtask_id` apontando para uma subtask `subtask_key='geracao_cmi'`, o sistema SHALL apresentar a acção como "Aceitar assinatura" (em vez de "Aprovar"). A semântica do `action='approve'` aplicado a este doc MUST:

1. Marcar a subtask `geracao_cmi` (resolvida via `signed_from_subtask_id`) como `is_completed=true`.
2. Localizar na MESMA `proc_instance` a subtask com `subtask_key='upload_cmi_digitalizado'` e marcá-la também como `is_completed=true`.
3. Ambos os UPDATEs MUST ser guarded por `WHERE is_completed IS NOT TRUE` (idempotência).
4. Marcar `doc_registry.metadata.role='cmi_digitalizado_official'` no doc filho assinado para que a UI mostre a versão oficial.
5. Invocar `propagateDueDates` para AMBAS as subtasks.
6. Registar UMA SÓ activity `owner_cmi_signed_accepted` em `proc_task_activities` referenciando ambos os subtask_ids no `metadata`.

#### Scenario: Aceitar CMI assinado completa geracao_cmi e upload_cmi_digitalizado

- **WHEN** o consultor aprova um doc com `metadata.signature_method='canvas_png_stamped'` e `metadata.signed_from_subtask_id=<X>`
- **AND** existe na mesma `proc_instance` uma subtask com `subtask_key='upload_cmi_digitalizado'` e `id=<Y>`
- **THEN** `proc_subtasks` row `<X>` (geracao_cmi) tem `is_completed=true`
- **AND** `proc_subtasks` row `<Y>` (upload_cmi_digitalizado) tem `is_completed=true`
- **AND** `doc_registry.metadata.role='cmi_digitalizado_official'` no doc assinado
- **AND** uma única activity `owner_cmi_signed_accepted` é registada com `metadata.subtask_ids=[X, Y]`

#### Scenario: Aceitar CMI quando upload_cmi_digitalizado não existe na proc_instance

- **WHEN** o consultor aprova o CMI assinado e a `proc_instance` não tem subtask `upload_cmi_digitalizado`
- **THEN** apenas a subtask `geracao_cmi` é marcada `is_completed=true` (no rows updated para a outra)
- **AND** a activity registada é `owner_cmi_signed_accepted` com `metadata.subtask_ids=[X]` (array com um único id)

#### Scenario: CMI assinado mas signed_from_subtask_id em falta na metadata

- **WHEN** o doc tem `signature_method='canvas_png_stamped'` mas `signed_from_subtask_id` não está na metadata
- **THEN** o endpoint trata como aprovação standard (apenas o `subtaskId` do path é completado)
- **AND** nenhuma tentativa é feita de localizar `upload_cmi_digitalizado`

---

### Requirement: UI da subtask de upload mostra fila de revisão para submissões do owner

O card hardcoded da subtask de upload (`armazenar_documentos`, `upload_*` em [lib/processes/subtasks/rules/angariacao/](lib/processes/subtasks/rules/angariacao/)) SHALL apresentar para cada doc com `status='under_review'` E `metadata.uploaded_via='owner_angariacao_checklist'`:

- Badge `Enviado pelo proprietário via app` ao lado do nome do ficheiro.
- Botões `Aprovar` (variant default) e `Rejeitar` (variant destructive).
- Click em `Rejeitar` abre Dialog com `<Textarea>` obrigatório (min 5 chars) e botão de confirmação.
- Após Aprovar/Rejeitar com sucesso, a UI faz refetch da subtask para reflectir o novo estado.

Para docs com `metadata.signature_method='canvas_png_stamped'`, o card MUST mostrar:
- Badge `CMI assinado pelo proprietário`.
- Preview inline do PDF assinado (signed URL TTL 5min via `/api/documents/proxy`).
- Botão `Aceitar assinatura` (variant default) em vez de `Aprovar`.
- Botão `Rejeitar` continua a existir com a mesma semântica.

#### Scenario: Doc under_review do owner tem botões de revisão

- **WHEN** o card da subtask renderiza um doc com `status='under_review'` e `metadata.uploaded_via='owner_angariacao_checklist'`
- **THEN** o badge `Enviado pelo proprietário via app` está visível
- **AND** os botões `Aprovar` e `Rejeitar` estão visíveis e habilitados

#### Scenario: Doc enviado pelo consultor não mostra fila de revisão

- **WHEN** o card renderiza um doc cuja `metadata.uploaded_via` é diferente de `'owner_*'` (ex.: upload feito pelo consultor)
- **THEN** os botões de Aprovar/Rejeitar não aparecem
- **AND** o doc segue o fluxo standard (download/visualizar)

#### Scenario: Rejeitar abre dialog com textarea obrigatório

- **WHEN** o consultor clica em `Rejeitar`
- **THEN** abre um Dialog com `<Textarea>` para o motivo
- **AND** o botão `Confirmar rejeição` está desactivado enquanto `reason.length < 5`

---

### Requirement: Push notifications fan-out para os 3 novos tipos

O sistema SHALL entregar push notifications (Web Push) ao consultor para os tipos `owner_doc_submitted`, `owner_cmi_signed`, `owner_field_edited`, e ao owner para a notificação de rejeição.

**Push ao consultor (ERP web/PWA):**
- Reusar [lib/crm/send-push.ts](lib/crm/send-push.ts) (`sendPushToUser`).
- Reusar tabela `push_subscriptions` (existente) e service worker [public/sw.js](public/sw.js).
- Schema da coluna `notifications.push_dispatched bool DEFAULT false` é adicionado pela migration desta change.
- Index parcial `idx_notifications_push_pending` para suportar o scan barato do cron.

**Push ao owner (app cliente PWA):**
- Novo helper `lib/notifications/send-push-to-owner.ts` que mirrors `sendPushToUser` mas consulta `owner_push_subscriptions` (criar tabela se não existir).
- Disparado IMEDIATAMENTE no Route Handler `/review` quando `action='reject'`, em paralelo com a INSERT em `owner_notifications`.

**Cron de fan-out para o trigger SQL (`/api/cron/dispatch-pending-push`):**
- Corre a cada 1 minuto via Coolify Scheduled Task.
- Selecciona `notifications WHERE push_dispatched IS NOT TRUE AND notification_type IN ('owner_doc_submitted','owner_cmi_signed','owner_field_edited') AND created_at > now() - interval '24 hours' ORDER BY created_at ASC LIMIT 100`.
- Para cada row: chama `sendPushToUser`, depois `UPDATE notifications SET push_dispatched=true WHERE id=<id>`.
- Falhas individuais loggadas; não revertem o batch.

**Push payload:**
- `title`: o `notifications.title`.
- `body`: derivado de `notifications.body` (ou um truncate de `metadata`).
- `icon`: `/icons/icon-192.png` (ou o que o SW actual usa).
- `data.url`: `notifications.action_url` para o SW abrir ao clicar.
- `tag`: `<notification_type>:<entity_id>` (permite que push duplicado substitua a anterior em vez de empilhar).

#### Scenario: Push ao consultor 1min após upload pelo owner

- **WHEN** o trigger SQL cria uma notificação `owner_doc_submitted` em `notifications` com `push_dispatched=false`
- **AND** o cron `/api/cron/dispatch-pending-push` corre 30 segundos depois
- **THEN** o cron chama `sendPushToUser(supabase, recipient_id, payload)` com o payload derivado da notification
- **AND** marca `push_dispatched=true` na row da notification
- **AND** o consultor recebe push no browser/PWA via service worker

#### Scenario: Push imediato ao owner quando consultor rejeita

- **WHEN** o consultor envia `POST /review` com `action='reject', reason='...'`
- **THEN** o handler chama `sendPushToOwner(supabase, owner_id, payload)` antes de retornar a resposta
- **AND** a INSERT em `owner_notifications` corre em paralelo
- **AND** se `owner_push_subscriptions` está vazia para esse owner, `sendPushToOwner` retorna `{ sent: 0 }` sem erro

#### Scenario: Cron NÃO duplica push para notifications já despachadas

- **WHEN** uma notification `owner_doc_submitted` tem `push_dispatched=true`
- **THEN** o cron não a inclui na query
- **AND** nenhum push adicional é enviado

#### Scenario: Cron ignora notifications mais antigas que 24h

- **WHEN** uma notification não-despachada tem `created_at = now() - 25 hours`
- **THEN** o cron não a inclui na query (filtro `> now() - interval '24 hours'`)
- **AND** marca-se como caso recoverable manualmente, não automaticamente

#### Scenario: Notification criada por handler TS marca push_dispatched imediatamente

- **WHEN** o endpoint `/review` cria uma `owner_notifications` (ou `notifications` com tipo de owner-side) e despacha push imediatamente via `sendPushToOwner`
- **THEN** o INSERT marca `push_dispatched=true` (se a tabela for `notifications`) para que o cron NÃO duplique

#### Scenario: Push payload usa tag para coalesce

- **WHEN** dois pushes consecutivos para o mesmo `(notification_type, entity_id)` são entregues a um device antes do utilizador interagir
- **THEN** o segundo substitui o primeiro no notification center do device (tag determinística)

---

### Requirement: Tipos de notificação e activity registados nas constantes do sistema

O sistema SHALL registar os seguintes novos `notification_type` em [lib/notifications/types.ts](lib/notifications/types.ts):
- `owner_doc_submitted`
- `owner_cmi_signed`
- `owner_field_edited`

E os seguintes novos `activity_type` em `TASK_ACTIVITY_TYPE_CONFIG` em [lib/constants.ts](lib/constants.ts):
- `owner_doc_submitted` (icon: `FileUp`, color: `text-blue-600`)
- `owner_cmi_signed` (icon: `PenLine`, color: `text-emerald-600`)
- `owner_doc_approved` (icon: `FileCheck2`, color: `text-emerald-700`)
- `owner_doc_rejected` (icon: `FileX`, color: `text-red-600`)
- `owner_cmi_signed_accepted` (icon: `BadgeCheck`, color: `text-emerald-700`)
- `owner_field_edited` (icon: `UserPen`, color: `text-amber-600`)

Nenhum dos `activity_type` acima MUST ser marcado como system event (todos visíveis por defeito na timeline da `proc_task`).

#### Scenario: classifyBucket dos novos types

- **WHEN** uma notificação com `notification_type='owner_doc_submitted'` é classificada
- **THEN** `classifyBucket` retorna `'geral'` (não pertence a `PROCESS_NOTIFICATION_TYPES`)

#### Scenario: Activity types renderizam com ícones correctos

- **WHEN** a timeline da `proc_task` renderiza uma activity `owner_doc_approved`
- **THEN** o ícone `FileCheck2` é mostrado com cor `text-emerald-700`
