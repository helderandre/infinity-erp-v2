-- PROC-NEG: add "Pedido de Documentação" as the FIRST step of stage 1.
--
-- The fecho process must START by emailing the involved parties for the docs
-- needed to draft the CPCV (recipients/content vary by deal_type — pleno→buyers,
-- angariacao_externa→listing agency, comprador_externo→buyer's agency; consultant
-- adjusts in the composer). Additive + idempotent (fixed UUIDs + ON CONFLICT).
--
-- Pairs with the hardcoded rule `neg_pedido_documentacao` (email). The tpl_subtask
-- keeps the production old-flow working until the handoff migration deletes tpl_subtasks.
--
-- REVERT:
--   DELETE FROM tpl_subtasks WHERE id='a1b2c3d4-5e6f-4071-8293-a4b5c6d7e8f9';
--   DELETE FROM tpl_tasks WHERE id='c4e9f1b2-3a4d-4c5e-8f90-1a2b3c4d5e6f';
--   DELETE FROM tpl_email_library WHERE id='d5f0e1a2-3b4c-4d5e-9f60-718293a4b5c6';

INSERT INTO tpl_email_library (id, name, subject, body_html, signature_mode, scope, usage_count, is_active, is_system, category, slug)
VALUES (
  'd5f0e1a2-3b4c-4d5e-9f60-718293a4b5c6',
  'PROC-NEG — Pedido de Documentação (Fecho)',
  'Documentação necessária para o Contrato de Promessa (CPCV)',
  '<p>Olá,</p><p>Para avançarmos com a elaboração do Contrato de Promessa de Compra e Venda (CPCV), agradecemos o envio da seguinte documentação:</p><ul><li>Documento de identificação</li><li>NIF</li><li>Comprovativo de morada</li><li>IBAN</li><li>Comprovativo de origem de fundos</li></ul><p>Ficamos a aguardar e estamos disponíveis para qualquer esclarecimento.</p><p>Com os melhores cumprimentos,<br/>{{consultor_nome}}</p>',
  'process_owner', 'global', 0, true, true, 'PROC-NEG', 'neg-pedido-documentacao'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tpl_tasks (id, tpl_stage_id, title, action_type, order_index, config)
SELECT 'c4e9f1b2-3a4d-4c5e-8f90-1a2b3c4d5e6f', s.id, 'Pedido de Documentação', 'COMPOSITE', 0, '{}'::jsonb
FROM tpl_stages s
WHERE s.tpl_process_id = 'ca943474-2514-4781-b91f-83e76a8b7831' AND s.order_index = 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO tpl_subtasks (id, tpl_task_id, title, order_index, config)
VALUES (
  'a1b2c3d4-5e6f-4071-8293-a4b5c6d7e8f9',
  'c4e9f1b2-3a4d-4c5e-8f90-1a2b3c4d5e6f',
  'Email de pedido de documentação enviado',
  0,
  '{"type":"email","email_library_id":"d5f0e1a2-3b4c-4d5e-9f60-718293a4b5c6"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
