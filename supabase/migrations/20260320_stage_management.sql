-- Stage Management: dependências entre estágios + tracking de estágios concluídos
-- Data: 2026-03-20

-- 1. Dependências entre estágios no template
ALTER TABLE tpl_stages
  ADD COLUMN IF NOT EXISTS depends_on_stages UUID[] DEFAULT '{}';

-- 2. Tracking de estágios no processo
ALTER TABLE proc_instances
  ADD COLUMN IF NOT EXISTS current_stage_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS completed_stage_ids UUID[] DEFAULT '{}';

-- 3. Migrar dados existentes (current_stage_id → current_stage_ids)
UPDATE proc_instances
SET current_stage_ids = CASE
  WHEN current_stage_id IS NOT NULL THEN ARRAY[current_stage_id]
  ELSE '{}'
END
WHERE current_stage_ids = '{}' OR current_stage_ids IS NULL;
