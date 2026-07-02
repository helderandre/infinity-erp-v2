-- ============================================================================
-- Recrutamento — revamp do pipeline + routing de campanhas Meta
--
-- 1) leads_assignment_rules.lead_sector passa a aceitar 'recruitment' — uma
--    campanha/anúncio Meta atribuída como Recrutamento faz os leads entrarem
--    como candidatos em recruitment_candidates (NÃO criam contacto/entrada no
--    CRM de vendas). Ver lib/crm/ingest-recruitment-candidate.ts + o desvio em
--    lib/mube/handlers.ts (bridgeMetaLeadToCrm).
--
-- 2) recruitment_candidates ganha colunas de ingestão de campanha:
--    meta_leadgen_id (idempotência de webhook, unique parcial), form_data
--    (payload do formulário Meta), campaign_external_id / ad_external_id.
--
-- 3) Pipeline de candidatos migra para as fases ATS (design quintino):
--      prospect         → novo
--      in_contact       → triagem
--      in_process       → entrevista
--      decision_pending → oferta
--      joined           → contratado
--      declined         → rejeitado
--      on_hold          → em_espera
--    'avaliacao' é uma fase NOVA (entre entrevista e oferta) sem equivalente
--    legacy. O valor antigo fica guardado em legacy_status (reversível).
--    recruitment_stage_log e recruitment_comm_templates.stage migram com o
--    mesmo mapa (sem backup — mapa determinístico, inverso documentado abaixo).
--
-- 4) Tabelas temp_* promovidas a definitivas:
--      temp_recruitment_communications  → recruitment_communications
--      temp_recruitment_probation       → recruitment_probation
--      temp_recruitment_comm_templates  → recruitment_comm_templates
--    Constraints/índices com prefixo temp_ são renomeados em conformidade.
--    (O código passa a usar hints de coluna no PostgREST, não nomes de FK.)
--
-- Idempotente: re-aplicar é seguro (guards to_regclass / IF EXISTS / WHERE).
-- ============================================================================

-- ── 1. Assignment rules: aceitar lead_sector='recruitment' ─────────────────
ALTER TABLE leads_assignment_rules
  DROP CONSTRAINT IF EXISTS leads_assignment_rules_lead_sector_chk;
ALTER TABLE leads_assignment_rules
  ADD CONSTRAINT leads_assignment_rules_lead_sector_chk
  CHECK (lead_sector IS NULL OR lead_sector IN (
    'real_estate_buy', 'real_estate_sell', 'real_estate_rent', 'real_estate_landlord',
    'recruitment'
  ));

-- ── 2. Colunas de ingestão de campanha em recruitment_candidates ───────────
ALTER TABLE recruitment_candidates
  ADD COLUMN IF NOT EXISTS meta_leadgen_id      TEXT,
  ADD COLUMN IF NOT EXISTS campaign_external_id TEXT,
  ADD COLUMN IF NOT EXISTS ad_external_id       TEXT,
  ADD COLUMN IF NOT EXISTS form_data            JSONB,
  ADD COLUMN IF NOT EXISTS legacy_status        TEXT;

-- Idempotência do webhook Meta (re-entregas do mesmo leadgen_id).
CREATE UNIQUE INDEX IF NOT EXISTS recruitment_candidates_meta_leadgen_uq
  ON recruitment_candidates (meta_leadgen_id)
  WHERE meta_leadgen_id IS NOT NULL;

-- ── 3a. Drop de CHECKs existentes sobre status (nome desconhecido — a tabela
--        foi criada fora das migrations; iteramos pg_constraint). ────────────
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.recruitment_candidates'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%legacy_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.recruitment_candidates DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- ── 3b. Migração dos valores (com backup em legacy_status) ─────────────────
UPDATE recruitment_candidates SET
  legacy_status = COALESCE(legacy_status, status),
  status = CASE status
    WHEN 'prospect'         THEN 'novo'
    WHEN 'in_contact'       THEN 'triagem'
    WHEN 'in_process'       THEN 'entrevista'
    WHEN 'decision_pending' THEN 'oferta'
    WHEN 'joined'           THEN 'contratado'
    WHEN 'declined'         THEN 'rejeitado'
    WHEN 'on_hold'          THEN 'em_espera'
    ELSE status
  END
WHERE status IN ('prospect','in_contact','in_process','decision_pending','joined','declined','on_hold');

ALTER TABLE recruitment_candidates
  ADD CONSTRAINT recruitment_candidates_status_chk
  CHECK (status IN ('novo','triagem','entrevista','avaliacao','oferta','contratado','rejeitado','em_espera'));
ALTER TABLE recruitment_candidates ALTER COLUMN status SET DEFAULT 'novo';

-- ── 3c. Stage log: mesmo mapa nos dois lados ────────────────────────────────
UPDATE recruitment_stage_log SET
  from_status = CASE from_status
    WHEN 'prospect'         THEN 'novo'
    WHEN 'in_contact'       THEN 'triagem'
    WHEN 'in_process'       THEN 'entrevista'
    WHEN 'decision_pending' THEN 'oferta'
    WHEN 'joined'           THEN 'contratado'
    WHEN 'declined'         THEN 'rejeitado'
    WHEN 'on_hold'          THEN 'em_espera'
    ELSE from_status
  END,
  to_status = CASE to_status
    WHEN 'prospect'         THEN 'novo'
    WHEN 'in_contact'       THEN 'triagem'
    WHEN 'in_process'       THEN 'entrevista'
    WHEN 'decision_pending' THEN 'oferta'
    WHEN 'joined'           THEN 'contratado'
    WHEN 'declined'         THEN 'rejeitado'
    WHEN 'on_hold'          THEN 'em_espera'
    ELSE to_status
  END
WHERE from_status IN ('prospect','in_contact','in_process','decision_pending','joined','declined','on_hold')
   OR to_status   IN ('prospect','in_contact','in_process','decision_pending','joined','declined','on_hold');

-- ── 4. Promover tabelas temp_* a definitivas ────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.temp_recruitment_communications') IS NOT NULL
     AND to_regclass('public.recruitment_communications') IS NULL THEN
    ALTER TABLE public.temp_recruitment_communications RENAME TO recruitment_communications;
  END IF;
  IF to_regclass('public.temp_recruitment_probation') IS NOT NULL
     AND to_regclass('public.recruitment_probation') IS NULL THEN
    ALTER TABLE public.temp_recruitment_probation RENAME TO recruitment_probation;
  END IF;
  IF to_regclass('public.temp_recruitment_comm_templates') IS NOT NULL
     AND to_regclass('public.recruitment_comm_templates') IS NULL THEN
    ALTER TABLE public.temp_recruitment_comm_templates RENAME TO recruitment_comm_templates;
  END IF;
END $$;

-- Renomear constraints e índices que mantiveram o prefixo temp_ (os RENAME de
-- tabela não renomeiam constraints/índices automaticamente).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass::text AS tbl
    FROM pg_constraint
    WHERE conrelid IN (
      to_regclass('public.recruitment_communications'),
      to_regclass('public.recruitment_probation'),
      to_regclass('public.recruitment_comm_templates')
    )
      AND conname LIKE 'temp\_%'
  LOOP
    EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
      r.tbl, r.conname, substring(r.conname FROM 6));
  END LOOP;

  FOR r IN
    SELECT indexname, schemaname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('recruitment_communications','recruitment_probation','recruitment_comm_templates')
      AND indexname LIKE 'temp\_%'
  LOOP
    EXECUTE format('ALTER INDEX public.%I RENAME TO %I',
      r.indexname, substring(r.indexname FROM 6));
  END LOOP;
END $$;

-- comm templates: migrar os valores de stage (referem estados de candidato)
DO $$
DECLARE c RECORD;
BEGIN
  IF to_regclass('public.recruitment_comm_templates') IS NOT NULL THEN
    -- drop de CHECKs sobre stage (nome desconhecido)
    FOR c IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.recruitment_comm_templates'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%stage%'
    LOOP
      EXECUTE format('ALTER TABLE public.recruitment_comm_templates DROP CONSTRAINT %I', c.conname);
    END LOOP;
    UPDATE recruitment_comm_templates SET
      stage = CASE stage
        WHEN 'prospect'         THEN 'novo'
        WHEN 'in_contact'       THEN 'triagem'
        WHEN 'in_process'       THEN 'entrevista'
        WHEN 'decision_pending' THEN 'oferta'
        WHEN 'joined'           THEN 'contratado'
        WHEN 'declined'         THEN 'rejeitado'
        WHEN 'on_hold'          THEN 'em_espera'
        ELSE stage
      END
    WHERE stage IN ('prospect','in_contact','in_process','decision_pending','joined','declined','on_hold');
  END IF;
END $$;

-- ============================================================================
-- REVERT
-- 1) Estados dos candidatos:
--    UPDATE recruitment_candidates SET status = legacy_status
--      WHERE legacy_status IS NOT NULL;
--    (candidatos criados já no novo modelo e a fase 'avaliacao' não têm
--     equivalente legacy — rever manualmente)
--    Mapa inverso p/ stage_log e comm_templates: novo→prospect,
--    triagem→in_contact, entrevista→in_process, oferta→decision_pending,
--    contratado→joined, rejeitado→declined, em_espera→on_hold.
-- 2) ALTER TABLE recruitment_candidates
--      DROP CONSTRAINT IF EXISTS recruitment_candidates_status_chk,
--      DROP COLUMN IF EXISTS meta_leadgen_id,
--      DROP COLUMN IF EXISTS campaign_external_id,
--      DROP COLUMN IF EXISTS ad_external_id,
--      DROP COLUMN IF EXISTS form_data,
--      DROP COLUMN IF EXISTS legacy_status;
-- 3) ALTER TABLE recruitment_communications RENAME TO temp_recruitment_communications; (etc.)
-- 4) Repor o CHECK antigo de leads_assignment_rules_lead_sector_chk (sem
--    'recruitment') — ver 20260619_assignment_rules_lead_type.sql.
-- ============================================================================
