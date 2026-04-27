-- ==================================================================
-- MIGRATION: owners_legal_rep_fields
-- ==================================================================
-- Fix para bug introduzido em 20260502_split_armazenar_documentos_task.sql:
-- as 3 rules `field_naturalidade_representante_legal`,
-- `field_morada_representante_legal` e `field_estado_civil_representante_legal`
-- gravam em `owners.legal_rep_naturality`, `owners.legal_rep_address` e
-- `owners.legal_rep_marital_status` respectivamente, mas as colunas
-- nunca foram criadas. O form-write em
-- app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form/route.ts:396-401
-- fazia UPDATE owners SET legal_rep_naturality=... → erro 42703.
--
-- Aditiva, NULLABLE, sem default — não afecta rows existentes.
--
-- REVERT:
--   ALTER TABLE public.owners
--     DROP COLUMN legal_rep_naturality,
--     DROP COLUMN legal_rep_address,
--     DROP COLUMN legal_rep_marital_status;
-- ==================================================================

ALTER TABLE public.owners
  ADD COLUMN legal_rep_naturality text,
  ADD COLUMN legal_rep_address text,
  ADD COLUMN legal_rep_marital_status text;
