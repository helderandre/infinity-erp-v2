-- Licença de Utilização: colunas estruturadas + variáveis de template
-- + mapeamento dos campos do CMI.

-- 1. Colunas no dev_property_internal ────────────────────────────────
ALTER TABLE dev_property_internal
  ADD COLUMN IF NOT EXISTS use_license_number text,
  ADD COLUMN IF NOT EXISTS use_license_date   date,
  ADD COLUMN IF NOT EXISTS use_license_issuer text;

COMMENT ON COLUMN dev_property_internal.use_license_number IS 'Número da Licença de Utilização (campo do CMI).';
COMMENT ON COLUMN dev_property_internal.use_license_date   IS 'Data de emissão da Licença de Utilização.';
COMMENT ON COLUMN dev_property_internal.use_license_issuer IS 'Entidade emissora (Câmara Municipal de X).';

-- 2. tpl_variables ────────────────────────────────────────────────────
INSERT INTO tpl_variables (key, label, category, source_entity, source_table, source_column, format_type, is_system, is_active, order_index)
VALUES
  ('imovel_licenca_numero',  'Número da Licença de Utilização',  'imovel', 'property', 'dev_property_internal', 'use_license_number', 'text', false, true, 50),
  ('imovel_licenca_data',    'Data da Licença de Utilização',    'imovel', 'property', 'dev_property_internal', 'use_license_date',   'date', false, true, 51),
  ('imovel_licenca_emissor', 'Entidade emissora da Licença',      'imovel', 'property', 'dev_property_internal', 'use_license_issuer', 'text', false, true, 52)
ON CONFLICT (key) DO NOTHING;

-- 3. Mapeamento no CMI ────────────────────────────────────────────────
-- PDF field "a licença de utilização  construção n" → número
UPDATE doc_pdf_field_mappings
   SET variable_key = 'imovel_licenca_numero'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'a licença de utilização  construção n';

-- PDF field "em_2" está numa linha "emitida em ___" — data
UPDATE doc_pdf_field_mappings
   SET variable_key = 'imovel_licenca_data'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'em_2';
