-- =============================================================================
-- Migration: notification_routing_rules
-- Sistema dinamico de routing de notificacoes
-- Permite configurar via UI quem recebe cada tipo de notificacao e em que canal
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

-- 2. Indices
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

CREATE POLICY "Authenticated users can read notification rules"
  ON notification_routing_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage notification rules"
  ON notification_routing_rules FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Seed defaults

-- Recrutamento
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('recruitment.new_candidate', 'recruitment', 'Novo candidato adicionado', 'Quando um novo candidato e adicionado ao recrutamento', 'role', (SELECT id FROM roles WHERE name = 'Recrutador' LIMIT 1), true),
  ('recruitment.stage_change', 'recruitment', 'Candidato mudou de fase', 'Quando um candidato avanca ou recua de fase no recrutamento', 'role', (SELECT id FROM roles WHERE name = 'Recrutador' LIMIT 1), true),
  ('recruitment.candidate_hired', 'recruitment', 'Candidato contratado', 'Quando um candidato e marcado como contratado', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true);

-- Pipeline
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('pipeline.new_negocio', 'pipeline', 'Novo negocio criado', 'Quando um novo negocio e criado no pipeline', 'assigned_agent', true),
  ('pipeline.stage_change', 'pipeline', 'Negocio mudou de fase', 'Quando um negocio avanca ou recua de fase', 'assigned_agent', true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('pipeline.won', 'pipeline', 'Negocio ganho', 'Quando um negocio e marcado como ganho', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true),
  ('pipeline.lost', 'pipeline', 'Negocio perdido', 'Quando um negocio e marcado como perdido', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('pipeline.sla_warning', 'pipeline', 'SLA proximo de expirar', 'Quando o SLA de um negocio esta prestes a expirar', 'assigned_agent', true),
  ('pipeline.sla_breach', 'pipeline', 'SLA expirado', 'Quando o SLA de um negocio expirou', 'assigned_agent', true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('pipeline.sla_breach', 'pipeline', 'SLA expirado (gestor)', 'Quando o SLA de um negocio expirou — notificar gestao', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true);

-- Leads
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('leads.new_lead', 'leads', 'Novo lead recebido', 'Quando um novo lead entra no sistema', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('leads.assigned', 'leads', 'Lead atribuido', 'Quando um lead e atribuido a um consultor', 'assigned_agent', true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('leads.qualified', 'leads', 'Lead qualificado', 'Quando um lead e qualificado', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true);

-- Processos
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('processes.created', 'processes', 'Processo criado', 'Quando um novo processo e criado', 'role', (SELECT id FROM roles WHERE name = 'Gestor Processual' LIMIT 1), true),
  ('processes.task_completed', 'processes', 'Tarefa concluida', 'Quando uma tarefa de processo e concluida', 'role', (SELECT id FROM roles WHERE name = 'Gestor Processual' LIMIT 1), true),
  ('processes.task_overdue', 'processes', 'Tarefa em atraso', 'Quando uma tarefa de processo passa do prazo', 'role', (SELECT id FROM roles WHERE name = 'Gestor Processual' LIMIT 1), true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('processes.approved', 'processes', 'Processo aprovado', 'Quando um processo e aprovado', 'entity_owner', true),
  ('processes.rejected', 'processes', 'Processo rejeitado', 'Quando um processo e rejeitado', 'entity_owner', true),
  ('processes.returned', 'processes', 'Processo devolvido', 'Quando um processo e devolvido para correccao', 'entity_owner', true),
  ('processes.task_assigned', 'processes', 'Tarefa atribuida', 'Quando uma tarefa e atribuida a um consultor', 'assigned_agent', true);

-- Imoveis
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('properties.new', 'properties', 'Novo imovel criado', 'Quando um novo imovel e adicionado ao sistema', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true),
  ('properties.price_change', 'properties', 'Preco alterado', 'Quando o preco de um imovel e alterado', 'role', (SELECT id FROM roles WHERE name = 'Broker/CEO' LIMIT 1), true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('properties.status_change', 'properties', 'Estado alterado', 'Quando o estado de um imovel muda', 'entity_owner', true);

-- Credito
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('credit.new_request', 'credit', 'Novo pedido de credito', 'Quando um novo pedido de credito e criado', 'role', (SELECT id FROM roles WHERE name = 'Intermediário de Crédito' LIMIT 1), true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('credit.status_update', 'credit', 'Actualizacao de credito', 'Quando o estado de um pedido de credito muda', 'assigned_agent', true);

-- Loja
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('store.new_order', 'store', 'Nova encomenda', 'Quando uma nova encomenda e feita na loja', 'role', (SELECT id FROM roles WHERE name = 'Office Manager' LIMIT 1), true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('store.order_shipped', 'store', 'Encomenda enviada', 'Quando uma encomenda e marcada como enviada', 'entity_owner', true);

-- Formacoes
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, recipient_role_id, channel_in_app) VALUES
  ('training.new_session', 'training', 'Nova formacao agendada', 'Quando uma nova sessao de formacao e criada', 'role', (SELECT id FROM roles WHERE name = 'Consultor' LIMIT 1), true);

INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('training.reminder', 'training', 'Lembrete de formacao', 'Lembrete antes do inicio da formacao', 'assigned_agent', true);

-- Financeiro
INSERT INTO notification_routing_rules (event_key, module, label, description, recipient_type, channel_in_app) VALUES
  ('financial.commission_ready', 'financial', 'Comissao pronta', 'Quando uma comissao esta pronta para pagamento', 'assigned_agent', true),
  ('financial.payment_processed', 'financial', 'Pagamento processado', 'Quando um pagamento e processado', 'assigned_agent', true);

COMMIT;
