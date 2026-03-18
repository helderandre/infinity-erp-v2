# AUDIT — Sistema de Notificações, Alertas e Actividades

**Data da auditoria:** 2026-03-16
**Objectivo:** Mapear divergências entre documentação original e implementação real; servir como base para aprimoramentos.

---

## 1. ARQUITECTURA GERAL (3 Camadas)

O sistema real tem **3 camadas distintas** que se complementam mas têm finalidades diferentes:

```
┌─────────────────────────────────────────────────────────────────┐
│                     CAMADA 1: NOTIFICAÇÕES                      │
│  In-app, tempo real, visíveis na UI (sino no sidebar)           │
│  Tabela: notifications (164 registos)                           │
│  Serviço: lib/notifications/service.ts                          │
│  Frontend: notification-popover + useNotifications (Realtime)   │
├─────────────────────────────────────────────────────────────────┤
│                     CAMADA 2: ALERTAS MULTICANAL                │
│  Email + WhatsApp + In-app, configuráveis por template          │
│  Tabela: proc_alert_log (18 registos)                           │
│  Serviço: lib/alerts/service.ts                                 │
│  Config: task.config.alerts / subtask.config.alerts             │
├─────────────────────────────────────────────────────────────────┤
│                     CAMADA 3: ACTIVIDADES (AUDIT TRAIL)         │
│  Log de tudo o que acontece, para timeline e histórico          │
│  Tabela: proc_task_activities (116 registos)                    │
│  Serviço: lib/processes/activity-logger.ts                      │
│  Frontend: task-activity-feed + task-activity-timeline           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. DIVERGÊNCIAS ENTRE PLANEADO E IMPLEMENTADO

### 2.1. Notificações — PRD vs Realidade

O PRD-NOTIFICACOES.md planeou **10 eventos**. Aqui está o estado real de cada um:

| # | Evento (PRD) | notification_type | Implementado? | Onde é disparado | Destinatários |
|---|-------------|-------------------|:---:|----------------|---------------|
| 1 | Processo criado | `process_created` | ❌ **NÃO** | — | Ninguém é notificado quando se cria um processo |
| 2 | Processo aprovado | `process_approved` | ✅ | approve/route.ts L223 | `requested_by` (consultor que criou) |
| 3 | Tarefa atribuída | `task_assigned` | ✅ | tasks/[taskId]/route.ts L286 | Utilizador atribuído |
| 4 | Tarefa concluída | `task_completed` | ✅ | tasks/[taskId]/route.ts L301 | Batch → APPROVER_NOTIFICATION_ROLES |
| 5 | Comentário adicionado | `task_comment` | ❌ **NÃO** | Tipo definido, trigger **não existe** | — |
| 6 | Mensagem de chat | `chat_message` | ❌ **NÃO** | Tipo definido, trigger **não existe** | — |
| 7 | @mention | `comment_mention` / `chat_mention` | ❌ **NÃO** | Tipos definidos, triggers **não existem** | — |
| 8 | Tarefa actualizada | `task_updated` | ✅ | tasks/[taskId]/route.ts L318 | Utilizador atribuído (apenas priority/due_date) |
| 9 | Tarefa em atraso | `task_overdue` | ⚠️ **PARCIAL** | Cron endpoint existe, **pg_cron não confirmado** | — |
| 10 | (Não no PRD original) | `process_rejected` | ✅ | reject/route.ts L91 | `requested_by` |
| 11 | (Não no PRD original) | `process_returned` | ✅ | return/route.ts L81 | `requested_by` |
| 12 | (Não no PRD original) | `process_deleted` | ✅ | [id]/route.ts L82+L99 | `requested_by` + Batch → managers |

**Resumo: 6 de 10 eventos planeados implementados + 3 extras não planeados.**

### 2.2. Notificações — Lacunas Identificadas

| Acção | Notificação Esperada | Estado |
|-------|---------------------|:---:|
| **Processo criado** | Notificar gestoras/aprovadores | ❌ Não implementado |
| **Processo pausado (hold)** | Notificar consultor/atribuídos | ❌ Não implementado |
| **Processo retomado (resume)** | Notificar consultor/atribuídos | ❌ Não implementado |
| **Processo cancelado** | Notificar consultor | ❌ Não implementado |
| **Tarefa dispensada (bypass)** | Notificar gestora | ❌ Não implementado |
| **Subtarefa concluída** | Notificar responsável da tarefa pai | ❌ Só activity log |
| **Subtarefa atribuída** | Notificar utilizador | ❌ Só alert config |
| **Comentário na tarefa** | Notificar participantes | ❌ Tipo definido, sem trigger |
| **Mensagem no chat** | Notificar participantes do processo | ❌ Tipo definido, sem trigger |
| **@mention** | Notificar utilizador mencionado | ❌ Tipo definido, sem trigger |
| **Re-template aplicado** | Notificar consultor | ❌ Não implementado |

### 2.3. Alertas Multicanal — SPEC vs Realidade

| Evento de Alerta | In-App | Email | WhatsApp | Cron/Trigger |
|-----------------|:---:|:---:|:---:|:---:|
| `on_complete` (tarefa) | ✅ | ✅ | ✅ | Inline no route handler |
| `on_complete` (subtarefa) | ✅ | ✅ | ✅ | Inline no route handler |
| `on_assign` (tarefa) | ✅ | ✅ | ✅ | Inline no route handler |
| `on_assign` (subtarefa) | ✅ | ✅ | ✅ | Inline no route handler |
| `on_unblock` (tarefa dependente) | ✅ | ✅ | ✅ | Inline quando dependência completa |
| `on_unblock` (subtarefa dependente) | ✅ | ✅ | ✅ | Inline quando dependência completa |
| `on_overdue` (tarefa) | ⚠️ | ⚠️ | ⚠️ | **Endpoint existe, pg_cron não confirmado** |
| `on_overdue` (subtarefa) | ⚠️ | ⚠️ | ⚠️ | **Endpoint existe, pg_cron não confirmado** |

**Nota:** Os alertas multicanal funcionam **apenas se configurados no template**. Sem configuração, nenhum alerta é enviado — apenas a notificação hardcoded (Camada 1).

### 2.4. Actividades — Cobertura

| Activity Type | Registos | Onde |
|--------------|:-------:|------|
| `viewed` | 82 | Task activities route (throttled 5min) |
| `email_sent` | 7 | Subtask email completion |
| `email_delivered` | 7 | Webhook de delivery |
| `upload` | 5 | Subtask upload completion |
| `subtask_reverted` | 5 | Reverter subtarefa |
| `completed` | 4 | Form/checklist completion |
| `draft_generated` | 2 | Geração de rascunho |
| `comment` | 1 | Comentário na tarefa |
| `email_bounced` | 1 | Email rejeitado |
| `email_resent` | 1 | Reenvio de email |
| `priority_change` | 1 | Alteração de prioridade |

**Actividades NÃO registadas (mas deveriam ser):**
- `assignment` — Código existe mas 0 registos (pode não estar a ser chamado correctamente)
- `started` — Código existe mas 0 registos
- `bypass` — Código existe mas 0 registos
- `due_date_change` — Código existe mas 0 registos
- `status_change` — Código existe mas 0 registos (reset)
- `task_created` — Código existe mas 0 registos (ad-hoc)
- `task_deleted` — Código existe mas 0 registos

**Possível causa:** Estas acções podem simplesmente nunca ter sido executadas em produção, ou o logging pode ter sido adicionado depois dos primeiros dados. Não é necessariamente um bug.

---

## 3. BASE DE DADOS — SCHEMA ACTUAL

### 3.1. notifications (13 colunas, 164 registos)

| Coluna | Tipo | Default | Notas |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | PK |
| recipient_id | uuid | null | FK → dev_users |
| sender_id | uuid | null | FK → dev_users (nullable — sistema) |
| notification_type | text | null | Enum string |
| entity_type | text | null | `proc_instance` / `proc_task` / `proc_chat_message` / `proc_task_comment` |
| entity_id | uuid | null | ID da entidade |
| title | text | null | Título curto |
| body | text | null | Descrição longa |
| action_url | text | null | Link para dashboard |
| is_read | boolean | false | |
| read_at | timestamptz | null | |
| metadata | jsonb | '{}' | Dados adicionais |
| created_at | timestamptz | now() | |

**Índices:**
- `idx_notifications_recipient_unread` — Partial index `(recipient_id, is_read, created_at DESC) WHERE is_read = false`
- `idx_notifications_recipient_created` — `(recipient_id, created_at DESC)`
- `idx_notifications_entity` — `(entity_type, entity_id)`

**RLS:** Activo — users só vêem/editam/eliminam as suas notificações. Inserts apenas via service role.

**Distribuição por entity_type:**
- `proc_instance`: 120 (73%)
- `proc_task`: 36 (22%)
- `proc_chat_message`: 7 (4%)
- `proc_task_comment`: 1 (1%)

### 3.2. proc_alert_log (12 colunas, 18 registos)

| Coluna | Tipo | Default | Notas |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | PK |
| proc_instance_id | uuid | null | FK → proc_instances |
| entity_type | text | null | `proc_task` / `proc_subtask` |
| entity_id | uuid | null | |
| event_type | text | null | `on_complete` / `on_overdue` / `on_unblock` / `on_assign` |
| channel | text | null | `notification` / `email` / `whatsapp` |
| recipient_id | uuid | null | FK → dev_users |
| recipient_address | text | null | Email ou telefone |
| status | text | 'sent' | `pending` / `sent` / `failed` / `skipped` |
| error_message | text | null | |
| metadata | jsonb | '{}' | alert_config + context |
| created_at | timestamptz | now() | |

**Distribuição:** 16 sent, 2 failed.

### 3.3. proc_task_activities (7 colunas, 116 registos)

| Coluna | Tipo | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| proc_task_id | uuid | null |
| user_id | uuid | null |
| activity_type | text | null |
| description | text | null |
| metadata | jsonb | '{}' |
| created_at | timestamptz | now() |

### 3.4. log_emails (18 colunas)

| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid | PK |
| proc_task_id | uuid | FK → proc_tasks |
| proc_subtask_id | uuid | FK → proc_subtasks |
| recipient_email | text | |
| subject | text | |
| body_html | text | HTML completo |
| sender_email | text | |
| sender_name | text | |
| cc | text[] | Array de CC |
| sent_at | timestamptz | |
| delivery_status | text | |
| last_event | text | Último evento Resend |
| events | jsonb | Histórico de eventos |
| provider_id | text | ID Resend |
| resend_email_id | text | |
| parent_email_id | uuid | Threading |
| error_message | text | |
| metadata | jsonb | |

---

## 4. SERVIÇOS — IMPLEMENTAÇÃO REAL

### 4.1. NotificationService (`lib/notifications/service.ts`)

```typescript
class NotificationService {
  // Cria notificação individual
  async create(params: CreateNotificationParams): Promise<void>

  // Cria notificações para múltiplos destinatários (exclui sender automaticamente)
  async createBatch(recipientIds: string[], params): Promise<void>

  // Obtém user IDs por roles
  async getUserIdsByRoles(roleNames: string[]): Promise<string[]>
}
```

**Características:**
- Usa admin client (bypassa RLS)
- Erros capturados silenciosamente (log + continue)
- Exclui automaticamente o sender do batch

### 4.2. AlertService (`lib/alerts/service.ts`)

```typescript
class AlertService {
  // Entry point — processa alerta configurado
  async processAlert(alertConfig: AlertEventConfig, context: AlertContext): Promise<void>

  // Resolve destinatários por tipo
  private async resolveRecipients(recipients, context): Promise<ResolvedRecipient[]>

  // Envia por cada canal
  private async sendNotification(recipient, config, context): Promise<void>
  private async sendEmail(recipient, config, context): Promise<void>
  private async sendWhatsApp(recipient, config, context): Promise<void>

  // Renderiza variáveis no template de mensagem
  private renderMessage(template, context): string

  // Regista no proc_alert_log
  private async logAlert(params): Promise<void>
}
```

**Variáveis suportadas no template:**
- `{title}` → Nome da tarefa/subtarefa
- `{process_ref}` → Referência do processo (ex: ANG-2026-0038)
- `{triggered_by}` → Nome de quem disparou

**Resolução de destinatários:**
- `assigned` → Utilizador atribuído à tarefa
- `consultant` → `requested_by` do proc_instances
- `role` → Todos os users com os roles especificados
- `specific_users` → Lista fixa de user IDs

### 4.3. Activity Logger (`lib/processes/activity-logger.ts`)

```typescript
async function logTaskActivity(
  supabase, taskId, userId, activity_type, description, metadata?
): Promise<void>
```

**35+ activity types definidos:**
`status_change`, `assignment`, `priority_change`, `due_date_change`, `bypass`, `started`, `completed`, `viewed`, `email_sent`, `email_delivered`, `email_opened`, `email_clicked`, `email_bounced`, `email_resent`, `subtask_added`, `subtask_deleted`, `subtask_reverted`, `upload`, `draft_generated`, `doc_generated`, `template_reset`, `comment`, `task_created`, `task_deleted`, ...

---

## 5. ENDPOINTS DE CRON/WORKER

### 5.1. Check Overdue (`GET /api/alerts/check-overdue`)

- **Protecção:** `Authorization: Bearer {CRON_SECRET}`
- **Acção:** Chama RPC `check_overdue_and_unblock_alerts()` no Supabase
- **Resultado:** Insere registos `pending` no `proc_alert_log`
- **Depois:** Chama internamente `/api/alerts/process-pending`

### 5.2. Process Pending (`GET /api/alerts/process-pending`)

- **Acção:** Busca até 50 alertas `pending` do `proc_alert_log`
- **Para cada:** Extrai `metadata.alert_config` e chama `alertService.processAlert()`
- **Actualiza:** `pending` → `sent` ou `failed`

### 5.3. Estado do pg_cron

**⚠️ NÃO CONFIRMADO** se a função SQL `check_overdue_and_unblock_alerts()` existe no Supabase ou se o pg_cron está configurado. O endpoint API existe mas pode nunca ter sido activado.

---

## 6. FRONTEND

### 6.1. Componentes

| Componente | Ficheiro | Estado |
|-----------|----------|:---:|
| NotificationPopover | `components/notifications/notification-popover.tsx` | ✅ |
| NotificationItem | `components/notifications/notification-item.tsx` | ✅ |

### 6.2. Hook

| Hook | Ficheiro | Features |
|------|----------|---------|
| useNotifications | `hooks/use-notifications.ts` | Fetch, markAsRead, markAllAsRead, delete, unreadCount, **Supabase Realtime** (INSERT → toast + increment, UPDATE → refetch count) |

### 6.3. APIs Frontend

| Método | Rota | Funcionalidade |
|--------|------|---------------|
| GET | `/api/notifications` | Lista paginada com filtros |
| PUT | `/api/notifications` | Marcar todas como lidas |
| PUT | `/api/notifications/[id]` | Marcar individual como lida |
| DELETE | `/api/notifications/[id]` | Eliminar notificação |
| GET | `/api/notifications/unread-count` | Contagem rápida |

---

## 7. MAPA DE TRIGGERS COMPLETO

### Por Acção → O que é disparado

| Acção | Notificação (Camada 1) | Alerta Multicanal (Camada 2) | Activity Log (Camada 3) |
|-------|:---:|:---:|:---:|
| **Processo criado** | ❌ | ❌ | ❌ |
| **Processo aprovado** | ✅ → requested_by | ❌ | ❌ |
| **Processo rejeitado** | ✅ → requested_by | ❌ | ❌ |
| **Processo devolvido** | ✅ → requested_by | ❌ | ❌ |
| **Processo eliminado** | ✅ → requested_by + managers | ❌ | ❌ |
| **Processo pausado** | ❌ | ❌ | ❌ |
| **Processo retomado** | ❌ | ❌ | ❌ |
| **Processo cancelado** | ❌ | ❌ | ❌ |
| **Tarefa iniciada** | ❌ | ❌ | ✅ `started` |
| **Tarefa concluída** | ✅ → approver roles | ✅ `on_complete` (se config) | ✅ `completed` |
| **Tarefa atribuída** | ✅ → assignee | ✅ `on_assign` (se config) | ✅ `assignment` |
| **Tarefa dispensada (bypass)** | ❌ | ❌ | ✅ `bypass` |
| **Tarefa reactivada (reset)** | ❌ | ❌ | ✅ `status_change` |
| **Tarefa prioridade alterada** | ✅ → assignee | ❌ | ✅ `priority_change` |
| **Tarefa data limite alterada** | ✅ → assignee | ❌ | ✅ `due_date_change` |
| **Tarefa desbloqueada** | ❌ | ✅ `on_unblock` (se config) | ❌ |
| **Tarefa em atraso** | ❌ | ⚠️ `on_overdue` (cron não confirmado) | ❌ |
| **Tarefa ad-hoc criada** | ❌ | ❌ | ✅ `task_created` |
| **Tarefa ad-hoc eliminada** | ❌ | ❌ | ✅ `task_deleted` |
| **Subtarefa concluída** | ❌ | ✅ `on_complete` (se config) | ✅ (varia por tipo) |
| **Subtarefa atribuída** | ❌ | ✅ `on_assign` (se config) | ❌ |
| **Subtarefa revertida** | ❌ | ❌ | ✅ `subtask_reverted` |
| **Subtarefa desbloqueada** | ❌ | ✅ `on_unblock` (se config) | ❌ |
| **Subtarefa eliminada** | ❌ | ❌ | ✅ `subtask_deleted` |
| **Email enviado** | ❌ | ❌ | ✅ `email_sent` |
| **Email entregue** | ❌ | ❌ | ✅ `email_delivered` |
| **Email bounced** | ❌ | ❌ | ✅ `email_bounced` |
| **Comentário na tarefa** | ❌ | ❌ | ✅ `comment` |
| **Mensagem no chat** | ❌ | ❌ | ❌ |
| **Tarefa visualizada** | ❌ | ❌ | ✅ `viewed` (throttle 5min) |

---

## 8. PROBLEMAS IDENTIFICADOS

### 8.1. Críticos

| # | Problema | Impacto | Solução |
|---|---------|---------|---------|
| P1 | **Processo criado não notifica ninguém** | Gestoras processual não sabem que há processos para aprovar | Adicionar notificação batch → APPROVER_NOTIFICATION_ROLES no POST de angariação/finalização |
| P2 | **Comentários e chat não geram notificações** | Utilizadores perdem mensagens importantes | Implementar triggers nos POST de comentários e chat |
| P3 | **pg_cron para on_overdue não confirmado** | Tarefas atrasadas podem nunca disparar alertas | Verificar se RPC `check_overdue_and_unblock_alerts()` existe e se cron está agendado |

### 8.2. Importantes

| # | Problema | Impacto | Solução |
|---|---------|---------|---------|
| P4 | **Hold/Resume/Cancel sem notificações** | Consultores não sabem que processo foi pausado/cancelado | Adicionar notificações simples nestes handlers |
| P5 | **Bypass de tarefa sem notificação** | Gestora dispensa tarefa e ninguém é informado | Notificar consultor atribuído |
| P6 | **Subtarefa concluída não notifica** | Responsável da tarefa pai não sabe do progresso | Notificar assigned_to da tarefa pai quando subtarefa é concluída |
| P7 | **@mentions não implementados** | Tipos definidos mas sem parser nem trigger | Implementar parser de @mentions no chat e comentários |

### 8.3. Menores

| # | Problema | Impacto | Solução |
|---|---------|---------|---------|
| P8 | **Typo nas notificações** (dados reais: "A tarefa TEste Aleta Task foi cincluida") | Mensagens com erros ortográficos | Corrigir "concluída" nos templates |
| P9 | **Re-template não notifica** | Consultor não sabe que template mudou | Adicionar notificação |
| P10 | **Activity log da tarefa visualizada domina** (82 de 116 = 71%) | Ruído no histórico | Considerar separar "viewed" ou reduzir frequência |

### 8.4. Inconsistências de Design

| # | Inconsistência | Detalhe |
|---|---------------|---------|
| D1 | **Processos logam na Camada 1 mas não na Camada 3** | Aprovação/rejeição/devolução geram notificação mas NÃO activity log |
| D2 | **Subtarefas logam na Camada 3 mas não na Camada 1** | Conclusão de subtarefa gera activity mas NÃO notificação |
| D3 | **Alertas (Camada 2) dependem de config, notificações (Camada 1) são hardcoded** | Duas lógicas paralelas para o mesmo evento (ex: task_completed) |
| D4 | **Chat gera entity_type `proc_chat_message` (7 registos)** mas não há trigger visível | Pode ter sido implementado e removido, ou há código não encontrado |

---

## 9. RECOMENDAÇÕES PARA APRIMORAMENTO

### Fase 1 — Quick Wins (1-2 dias)

| # | Acção | Ficheiros a Modificar | Esforço |
|---|-------|----------------------|:---:|
| R1 | **Notificar gestoras quando processo é criado** | `app/api/acquisitions/[id]/finalize/route.ts` | Baixo |
| R2 | **Notificar em hold/resume/cancel** | `hold/route.ts`, `cancel/route.ts` | Baixo |
| R3 | **Notificar ao dispensar tarefa (bypass)** | `tasks/[taskId]/route.ts` (secção bypass) | Baixo |
| R4 | **Corrigir typo "concluida" → "concluída"** | `tasks/[taskId]/route.ts` L306 | Trivial |
| R5 | **Adicionar activity log em aprovação/rejeição/devolução** | `approve/route.ts`, `reject/route.ts`, `return/route.ts` | Baixo |

### Fase 2 — Notificações de Chat/Comentários (2-3 dias)

| # | Acção | Ficheiros a Modificar | Esforço |
|---|-------|----------------------|:---:|
| R6 | **Notificar participantes ao enviar mensagem no chat** | `chat/route.ts` (POST) | Médio |
| R7 | **Notificar ao adicionar comentário na tarefa** | `tasks/[taskId]/comments/route.ts` (POST) | Médio |
| R8 | **Notificar subtarefa concluída → assigned_to da tarefa pai** | `subtasks/[subtaskId]/route.ts` (PUT) | Médio |

### Fase 3 — @Mentions e Overdue (3-5 dias)

| # | Acção | Ficheiros a Criar/Modificar | Esforço |
|---|-------|----------------------------|:---:|
| R9 | **Implementar parser de @mentions** | Novo: `lib/mentions/parser.ts` | Médio |
| R10 | **Integrar @mentions no chat e comentários** | `chat/route.ts`, `comments/route.ts` | Médio |
| R11 | **Verificar/criar RPC `check_overdue_and_unblock_alerts()`** | Migration SQL | Médio |
| R12 | **Configurar Vercel Cron ou pg_cron para check-overdue** | `vercel.json` ou Supabase Dashboard | Baixo |

### Fase 4 — Consolidação (2-3 dias)

| # | Acção | Descrição | Esforço |
|---|-------|-----------|:---:|
| R13 | **Unificar Camadas 1 e 2 quando possível** | Evitar duplicação (task_completed gera notificação E alerta) | Médio |
| R14 | **Dashboard de notificações enviadas** | Página para ver proc_alert_log + log_emails | Médio |
| R15 | **Deduplicação de alertas** (24h) | Evitar spam quando mesma acção é repetida | Baixo |
| R16 | **Página /dashboard/notificacoes** | Lista completa com filtros (já existe popover, falta página full) | Médio |

---

## 10. CONSTANTES E TIPOS — REFERÊNCIA

### notification_type (definidos em `lib/notifications/types.ts`)

| Tipo | Trigger Existe? | Categoria |
|------|:---:|----------|
| `process_created` | ❌ | Processo |
| `process_approved` | ✅ | Processo |
| `process_rejected` | ✅ | Processo |
| `process_returned` | ✅ | Processo |
| `process_deleted` | ✅ | Processo |
| `task_assigned` | ✅ | Tarefa |
| `task_completed` | ✅ | Tarefa |
| `task_comment` | ❌ | Tarefa |
| `task_updated` | ✅ | Tarefa |
| `task_overdue` | ⚠️ | Tarefa |
| `subtask_completed` | ❌ | Subtarefa |
| `subtask_overdue` | ⚠️ | Subtarefa |
| `subtask_unblocked` | ❌ | Subtarefa |
| `subtask_assigned` | ❌ | Subtarefa |
| `chat_message` | ❌ | Chat |
| `comment_mention` | ❌ | Menções |
| `chat_mention` | ❌ | Menções |
| `alert_on_complete` | ✅ | Alerta |
| `alert_on_overdue` | ⚠️ | Alerta |
| `alert_on_unblock` | ✅ | Alerta |
| `alert_on_assign` | ✅ | Alerta |

**Score: 9 activos de 21 definidos (43%)**

---

## 11. VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```env
# Notificações (já configurado)
NEXT_PUBLIC_SUPABASE_URL=...        # Para Realtime subscriptions
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # Para Realtime subscriptions
SUPABASE_SERVICE_ROLE_KEY=...       # Para inserts via admin client

# Alertas Email (já configurado)
# (usa Edge Function send-email no Supabase)

# Alertas WhatsApp
UAZAPI_URL=...                      # URL da API Uazapi

# Cron
CRON_SECRET=...                     # Bearer token para proteger endpoints cron
```

---

## 12. FICHEIROS CHAVE

| Ficheiro | Papel | Linhas |
|----------|-------|:------:|
| `lib/notifications/service.ts` | NotificationService (create, batch, roles) | ~90 |
| `lib/notifications/types.ts` | 21 notification types + interfaces | ~50 |
| `lib/alerts/service.ts` | AlertService (email, WhatsApp, in-app) | ~200 |
| `lib/processes/activity-logger.ts` | logTaskActivity() | ~20 |
| `lib/validations/alert.ts` | Zod schemas para alert config | ~60 |
| `lib/validations/notification.ts` | Zod schemas para notification ops | ~20 |
| `types/alert.ts` | AlertEventConfig, AlertsConfig, AlertContext | ~50 |
| `hooks/use-notifications.ts` | Frontend hook + Realtime | ~100 |
| `components/notifications/notification-popover.tsx` | UI do sino | ~80 |
| `components/notifications/notification-item.tsx` | Card de notificação | ~60 |
| `components/templates/alert-config-editor.tsx` | Config de alertas no template | ~150 |
| `app/api/notifications/route.ts` | GET/PUT notificações | ~100 |
| `app/api/notifications/[id]/route.ts` | PUT/DELETE individual | ~60 |
| `app/api/notifications/unread-count/route.ts` | Contagem rápida | ~20 |
| `app/api/alerts/check-overdue/route.ts` | Cron: detectar atrasos | ~40 |
| `app/api/alerts/process-pending/route.ts` | Processar alertas pendentes | ~60 |
