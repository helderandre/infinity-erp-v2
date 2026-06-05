-- Relax CHECK on taxonomy_extras.value to support scopes that store labels
-- as the canonical value (e.g. negocio_tipo_imovel — `negocios.tipo_imovel`
-- already stores 'Apartamento'/'Prédio' as text strings, not slugs).
--
-- Each scope declares its `valueFormat` in lib/taxonomy/scopes.ts; the API
-- enforces the right shape per scope. The DB only enforces basic sanity
-- (non-empty, ≤80 chars).

ALTER TABLE taxonomy_extras DROP CONSTRAINT IF EXISTS taxonomy_extras_value_check;

ALTER TABLE taxonomy_extras
  ADD CONSTRAINT taxonomy_extras_value_check
  CHECK (length(trim(value)) > 0 AND length(value) <= 80);
