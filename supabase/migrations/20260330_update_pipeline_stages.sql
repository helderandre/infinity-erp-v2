-- =============================================================================
-- Migration: Update pipeline stages
-- Comprador:     Leads → Pesquisa de Imóveis → Visitas → Proposta → CPCV → Escritura → Fecho (+Perdido)
-- Vendedor:      Leads → Pré-Angariação → Estudo de Mercado → Angariação → Promoção → Proposta Aceite → CPCV → Escritura → Fecho (+Perdido)
-- Arrendatário:  Leads → Pesquisa de Imóveis → Visitas → Proposta → Contrato → Fecho (+Perdido)
-- Senhorio:      Leads → Pré-Angariação → Estudo de Mercado → Angariação → Promoção → Proposta Aceite → Contrato → Fecho (+Perdido)
-- =============================================================================

BEGIN;

-- 1. Clear stage history for both negocios tables
DELETE FROM leads_negocio_stage_history;

-- 2. Nullify pipeline_stage_id on the old `negocios` table (has FK to leads_pipeline_stages)
UPDATE negocios SET pipeline_stage_id = NULL WHERE pipeline_stage_id IS NOT NULL;

-- 3. Nullify pipeline_stage_id on `leads_negocios` (has FK to leads_pipeline_stages)
CREATE TEMP TABLE _ln_pipelines AS
  SELECT id, pipeline_type FROM leads_negocios WHERE pipeline_stage_id IS NOT NULL;

UPDATE leads_negocios SET pipeline_stage_id = NULL WHERE pipeline_stage_id IS NOT NULL;

-- 4. Delete all existing pipeline stages (now safe — no FKs pointing to them)
DELETE FROM leads_pipeline_stages;

-- 5. Comprador pipeline (7 stages + lost)
INSERT INTO leads_pipeline_stages (pipeline_type, name, color, order_index, is_terminal, terminal_type, probability_pct, sla_days) VALUES
  ('comprador', 'Leads',                '#3b82f6', 0, false, NULL,   5,  2),
  ('comprador', 'Pesquisa de Imóveis',  '#6366f1', 1, false, NULL,  15,  7),
  ('comprador', 'Visitas',              '#8b5cf6', 2, false, NULL,  30, 14),
  ('comprador', 'Proposta',             '#f59e0b', 3, false, NULL,  50,  5),
  ('comprador', 'CPCV',                 '#f97316', 4, false, NULL,  80, 14),
  ('comprador', 'Escritura',            '#10b981', 5, false, NULL,  95, 30),
  ('comprador', 'Fecho',                '#059669', 6, true,  'won', 100, NULL),
  ('comprador', 'Perdido',              '#6b7280', 7, true,  'lost',  0, NULL);

-- 6. Vendedor pipeline (9 stages + lost)
INSERT INTO leads_pipeline_stages (pipeline_type, name, color, order_index, is_terminal, terminal_type, probability_pct, sla_days) VALUES
  ('vendedor', 'Leads',               '#3b82f6', 0, false, NULL,   5,  2),
  ('vendedor', 'Pré-Angariação',      '#6366f1', 1, false, NULL,  10,  5),
  ('vendedor', 'Estudo de Mercado',   '#8b5cf6', 2, false, NULL,  20,  7),
  ('vendedor', 'Angariação',          '#a855f7', 3, false, NULL,  35,  7),
  ('vendedor', 'Promoção',            '#f59e0b', 4, false, NULL,  50, 30),
  ('vendedor', 'Proposta Aceite',     '#f97316', 5, false, NULL,  70,  5),
  ('vendedor', 'CPCV',                '#ef4444', 6, false, NULL,  85, 14),
  ('vendedor', 'Escritura',           '#10b981', 7, false, NULL,  95, 30),
  ('vendedor', 'Fecho',               '#059669', 8, true,  'won', 100, NULL),
  ('vendedor', 'Perdido',             '#6b7280', 9, true,  'lost',  0, NULL);

-- 7. Arrendatário pipeline (6 stages + lost)
INSERT INTO leads_pipeline_stages (pipeline_type, name, color, order_index, is_terminal, terminal_type, probability_pct, sla_days) VALUES
  ('arrendatario', 'Leads',                '#3b82f6', 0, false, NULL,   5,  2),
  ('arrendatario', 'Pesquisa de Imóveis',  '#6366f1', 1, false, NULL,  15,  7),
  ('arrendatario', 'Visitas',              '#8b5cf6', 2, false, NULL,  35, 10),
  ('arrendatario', 'Proposta',             '#f59e0b', 3, false, NULL,  55,  3),
  ('arrendatario', 'Contrato',             '#10b981', 4, false, NULL,  90, 10),
  ('arrendatario', 'Fecho',               '#059669', 5, true,  'won', 100, NULL),
  ('arrendatario', 'Perdido',             '#6b7280', 6, true,  'lost',  0, NULL);

-- 8. Senhorio pipeline (8 stages + lost, DB key stays arrendador)
INSERT INTO leads_pipeline_stages (pipeline_type, name, color, order_index, is_terminal, terminal_type, probability_pct, sla_days) VALUES
  ('arrendador', 'Leads',              '#3b82f6', 0, false, NULL,   5,  2),
  ('arrendador', 'Pré-Angariação',     '#6366f1', 1, false, NULL,  10,  5),
  ('arrendador', 'Estudo de Mercado',  '#8b5cf6', 2, false, NULL,  20,  7),
  ('arrendador', 'Angariação',         '#a855f7', 3, false, NULL,  35,  7),
  ('arrendador', 'Promoção',           '#f59e0b', 4, false, NULL,  50, 21),
  ('arrendador', 'Proposta Aceite',    '#f97316', 5, false, NULL,  70,  3),
  ('arrendador', 'Contrato',           '#10b981', 6, false, NULL,  90, 10),
  ('arrendador', 'Fecho',              '#059669', 7, true,  'won', 100, NULL),
  ('arrendador', 'Perdido',            '#6b7280', 8, true,  'lost',  0, NULL);

-- 9. Re-point leads_negocios to the first stage (Leads) of their pipeline
UPDATE leads_negocios ln
SET pipeline_stage_id = (
  SELECT s.id FROM leads_pipeline_stages s
  WHERE s.pipeline_type = ln.pipeline_type AND s.order_index = 0
  LIMIT 1
),
stage_entered_at = now()
FROM _ln_pipelines p
WHERE p.id = ln.id;

-- 10. Re-point old negocios table — derive pipeline_type from tipo column
UPDATE negocios n
SET pipeline_stage_id = (
  SELECT s.id FROM leads_pipeline_stages s
  WHERE s.pipeline_type = (
    CASE
      WHEN lower(n.tipo) LIKE '%venda%' OR lower(n.tipo) LIKE '%vendedor%' THEN 'vendedor'
      WHEN lower(n.tipo) LIKE '%arrendador%' OR lower(n.tipo) LIKE '%senhorio%' THEN 'arrendador'
      WHEN lower(n.tipo) LIKE '%arrendat%' THEN 'arrendatario'
      ELSE 'comprador'
    END
  )
  AND s.order_index = 0
  LIMIT 1
),
stage_entered_at = now()
WHERE n.pipeline_stage_id IS NULL
  AND n.tipo IS NOT NULL;

-- 11. Cleanup
DROP TABLE _ln_pipelines;

COMMIT;
