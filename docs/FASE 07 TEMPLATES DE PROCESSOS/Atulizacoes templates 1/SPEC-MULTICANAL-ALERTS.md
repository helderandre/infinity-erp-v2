# SPEC — Alertas Multicanal (Notificação + Email + WhatsApp) em Tarefas e Subtarefas

**Data:** 2026-03-10 (rev. 3 — ajustada ao estado real do projecto)
**Módulo:** M07 (Templates), M06 (Processos), Notificações, Automação
**Pré-requisitos implementados:** SPEC-SUBTASK-ENHANCEMENTS ✅, SPEC-TASK-DEPENDENCIES ✅

---

## 1. Contexto — O Que Já Existe

### 1.1 Base de Dados (já aplicado)

| Tabela/Recurso | Estado |
|----------------|--------|
| `email_senders` | ✅ Criada. 1 registo seed: `noreply@infinitygroup.pt` (default) |
| `proc_alert_log` | ✅ Criada. Vazia. Índices + RLS aplicados |
| `auto_wpp_instances` | ✅ 3 instâncias activas (Duarte, Filipe, Helder) |
| `notifications` | ✅ Tabela existente com RLS + Realtime |
| `tpl_subtasks.config` | ✅ JSONB — campo `alerts` será adicionado aqui |
| `tpl_tasks.config` | ✅ JSONB — campo `alerts` será adicionado aqui |
| Triggers de desbloqueio | ✅ `auto_unblock_on_task_complete`, `auto_unblock_on_subtask_complete` |
| RPC `resolve_process_dependencies` | ✅ Implementada |
| Edge Function `send-email` | ✅ Existente (Resend) |
| Uazapi (WhatsApp) | ✅ Integração existente via `auto_wpp_instances` |

### 1.2 Código Backend Existente

| Ficheiro | O que faz |
|----------|-----------|
| `lib/notifications/service.ts` | `NotificationService` — `create()`, `createBatch()`, `getUserIdsByRoles()` |
| `lib/notifications/types.ts` | Types `Notification`, `NotificationType`, `CreateNotificationParams` |
| `hooks/use-notifications.ts` | Hook client com fetch + Realtime |
| `components/notifications/notification-popover.tsx` | UI do sino com badge |

### 1.3 Desvios Relevantes da SPEC-TASK-DEPENDENCIES

| Desvio | Impacto nos alertas |
|--------|---------------------|
| Desbloqueio via triggers SQL (não passa por route handlers) | O evento `on_unblock` **não pode ser disparado inline** — precisa de polling via cron |
| Casts `as any` por types desactualizados | Manter mesmo padrão — novos campos de alerta também usarão casts |

---

## 2. O Que Esta Spec Implementa

Ao nível do **template** (tpl_tasks / tpl_subtasks), o utilizador pode configurar alertas que disparam automaticamente quando a **instância** (proc_tasks / proc_subtasks) muda de estado.

Cada alerta define:
- **Evento**: quando dispara (ao concluir, ao vencer prazo, ao desbloquear, ao atribuir)
- **Canais**: notificação in-app, email (com remetente), WhatsApp (com instância)
- **Destinatários**: consultor do processo, responsável atribuído, todos com role X, users específicos
- **Mensagem**: template de texto com variáveis

---

## 3. Nenhuma Migração SQL Necessária

Tudo o que é preciso ao nível da BD **já existe**:
- `email_senders` — criada
- `proc_alert_log` — criada
- `config` JSONB em `tpl_tasks` e `tpl_subtasks` — já existe, os alertas ficam dentro

Não é preciso ALTER TABLE nem CREATE TABLE.

---

## 4. Estrutura de `config.alerts` (JSONB)

Guardado dentro do `config` existente de `tpl_tasks` e `tpl_subtasks`:

```jsonc
{
  // ... campos existentes (type, doc_type_id, owner_scope, etc.) ...
  "alerts": {
    "on_complete": {
      "enabled": true,
      "channels": {
        "notification": true,
        "email": {
          "enabled": true,
          "sender_id": "13a2844a-f357-41c7-9669-a6645caf9f22"  // → email_senders.id
        },
        "whatsapp": {
          "enabled": true,
          "wpp_instance_id": "607e1ab4-2cba-4640-a8dc-b781e9143d11"  // → auto_wpp_instances.id
        }
      },
      "recipients": {
        "type": "role",          // "role" | "consultant" | "assigned" | "specific_users"
        "roles": ["Consultor"]   // quando type = "role"
      },
      "message_template": "A subtarefa '{title}' foi concluída no processo {process_ref}"
    },
    "on_overdue": {
      "enabled": true,
      "channels": {
        "notification": true,
        "email": { "enabled": true, "sender_id": null },  // null = usar default
        "whatsapp": { "enabled": false }
      },
      "recipients": { "type": "assigned" }
    },
    "on_unblock": {
      "enabled": false,
      "channels": { "notification": false, "email": { "enabled": false }, "whatsapp": { "enabled": false } },
      "recipients": { "type": "assigned" }
    },
    "on_assign": {
      "enabled": false,
      "channels": { "notification": false, "email": { "enabled": false }, "whatsapp": { "enabled": false } },
      "recipients": { "type": "assigned" }
    }
  }
}
```

---

## 5. Ficheiros a CRIAR

### 5.1 `types/alert.ts`

```typescript
export interface EmailSender {
  id: string
  name: string
  email: string
  display_name: string
  reply_to: string | null
  is_default: boolean
}

export interface WppInstance {
  id: string
  name: string
  phone: string
  connection_status: string
}

export interface AlertChannelsConfig {
  notification: boolean
  email: {
    enabled: boolean
    sender_id: string | null  // null = usar default (is_default = true)
  }
  whatsapp: {
    enabled: boolean
    wpp_instance_id: string | null  // obrigatório se enabled = true
  }
}

export interface AlertRecipientsConfig {
  type: 'role' | 'consultant' | 'assigned' | 'specific_users'
  roles?: string[]       // quando type = 'role'
  user_ids?: string[]    // quando type = 'specific_users'
}

export interface AlertEventConfig {
  enabled: boolean
  channels: AlertChannelsConfig
  recipients: AlertRecipientsConfig
  message_template?: string
}

export interface AlertsConfig {
  on_complete?: AlertEventConfig
  on_overdue?: AlertEventConfig
  on_unblock?: AlertEventConfig
  on_assign?: AlertEventConfig
}
```

### 5.2 `lib/validations/alert.ts`

```typescript
import { z } from 'zod'

export const alertChannelsSchema = z.object({
  notification: z.boolean().default(false),
  email: z.object({
    enabled: z.boolean().default(false),
    sender_id: z.string().uuid().nullable().default(null),
  }).default({ enabled: false, sender_id: null }),
  whatsapp: z.object({
    enabled: z.boolean().default(false),
    wpp_instance_id: z.string().uuid().nullable().default(null),
  }).default({ enabled: false, wpp_instance_id: null }),
})

export const alertRecipientsSchema = z.object({
  type: z.enum(['role', 'consultant', 'assigned', 'specific_users']),
  roles: z.array(z.string()).optional(),
  user_ids: z.array(z.string().uuid()).optional(),
})

export const alertEventSchema = z.object({
  enabled: z.boolean().default(false),
  channels: alertChannelsSchema,
  recipients: alertRecipientsSchema,
  message_template: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.channels.whatsapp.enabled && !data.channels.whatsapp.wpp_instance_id) return false
    return true
  },
  { message: 'Seleccione uma instância WhatsApp', path: ['channels', 'whatsapp', 'wpp_instance_id'] }
)

export const alertsConfigSchema = z.object({
  on_complete: alertEventSchema.optional(),
  on_overdue: alertEventSchema.optional(),
  on_unblock: alertEventSchema.optional(),
  on_assign: alertEventSchema.optional(),
}).optional()
```

### 5.3 `lib/alerts/service.ts`

Serviço centralizado que orquestra os 3 canais. Usa o `notificationService` existente para in-app, Edge Function `send-email` para email, e Uazapi para WhatsApp.

**Métodos:**
- `processAlert(alertConfig, context)` — ponto de entrada principal
- `resolveRecipients(recipientConfig, context)` — resolve quem recebe
- `sendNotification(recipient, context)` — delega ao `notificationService.create()`
- `sendEmail(recipient, context, senderId)` — resolve remetente via `email_senders` + chama Edge Function
- `sendWhatsApp(recipient, context, wppInstanceId)` — resolve instância via `auto_wpp_instances` + chama Uazapi
- `logAlert(context, channel, recipientId, status)` — insere em `proc_alert_log`
- `renderMessage(template, context)` — substitui variáveis: `{title}`, `{process_ref}`, `{triggered_by}`

**Resolver remetente email:**
1. Se `sender_id` fornecido → buscar `email_senders` por ID
2. Se `null` → buscar `email_senders` com `is_default = true`
3. Fallback hardcoded: `noreply@infinitygroup.pt`

**Resolver instância WhatsApp:**
1. Se `wpp_instance_id` fornecido → buscar `auto_wpp_instances` por ID, verificar `connection_status = 'connected'`
2. Se não conectada → log error, não enviar
3. Se `null` e `enabled = true` → não enviar (validação Zod impede, mas safety check)

**Importante:** Erros de envio **nunca bloqueiam** a acção principal. Try/catch em cada canal com log no `proc_alert_log`.

### 5.4 `app/api/settings/email-senders/route.ts`

GET — lista email senders activos para popular select no template builder.

```typescript
// Select: id, name, email, display_name, is_default
// Filtro: is_active = true
// Ordem: is_default DESC, name ASC
```

### 5.5 `app/api/settings/wpp-instances/route.ts`

GET — lista instâncias WhatsApp activas para popular select no template builder.

```typescript
// Select: id, name, phone, connection_status
// Filtro: status = 'active'
// Ordem: name ASC
```

### 5.6 `components/templates/alert-config-editor.tsx`

Componente reutilizável para configurar alertas. Usado tanto no `subtask-editor.tsx` como no `template-task-sheet.tsx`.

**Props:**
```typescript
interface AlertConfigEditorProps {
  alerts: AlertsConfig | undefined
  onChange: (alerts: AlertsConfig) => void
}
```

**Layout (dentro de um Collapsible "Alertas"):**

```
▼ Alertas
  
  ▼ Ao concluir
    [✓] Notificação in-app
    [✓] Email
        Remetente: [Geral (noreply@infinitygroup.pt) ▾]
    [✓] WhatsApp
        Instância: [Duarte (+351915981132) ▾]
    Destinatários: [Todos com a role... ▾]
        Role: [Consultor ▾]
    Mensagem: [A subtarefa '{title}' foi conclu...]

  ▸ Ao vencer prazo
  ▸ Ao desbloquear
  ▸ Ao atribuir
```

**Dados lazy-loaded (apenas quando Collapsible abre):**
- `GET /api/settings/email-senders` → popular select de remetente
- `GET /api/settings/wpp-instances` → popular select de instância

**Roles disponíveis (hardcoded, mesma lista do sistema):**
```typescript
const ALERT_ROLES = [
  { value: 'Consultor', label: 'Consultor' },
  { value: 'Gestora Processual', label: 'Gestora Processual' },
  { value: 'Broker/CEO', label: 'Broker/CEO' },
  { value: 'Team Leader', label: 'Team Leader' },
  { value: 'Office Manager', label: 'Office Manager' },
] as const
```

**Componentes shadcn usados:** Collapsible, Switch (para cada canal), Select (remetente, instância, destinatários, role), Input (mensagem template), Badge.

---

## 6. Ficheiros a MODIFICAR

### 6.1 `components/templates/subtask-editor.tsx`

Dentro do Collapsible "Opções avançadas" de cada `SortableSubtaskRow`, adicionar o `AlertConfigEditor`:

```tsx
// Após os campos de prioridade/responsável/SLA/dependência:
<AlertConfigEditor
  alerts={subtask.config.alerts}
  onChange={(alerts) => onUpdate(subtask.id, {
    config: { ...subtask.config, alerts }
  })}
/>
```

### 6.2 `components/templates/template-task-sheet.tsx`

Adicionar secção "Alertas" na tarefa (nível superior):

```tsx
// Após a secção "Subtasks", antes do footer:
<Separator />
<div className="space-y-3">
  <h3 className="text-sm font-medium text-muted-foreground">Alertas da Tarefa</h3>
  <AlertConfigEditor
    alerts={taskAlerts}
    onChange={setTaskAlerts}
  />
</div>
```

**Estado local adicional:**
```typescript
const [taskAlerts, setTaskAlerts] = useState<AlertsConfig | undefined>(
  initialData?.config?.alerts
)
```

**No handleSubmit:** Incluir alerts no config da tarefa. Como `TaskData` não tem `config` (foi removido na refactoração para COMPOSITE), a solução é guardar os alertas da tarefa como metadata que o backend propaga para `tpl_tasks.config`:

```typescript
onSubmit({
  ...taskData,
  // Os alertas ficam num campo dedicado que o builder propaga
  _task_alerts: taskAlerts,
})
```

### 6.3 `components/templates/template-builder.tsx`

No `handleSave`, propagar os alertas da tarefa para o payload:

```typescript
tasks: (items[stageId] || []).map((taskId, taskIndex) => ({
  // ... campos existentes ...
  config: {
    alerts: tasksData[taskId]._task_alerts || undefined,
  },
  subtasks: (tasksData[taskId].subtasks || []).map((st, sidx) => ({
    // ... campos existentes ...
    // alerts já estão dentro de st.config.alerts — propagam automaticamente
  })),
}))
```

No `useEffect` de carregamento do `initialData`, popular os alertas:

```typescript
// Ao mapear tasks:
_task_alerts: task.config?.alerts || undefined,

// Ao mapear subtasks:
// alerts já vêm dentro de st.config — não precisa de tratamento especial
```

### 6.4 `app/api/templates/route.ts` (POST) e `app/api/templates/[id]/route.ts` (PUT)

No mapping de tasks para insert, restaurar o `config` com os alertas:

```typescript
const tasksToInsert = stage.tasks.map((task) => ({
  tpl_stage_id: insertedStage.id,
  title: task.title,
  // ... campos existentes ...
  action_type: 'COMPOSITE',
  config: task.config || {},  // ← agora tem { alerts: {...} } se configurado
  order_index: task.order_index,
}))
```

As subtarefas já propagam `config` correctamente (inclui `alerts` se presente).

### 6.5 `app/api/processes/[id]/tasks/[taskId]/route.ts`

Após acções `complete`, `assign`:

```typescript
// Após recalcular progresso e registar actividade:

// Disparar alertas configurados no template
try {
  const taskConfig = (task as any).config || {}
  const alertService = (await import('@/lib/alerts/service')).alertService

  if (action === 'complete' && taskConfig.alerts?.on_complete?.enabled) {
    await alertService.processAlert(taskConfig.alerts.on_complete, {
      procInstanceId: id,
      entityType: 'proc_task',
      entityId: taskId,
      eventType: 'on_complete',
      title: task.title,
      processRef: (task as any).proc_instance?.external_ref || '',
      triggeredBy: user.id,
      assignedTo: task.assigned_to,
    })
  }

  if (action === 'assign' && assigned_to && taskConfig.alerts?.on_assign?.enabled) {
    await alertService.processAlert(taskConfig.alerts.on_assign, {
      procInstanceId: id,
      entityType: 'proc_task',
      entityId: taskId,
      eventType: 'on_assign',
      title: task.title,
      processRef: (task as any).proc_instance?.external_ref || '',
      triggeredBy: user.id,
      assignedTo: assigned_to,
    })
  }
} catch (alertError) {
  console.error('[TaskUpdate] Erro ao processar alertas:', alertError)
}
```

### 6.6 `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts`

Após toggle de subtarefa:

```typescript
// Após recalcular progresso:

// Disparar alertas configurados no template
try {
  const subtaskConfig = config || {}
  const alertService = (await import('@/lib/alerts/service')).alertService

  if (is_completed && subtaskConfig.alerts?.on_complete?.enabled) {
    // Buscar process ref
    const { data: proc } = await supabase
      .from('proc_instances')
      .select('external_ref')
      .eq('id', id)
      .single()

    await alertService.processAlert(subtaskConfig.alerts.on_complete, {
      procInstanceId: id,
      entityType: 'proc_subtask',
      entityId: subtaskId,
      eventType: 'on_complete',
      title: (subtask as any).title,
      processRef: proc?.external_ref || '',
      triggeredBy: user.id,
      assignedTo: (subtask as any).assigned_to,
    })
  }
} catch (alertError) {
  console.error('[SubtaskUpdate] Erro ao processar alertas:', alertError)
}
```

### 6.7 `lib/constants.ts`

Adicionar constantes PT-PT para alertas:

```typescript
// --- ALERTAS ---

export const ALERT_EVENT_LABELS = {
  on_complete: 'Ao concluir',
  on_overdue: 'Ao vencer prazo',
  on_unblock: 'Ao desbloquear',
  on_assign: 'Ao atribuir',
} as const

export const ALERT_CHANNEL_LABELS = {
  notification: 'Notificação in-app',
  email: 'Email',
  whatsapp: 'WhatsApp',
} as const

export const ALERT_RECIPIENT_LABELS = {
  consultant: 'Consultor do processo',
  assigned: 'Responsável atribuído',
  role: 'Todos com a role...',
  specific_users: 'Utilizadores específicos',
} as const

export const ALERT_MESSAGE_VARIABLES = {
  '{title}': 'Título da tarefa/subtarefa',
  '{process_ref}': 'Referência do processo (PROC-2026-XXXX)',
  '{triggered_by}': 'Nome de quem executou a acção',
} as const
```

### 6.8 `lib/notifications/types.ts`

Adicionar novos notification types:

```typescript
export type NotificationType =
  | 'process_created'
  | 'process_approved'
  | 'process_rejected'
  | 'process_returned'
  | 'process_deleted'
  | 'task_assigned'
  | 'task_completed'
  | 'task_comment'
  | 'chat_message'
  | 'comment_mention'
  | 'chat_mention'
  | 'task_updated'
  | 'task_overdue'
  | 'subtask_completed'    // ← NOVO
  | 'subtask_overdue'      // ← NOVO
  | 'subtask_unblocked'    // ← NOVO
  | 'subtask_assigned'     // ← NOVO
  | 'alert_on_complete'    // ← NOVO (alertas do template)
  | 'alert_on_overdue'     // ← NOVO
  | 'alert_on_unblock'     // ← NOVO
  | 'alert_on_assign'      // ← NOVO
```

---

## 7. Evento `on_overdue` — Via Cron

Os eventos `on_overdue` não são disparados inline (ninguém "executa" um vencimento). Precisam de um **job periódico**.

### 7.1 Abordagem: Expandir o cron existente

O sistema já tem 3 cron jobs activos:
- `auto-detect-stuck` (cada 5 min)
- `auto-cleanup` (3h diário)
- `auto-process-worker` (cada minuto)

**Opção recomendada:** Criar função SQL `check_overdue_subtasks_and_tasks()` e agendar via pg_cron (cada hora).

```sql
CREATE OR REPLACE FUNCTION check_overdue_subtasks_and_tasks()
RETURNS void AS $$
DECLARE
  item RECORD;
BEGIN
  -- Subtarefas vencidas (com config.alerts.on_overdue configurado)
  FOR item IN
    SELECT ps.id, ps.title, ps.config, ps.assigned_to, ps.due_date,
           pt.proc_instance_id, pi.external_ref
    FROM proc_subtasks ps
    JOIN proc_tasks pt ON pt.id = ps.proc_task_id
    JOIN proc_instances pi ON pi.id = pt.proc_instance_id
    WHERE ps.due_date < now()
      AND ps.is_completed = false
      AND ps.is_blocked = false
      AND pi.current_status = 'active'
      AND ps.config->'alerts'->'on_overdue'->>'enabled' = 'true'
      AND NOT EXISTS (
        SELECT 1 FROM proc_alert_log pal
        WHERE pal.entity_id = ps.id
          AND pal.event_type = 'on_overdue'
          AND pal.created_at > now() - interval '24 hours'
      )
  LOOP
    -- Inserir alerta pendente no proc_alert_log (será processado pelo worker Next.js)
    INSERT INTO proc_alert_log (proc_instance_id, entity_type, entity_id, event_type, channel, status, metadata)
    VALUES (
      item.proc_instance_id, 'proc_subtask', item.id, 'on_overdue', 'pending_dispatch',
      'pending',
      jsonb_build_object(
        'title', item.title,
        'process_ref', item.external_ref,
        'due_date', item.due_date,
        'assigned_to', item.assigned_to,
        'alert_config', item.config->'alerts'->'on_overdue'
      )
    );
  END LOOP;

  -- Tarefas vencidas (mesma lógica)
  FOR item IN
    SELECT pt.id, pt.title, pt.config, pt.assigned_to, pt.due_date,
           pt.proc_instance_id, pi.external_ref
    FROM proc_tasks pt
    JOIN proc_instances pi ON pi.id = pt.proc_instance_id
    WHERE pt.due_date < now()
      AND pt.status NOT IN ('completed', 'skipped')
      AND pt.is_blocked = false
      AND pi.current_status = 'active'
      AND pt.config->'alerts'->'on_overdue'->>'enabled' = 'true'
      AND NOT EXISTS (
        SELECT 1 FROM proc_alert_log pal
        WHERE pal.entity_id = pt.id
          AND pal.event_type = 'on_overdue'
          AND pal.created_at > now() - interval '24 hours'
      )
  LOOP
    INSERT INTO proc_alert_log (proc_instance_id, entity_type, entity_id, event_type, channel, status, metadata)
    VALUES (
      item.proc_instance_id, 'proc_task', item.id, 'on_overdue', 'pending_dispatch',
      'pending',
      jsonb_build_object(
        'title', item.title,
        'process_ref', item.external_ref,
        'due_date', item.due_date,
        'assigned_to', item.assigned_to,
        'alert_config', item.config->'alerts'->'on_overdue'
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule('check-overdue-alerts', '0 * * * *', 'SELECT check_overdue_subtasks_and_tasks()');
```

### 7.2 Worker para processar alertas pendentes

Criar `app/api/alerts/process-pending/route.ts`:

```typescript
// GET — chamado pelo cron ou manualmente
// 1. Buscar proc_alert_log WHERE status = 'pending' LIMIT 50
// 2. Para cada: parsear metadata.alert_config, chamar alertService.processAlert()
// 3. Actualizar status para 'sent' ou 'failed'
```

Este endpoint pode ser chamado pelo `auto-process-worker` existente (que já corre a cada minuto) adicionando uma verificação no worker.

---

## 8. Evento `on_unblock` — Via Polling

Como o desbloqueio acontece via trigger SQL (não passa por route handlers), os alertas `on_unblock` usam o mesmo mecanismo de polling:

```sql
-- Dentro de check_overdue_subtasks_and_tasks() ou função separada:
-- Verificar subtarefas recém-desbloqueadas (unblocked_at recente, sem alerta enviado)

FOR item IN
  SELECT ps.id, ps.title, ps.config, ps.assigned_to, ps.unblocked_at,
         pt.proc_instance_id, pi.external_ref
  FROM proc_subtasks ps
  JOIN proc_tasks pt ON pt.id = ps.proc_task_id
  JOIN proc_instances pi ON pi.id = pt.proc_instance_id
  WHERE ps.unblocked_at > now() - interval '1 hour'
    AND ps.is_completed = false
    AND ps.config->'alerts'->'on_unblock'->>'enabled' = 'true'
    AND NOT EXISTS (
      SELECT 1 FROM proc_alert_log pal
      WHERE pal.entity_id = ps.id AND pal.event_type = 'on_unblock'
    )
LOOP
  INSERT INTO proc_alert_log (proc_instance_id, entity_type, entity_id, event_type, channel, status, metadata)
  VALUES (item.proc_instance_id, 'proc_subtask', item.id, 'on_unblock', 'pending_dispatch', 'pending',
    jsonb_build_object('title', item.title, 'process_ref', item.external_ref, 'assigned_to', item.assigned_to, 'alert_config', item.config->'alerts'->'on_unblock')
  );
END LOOP;
```

---

## 9. Constantes e Labels PT-PT

Ver secção 6.7 acima.

---

## 10. Ordem de Implementação

| # | Acção | Ficheiro(s) | Dependências |
|---|-------|-------------|--------------|
| 1 | Criar types de alerta | `types/alert.ts` | Nenhuma |
| 2 | Criar validação Zod | `lib/validations/alert.ts` | #1 |
| 3 | Criar AlertService | `lib/alerts/service.ts` | #1 |
| 4 | Criar APIs de listagem remetentes | `api/settings/email-senders/route.ts`, `api/settings/wpp-instances/route.ts` | Nenhuma |
| 5 | Criar componente AlertConfigEditor | `components/templates/alert-config-editor.tsx` | #1, #2, #4 |
| 6 | Integrar no subtask-editor | `components/templates/subtask-editor.tsx` | #5 |
| 7 | Integrar no template-task-sheet | `components/templates/template-task-sheet.tsx` | #5 |
| 8 | Propagar alerts no template-builder save | `components/templates/template-builder.tsx` | #6, #7 |
| 9 | Propagar alerts nas APIs de templates | `app/api/templates/route.ts`, `[id]/route.ts` | #8 |
| 10 | Integrar alertService na API de tarefas | `app/api/processes/[id]/tasks/[taskId]/route.ts` | #3 |
| 11 | Integrar alertService na API de subtarefas | `.../subtasks/[subtaskId]/route.ts` | #3 |
| 12 | Actualizar constantes PT-PT | `lib/constants.ts` | Nenhuma |
| 13 | Actualizar notification types | `lib/notifications/types.ts` | Nenhuma |
| 14 | Criar função SQL de overdue + cron | Via Supabase MCP | #3 |
| 15 | Criar/integrar worker de alertas pendentes | `api/alerts/process-pending/route.ts` ou integrar no worker existente | #3, #14 |

---

## 11. Resumo de Ficheiros

### CRIAR (7)

| Ficheiro | Propósito |
|----------|-----------|
| `types/alert.ts` | Types: AlertsConfig, AlertEventConfig, AlertChannelsConfig, etc. |
| `lib/validations/alert.ts` | Schemas Zod para validação de config de alertas |
| `lib/alerts/service.ts` | AlertService: processAlert, sendEmail, sendWhatsApp, logAlert |
| `app/api/settings/email-senders/route.ts` | GET — listar email senders activos |
| `app/api/settings/wpp-instances/route.ts` | GET — listar instâncias WhatsApp activas |
| `components/templates/alert-config-editor.tsx` | UI de configuração de alertas (reutilizável) |
| `app/api/alerts/process-pending/route.ts` | Worker para processar alertas pendentes (overdue + unblock) |

### MODIFICAR (8)

| Ficheiro | Alteração |
|----------|-----------|
| `components/templates/subtask-editor.tsx` | Integrar `AlertConfigEditor` nas opções avançadas |
| `components/templates/template-task-sheet.tsx` | Adicionar secção "Alertas da Tarefa" + estado `taskAlerts` |
| `components/templates/template-builder.tsx` | Propagar `_task_alerts` no save + carregar do initialData |
| `app/api/templates/route.ts` | Restaurar `config` com alerts no insert de tasks |
| `app/api/templates/[id]/route.ts` | Idem para PUT |
| `app/api/processes/[id]/tasks/[taskId]/route.ts` | Chamar alertService após complete/assign |
| `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts` | Chamar alertService após toggle |
| `lib/constants.ts` | Adicionar constantes ALERT_EVENT_LABELS, ALERT_CHANNEL_LABELS, etc. |
| `lib/notifications/types.ts` | Adicionar notification types: alert_on_complete, etc. |

### SQL (1 cron function)

| Acção | Via |
|-------|-----|
| Criar `check_overdue_subtasks_and_tasks()` + agendar cron | Supabase MCP `apply_migration` |

---

## 12. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Spam de alertas (muitas subtarefas completadas rápido) | `proc_alert_log` impede duplicados: max 1 alerta por entity+event por 24h |
| WhatsApp instance offline | Verificar `connection_status` antes de enviar; log `failed` no proc_alert_log |
| Edge Function `send-email` falhar | Log no `proc_alert_log` com status `failed`; não bloquear acção principal |
| Config JSONB complexo | UI simplificada com Collapsible; presets futuros ("Notificar consultor") |
| Alertas `on_overdue` e `on_unblock` atrasados (dependem do cron) | Cron corre cada hora — atraso máximo de 1h é aceitável para estes eventos |
| Templates existentes sem campo `alerts` | `alertConfig?.on_complete?.enabled` — acesso seguro com optional chaining; sem alerts = sem disparos |
