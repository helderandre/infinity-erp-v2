-- ════════════════════════════════════════════════════════════════════
-- CMI (Contrato de Mediação Imobiliária) — mapeamento COMPLETO dos 75
-- campos do PDF Convictus_CMI (tpl_doc_library 9223bdfc-31a0-4918-b5ee-
-- 580760ba8b32) às colunas da nossa estrutura.
--
-- Faz 4 coisas:
--   1. Corrige 4 mapeamentos ERRADOS (o valor caía no campo errado):
--      • `nos`        estava em proprietario_nif mas é o n.º C.C/B.I
--      • `nos_2`       (o n.º contribuinte fiscal) ficava VAZIO → NIF
--      • `descrito…Predial de 2` estava em imovel_ficha_ano mas é a
--        Câmara Municipal emissora da licença
--      • `contribuinte fiscal n` / `angariador` estavam TROCADOS
--        (o nome do angariador caía no slot do NIF e vice-versa)
--   2. Liga campos cujo dado já existe (código postal, prazo, comissão…)
--   3. Adiciona colunas a `owners` para o bloco de identificação
--      (cônjuge, n.º C.C, código postal, localidade) + variáveis
--   4. Liga as checkboxes a dados reais via transforms condicionais
--      (business_type → Compra/Arrend./Trespasse; has_mortgage → ónus;
--       commission_type → % vs fixo).
--
-- Aditiva e idempotente. Reversível (ver fundo do ficheiro).
-- ════════════════════════════════════════════════════════════════════

-- ── 0. Colunas novas em owners (bloco de identificação do CMI) ────────
ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS cc_number        text,
  ADD COLUMN IF NOT EXISTS postal_code      text,
  ADD COLUMN IF NOT EXISTS locality         text,
  ADD COLUMN IF NOT EXISTS spouse_name      text,
  ADD COLUMN IF NOT EXISTS spouse_cc_number text,
  ADD COLUMN IF NOT EXISTS spouse_nif       text;

COMMENT ON COLUMN owners.cc_number        IS 'N.º do Cartão de Cidadão / B.I. do proprietário (usado no CMI).';
COMMENT ON COLUMN owners.postal_code      IS 'Código postal da morada do proprietário (AAAA-BBB).';
COMMENT ON COLUMN owners.locality         IS 'Localidade da morada do proprietário.';
COMMENT ON COLUMN owners.spouse_name      IS 'Nome do cônjuge (2.º contratante) — preenchido quando casado.';
COMMENT ON COLUMN owners.spouse_cc_number IS 'N.º C.C/B.I. do cônjuge.';
COMMENT ON COLUMN owners.spouse_nif       IS 'NIF do cônjuge.';

-- ── 1. Variáveis novas (catálogo tpl_variables) ───────────────────────
INSERT INTO tpl_variables (key, label, category, source_entity, source_table, source_column, format_type, is_system, is_active, order_index)
VALUES
  -- Consultor / angariador
  ('consultor_nif', 'NIF do consultor (angariador)', 'consultor', 'consultant', 'dev_consultant_private_data', 'nif', 'text', false, true, 20),
  -- Proprietário (campos novos)
  ('proprietario_cc', 'N.º C.C/B.I. do proprietário', 'proprietario', 'owner', 'owners', 'cc_number', 'text', false, true, 15),
  ('proprietario_codigo_postal', 'Código postal do proprietário', 'proprietario', 'owner', 'owners', 'postal_code', 'text', false, true, 16),
  ('proprietario_localidade', 'Localidade do proprietário', 'proprietario', 'owner', 'owners', 'locality', 'text', false, true, 17),
  ('conjuge_nome', 'Nome do cônjuge', 'proprietario', 'owner', 'owners', 'spouse_name', 'text', false, true, 18),
  ('conjuge_cc', 'N.º C.C/B.I. do cônjuge', 'proprietario', 'owner', 'owners', 'spouse_cc_number', 'text', false, true, 19),
  ('conjuge_nif', 'NIF do cônjuge', 'proprietario', 'owner', 'owners', 'spouse_nif', 'text', false, true, 20),
  -- Imóvel (campos que alimentam qualidade + checkboxes)
  ('imovel_business_type', 'Tipo de negócio do imóvel (venda/arrend.)', 'imovel', 'property', 'dev_properties', 'business_type', 'text', false, true, 50),
  ('imovel_tem_hipoteca', 'Tem hipoteca/ónus (sim/não)', 'imovel', 'property', 'dev_property_internal', 'has_mortgage', 'text', false, true, 51),
  ('imovel_mortgage_owed', 'Valor em dívida (ónus)', 'imovel', 'property', 'dev_property_internal', 'mortgage_owed', 'currency', false, true, 52),
  ('imovel_tipo_comissao', 'Tipo de comissão (% / fixa)', 'imovel', 'property', 'dev_property_internal', 'commission_type', 'text', false, true, 53)
ON CONFLICT (key) DO NOTHING;

-- ── 2. Mapeamentos do PDF ─────────────────────────────────────────────
-- Helper conceptual: todas as UPDATE filtram pelo template + pdf_field_name.

DO $cmi$
DECLARE
  tpl uuid := '9223bdfc-31a0-4918-b5ee-580760ba8b32';
BEGIN

  -- ░░ 2a. CORREÇÕES DE BUGS ░░

  -- `nos` é o n.º C.C/B.I (não o NIF). NIF passa para `nos_2`.
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'proprietario_cc', transform = NULL
   WHERE template_id = tpl AND pdf_field_name = 'nos';

  UPDATE doc_pdf_field_mappings
     SET variable_key = 'proprietario_nif', transform = NULL
   WHERE template_id = tpl AND pdf_field_name = 'nos_2';

  -- "descrito na Conservatória do Registo Predial de 2" é, na verdade, a
  -- Câmara Municipal que emitiu a licença de utilização (não o ano da ficha).
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_licenca_emissor', transform = NULL
   WHERE template_id = tpl AND pdf_field_name = 'descrito na Conservatória do Registo Predial de 2';

  -- Cláusula 11 (Angariador): os 2 campos estavam TROCADOS.
  -- `contribuinte fiscal n` ocupa o slot do NOME ("O/A ___").
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'consultor_nome', transform = NULL
   WHERE template_id = tpl AND pdf_field_name = 'contribuinte fiscal n';
  -- `angariador` ocupa o slot do NIF ("contribuinte fiscal n.º ___").
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'consultor_nif', transform = NULL
   WHERE template_id = tpl AND pdf_field_name = 'angariador';

  -- ░░ 2b. LIGAÇÕES FÁCEIS (fonte já existia, campo estava vazio) ░░

  -- Código postal do imóvel (dividido em 2 campos AAAA-BBB)
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_codigo_postal', transform = 'cp_prefix'
   WHERE template_id = tpl AND pdf_field_name = 'undefined_5';
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_codigo_postal', transform = 'cp_suffix'
   WHERE template_id = tpl AND pdf_field_name = 'undefined_6';

  -- Localidade do imóvel (entre "em" e "(freguesia)")
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_zona', transform = NULL
   WHERE template_id = tpl AND pdf_field_name = 'undefined_7';

  -- Prazo de validade do contrato (Cláusula 8)
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_contrato_prazo', transform = NULL
   WHERE template_id = tpl AND pdf_field_name = 'dias meses contados a partir da data da sua';

  -- Comissão — valor fixo em € (Cláusula 5, alínea fixa)
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_comissao', transform = NULL
   WHERE template_id = tpl AND pdf_field_name = 'A quantia de_2';

  -- Valor em dívida dos ónus (Cláusula 3)
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_mortgage_owed', transform = NULL
   WHERE template_id = tpl AND pdf_field_name = 'pelo valor de';

  -- "na qualidade de" → derivar de business_type (Proprietário/Senhorio/…)
  -- (antes apontava a negocio_tipo, que nunca resolve no contexto do CMI)
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_business_type', transform = 'qualidade_from_business'
   WHERE template_id = tpl AND pdf_field_name = 'na qualidade de';

  -- ░░ 2c. BLOCO DE IDENTIFICAÇÃO DO PROPRIETÁRIO (colunas novas) ░░

  -- Cônjuge (2.º contratante)
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'conjuge_nome', transform = NULL
   WHERE template_id = tpl AND pdf_field_name = 'residentes';
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'conjuge_cc', transform = NULL
   WHERE template_id = tpl AND pdf_field_name = 'undefined_4';
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'conjuge_nif', transform = NULL
   WHERE template_id = tpl AND pdf_field_name = 'adiante designados como Segundos Contratantes';

  -- Localidade + código postal do proprietário
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'proprietario_localidade', transform = NULL
   WHERE template_id = tpl AND pdf_field_name = 'em';
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'proprietario_codigo_postal', transform = 'cp_prefix'
   WHERE template_id = tpl AND pdf_field_name = 'undefined_2';
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'proprietario_codigo_postal', transform = 'cp_suffix'
   WHERE template_id = tpl AND pdf_field_name = 'undefined_3';

  -- ░░ 2d. DATA DA LICENÇA — dividida em 3 campos (dia/mês/ano) ░░
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_licenca_data', transform = 'date_part_day'
   WHERE template_id = tpl AND pdf_field_name = 'em_2';
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_licenca_data', transform = 'date_part_month'
   WHERE template_id = tpl AND pdf_field_name = 'undefined_8';
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_licenca_data', transform = 'date_part_year'
   WHERE template_id = tpl AND pdf_field_name = 'undefined_9';

  -- ░░ 2e. CHECKBOXES (marcadas automaticamente a partir dos dados) ░░

  -- Cláusula 2: tipo de negócio
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_business_type', transform = 'checkbox_if_venda'
   WHERE template_id = tpl AND pdf_field_name = 'Check Box6';   -- Compra
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_business_type', transform = 'checkbox_if_trespasse'
   WHERE template_id = tpl AND pdf_field_name = 'Check Box7';   -- Trespasse
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_business_type', transform = 'checkbox_if_arrendamento'
   WHERE template_id = tpl AND pdf_field_name = 'Check Box8';   -- Arrendamento
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_business_type', transform = 'checkbox_if_outros'
   WHERE template_id = tpl AND pdf_field_name = 'Check Box9';   -- Outros

  -- Cláusula 3: ónus
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_tem_hipoteca', transform = 'checkbox_if_false'
   WHERE template_id = tpl AND pdf_field_name = 'Check Box16';  -- Livre de ónus
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_tem_hipoteca', transform = 'checkbox_if_true'
   WHERE template_id = tpl AND pdf_field_name = 'Check Box17';  -- Recaem ónus

  -- Cláusula 5: tipo de remuneração
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_tipo_comissao', transform = 'checkbox_if_percentage'
   WHERE template_id = tpl AND pdf_field_name = 'Check Box11';  -- comissão %
  UPDATE doc_pdf_field_mappings
     SET variable_key = 'imovel_tipo_comissao', transform = 'checkbox_if_fixed'
   WHERE template_id = tpl AND pdf_field_name = 'Check Box15';  -- comissão fixa

END
$cmi$;

-- ════════════════════════════════════════════════════════════════════
-- REVERT (manual):
--   ALTER TABLE owners
--     DROP COLUMN IF EXISTS cc_number, DROP COLUMN IF EXISTS postal_code,
--     DROP COLUMN IF EXISTS locality, DROP COLUMN IF EXISTS spouse_name,
--     DROP COLUMN IF EXISTS spouse_cc_number, DROP COLUMN IF EXISTS spouse_nif;
--   DELETE FROM tpl_variables WHERE key IN (
--     'consultor_nif','proprietario_cc','proprietario_codigo_postal',
--     'proprietario_localidade','conjuge_nome','conjuge_cc','conjuge_nif',
--     'imovel_business_type','imovel_tem_hipoteca','imovel_mortgage_owed',
--     'imovel_tipo_comissao');
--   -- e repor os variable_key/transform anteriores em doc_pdf_field_mappings
--   -- (ver git blame de 20260427_cmi_variables_and_mappings.sql).
-- ════════════════════════════════════════════════════════════════════
