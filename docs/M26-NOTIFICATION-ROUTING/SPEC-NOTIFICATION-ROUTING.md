# SPEC — Sistema de Routing Dinâmico de Notificações

**Data:** 2026-04-02
**Módulo:** M26
**Depende de:** Sistema de notificações existente (M07), Roles (M01), AlertService

---

## 1. Problema

Actualmente, o destinatário das notificações é definido em código:

```typescript
// lib/auth/roles.ts
export const APPROVER_NOTIFICATION_ROLES = ['Broker/CEO', 'Gestor Processual'] as const
```

```typescript
// Nos route handlers:
const approverIds = await notificationService.getUserIdsByRoles([...APPROVER_NOTIFICATION_ROLES])
```

**Limitações:**
- Para mudar quem recebe notificações, é preciso alterar código e fazer deploy
- Não é possível atribuir notificações a pessoas específicas dentro de um role (ex: "só a Maria do recrutamento")
- Não há granularidade por evento — todos os aprovadores recebem todas as notificações de aprovação
- Não há forma de configurar o canal (in-app, email, WhatsApp) por evento

---

## 2. Solução: `notification_routing_rules`

Uma tabela de **regras de routing** configuráveis via UI em Definições. Cada regra mapeia um **evento** a **destinatários** (por role, por pessoa, ou dinâmico) e **canais**.

### 2.1 Tabela `notification_routing_rules`

```sql
CREATE TABLE notification_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação do evento
  event_key TEXT NOT NULL,               -- ex: 'recruitment.new_candidate'
  module TEXT NOT NULL,                   -- ex: 'recruitment'
  label TEXT NOT NULL,                    -- ex: 'Novo candidato adicionado'
  description TEXT,                       -- Descrição detalhada do evento

  -- Destinatário
  recipient_type TEXT NOT NULL            -- 'role' | 'user' | 'assigned_agent' | 'entity_owner'
    CHECK (recipient_type IN ('role', 'user', 'assigned_agent', 'entity_owner')),
  recipient_role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES dev_users(id) ON DELETE CASCADE,

  -- Canais
  channel_in_app BOOLEAN NOT NULL DEFAULT true,
  channel_email BOOLEAN NOT NULL DEFAULT false,
  channel_whatsapp BOOLEAN NOT NULL DEFAULT false,

  -- Estado
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,   -- Para ordenação na UI

  -- Auditoria
  created_by UUID REFERENCES dev_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT chk_recipient_role CHECK (
    recipient_type != 'role' OR recipient_role_id IS NOT NULL
  ),
  CONSTRAINT chk_recipient_user CHECK (
    recipient_type != 'user' OR recipient_user_id IS NOT NULL
  )
);

CREATE INDEX idx_nrr_event_key ON notification_routing_rules(event_key) WHERE is_active = true;
CREATE INDEX idx_nrr_module ON notification_routing_rules(module) WHERE is_active = true;
```

### 2.2 Como funciona

| Cenário | recipient_type | recipient_role_id | recipient_user_id |
|---------|---------------|-------------------|-------------------|
| Todos os recrutadores recebem | `role` | `<id role recrutador>` | NULL |
| Só a Maria recebe | `user` | NULL | `<id Maria>` |
| Maria + João recebem | 2 linhas `user` | NULL | cada user_id |
| Quem está atribuído ao negócio | `assigned_agent` | NULL | NULL |
| Consultor dono do imóvel | `entity_owner` | NULL | NULL |

**Múltiplas linhas por event_key = múltiplos destinatários.** Para adicionar alguém, criar nova linha. Para remover, desactivar ou apagar.

### 2.3 Recipient Types

| Tipo | Descrição | Resolução |
|------|-----------|-----------|
| `role` | Todos os utilizadores activos com esse role | `dev_users JOIN user_roles WHERE role_id = X AND is_active = true` |
| `user` | Um utilizador específico | Directo via `recipient_user_id` |
| `assigned_agent` | O consultor atribuído à entidade (lead, negócio, imóvel) | Resolvido em runtime a partir da entidade |
| `entity_owner` | O "dono" da entidade (ex: quem criou o processo) | Resolvido em runtime a partir da entidade |

---

## 3. Catálogo de Eventos

Todos os eventos possíveis, agrupados por módulo. Cada evento é uma seed na tabela (com regras default).

### 3.1 Recrutamento

| event_key | label | Destinatário default |
|-----------|-------|---------------------|
| `recruitment.new_candidate` | Novo candidato adicionado | role: Recrutador |
| `recruitment.stage_change` | Candidato mudou de fase | role: Recrutador |
| `recruitment.interview_scheduled` | Entrevista agendada | role: Recrutador + assigned_agent |
| `recruitment.candidate_hired` | Candidato contratado | role: Broker/CEO |

### 3.2 Pipeline (CRM)

| event_key | label | Destinatário default |
|-----------|-------|---------------------|
| `pipeline.new_negocio` | Novo negócio criado | assigned_agent |
| `pipeline.stage_change` | Negócio mudou de fase | assigned_agent |
| `pipeline.won` | Negócio ganho | role: Broker/CEO + assigned_agent |
| `pipeline.lost` | Negócio perdido | role: Broker/CEO + assigned_agent |
| `pipeline.sla_warning` | SLA próximo de expirar | assigned_agent |
| `pipeline.sla_breach` | SLA expirado | role: Broker/CEO + assigned_agent |

### 3.3 Leads

| event_key | label | Destinatário default |
|-----------|-------|---------------------|
| `leads.new_lead` | Novo lead recebido | role: Broker/CEO |
| `leads.assigned` | Lead atribuído a consultor | assigned_agent |
| `leads.qualified` | Lead qualificado | role: Broker/CEO |

### 3.4 Processos

| event_key | label | Destinatário default |
|-----------|-------|---------------------|
| `processes.created` | Processo criado | role: Gestor Processual |
| `processes.approved` | Processo aprovado | entity_owner |
| `processes.rejected` | Processo rejeitado | entity_owner |
| `processes.returned` | Processo devolvido | entity_owner |
| `processes.task_assigned` | Tarefa atribuída | assigned_agent |
| `processes.task_completed` | Tarefa concluída | role: Gestor Processual |
| `processes.task_overdue` | Tarefa em atraso | role: Gestor Processual + assigned_agent |

### 3.5 Imóveis

| event_key | label | Destinatário default |
|-----------|-------|---------------------|
| `properties.new` | Novo imóvel criado | role: Broker/CEO |
| `properties.status_change` | Estado do imóvel alterado | entity_owner |
| `properties.price_change` | Preço do imóvel alterado | role: Broker/CEO |

### 3.6 Crédito

| event_key | label | Destinatário default |
|-----------|-------|---------------------|
| `credit.new_request` | Novo pedido de crédito | role: Intermediário de Crédito |
| `credit.status_update` | Actualização de estado | assigned_agent + entity_owner |

### 3.7 Loja (Store)

| event_key | label | Destinatário default |
|-----------|-------|---------------------|
| `store.new_order` | Nova encomenda | role: Office Manager |
| `store.order_shipped` | Encomenda enviada | entity_owner |

### 3.8 Formações

| event_key | label | Destinatário default |
|-----------|-------|---------------------|
| `training.new_session` | Nova formação agendada | role: Consultor (todos) |
| `training.reminder` | Lembrete de formação | assigned_agent |

### 3.9 Financeiro

| event_key | label | Destinatário default |
|-----------|-------|---------------------|
| `financial.commission_ready` | Comissão pronta para pagamento | assigned_agent |
| `financial.payment_processed` | Pagamento processado | assigned_agent |

---

## 4. Serviço de Routing: `NotificationRouter`

### 4.1 Ficheiro: `lib/notifications/router.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { notificationService } from './service'

interface RoutingContext {
  eventKey: string
  entityId: string
  entityType: string
  // Campos opcionais para resolução dinâmica
  assignedAgentId?: string | null
  entityOwnerId?: string | null
  // Para a notificação
  title: string
  body?: string
  actionUrl: string
  senderId?: string | null
  metadata?: Record<string, unknown>
}

class NotificationRouter {
  /**
   * Ponto de entrada principal.
   * Dado um evento, resolve as regras activas e cria notificações.
   */
  async dispatch(context: RoutingContext): Promise<void> {
    const supabase = createAdminClient()

    // 1. Buscar regras activas para este evento
    const { data: rules, error } = await supabase
      .from('notification_routing_rules')
      .select('*')
      .eq('event_key', context.eventKey)
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (error || !rules || rules.length === 0) return

    // 2. Resolver destinatários de cada regra
    const allRecipientIds = new Set<string>()
    const emailRecipientIds = new Set<string>()
    const whatsappRecipientIds = new Set<string>()

    for (const rule of rules) {
      const ids = await this.resolveRecipients(rule, context)

      for (const id of ids) {
        if (rule.channel_in_app) allRecipientIds.add(id)
        if (rule.channel_email) emailRecipientIds.add(id)
        if (rule.channel_whatsapp) whatsappRecipientIds.add(id)
      }
    }

    // 3. Enviar notificações in-app
    if (allRecipientIds.size > 0) {
      await notificationService.createBatch(
        [...allRecipientIds],
        {
          senderId: context.senderId,
          notificationType: context.eventKey as any,
          entityType: context.entityType as any,
          entityId: context.entityId,
          title: context.title,
          body: context.body,
          actionUrl: context.actionUrl,
          metadata: {
            ...context.metadata,
            routed_event: context.eventKey,
          },
        }
      )
    }

    // 4. Email + WhatsApp (via canais existentes)
    // ... usar edge functions ou serviços existentes
  }

  private async resolveRecipients(
    rule: any,
    context: RoutingContext
  ): Promise<string[]> {
    switch (rule.recipient_type) {
      case 'user':
        return rule.recipient_user_id ? [rule.recipient_user_id] : []

      case 'role':
        if (!rule.recipient_role_id) return []
        return notificationService.getUserIdsByRoleId(rule.recipient_role_id)

      case 'assigned_agent':
        return context.assignedAgentId ? [context.assignedAgentId] : []

      case 'entity_owner':
        return context.entityOwnerId ? [context.entityOwnerId] : []

      default:
        return []
    }
  }
}

export const notificationRouter = new NotificationRouter()
```

### 4.2 Uso nos Route Handlers

**Antes (hardcoded):**
```typescript
const approverIds = await notificationService.getUserIdsByRoles([...APPROVER_NOTIFICATION_ROLES])
await notificationService.createBatch(approverIds, { ... })
```

**Depois (dinâmico):**
```typescript
await notificationRouter.dispatch({
  eventKey: 'processes.created',
  entityId: proc.id,
  entityType: 'proc_instance',
  entityOwnerId: proc.requested_by,
  title: `Novo processo criado: ${proc.external_ref}`,
  actionUrl: `/dashboard/processos/${proc.id}`,
  senderId: user.id,
})
```

O router consulta `notification_routing_rules` para saber quem recebe e em que canal. Sem alterar código nunca mais.

---

## 5. Método auxiliar: `getUserIdsByRoleId`

Adicionar ao `NotificationService`:

```typescript
/** Buscar IDs de utilizadores com um role específico (por role.id, não nome) */
async getUserIdsByRoleId(roleId: string): Promise<string[]> {
  const { data, error } = await this.supabase
    .from('user_roles')
    .select('user_id')
    .eq('role_id', roleId)

  if (error || !data) return []

  // Filtrar apenas utilizadores activos
  const userIds = data.map((ur: any) => ur.user_id)
  const { data: activeUsers } = await this.supabase
    .from('dev_users')
    .select('id')
    .in('id', userIds)
    .eq('is_active', true)

  return activeUsers?.map((u: any) => u.id) || []
}
```

---

## 6. UI — Definições > Notificações (nova tab)

### 6.1 Localização

Adicionar tab **"Notificações"** na página de Definições (`app/dashboard/definicoes/page.tsx`), ao lado de Roles, Financeiro e Integrações.

### 6.2 Layout da Tab

```
┌────────────────────────────────────────────────────────────┐
│  [Filtro por módulo ▼]   [Pesquisar evento...]   [+ Regra] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ── Recrutamento ──────────────────────────────────────    │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Novo candidato adicionado                           │   │
│  │ recruitment.new_candidate                           │   │
│  │                                                     │   │
│  │ Destinatários:                                      │   │
│  │  [Role: Recrutador]  [Maria Silva ×]  [+ Adicionar] │   │
│  │                                                     │   │
│  │ Canais: [✓ App] [✓ Email] [  WhatsApp]             │   │
│  │                                                     │   │
│  │ [Activo ●]                            [Editar] [×]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Candidato mudou de fase                             │   │
│  │ ...                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  ── Pipeline ──────────────────────────────────────────    │
│  ...                                                       │
└────────────────────────────────────────────────────────────┘
```

### 6.3 Dialog de Adicionar/Editar Regra

```
┌─────────────────────────────────────────┐
│  Adicionar Regra de Notificação         │
├─────────────────────────────────────────┤
│                                         │
│  Evento:       [Select ▼]              │
│                                         │
│  Tipo destino: (●) Role                │
│                ( ) Pessoa específica    │
│                ( ) Agente atribuído     │
│                ( ) Dono da entidade     │
│                                         │
│  Role:         [Select ▼]  (se role)   │
│  Pessoa:       [Search... ] (se user)  │
│                                         │
│  Canais:                                │
│  [✓] Notificação in-app                │
│  [ ] Email                              │
│  [ ] WhatsApp                           │
│                                         │
│            [Cancelar]  [Guardar]        │
└─────────────────────────────────────────┘
```

### 6.4 Componentes

| Componente | Ficheiro | Responsabilidade |
|-----------|---------|-----------------|
| `NotificationRoutingTab` | `components/settings/notification-routing-tab.tsx` | Tab principal com listagem |
| `NotificationRuleCard` | `components/settings/notification-rule-card.tsx` | Card de cada regra |
| `NotificationRuleDialog` | `components/settings/notification-rule-dialog.tsx` | Dialog criar/editar |

---

## 7. API Routes

### 7.1 `GET /api/notification-rules`

Listar todas as regras agrupadas por módulo.

```typescript
// Query
const { data } = await supabase
  .from('notification_routing_rules')
  .select(`
    *,
    recipient_role:roles(id, name),
    recipient_user:dev_users(id, commercial_name)
  `)
  .order('module')
  .order('event_key')
  .order('priority')
```

**Response:** Array de regras com joins.

### 7.2 `POST /api/notification-rules`

Criar nova regra.

**Body:**
```json
{
  "event_key": "recruitment.new_candidate",
  "module": "recruitment",
  "label": "Novo candidato adicionado",
  "recipient_type": "user",
  "recipient_user_id": "uuid-maria",
  "channel_in_app": true,
  "channel_email": true,
  "channel_whatsapp": false
}
```

### 7.3 `PUT /api/notification-rules/[id]`

Editar regra existente (canais, activar/desactivar, mudar destinatário).

### 7.4 `DELETE /api/notification-rules/[id]`

Eliminar regra.

---

## 8. Seed de Regras Default

Na migração, inserir regras default para todos os eventos do catálogo (secção 3). Isto garante que o sistema funciona out-of-the-box com defaults sensatos, e os admins podem ajustar depois.

```sql
-- Exemplo: recruitment defaults
INSERT INTO notification_routing_rules (event_key, module, label, recipient_type, recipient_role_id, channel_in_app)
SELECT
  'recruitment.new_candidate',
  'recruitment',
  'Novo candidato adicionado',
  'role',
  r.id,
  true
FROM roles r WHERE r.name = 'Recrutador';
```

---

## 9. Migração para Router

### 9.1 Plano de Transição

1. Criar tabela + seed defaults
2. Implementar `NotificationRouter`
3. Adicionar `getUserIdsByRoleId` ao `NotificationService`
4. Criar API routes + UI settings
5. **Gradualmente** substituir chamadas hardcoded por `notificationRouter.dispatch()`
6. Manter retrocompatibilidade — `NotificationService.create()` continua a funcionar

### 9.2 Ficheiros a Modificar

| Ficheiro | Alteração |
|---------|-----------|
| `lib/notifications/service.ts` | Adicionar `getUserIdsByRoleId()` |
| `lib/notifications/router.ts` | **NOVO** — NotificationRouter |
| `lib/notifications/events.ts` | **NOVO** — Catálogo de event_keys (constantes) |
| `app/api/notification-rules/route.ts` | **NOVO** — CRUD regras |
| `app/api/notification-rules/[id]/route.ts` | **NOVO** — PUT/DELETE |
| `components/settings/notification-routing-tab.tsx` | **NOVO** — Tab UI |
| `components/settings/notification-rule-card.tsx` | **NOVO** — Card regra |
| `components/settings/notification-rule-dialog.tsx` | **NOVO** — Dialog |
| `app/dashboard/definicoes/page.tsx` | Adicionar tab "Notificações" |
| Route handlers (graduais) | Trocar hardcoded por `notificationRouter.dispatch()` |

### 9.3 Constantes Hardcoded a Remover (Gradualmente)

```typescript
// lib/auth/roles.ts — estas constantes ficam obsoletas:
APPROVER_NOTIFICATION_ROLES  // → substituído por regras 'processes.*'
```

Não remover imediatamente — manter até todos os callsites usarem o router.

---

## 10. SQL Completo da Migração

```sql
-- =============================================================================
-- Migration: notification_routing_rules
-- Sistema dinâmico de routing de notificações
-- =============================================================================

BEGIN;

-- 1. Tabela principal
CREATE TABLE IF NOT EXISTS notification_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL,
  module TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  recipient_type TEXT NOT NULL
    CHECK (recipient_type IN ('role', 'user', 'assigned_agent', 'entity_owner')),
  recipient_role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES dev_users(id) ON DELETE CASCADE,
  channel_in_app BOOLEAN NOT NULL DEFAULT true,
  channel_email BOOLEAN NOT NULL DEFAULT false,
  channel_whatsapp BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES dev_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_recipient_role CHECK (
    recipient_type != 'role' OR recipient_role_id IS NOT NULL
  ),
  CONSTRAINT chk_recipient_user CHECK (
    recipient_type != 'user' OR recipient_user_id IS NOT NULL
  )
);

-- 2. Índices
CREATE INDEX idx_nrr_event_active ON notification_routing_rules(event_key) WHERE is_active = true;
CREATE INDEX idx_nrr_module ON notification_routing_rules(module) WHERE is_active = true;

-- 3. Trigger updated_at
CREATE OR REPLACE FUNCTION trg_nrr_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notification_routing_rules_updated
  BEFORE UPDATE ON notification_routing_rules
  FOR EACH ROW EXECUTE FUNCTION trg_nrr_updated_at();

-- 4. RLS
ALTER TABLE notification_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerir regras de notificação"
  ON notification_routing_rules FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Seed defaults (usando subqueries para roles)
-- Recrutamento
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('recruitment.new_candidate', 'recruitment', 'Novo candidato adicionado', 'Quando um novo candidato é adicionado ao recrutamento', 'role', (SELECT id FROM roles WHERE name = 'Recrutador' LIMIT 1), true),
  ('recruitment.stage_change', 'recruitment', 'Candidato mudou de fase', 'Quando um candidato avança ou recua de fase no recrutamento', 'role', (SELECT id FROM roles WHERE name = 'Recrutador' LIMIT 1), true),
  ('recruitment.candidate_hired', 'recruitment', 'Candidato contratado', 'Quando um candidato é marcado como contratado', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true);

-- Pipeline
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('pipeline.new_negocio', 'pipeline', 'Novo negócio criado', 'Quando um novo negócio é criado no pipeline', 'assigned_agent', true),
  ('pipeline.stage_change', 'pipeline', 'Negócio mudou de fase', 'Quando um negócio avança ou recua de fase', 'assigned_agent', true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('pipeline.won', 'pipeline', 'Negócio ganho', 'Quando um negócio é marcado como ganho', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true),
  ('pipeline.lost', 'pipeline', 'Negócio perdido', 'Quando um negócio é marcado como perdido', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true),
  ('pipeline.sla_warning', 'pipeline', 'SLA próximo de expirar', 'Quando o SLA de um negócio está prestes a expirar', 'assigned_agent', NULL, true),
  ('pipeline.sla_breach', 'pipeline', 'SLA expirado', 'Quando o SLA de um negócio expirou', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true);

-- Leads
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('leads.new_lead', 'leads', 'Novo lead recebido', 'Quando um novo lead entra no sistema', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('leads.assigned', 'leads', 'Lead atribuído', 'Quando um lead é atribuído a um consultor', 'assigned_agent', true);

-- Processos
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('processes.created', 'processes', 'Processo criado', 'Quando um novo processo é criado', 'role', (SELECT id FROM roles WHERE name = 'Gestor Processual' LIMIT 1), true),
  ('processes.task_completed', 'processes', 'Tarefa concluída', 'Quando uma tarefa de processo é concluída', 'role', (SELECT id FROM roles WHERE name = 'Gestor Processual' LIMIT 1), true),
  ('processes.task_overdue', 'processes', 'Tarefa em atraso', 'Quando uma tarefa de processo passa do prazo', 'role', (SELECT id FROM roles WHERE name = 'Gestor Processual' LIMIT 1), true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('processes.approved', 'processes', 'Processo aprovado', 'Quando um processo é aprovado', 'entity_owner', true),
  ('processes.rejected', 'processes', 'Processo rejeitado', 'Quando um processo é rejeitado', 'entity_owner', true),
  ('processes.returned', 'processes', 'Processo devolvido', 'Quando um processo é devolvido para correcção', 'entity_owner', true),
  ('processes.task_assigned', 'processes', 'Tarefa atribuída', 'Quando uma tarefa é atribuída a um consultor', 'assigned_agent', true);

-- Imóveis
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('properties.new', 'properties', 'Novo imóvel criado', 'Quando um novo imóvel é adicionado ao sistema', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true),
  ('properties.price_change', 'properties', 'Preço alterado', 'Quando o preço de um imóvel é alterado', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('properties.status_change', 'properties', 'Estado alterado', 'Quando o estado de um imóvel muda', 'entity_owner', true);

-- Crédito
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('credit.new_request', 'credit', 'Novo pedido de crédito', 'Quando um novo pedido de crédito é criado', 'role', (SELECT id FROM roles WHERE name = 'Intermediário de Crédito' LIMIT 1), true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('credit.status_update', 'credit', 'Actualização de crédito', 'Quando o estado de um pedido de crédito muda', 'assigned_agent', true);

-- Loja
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('store.new_order', 'store', 'Nova encomenda', 'Quando uma nova encomenda é feita na loja', 'role', (SELECT id FROM roles WHERE name = 'Office Manager' LIMIT 1), true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('store.order_shipped', 'store', 'Encomenda enviada', 'Quando uma encomenda é marcada como enviada', 'entity_owner', true);

-- Formações
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('training.new_session', 'training', 'Nova formação agendada', 'Quando uma nova sessão de formação é criada', 'role', (SELECT id FROM roles WHERE name = 'Consultor' LIMIT 1), true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('training.reminder', 'training', 'Lembrete de formação', 'Lembrete antes do início da formação', 'assigned_agent', true);

-- Financeiro
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('financial.commission_ready', 'financial', 'Comissão pronta', 'Quando uma comissão está pronta para pagamento', 'assigned_agent', true),
  ('financial.payment_processed', 'financial', 'Pagamento processado', 'Quando um pagamento é processado', 'assigned_agent', true);

COMMIT;
```

---

## 11. Exemplo Real: Recrutamento

### Cenário inicial
- Role "Recrutador" tem 1 pessoa (Ana)
- Regra default: `recruitment.new_candidate → role: Recrutador`
- Ana recebe todas as notificações

### Cenário futuro: Maria junta-se ao recrutamento
- Maria recebe o role "Recrutador"
- Automaticamente recebe notificações (é role-based)
- **Não é preciso alterar nada**

### Cenário futuro: Só Maria deve receber (não Ana)
- Admin vai a Definições > Notificações
- Desactiva a regra `role: Recrutador` para `recruitment.new_candidate`
- Cria nova regra: `recruitment.new_candidate → user: Maria`
- Agora só Maria recebe

### Cenário futuro: Maria + João, mas não Ana
- Cria 2 regras `user`: Maria e João
- Mantém a regra `role: Recrutador` desactivada
