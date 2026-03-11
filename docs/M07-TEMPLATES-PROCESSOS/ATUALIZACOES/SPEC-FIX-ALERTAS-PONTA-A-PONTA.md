# SPEC — Fix Alertas Ponta-a-Ponta (Persistência + Triggers)

> **Data:** 2026-03-11
> **Referência:** SPEC-MULTICANAL-ALERTS.md (mesmo directório)
> **Objectivo:** Fechar os gaps que impedem o sistema de alertas multicanal de funcionar de ponta a ponta, **sem alterar** código do módulo de automações (M10).

---

## 1. Diagnóstico

A infraestrutura de alertas multicanal está implementada mas **desligada** em 3 pontos:

| # | Gap | Impacto |
|---|-----|---------|
| G1 | `_task_alerts` é enviado no payload mas **templates existentes** perderam os alertas porque o save anterior não incluía o campo `config` correctamente | Alertas configurados no editor desaparecem após reload |
| G2 | Ao carregar um template para edição, `config.alerts` é lido correctamente (L149 template-builder), porém o **save de subtasks** não propaga `config.alerts` das subtasks — o campo `st.config` no payload já inclui alertas, mas o backend precisa garantir passthrough | Subtask alerts podem perder-se no round-trip |
| G3 | Os eventos `on_overdue` e `on_unblock` **não têm trigger** — só `on_complete` e `on_assign` estão ligados nos route handlers | 2 dos 4 eventos nunca disparam |

### 1.1 O que já funciona

- **AlertService** (`lib/alerts/service.ts`) — envio por 3 canais (app, email, WhatsApp)
- **AlertConfigEditor** (`components/templates/alert-config-editor.tsx`) — UI completa
- **Triggers on_complete** em tasks (L344-362 de `tasks/[taskId]/route.ts`)
- **Triggers on_complete** em subtasks (L312-338 de `subtasks/[subtaskId]/route.ts`)
- **Trigger on_assign** em tasks (L364-375 de `tasks/[taskId]/route.ts`)
- **proc_alert_log** — tabela de logging funcional
- **Validação Zod** (`lib/validations/alert.ts`)
- **Types** (`types/alert.ts`)

### 1.2 Fronteira com Automações (M10) — NÃO TOCAR

| Recurso partilhado | Usado por Alertas | Usado por Automações | Acção |
|----|----|----|------|
| `auto_wpp_instances` | Leitura (buscar instância + token) | CRUD + conexão | Apenas leitura — sem alteração |
| Edge Function `send-email` | Invocação | Invocação | Sem alteração |
| `log_emails` | Insert | Insert | Sem alteração |
| `auto_delivery_log` | Não usa | Insert | Não tocar |
| `lib/node-processors/*` | Não usa | Core M10 | Não tocar |
| `app/api/automacao/*` | Não usa | Core M10 | Não tocar |

---

## 2. Alterações Necessárias

### 2.1 (G1) Garantir persistência de alertas no save de templates

**Ficheiro:** `app/api/templates/route.ts`

**Estado actual (L152-163):**
```typescript
const tasksToInsert = stage.tasks.map((task) => ({
  tpl_stage_id: insertedStage.id,
  title: task.title,
  // ...
  config: task.config || {},
  order_index: task.order_index,
}))
```

**Problema:** O frontend em `template-builder.tsx` (L463-465) envia:
```typescript
config: tasksData[taskId]._task_alerts
  ? { alerts: tasksData[taskId]._task_alerts }
  : undefined,
```

O backend recebe `task.config = { alerts: {...} }` e guarda-o com `task.config || {}`. Isto **funciona** para criação. Mas se `config` vier `undefined`, o `|| {}` aplica-se e os alertas perdem-se.

**Fix:** Nenhuma alteração necessária no POST. O fluxo de save já está correcto — o `{ alerts: ... }` passa pelo `config || {}`. Confirmar que o PUT (edição) tem o mesmo passthrough.

**Verificação necessária no PUT handler:** Garantir que ao editar um template, o campo `config` das tasks é **preservado** (merge, não overwrite). Se o PUT faz delete + re-insert de tasks, o config chega do frontend e é reinserido. Se faz UPDATE parcial, garantir que `config` não é omitido.

**Acção concreta:**
1. No PUT handler de `/api/templates/[id]`, confirmar que `config: task.config || {}` está presente no insert/upsert de `tpl_tasks`
2. No PUT handler, confirmar que subtasks também preservam `config` (que já contém `alerts` quando definido no `subtask-config-dialog`)

### 2.2 (G2) Garantir round-trip de alertas em subtasks

**Ficheiro:** `components/templates/template-builder.tsx` (L467-481)

**Estado actual:** O payload de subtasks envia `config: st.config` directamente. Como `st.config` é um objecto JSONB que pode conter `{ type, alerts, ... }`, o round-trip já está potencialmente correcto.

**Verificação:** Ao carregar template para edição, confirmar que `SubtaskData.config` é populado a partir de `tpl_subtasks.config` (que contém `alerts` quando configurado).

**Acção concreta:**
1. No carregamento do template (dentro do `useEffect` de `initialData` no `template-builder.tsx`), confirmar que `subtask.config` é passado tal como vem da API
2. No `subtask-config-dialog.tsx`, confirmar que `AlertConfigEditor` lê e escreve de/para `config.alerts`
3. No `SubtaskData` interface, garantir que `config` tem tipo `Record<string, unknown>` (ou similar) que acomoda `alerts`

### 2.3 (G3) Implementar trigger `on_overdue`

**Estratégia:** SQL function chamada por pg_cron (1x por hora) que insere alertas pendentes em `proc_alert_log`. O worker existente (`/api/alerts/process-pending`) processa-os.

**Porquê pg_cron e não route handler com cron externo?**
- O Supabase já tem pg_cron habilitado (usado em automações)
- Evita dependência de serviço externo para scheduling
- A detecção de overdue é uma query SQL pura

#### 2.3.1 SQL Function: `check_overdue_and_create_alerts()`

**Ficheiro:** Nova migration

```sql
-- Função para detectar tarefas/subtarefas vencidas e criar alertas pendentes
CREATE OR REPLACE FUNCTION check_overdue_and_create_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
BEGIN
  -- 1) Tarefas (proc_tasks) vencidas com alerta on_overdue configurado
  FOR r IN
    SELECT
      pt.id           AS entity_id,
      pt.title,
      pt.assigned_to,
      pi.id           AS proc_instance_id,
      pi.external_ref AS process_ref,
      pi.requested_by AS triggered_by,
      (pt.config->'alerts'->'on_overdue') AS alert_config
    FROM proc_tasks pt
    JOIN proc_instances pi ON pi.id = pt.proc_instance_id
    WHERE pt.status NOT IN ('completed', 'skipped', 'cancelled')
      AND pt.due_date IS NOT NULL
      AND pt.due_date < NOW()
      AND pi.current_status IN ('in_progress', 'approved')
      AND pt.config->'alerts'->'on_overdue'->>'enabled' = 'true'
      -- Não criar duplicado nas últimas 24h
      AND NOT EXISTS (
        SELECT 1 FROM proc_alert_log pal
        WHERE pal.entity_id = pt.id
          AND pal.entity_type = 'proc_task'
          AND pal.event_type = 'on_overdue'
          AND pal.created_at > NOW() - INTERVAL '24 hours'
      )
  LOOP
    INSERT INTO proc_alert_log (
      proc_instance_id, entity_type, entity_id, event_type,
      channel, status, metadata
    ) VALUES (
      r.proc_instance_id,
      'proc_task',
      r.entity_id,
      'on_overdue',
      'pending',  -- será processado pelo worker
      'pending',
      jsonb_build_object(
        'alert_config', r.alert_config,
        'title', r.title,
        'process_ref', r.process_ref,
        'triggered_by', COALESCE(r.triggered_by, '00000000-0000-0000-0000-000000000000'),
        'assigned_to', r.assigned_to
      )
    );
  END LOOP;

  -- 2) Subtarefas (proc_subtasks) vencidas com alerta on_overdue configurado
  FOR r IN
    SELECT
      ps.id           AS entity_id,
      ps.title,
      ps.assigned_to,
      pi.id           AS proc_instance_id,
      pi.external_ref AS process_ref,
      pi.requested_by AS triggered_by,
      (ps.config->'alerts'->'on_overdue') AS alert_config
    FROM proc_subtasks ps
    JOIN proc_tasks pt ON pt.id = ps.proc_task_id
    JOIN proc_instances pi ON pi.id = pt.proc_instance_id
    WHERE ps.is_completed = false
      AND ps.due_date IS NOT NULL
      AND ps.due_date < NOW()
      AND pi.current_status IN ('in_progress', 'approved')
      AND ps.config->'alerts'->'on_overdue'->>'enabled' = 'true'
      AND NOT EXISTS (
        SELECT 1 FROM proc_alert_log pal
        WHERE pal.entity_id = ps.id
          AND pal.entity_type = 'proc_subtask'
          AND pal.event_type = 'on_overdue'
          AND pal.created_at > NOW() - INTERVAL '24 hours'
      )
  LOOP
    INSERT INTO proc_alert_log (
      proc_instance_id, entity_type, entity_id, event_type,
      channel, status, metadata
    ) VALUES (
      r.proc_instance_id,
      'proc_subtask',
      r.entity_id,
      'on_overdue',
      'pending',
      'pending',
      jsonb_build_object(
        'alert_config', r.alert_config,
        'title', r.title,
        'process_ref', r.process_ref,
        'triggered_by', COALESCE(r.triggered_by, '00000000-0000-0000-0000-000000000000'),
        'assigned_to', r.assigned_to
      )
    );
  END LOOP;
END;
$$;

-- Agendar pg_cron a cada hora
SELECT cron.schedule(
  'check-overdue-alerts',
  '0 * * * *',  -- a cada hora, minuto 0
  $$SELECT check_overdue_and_create_alerts()$$
);
```

**Nota:** Esta função **não toca** nas tabelas/funções de automação. Usa apenas `proc_tasks`, `proc_subtasks`, `proc_instances`, `proc_alert_log`.

#### 2.3.2 Actualizar worker para processar alertas pendentes

**Ficheiro:** `app/api/alerts/process-pending/route.ts`

O worker existente já busca alertas com `status='pending'` e chama `alertService.processAlert()`. Precisa de uma pequena adaptação para extrair o `alert_config` do campo `metadata` (que é onde a SQL function o guarda).

**Acção concreta:** Verificar que o worker faz:
```typescript
const alertConfig = alert.metadata?.alert_config as AlertEventConfig
const context: AlertContext = {
  procInstanceId: alert.proc_instance_id,
  entityType: alert.entity_type,
  entityId: alert.entity_id,
  eventType: alert.event_type,
  title: alert.metadata?.title,
  processRef: alert.metadata?.process_ref,
  triggeredBy: alert.metadata?.triggered_by,
  assignedTo: alert.metadata?.assigned_to,
}
await alertService.processAlert(alertConfig, context)
```

Se o worker já faz isto, nenhuma alteração necessária.

### 2.4 (G3) Implementar trigger `on_unblock`

**Estratégia:** Quando uma tarefa é marcada como `completed`, verificar se existem tarefas dependentes (`dependency_task_id`) que ficam desbloqueadas e têm `on_unblock` configurado.

**Ficheiro a alterar:** `app/api/processes/[id]/tasks/[taskId]/route.ts`

**Localização:** Após o bloco de alertas existente (L344-379), adicionar:

```typescript
// --- Trigger on_unblock para tarefas dependentes ---
if (action === 'complete') {
  try {
    // Buscar tarefas que dependiam desta tarefa
    const { data: dependentTasks } = await supabase
      .from('proc_tasks')
      .select('id, title, config, assigned_to')
      .eq('proc_instance_id', id)
      .eq('dependency_task_id', task.tpl_task_id)  // referência ao template task
      .in('status', ['pending', 'blocked'])

    if (dependentTasks?.length) {
      const { alertService } = await import('@/lib/alerts/service')
      for (const depTask of dependentTasks) {
        const depConfig = (depTask.config as Record<string, any>)?.alerts?.on_unblock
        if (depConfig?.enabled) {
          await alertService.processAlert(depConfig, {
            procInstanceId: id,
            entityType: 'proc_task',
            entityId: depTask.id,
            eventType: 'on_unblock',
            title: depTask.title,
            processRef: procRef,
            triggeredBy: user.id,
            assignedTo: depTask.assigned_to,
          })
        }
      }
    }
  } catch (unblockError) {
    console.error('[TaskUpdate] Erro ao processar on_unblock:', unblockError)
  }
}
```

**Mesma lógica para subtasks:** No `subtasks/[subtaskId]/route.ts`, após completar uma subtask, verificar se existem subtasks dependentes com `on_unblock`.

```typescript
// --- Trigger on_unblock para subtarefas dependentes ---
if (is_completed) {
  try {
    const { data: dependentSubtasks } = await supabase
      .from('proc_subtasks')
      .select('id, title, config, assigned_to')
      .eq('proc_task_id', taskId)
      .eq('dependency_subtask_id', subtaskId)
      .eq('is_completed', false)

    if (dependentSubtasks?.length) {
      const { alertService } = await import('@/lib/alerts/service')
      const { data: proc } = await supabase
        .from('proc_instances')
        .select('external_ref')
        .eq('id', id)
        .single()

      for (const depSt of dependentSubtasks) {
        const depConfig = (depSt.config as Record<string, any>)?.alerts?.on_unblock
        if (depConfig?.enabled) {
          await alertService.processAlert(depConfig, {
            procInstanceId: id,
            entityType: 'proc_subtask',
            entityId: depSt.id,
            eventType: 'on_unblock',
            title: depSt.title,
            processRef: proc?.external_ref || '',
            triggeredBy: user.id,
            assignedTo: depSt.assigned_to,
          })
        }
      }
    }
  } catch (unblockError) {
    console.error('[SubtaskUpdate] Erro ao processar on_unblock:', unblockError)
  }
}
```

### 2.5 Trigger `on_assign` para subtasks (não implementado)

**Ficheiro:** `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts`

Actualmente o subtask route handler não dispara `on_assign`. Se a subtask tiver `assigned_to` e o `config.alerts.on_assign` estiver habilitado, disparar:

```typescript
// --- Trigger on_assign para subtarefas ---
if (assigned_to !== undefined) {
  try {
    const subtaskAlerts = (config as Record<string, any>)?.alerts
    if (subtaskAlerts?.on_assign?.enabled && assigned_to) {
      const { alertService } = await import('@/lib/alerts/service')
      const { data: proc } = await supabase
        .from('proc_instances')
        .select('external_ref')
        .eq('id', id)
        .single()

      await alertService.processAlert(subtaskAlerts.on_assign, {
        procInstanceId: id,
        entityType: 'proc_subtask',
        entityId: subtaskId,
        eventType: 'on_assign',
        title: (subtask as any).title,
        processRef: proc?.external_ref || '',
        triggeredBy: user.id,
        assignedTo: assigned_to,
      })
    }
  } catch (assignError) {
    console.error('[SubtaskUpdate] Erro ao processar on_assign:', assignError)
  }
}
```

---

## 3. Ficheiros a Alterar

| # | Ficheiro | Tipo | Descrição |
|---|----------|------|-----------|
| 1 | `app/api/templates/route.ts` | Verificação | Confirmar que PUT handler preserva `config` com `alerts` em tasks e subtasks |
| 2 | `app/api/processes/[id]/tasks/[taskId]/route.ts` | Adição | Adicionar trigger `on_unblock` após `on_complete` (L379+) |
| 3 | `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/route.ts` | Adição | Adicionar triggers `on_assign` e `on_unblock` |
| 4 | `app/api/alerts/process-pending/route.ts` | Verificação | Confirmar que extrai `alert_config` de `metadata` correctamente |
| 5 | Nova migration SQL | Criação | Função `check_overdue_and_create_alerts()` + pg_cron schedule |

### Ficheiros que NÃO devem ser alterados

| Ficheiro | Razão |
|----------|-------|
| `lib/alerts/service.ts` | Já funcional — nenhuma alteração |
| `components/templates/alert-config-editor.tsx` | UI completa — nenhuma alteração |
| `components/templates/template-task-sheet.tsx` | Já passa `_task_alerts` — nenhuma alteração |
| `components/templates/template-builder.tsx` | Já monta payload correcto (L463-465) — nenhuma alteração |
| `components/templates/subtask-config-dialog.tsx` | Já integra AlertConfigEditor — nenhuma alteração |
| `types/alert.ts` | Types completos — nenhuma alteração |
| `lib/validations/alert.ts` | Schemas completos — nenhuma alteração |
| `lib/constants.ts` | Labels completas — nenhuma alteração |
| `lib/node-processors/*` | Módulo automações (M10) — NÃO TOCAR |
| `app/api/automacao/*` | Módulo automações (M10) — NÃO TOCAR |

---

## 4. Fluxo Completo Após Fix

```
                    ┌─────────────────────────────┐
                    │  TEMPLATE BUILDER (Frontend) │
                    │  AlertConfigEditor por task  │
                    │  e por subtask               │
                    └──────────┬──────────────────┘
                               │ POST/PUT /api/templates
                               │ config: { alerts: { on_complete, on_assign, on_overdue, on_unblock } }
                               ▼
                    ┌─────────────────────────────┐
                    │  tpl_tasks.config.alerts     │
                    │  tpl_subtasks.config.alerts  │
                    │  (JSONB no Supabase)         │
                    └──────────┬──────────────────┘
                               │ populate_process_tasks() trigger
                               │ (copia config do template para instância)
                               ▼
                    ┌─────────────────────────────┐
                    │  proc_tasks.config.alerts    │
                    │  proc_subtasks.config.alerts │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐
     │ on_complete   │ │ on_assign    │ │ on_overdue           │
     │ on_unblock    │ │              │ │                      │
     │               │ │              │ │                      │
     │ Trigger:      │ │ Trigger:     │ │ Trigger:             │
     │ Route handler │ │ Route handler│ │ pg_cron (1x/hora)    │
     │ (síncrono)    │ │ (síncrono)   │ │ → proc_alert_log     │
     │               │ │              │ │ → worker async        │
     └──────┬───────┘ └──────┬───────┘ └──────────┬───────────┘
            │                │                     │
            └────────────────┼─────────────────────┘
                             ▼
                  ┌─────────────────────┐
                  │   AlertService      │
                  │   .processAlert()   │
                  └──────┬──────────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
     ┌────────────┐ ┌─────────┐ ┌──────────┐
     │ In-App     │ │ Email   │ │ WhatsApp │
     │ Notif.     │ │ (Resend)│ │ (Uazapi) │
     └────────────┘ └─────────┘ └──────────┘
            │            │            │
            └────────────┼────────────┘
                         ▼
                  ┌─────────────────────┐
                  │  proc_alert_log     │
                  │  (status: sent/fail)│
                  └─────────────────────┘
```

---

## 5. Ordem de Implementação

| Passo | Acção | Risco |
|-------|-------|-------|
| 1 | Verificar PUT `/api/templates/[id]` — confirmar passthrough de `config` em tasks e subtasks | Baixo — leitura |
| 2 | Adicionar `on_unblock` no task route handler | Baixo — código aditivo, wrapped em try/catch |
| 3 | Adicionar `on_assign` + `on_unblock` no subtask route handler | Baixo — código aditivo, wrapped em try/catch |
| 4 | Verificar worker `process-pending` extrai metadata correctamente | Baixo — leitura |
| 5 | Criar migration com `check_overdue_and_create_alerts()` + pg_cron | Médio — SQL, testar em branch primeiro |
| 6 | Teste E2E: criar template com alertas → aprovar processo → completar task → verificar notificação | — |

---

## 6. Testes de Validação

### 6.1 Persistência (G1 + G2)
1. Criar template com alerta `on_complete` (email habilitado) numa task
2. Guardar template
3. Reabrir template para edição
4. **Esperado:** alerta `on_complete` com email habilitado aparece no AlertConfigEditor
5. Repetir para subtask

### 6.2 Trigger on_complete (já funciona — regressão)
1. Aprovar processo com template que tem `on_complete` habilitado
2. Completar a task
3. **Esperado:** notificação in-app + email enviado + registo em `proc_alert_log`

### 6.3 Trigger on_assign (task + subtask)
1. Template com `on_assign` habilitado (notificação in-app)
2. Aprovar processo → atribuir task a consultor
3. **Esperado:** consultor recebe notificação

### 6.4 Trigger on_unblock
1. Template com 2 tasks: Task A → Task B (B depende de A), B tem `on_unblock`
2. Aprovar processo → completar Task A
3. **Esperado:** alerta dispara para responsável de Task B

### 6.5 Trigger on_overdue
1. Template com task com `sla_days: 1` e `on_overdue` habilitado
2. Aprovar processo → não completar task → esperar pg_cron (ou chamar worker manualmente)
3. **Esperado:** registo em `proc_alert_log` com status `pending` → worker processa → alerta enviado

---

## 7. Fixes Adicionais (Detectados em Teste — 2026-03-11)

Durante o teste E2E, foram detectados e corrigidos 4 problemas adicionais no `lib/alerts/service.ts`:

### 7.1 Email enviado para endereço errado

**Problema:** `sendEmails()` buscava `professional_email` de `dev_users`, que pode não ter caixa de entrada activa.
**Fix:** Alterado para usar `supabase.auth.admin.getUserById()` para obter o email de cadastro (auth.users.email).

### 7.2 Notificação in-app não criada quando destinatário = remetente

**Problema:** `notificationService.createBatch()` filtra `recipientIds` excluindo o `senderId`. No caso de alertas, o `triggeredBy` (quem completou a tarefa) pode ser o próprio destinatário (tipo "consultant").
**Fix:** Alterado `senderId` para `null` no `sendNotifications()`, evitando o filtro de auto-exclusão.

### 7.3 WhatsApp — formato de API errado

**Problema:** O AlertService usava endpoint `/sendText/{token}` com body `{ phone, message }`, mas a API UAZAPI espera `/send/text` com header `token` e body `{ number, text, delay, readchat }`.
**Fix:** Alinhado com o formato usado pelo módulo de automação (`lib/node-processors/whatsapp.ts`):
- Endpoint: `/send/text`
- Auth: header `token: instance.uazapi_token`
- Body: `{ number, text, delay: 2, readchat: true, track_source: 'erp_infinity_alerts' }`

### 7.4 WhatsApp — status "sent" sem verificar resposta

**Problema:** `logAlert('sent')` executava incondicionalmente, mesmo se o fetch falhasse silenciosamente.
**Fix:** Adicionado log da resposta UAZAPI e verificação de `!res.ok` para marcar como `failed`.

### 7.5 Parent task on_complete via subtask completion

**Problema:** Quando todas as subtarefas mandatórias completam, o subtask route handler transita a task-pai para `completed` directamente (sem passar pelo task PUT handler). O trigger `on_complete` da task-pai nunca disparava.
**Fix:** Adicionado trigger `on_complete` da task-pai no subtask route handler, após a transição automática de status.

---

## 8. Notas de Segurança

- Todos os triggers usam **try/catch isolado** — falha num alerta nunca impede a operação principal (save de task/subtask)
- Prevenção de duplicados: query `NOT EXISTS` na SQL function com janela de 24h
- AlertService usa `supabaseAdmin` (service role) — sem problemas de RLS
- WhatsApp: verifica `connection_status = 'connected'` antes de enviar
- Email: fallback para sender padrão se `sender_id` não existir
