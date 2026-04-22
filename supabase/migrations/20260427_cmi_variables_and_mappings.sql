-- CMI template: add missing tpl_variables and map the unmapped CMI pdf
-- fields to the matching variable_key. Also repoints two legacy imovel_*
-- variables (property_listings is deprecated; use dev_* tables).

-- 1. Fix legacy source_table references ────────────────────────────────
UPDATE tpl_variables
   SET source_table = 'dev_properties',
       source_column = 'property_type'
 WHERE key = 'imovel_tipo';

UPDATE tpl_variables
   SET source_table = 'dev_property_specifications',
       source_column = 'typology'
 WHERE key = 'imovel_tipologia';

-- 2. Insert new variables ─────────────────────────────────────────────
-- Owner (proprietário)
INSERT INTO tpl_variables (key, label, category, source_entity, source_table, source_column, format_type, is_system, is_active, order_index)
VALUES
  ('proprietario_nif', 'NIF do proprietário', 'proprietario', 'owner', 'owners', 'nif', 'text', false, true, 10),
  ('proprietario_estado_civil', 'Estado civil do proprietário', 'proprietario', 'owner', 'owners', 'marital_status', 'text', false, true, 11),
  ('proprietario_regime', 'Regime de casamento', 'proprietario', 'owner', 'owners', 'marital_regime', 'text', false, true, 12),
  ('proprietario_naturalidade', 'Naturalidade do proprietário', 'proprietario', 'owner', 'owners', 'naturality', 'text', false, true, 13),
  ('proprietario_nacionalidade', 'Nacionalidade do proprietário', 'proprietario', 'owner', 'owners', 'nationality', 'text', false, true, 14)
ON CONFLICT (key) DO NOTHING;

-- Property (imóvel) — location columns directly on dev_properties
INSERT INTO tpl_variables (key, label, category, source_entity, source_table, source_column, format_type, is_system, is_active, order_index)
VALUES
  ('imovel_freguesia', 'Freguesia do imóvel', 'imovel', 'property', 'dev_properties', 'address_parish', 'text', false, true, 20),
  ('imovel_concelho', 'Concelho do imóvel', 'imovel', 'property', 'dev_properties', 'city', 'text', false, true, 21),
  ('imovel_zona', 'Zona do imóvel', 'imovel', 'property', 'dev_properties', 'zone', 'text', false, true, 22),
  ('imovel_codigo_postal', 'Código postal do imóvel', 'imovel', 'property', 'dev_properties', 'postal_code', 'text', false, true, 23)
ON CONFLICT (key) DO NOTHING;

-- Property legal data (Caderneta/CRP extracted)
INSERT INTO tpl_variables (key, label, category, source_entity, source_table, source_column, format_type, is_system, is_active, order_index)
VALUES
  ('imovel_conservatoria', 'Conservatória do Registo Predial', 'imovel', 'property', 'dev_property_legal_data', 'conservatoria_crp', 'text', false, true, 30),
  ('imovel_ficha_registo', 'Ficha do Registo Predial', 'imovel', 'property', 'dev_property_legal_data', 'descricao_ficha', 'text', false, true, 31),
  ('imovel_ficha_ano', 'Ano da ficha do Registo Predial', 'imovel', 'property', 'dev_property_legal_data', 'descricao_ficha_ano', 'text', false, true, 32),
  ('imovel_artigo_matricial', 'Artigo matricial', 'imovel', 'property', 'dev_property_legal_data', 'artigo_matricial', 'text', false, true, 33),
  ('imovel_fracao_autonoma', 'Fracção autónoma', 'imovel', 'property', 'dev_property_legal_data', 'fracao_autonoma', 'text', false, true, 34),
  ('imovel_freguesia_fiscal', 'Freguesia fiscal', 'imovel', 'property', 'dev_property_legal_data', 'freguesia_fiscal', 'text', false, true, 35),
  ('imovel_concelho_fiscal', 'Concelho fiscal', 'imovel', 'property', 'dev_property_legal_data', 'concelho', 'text', false, true, 36)
ON CONFLICT (key) DO NOTHING;

-- Property internal (comissão, contrato, etc.)
INSERT INTO tpl_variables (key, label, category, source_entity, source_table, source_column, format_type, is_system, is_active, order_index)
VALUES
  ('imovel_comissao', 'Comissão acordada', 'imovel', 'property', 'dev_property_internal', 'commission_agreed', 'currency', false, true, 40),
  ('imovel_contrato_prazo', 'Prazo do contrato', 'imovel', 'property', 'dev_property_internal', 'contract_term', 'text', false, true, 41),
  ('imovel_contrato_expiracao', 'Data de expiração do contrato', 'imovel', 'property', 'dev_property_internal', 'contract_expiry', 'date', false, true, 42),
  ('imovel_regime_contrato', 'Regime contratual (exclusivo/aberto)', 'imovel', 'property', 'dev_property_internal', 'contract_regime', 'text', false, true, 43)
ON CONFLICT (key) DO NOTHING;

-- 3. Map CMI template pdf fields ─────────────────────────────────────
-- Template ID: 9223bdfc-31a0-4918-b5ee-580760ba8b32

-- Owner fields
UPDATE doc_pdf_field_mappings SET variable_key = 'proprietario_estado_civil'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'estado civil';

UPDATE doc_pdf_field_mappings SET variable_key = 'proprietario_regime'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'sob o regime de bens';

UPDATE doc_pdf_field_mappings SET variable_key = 'proprietario_nif'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'contribuinte fiscal n';

-- Property location
UPDATE doc_pdf_field_mappings SET variable_key = 'imovel_freguesia'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'freguesia';

UPDATE doc_pdf_field_mappings SET variable_key = 'imovel_concelho'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'concelho';

-- Property type / business type
-- "urbano  estabelecimento comercial destinado a 1" reads like the base
-- property_type (ex: "apartamento"). Keep "destinado a 2" on tipologia
-- (already mapped).
UPDATE doc_pdf_field_mappings SET variable_key = 'imovel_tipo'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'urbano  estabelecimento comercial destinado a 1';

-- Legal data: Conservatória, ficha
UPDATE doc_pdf_field_mappings SET variable_key = 'imovel_conservatoria'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'descrito na Conservatória do Registo Predial de 1';

UPDATE doc_pdf_field_mappings SET variable_key = 'imovel_ficha_ano'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'descrito na Conservatória do Registo Predial de 2';

UPDATE doc_pdf_field_mappings SET variable_key = 'imovel_ficha_registo'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'sob a ficha n';

UPDATE doc_pdf_field_mappings SET variable_key = 'imovel_freguesia_fiscal'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'da freguesia de';

UPDATE doc_pdf_field_mappings SET variable_key = 'imovel_artigo_matricial'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'n';

-- Certificação energética (the mapping slot has a peculiar name, bind via pdf_field_name)
UPDATE doc_pdf_field_mappings SET variable_key = 'certificado_energetico'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'e a certificação energética';

-- Preço de venda / arrendamento
UPDATE doc_pdf_field_mappings SET variable_key = 'imovel_preco'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'pelo preço de';

-- Consultor (angariador)
UPDATE doc_pdf_field_mappings SET variable_key = 'consultor_nome'
 WHERE template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
   AND pdf_field_name = 'angariador';

-- Área util ("undefined_5" adjacent to "divisões assoalhadas") — skip
-- unmapped: residentes, undefined_N (ambiguous placeholders), checkboxes,
-- prazo (manual), etc. These can be filled via manual_values in the fill
-- request if needed.
