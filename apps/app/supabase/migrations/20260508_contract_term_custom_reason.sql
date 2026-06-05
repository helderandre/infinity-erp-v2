-- ─────────────────────────────────────────────────────────────────────────
-- 20260508_contract_term_custom_reason
--
-- Adiciona uma coluna para registar o motivo de um prazo de contrato
-- não-standard (≠ 6 meses) na angariação. UI mostra um toggle "Prazo
-- standard (6 meses)?" — quando OFF, o consultor preenche o prazo real
-- e justifica num campo texto. A página/edit sheet do imóvel sinaliza
-- visualmente (chip amarelo) sempre que o prazo difere do standard.
--
-- Aditiva, NULL-safe. Sem backfill — rows existentes ficam null.
--
-- Revert:
--   ALTER TABLE public.dev_property_internal
--     DROP COLUMN IF EXISTS contract_term_custom_reason;
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.dev_property_internal
  ADD COLUMN IF NOT EXISTS contract_term_custom_reason text;

COMMENT ON COLUMN public.dev_property_internal.contract_term_custom_reason IS
  'Justificação opcional para um prazo de contrato diferente do standard (6 meses). NULL quando o prazo é o standard.';
