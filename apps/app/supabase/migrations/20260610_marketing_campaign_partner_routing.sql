-- ============================================================================
-- Marketing campaign requests → routed to a chosen Meta/marketing partner
--
-- Quando um consultor pede uma campanha na Loja, escolhe o parceiro de
-- marketing (ex.: Digital Revolution) que a vai executar. O pedido aparece na
-- secção "Meta" do portal de parceiros desse parceiro, que o trabalha por um
-- ciclo próprio (pedido → aceite → criada → activa → terminada, + rejeitada),
-- liga-o à campanha Meta real (meta.meta_campaigns_raw.campaign_id) e — ao
-- ligá-la — passa a ser o referenciado dos leads que ela gera.
--
-- Aditiva. Revert no fim do ficheiro.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Flag de parceiro de marketing (quem aparece no picker da Loja)
-- ----------------------------------------------------------------------------
ALTER TABLE dev_users
  ADD COLUMN IF NOT EXISTS is_marketing_partner BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN dev_users.is_marketing_partner IS
  'True para parceiros (role Parceiro) que executam campanhas Meta. Listados no picker de campanhas da Loja.';

-- ----------------------------------------------------------------------------
-- 2. Colunas de routing + ciclo do parceiro em marketing_campaigns
--    O status existente (pending/approved/active/...) é o fluxo Loja/financeiro
--    e mantém-se intacto. partner_status é o ciclo voltado ao parceiro.
-- ----------------------------------------------------------------------------
ALTER TABLE marketing_campaigns
  ADD COLUMN IF NOT EXISTS partner_id                UUID REFERENCES dev_users(id),
  ADD COLUMN IF NOT EXISTS partner_status            TEXT NOT NULL DEFAULT 'pedido',
  ADD COLUMN IF NOT EXISTS meta_campaign_id          TEXT,
  ADD COLUMN IF NOT EXISTS partner_rejection_reason  TEXT,
  ADD COLUMN IF NOT EXISTS partner_status_updated_at TIMESTAMPTZ;

ALTER TABLE marketing_campaigns
  DROP CONSTRAINT IF EXISTS marketing_campaigns_partner_status_chk;
ALTER TABLE marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_partner_status_chk
  CHECK (partner_status IN ('pedido','aceite','criada','activa','terminada','rejeitada'));

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_partner
  ON marketing_campaigns(partner_id, partner_status)
  WHERE partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_meta_campaign_id
  ON marketing_campaigns(meta_campaign_id)
  WHERE meta_campaign_id IS NOT NULL;

COMMENT ON COLUMN marketing_campaigns.partner_id IS
  'Parceiro de marketing escolhido para executar a campanha (dev_users com is_marketing_partner).';
COMMENT ON COLUMN marketing_campaigns.partner_status IS
  'Ciclo voltado ao parceiro: pedido → aceite → criada → activa → terminada (+ rejeitada). Distinto de status (Loja/financeiro).';
COMMENT ON COLUMN marketing_campaigns.meta_campaign_id IS
  'meta.meta_campaigns_raw.campaign_id da campanha Meta real, ligada pelo parceiro. Activa a atribuição/referral.';

-- ----------------------------------------------------------------------------
-- 2b. Colunas em falta que a Loja já escreve (campaign_type, management_fee)
--     O POST /api/marketing/campaigns insere ambas, mas a tabela nunca as teve
--     — checkout de campanha estava latentemente partido. campaign_type também
--     alimenta o mapeamento para lead_sector na regra de atribuição (referral).
-- ----------------------------------------------------------------------------
ALTER TABLE marketing_campaigns
  ADD COLUMN IF NOT EXISTS campaign_type   TEXT,
  ADD COLUMN IF NOT EXISTS management_fee  NUMERIC NOT NULL DEFAULT 70;

ALTER TABLE marketing_campaigns
  DROP CONSTRAINT IF EXISTS marketing_campaigns_campaign_type_chk;
ALTER TABLE marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_campaign_type_chk
  CHECK (campaign_type IS NULL OR campaign_type IN ('compradores','vendedores','arrendatarios','senhorios','outros'));

-- ----------------------------------------------------------------------------
-- 3. Seed — Digital Revolution é parceiro de marketing
-- ----------------------------------------------------------------------------
UPDATE dev_users
  SET is_marketing_partner = true
  WHERE commercial_name ILIKE '%digital revolution%';

-- ============================================================================
-- REVERT
-- ----------------------------------------------------------------------------
-- DROP INDEX IF EXISTS idx_marketing_campaigns_meta_campaign_id;
-- DROP INDEX IF EXISTS idx_marketing_campaigns_partner;
-- ALTER TABLE marketing_campaigns
--   DROP CONSTRAINT IF EXISTS marketing_campaigns_campaign_type_chk,
--   DROP COLUMN IF EXISTS management_fee,
--   DROP COLUMN IF EXISTS campaign_type,
--   DROP CONSTRAINT IF EXISTS marketing_campaigns_partner_status_chk,
--   DROP COLUMN IF EXISTS partner_status_updated_at,
--   DROP COLUMN IF EXISTS partner_rejection_reason,
--   DROP COLUMN IF EXISTS meta_campaign_id,
--   DROP COLUMN IF EXISTS partner_status,
--   DROP COLUMN IF EXISTS partner_id;
-- ALTER TABLE dev_users DROP COLUMN IF EXISTS is_marketing_partner;
-- ============================================================================
