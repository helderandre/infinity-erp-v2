# SPEC-AUTO-F1-DATABASE — Fase 1: Schema de Base de Dados

**Data:** 2026-03-05
**Prioridade:** 🔴 Crítica (bloqueia todas as outras fases)
**Estimativa:** 1-2 sessões de Claude Code
**Pré-requisitos:** Acesso admin ao SupabaseInfinity

---

## 📋 Objectivo

Criar toda a estrutura de base de dados para o sistema de automações: 9 tabelas novas, 3 extensões PostgreSQL, índices optimizados, Realtime habilitado, e expansão da tabela `tpl_variables` existente.

---

## 🔧 Migration 0: Activar Extensões

```sql
-- Migration: auto_enable_extensions
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

---

## Migration 1: `auto_wpp_instances` — Instâncias WhatsApp

```sql
-- Migration: auto_create_wpp_instances

CREATE TABLE auto_wpp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  uazapi_token TEXT NOT NULL,
  uazapi_instance_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  connection_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (connection_status IN ('connected', 'disconnected', 'connecting', 'not_found')),
  phone TEXT,
  profile_name TEXT,
  profile_pic_url TEXT,
  is_business BOOLEAN DEFAULT false,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_auto_wpp_inst_status ON auto_wpp_instances (connection_status) WHERE status = 'active';
CREATE INDEX idx_auto_wpp_inst_user ON auto_wpp_instances (user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE auto_wpp_instances IS 'Instâncias WhatsApp via Uazapi';
```

---

## Migration 2: `auto_wpp_templates` — Templates Mensagens WhatsApp

```sql
-- Migration: auto_create_wpp_templates

CREATE TABLE auto_wpp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  category TEXT DEFAULT 'geral',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_auto_wpp_tpl_active ON auto_wpp_templates (is_active, category) WHERE is_active = true;

COMMENT ON TABLE auto_wpp_templates IS 'Biblioteca de templates de mensagens WhatsApp reutilizáveis';
COMMENT ON COLUMN auto_wpp_templates.messages IS 'Array JSON: [{type, content, mediaUrl?, docName?, delay?}]';
```

---

## Migration 3: `auto_flows` — Fluxos de Automação

```sql
-- Migration: auto_create_flows

CREATE TABLE auto_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Novo Fluxo',
  description TEXT,
  flow_definition JSONB NOT NULL DEFAULT '{"version":1,"nodes":[],"edges":[]}'::jsonb,
  is_active BOOLEAN DEFAULT false,
  wpp_instance_id UUID REFERENCES auto_wpp_instances(id) ON DELETE SET NULL,
  context_config JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_auto_flows_active ON auto_flows (is_active) WHERE is_active = true;

CREATE OR REPLACE FUNCTION auto_update_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_flows_updated BEFORE UPDATE ON auto_flows
  FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();

COMMENT ON TABLE auto_flows IS 'Fluxos de automação com definição visual React Flow';
```

---

## Migration 4: `auto_triggers` — Gatilhos

```sql
-- Migration: auto_create_triggers

CREATE TABLE auto_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES auto_flows(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('webhook', 'status_change', 'schedule', 'manual')),
  trigger_source TEXT,
  trigger_condition JSONB,
  payload_mapping JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_auto_triggers_flow ON auto_triggers (flow_id, active) WHERE active = true;
CREATE INDEX idx_auto_triggers_webhook ON auto_triggers (trigger_source) WHERE source_type = 'webhook' AND active = true;

COMMENT ON TABLE auto_triggers IS 'Gatilhos N:1 com auto_flows';
```

---

## Migration 5: `auto_runs` — Execuções

```sql
-- Migration: auto_create_runs

CREATE TYPE auto_run_status AS ENUM ('pending','queued','running','completed','failed','cancelled','timed_out');

CREATE TABLE auto_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES auto_flows(id) ON DELETE CASCADE,
  trigger_id UUID REFERENCES auto_triggers(id) ON DELETE SET NULL,
  triggered_by TEXT DEFAULT 'manual',
  status auto_run_status NOT NULL DEFAULT 'pending',
  context JSONB DEFAULT '{}'::jsonb,
  entity_type TEXT,
  entity_id UUID,
  total_steps INTEGER DEFAULT 0,
  completed_steps INTEGER DEFAULT 0,
  failed_steps INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  error_message TEXT
);

CREATE INDEX idx_auto_runs_flow ON auto_runs (flow_id, created_at DESC);
CREATE INDEX idx_auto_runs_status ON auto_runs (status) WHERE status IN ('pending','queued','running');
CREATE INDEX idx_auto_runs_entity ON auto_runs (entity_type, entity_id) WHERE entity_id IS NOT NULL;

CREATE TRIGGER trg_auto_runs_updated BEFORE UPDATE ON auto_runs
  FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();

COMMENT ON TABLE auto_runs IS 'Execuções individuais de fluxos';
```

---

## Migration 6: `auto_step_runs` — Steps por Nó

```sql
-- Migration: auto_create_step_runs

CREATE TYPE auto_step_status AS ENUM ('pending','running','completed','failed','skipped','cancelled');

CREATE TABLE auto_step_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES auto_runs(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES auto_flows(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  node_label TEXT,
  status auto_step_status NOT NULL DEFAULT 'pending',
  input_data JSONB,
  output_data JSONB,
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_auto_step_runs_run ON auto_step_runs (run_id, created_at);
CREATE INDEX idx_auto_step_runs_pending ON auto_step_runs (priority DESC, scheduled_for ASC) WHERE status = 'pending';

COMMENT ON TABLE auto_step_runs IS 'Execução de cada nó individual com input/output e Realtime';
```

---

## Migration 7: `auto_delivery_log` — Log de Entregas

```sql
-- Migration: auto_create_delivery_log

CREATE TYPE auto_channel_type AS ENUM ('whatsapp', 'email', 'notification');
CREATE TYPE auto_delivery_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'cancelled');

CREATE TABLE auto_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_run_id UUID NOT NULL REFERENCES auto_step_runs(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES auto_runs(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES auto_flows(id) ON DELETE CASCADE,
  channel auto_channel_type NOT NULL,
  recipient_address TEXT NOT NULL,
  message_type TEXT,
  final_content TEXT,
  media_url TEXT,
  status auto_delivery_status NOT NULL DEFAULT 'pending',
  external_message_id TEXT,
  track_source TEXT DEFAULT 'erp_infinity',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_auto_delivery_step ON auto_delivery_log (step_run_id);
CREATE INDEX idx_auto_delivery_run ON auto_delivery_log (run_id, created_at DESC);

COMMENT ON TABLE auto_delivery_log IS 'Log de mensagens WhatsApp, emails e notificações enviadas';
```

---

## Migration 8: `auto_webhook_captures` + `auto_flow_versions`

```sql
-- Migration: auto_create_captures_and_versions

CREATE TABLE auto_webhook_captures (
  source_id TEXT PRIMARY KEY,
  flow_name TEXT,
  payload JSONB,
  received_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE auto_flow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES auto_flows(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  flow_definition JSONB NOT NULL,
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(flow_id, version)
);

CREATE INDEX idx_auto_flow_versions ON auto_flow_versions (flow_id, version DESC);

CREATE OR REPLACE FUNCTION auto_save_flow_version()
RETURNS TRIGGER AS $$
DECLARE next_ver INTEGER;
BEGIN
  IF OLD.flow_definition IS DISTINCT FROM NEW.flow_definition THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_ver FROM auto_flow_versions WHERE flow_id = NEW.id;
    INSERT INTO auto_flow_versions (flow_id, version, flow_definition) VALUES (NEW.id, next_ver, OLD.flow_definition);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_flow_version BEFORE UPDATE OF flow_definition ON auto_flows
  FOR EACH ROW EXECUTE FUNCTION auto_save_flow_version();
```

---

## Migration 9: Expandir `tpl_variables`

```sql
-- Migration: auto_expand_tpl_variables

ALTER TABLE tpl_variables ADD COLUMN IF NOT EXISTS category_color TEXT DEFAULT '#6B7280';

UPDATE tpl_variables SET category_color = '#F59E0B' WHERE category = 'consultor';
UPDATE tpl_variables SET category_color = '#10B981' WHERE category = 'imovel';
UPDATE tpl_variables SET category_color = '#8B5CF6' WHERE category = 'proprietario';
UPDATE tpl_variables SET category_color = '#3B82F6' WHERE category = 'processo';
UPDATE tpl_variables SET category_color = '#6B7280' WHERE category = 'sistema';

INSERT INTO tpl_variables (key, label, category, source_entity, source_table, source_column, format_type, is_system, order_index, category_color) VALUES
  ('lead_nome',        'Nome do Lead',        'lead', 'lead', 'leads', 'nome',        'text', true, 1, '#3B82F6'),
  ('lead_email',       'Email do Lead',       'lead', 'lead', 'leads', 'email',       'text', true, 2, '#3B82F6'),
  ('lead_telefone',    'Telefone do Lead',    'lead', 'lead', 'leads', 'telefone',    'text', true, 3, '#3B82F6'),
  ('lead_telemovel',   'Telemóvel do Lead',   'lead', 'lead', 'leads', 'telemovel',   'text', true, 4, '#3B82F6'),
  ('lead_origem',      'Origem do Lead',      'lead', 'lead', 'leads', 'origem',      'text', true, 5, '#3B82F6'),
  ('lead_estado',      'Estado do Lead',      'lead', 'lead', 'leads', 'estado',      'text', true, 6, '#3B82F6'),
  ('lead_temperatura', 'Temperatura do Lead', 'lead', 'lead', 'leads', 'temperatura', 'text', true, 7, '#3B82F6'),
  ('negocio_tipo',      'Tipo de Negócio',   'negocio', 'deal', 'negocios', 'tipo',      'text',     true, 1, '#EC4899'),
  ('negocio_estado',    'Estado do Negócio', 'negocio', 'deal', 'negocios', 'estado',    'text',     true, 2, '#EC4899'),
  ('negocio_orcamento', 'Orçamento',         'negocio', 'deal', 'negocios', 'orcamento', 'currency', true, 3, '#EC4899'),
  ('imovel_tipologia', 'Tipologia do Imóvel', 'imovel', 'property', 'property_listings', 'typology',     'text', true, 5, '#10B981'),
  ('imovel_tipo',      'Tipo de Imóvel',      'imovel', 'property', 'property_listings', 'property_type', 'text', true, 6, '#10B981'),
  ('hora_actual',      'Hora Actual',         'sistema', 'system', NULL, NULL, 'time', true, 2, '#6B7280')
ON CONFLICT (key) DO NOTHING;
```

---

## Migration 10: pgmq + Realtime + Funções

```sql
-- Migration: auto_create_queues_realtime_functions

SELECT pgmq.create('auto_step_queue');
SELECT pgmq.create('auto_step_dlq');

ALTER PUBLICATION supabase_realtime ADD TABLE auto_step_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE auto_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE auto_webhook_captures;

CREATE OR REPLACE FUNCTION auto_claim_steps(batch_size INT DEFAULT 5)
RETURNS SETOF auto_step_runs LANGUAGE sql AS $$
  UPDATE auto_step_runs SET status = 'running', started_at = now()
  WHERE id IN (
    SELECT id FROM auto_step_runs
    WHERE status = 'pending' AND scheduled_for <= now()
    ORDER BY priority DESC, scheduled_for ASC
    FOR UPDATE SKIP LOCKED LIMIT batch_size
  ) RETURNING *;
$$;

CREATE OR REPLACE FUNCTION auto_reset_stuck_steps()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE reset_count INTEGER;
BEGIN
  UPDATE auto_step_runs SET status = 'pending', retry_count = retry_count + 1,
    error_message = COALESCE(error_message,'') || E'\n[auto-reset] ' || now()::text
  WHERE status = 'running' AND started_at < now() - interval '5 minutes' AND retry_count < max_retries;
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  UPDATE auto_step_runs SET status = 'failed', completed_at = now(),
    error_message = COALESCE(error_message,'') || E'\n[auto-failed] Max retries'
  WHERE status = 'running' AND started_at < now() - interval '5 minutes' AND retry_count >= max_retries;
  RETURN reset_count;
END; $$;

SELECT cron.schedule('auto-detect-stuck', '*/5 * * * *', $$SELECT auto_reset_stuck_steps();$$);
SELECT cron.schedule('auto-cleanup', '0 3 * * *', $$DELETE FROM auto_runs WHERE status IN ('completed','failed','cancelled') AND created_at < now() - interval '90 days';$$);
```

---

## ✅ Critérios de Aceitação

- [x] Todas as migrations aplicam sem erro
- [x] Extensões pgmq, pg_cron, pg_net activas
- [x] Fila pgmq existe: `SELECT * FROM pgmq.list_queues();`
- [x] Realtime: `SELECT * FROM pg_publication_tables WHERE tablename LIKE 'auto_%';`
- [x] `tpl_variables` tem 25+ registos
- [x] Versionamento: actualizar `auto_flows` cria versão automática
- [x] CASCADE: apagar flow remove triggers, runs, steps
- [x] Cron: `SELECT * FROM cron.job;` mostra 2 jobs
