-- ============================================================================
-- 20260625_neg_cpcv_doc_template_and_schedule.sql
-- PROC-NEG (fecho de negócio) — duas mudanças aditivas para a vista NOVA
-- (NegocioProcessPanel / "Passos"). NÃO toca no template declarativo antigo.
--
--  (1) "Criar CPCV" com o MESMO design do "Criar CMI":
--      A CMI (id 9223bdfc-31a0-4918-b5ee-580760ba8b32) é um template PDF
--      (template_type='pdf', 75 field mappings, Convictus_CMI.pdf no R2). Clona-se
--      numa nova linha de tpl_doc_library 'Minuta CPCV' (UUID FIXO
--      cf0cb71e-9d3a-4b2c-8e1f-5a6d7c8b9e0f) + os 75 field mappings. É um MODELO
--      PROVISÓRIO — reutiliza o PDF da CMI como placeholder ("usar a CMI por agora").
--      O file_key fica NULL de propósito: assim eliminar/substituir o modelo CPCV
--      NUNCA apaga o PDF da CMI no R2. Quando existir o PDF real do CPCV,
--      substitui-se em Definições › Templates de documentos (upload + remapear
--      campos) — sem mudar código (a rule aponta para este UUID estável).
--      A rule neg_cpcv_minuta passa de checklist → generate_doc com este UUID:
--      subtask-card-list → SubtaskCardDoc → SubtaskPdfSheet (igual à CMI).
--
--  (2) Activar o passo "Registar data/hora/local do CPCV" (schedule_cpcv):
--      adiciona a task 'Registar data do CPCV' à stage CPCV do template de
--      negócio com config.hook='schedule_cpcv'. O submit já cria a row
--      deal_events(event_type='cpcv') e o endpoint .../schedule-event já trata o
--      hook schedule_cpcv (mesma lógica de schedule_escritura) — só faltava a
--      task (e a rule neg_cpcv_agendar, em código). Sem esta task, o passo
--      'registar_datas_cpcv' fica vazio e não aparece na vista de passos.
--
-- Idempotente (ON CONFLICT / NOT EXISTS). Greenfield (0 proc_instances PROC-NEG
-- vivas — sem backfill).
--
-- REVERT:
--   delete from public.doc_pdf_field_mappings where template_id = 'cf0cb71e-9d3a-4b2c-8e1f-5a6d7c8b9e0f';
--   delete from public.tpl_doc_library      where id          = 'cf0cb71e-9d3a-4b2c-8e1f-5a6d7c8b9e0f';
--   delete from public.tpl_tasks t using public.tpl_stages s
--     where t.tpl_stage_id = s.id
--       and s.tpl_process_id = 'ca943474-2514-4781-b91f-83e76a8b7831'
--       and s.name = 'CPCV' and t.title = 'Registar data do CPCV';
-- ============================================================================

-- (1a) Clona a CMI → 'Minuta CPCV' (modelo provisório).
insert into public.tpl_doc_library
  (id, name, template_type, doc_type_id, file_url, file_key, content_html,
   file_name, file_size, total_fields, font_path, description)
select
  'cf0cb71e-9d3a-4b2c-8e1f-5a6d7c8b9e0f'::uuid,
  'Minuta CPCV',
  template_type,            -- 'pdf'
  null,                     -- sem doc_type (não é uma CMI)
  file_url,                 -- placeholder: aponta para o PDF da CMI no R2
  null,                     -- file_key NULL → eliminar/substituir o CPCV não toca no PDF da CMI
  content_html,             -- NULL na CMI
  file_name,
  file_size,
  total_fields,
  font_path,
  'Modelo provisório do CPCV (clonado da minuta CMI). Substituir pelo PDF real do CPCV em Definições › Templates de documentos quando disponível.'
from public.tpl_doc_library
where id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
on conflict (id) do nothing;

-- (1b) Clona os 75 field mappings da CMI para o modelo CPCV (idempotente).
insert into public.doc_pdf_field_mappings
  (template_id, pdf_field_name, field_type, field_options, variable_key,
   default_value, transform, font_size, is_required, display_label,
   display_order, page_number)
select
  'cf0cb71e-9d3a-4b2c-8e1f-5a6d7c8b9e0f'::uuid,
  pdf_field_name, field_type, field_options, variable_key,
  default_value, transform, font_size, is_required, display_label,
  display_order, page_number
from public.doc_pdf_field_mappings
where template_id = '9223bdfc-31a0-4918-b5ee-580760ba8b32'
  and not exists (
    select 1 from public.doc_pdf_field_mappings m
    where m.template_id = 'cf0cb71e-9d3a-4b2c-8e1f-5a6d7c8b9e0f'::uuid
  );

-- (2) Task "Registar data do CPCV" (hook schedule_cpcv) na stage CPCV.
insert into public.tpl_tasks
  (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
select
  s.id,
  'Registar data do CPCV',
  'Registar a data, hora e local da assinatura do CPCV. Sincroniza a row em deal_events(event_type=cpcv) criada na submissão; reagendamentos incrementam reschedule_count.',
  'COMPOSITE', true, 'normal', 10,
  '{"hook":"schedule_cpcv"}'::jsonb
from public.tpl_stages s
where s.tpl_process_id = 'ca943474-2514-4781-b91f-83e76a8b7831'
  and s.name = 'CPCV'
  and not exists (
    select 1 from public.tpl_tasks t
    where t.tpl_stage_id = s.id and t.title = 'Registar data do CPCV'
  );
