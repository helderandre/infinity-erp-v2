-- CMI readiness additions
-- 1. New doc_type "Ata do Condomínio"
-- 2. Property internal columns for mortgage disclosure

-- 1. doc_type ────────────────────────────────────────────────────────
INSERT INTO doc_types (
  id,
  name,
  description,
  category,
  allowed_extensions,
  applies_to,
  is_system
)
VALUES (
  '2a5b7e90-1c3d-4f6a-8b9c-0d1e2f3a4b5c',
  'Ata do Condomínio',
  'Última ata de reunião de condomínio',
  'Imóvel',
  ARRAY['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
  ARRAY['properties'],
  true
)
ON CONFLICT (id) DO NOTHING;

-- 2. Hipoteca: flag + valor em dívida ────────────────────────────────
ALTER TABLE dev_property_internal
  ADD COLUMN IF NOT EXISTS has_mortgage  boolean,
  ADD COLUMN IF NOT EXISTS mortgage_owed numeric;

COMMENT ON COLUMN dev_property_internal.has_mortgage  IS 'Existe hipoteca sobre o imóvel. NULL = ainda não respondido.';
COMMENT ON COLUMN dev_property_internal.mortgage_owed IS 'Valor aproximado em dívida. Aplicável apenas quando has_mortgage = true.';
