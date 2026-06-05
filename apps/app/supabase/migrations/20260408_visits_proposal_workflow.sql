-- Visitas: máquina de estados com proposta, confirmação e outcome.
--
-- Contexto:
-- ---------
-- Antes desta migration, as visitas tinham um ciclo de vida plano onde
-- qualquer agente podia marcar uma visita directamente como `scheduled` sem
-- envolver o consultor da angariação. Agora introduz-se um workflow de
-- proposta entre consultores quando a visita envolve dois agentes
-- diferentes (buyer agent ≠ seller agent).
--
-- Nova máquina de estados:
-- ------------------------
--
--                                  ┌──────────┐
--                                  │ rejected │ (terminal)
--                                  └────▲─────┘
--                                       │
--                                       │ (seller rejeita)
--                                       │
--   (cross-agent)              ┌────────┴───────┐
--   ──────────────────────────▶│    proposal    │
--                              └────────┬───────┘
--                                       │ (seller confirma)
--                                       ▼
--   (mesmo agente)             ┌────────────────┐         ┌───────────┐
--   ──────────────────────────▶│   scheduled    │────────▶│ completed │
--                              └────────┬───────┘         └───────────┘
--                                       │                 ┌───────────┐
--                                       ├────────────────▶│  no_show  │
--                                       │                 └───────────┘
--                                       │                 ┌───────────┐
--                                       └────────────────▶│ cancelled │
--                                                         └───────────┘
--
-- Estado `confirmed` removido:
-- ----------------------------
-- O antigo estado `confirmed` significava "o cliente confirmou que vem",
-- registado via `confirmed_at`/`confirmed_by`/`confirmation_method`. Foi
-- removido como STATUS — as colunas existentes continuam a guardar essa
-- informação como flag opcional, mas a visita continua em `scheduled` mesmo
-- quando o cliente confirma. Não há perda de funcionalidade, só simplificação.
--
-- Política de visitas mesmo-consultor:
-- ------------------------------------
-- Quando o buyer agent é o mesmo que o seller agent (visita própria em
-- angariação própria), a visita arranca directamente em `scheduled` — não
-- faz sentido pedir-se confirmação a si próprio. A determinação é feita
-- na API de criação (POST /api/visits) usando `seller_consultant_id` que
-- já é snapshotted pelo trigger anterior.

-- ---------------------------------------------------------------------------
-- 1. Migrar dados existentes: status='confirmed' → status='scheduled'
-- ---------------------------------------------------------------------------
-- Visitas que estavam em 'confirmed' agora ficam em 'scheduled' (a info de
-- confirmação do cliente continua nas colunas confirmed_at/confirmed_by).
UPDATE visits SET status = 'scheduled' WHERE status = 'confirmed';

-- ---------------------------------------------------------------------------
-- 2. Novas colunas para o workflow
-- ---------------------------------------------------------------------------

-- Resposta à proposta (apenas relevante quando passou por status='proposal')
ALTER TABLE visits ADD COLUMN IF NOT EXISTS proposal_responded_at TIMESTAMPTZ;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS proposal_responded_by UUID
  REFERENCES dev_users(id) ON DELETE SET NULL;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- Outcome da visita (quem marcou completed/no_show/cancelled e quando)
ALTER TABLE visits ADD COLUMN IF NOT EXISTS outcome_set_at TIMESTAMPTZ;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS outcome_set_by UUID
  REFERENCES dev_users(id) ON DELETE SET NULL;

-- Tracking do prompt de fallback (quando o buyer agent foi notificado por
-- ausência de resposta do seller agent passadas N horas)
ALTER TABLE visits ADD COLUMN IF NOT EXISTS outcome_prompt_fallback_sent_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 3. CHECK constraint para impedir status inválidos
-- ---------------------------------------------------------------------------
-- O status era texto livre antes desta migration. Agora bloqueia-se a coluna
-- aos 6 valores válidos da máquina de estados.
ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_check;
ALTER TABLE visits ADD CONSTRAINT visits_status_check
  CHECK (status IN ('proposal', 'rejected', 'scheduled', 'completed', 'no_show', 'cancelled'));

-- ---------------------------------------------------------------------------
-- 4. Índices úteis para queries de UI e cron
-- ---------------------------------------------------------------------------

-- Filtros de "pending proposals" e "stale proposals" no inbox do seller agent
CREATE INDEX IF NOT EXISTS idx_visits_status_seller
  ON visits(status, seller_consultant_id)
  WHERE status = 'proposal';

-- Cron de fallback: visitas scheduled cuja hora já passou e ainda sem outcome
CREATE INDEX IF NOT EXISTS idx_visits_pending_outcome
  ON visits(visit_date, visit_time)
  WHERE status = 'scheduled' AND outcome_set_at IS NULL;
