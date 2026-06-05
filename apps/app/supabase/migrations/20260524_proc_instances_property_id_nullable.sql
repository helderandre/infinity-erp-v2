-- ==================================================================
-- MIGRATION: proc_instances_property_id_nullable
-- ==================================================================
-- Permite proc_instances sem property_id para suportar PROC-NEG com
-- deal_type='angariacao_externa' (imóvel externo, sem row em
-- dev_properties).
--
-- Angariações continuam a popular property_id sempre (FK válido).
-- Apenas negócios de angariação externa podem ter NULL.
--
-- ADITIVA / RELAXAMENTO. Revert no fim.
-- ==================================================================

ALTER TABLE public.proc_instances
  ALTER COLUMN property_id DROP NOT NULL;

COMMENT ON COLUMN public.proc_instances.property_id IS
  'NULL apenas para PROC-NEG com angariacao_externa (imóvel externo). Angariações sempre populam.';

-- ==================================================================
-- REVERT (atenção: rejeita rows existentes com property_id NULL)
-- ==================================================================
-- ALTER TABLE public.proc_instances
--   ALTER COLUMN property_id SET NOT NULL;
