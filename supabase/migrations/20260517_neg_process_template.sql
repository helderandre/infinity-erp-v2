-- ==================================================================
-- MIGRATION: neg_process_template
-- ==================================================================
-- Seeds the system PROC-NEG template (`tpl_processes` + `tpl_stages`
-- + `tpl_tasks` + `tpl_subtasks`) for the deal-closing workflow.
--
-- Stages (5; "Aprovação" foi removida — fecho de negócios é imediato):
--
--   1. Recolha Documental
--   2. CPCV                                 (skip-completável condicional)
--   3. Pré-Escritura                        (skip-completável condicional)
--   4. Escritura / Contrato Final
--   5. Encerramento
--
-- Subtasks: nesta primeira iteração APENAS `upload` e `checklist`.
-- O motor de subtasks já suporta {email, generate_doc, form, field,
-- schedule_event, external_form}, mas:
--   • email subtasks precisam de `email_library_id` válido em
--     `tpl_email_library` — agendado para commit "neg-email-library";
--   • generate_doc precisa de `doc_library_id` em `tpl_doc_library`
--     — agendado para commit "cpcv-template" (escrita do CPCV/escritura
--     com variáveis);
--   • schedule_event precisa de extensão do populate engine para
--     materializar uma row em `deal_events` ao concluir a subtask;
--   • form/field com `target_entity ∈ {deal, deal_client,
--     deal_payment}` precisam do populate engine ler `deal_clients`
--     em vez de `property_owners` (process_type='negocio' branch).
--
-- Onde a UI rica seria útil (foto+IA do momento, direitos preferência
-- via Chrome extension, inquérito de satisfação) usamos `checklist`
-- como placeholder com `description` explícita; cada uma será
-- promovida a subtask type dedicado num commit posterior.
--
-- Per-client repeat (uma subtask de upload por comprador / por
-- vendedor externo) também fica para a fase do populate engine
-- estendido. Por agora, há UMA subtask por doc_type; o consultor
-- adiciona múltiplos ficheiros à mesma subtask quando há vários
-- compradores (com `label` para desambiguar).
--
-- IDEMPOTÊNCIA: a inserção é guardada por `IF EXISTS` no início.
-- Se já houver template com process_type='negocio' AND
-- name='Processo de Negócio' (não soft-deleted), a migration faz
-- early return. Permite re-aplicar com segurança.
--
-- ADITIVA. Revert no fundo do ficheiro.
-- ==================================================================

DO $do$
DECLARE
  v_proc_id          uuid;
  v_existing_id      uuid;

  -- Stage IDs
  v_stage_recolha_id    uuid;
  v_stage_cpcv_id       uuid;
  v_stage_pre_escr_id   uuid;
  v_stage_escr_id       uuid;
  v_stage_encerr_id     uuid;

  -- Task IDs (used for dependency_task_id wiring; only the ones we
  -- chain explicitly are captured)
  v_task_id          uuid;
  v_task_cpcv_assinado_id     uuid;
  v_task_sinal_recebido_id    uuid;
  v_task_escr_assinada_id     uuid;
  v_task_pago_final_id        uuid;

  -- doc_type IDs (looked up by name from the catalogue seeded in
  -- 20260516_neg_process_foundations)
  v_dt_cc_comprador            uuid;
  v_dt_nif_comprador           uuid;
  v_dt_morada_comprador        uuid;
  v_dt_iban_comprador          uuid;
  v_dt_origem_fundos           uuid;
  v_dt_certidao_comercial_c    uuid;
  v_dt_rcbe_comprador          uuid;
  v_dt_cc_rep_comprador        uuid;
  v_dt_nipc_comprador          uuid;
  v_dt_iban_empresa_comprador  uuid;
  v_dt_pep                     uuid;
  v_dt_impic                   uuid;
  v_dt_ia_comprador            uuid;
  v_dt_cc_vendedor_ext         uuid;
  v_dt_nif_vendedor_ext        uuid;
  v_dt_caderneta_ext           uuid;
  v_dt_certidao_ext            uuid;
  v_dt_ce_ext                  uuid;
  v_dt_distrate                uuid;
  v_dt_decl_condominio         uuid;
  v_dt_dir_preferencia         uuid;
  v_dt_cpcv_assinado           uuid;
  v_dt_escr_assinada           uuid;
  v_dt_arrend_assinado         uuid;
  v_dt_compr_sinal             uuid;
  v_dt_compr_final             uuid;
  v_dt_compr_caucao            uuid;
BEGIN
  -- ── Idempotency guard ──
  SELECT id INTO v_existing_id
    FROM public.tpl_processes
    WHERE process_type = 'negocio'
      AND name = 'Processo de Negócio'
      AND (deleted_at IS NULL)
    LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'PROC-NEG template already exists (id=%); skipping seed.', v_existing_id;
    RETURN;
  END IF;

  -- ── Lookup doc_type IDs (seeded in 20260516) ──
  SELECT id INTO v_dt_cc_comprador           FROM public.doc_types WHERE name = 'CC/Passaporte do Comprador';
  SELECT id INTO v_dt_nif_comprador          FROM public.doc_types WHERE name = 'NIF do Comprador';
  SELECT id INTO v_dt_morada_comprador       FROM public.doc_types WHERE name = 'Comprovativo de Morada do Comprador';
  SELECT id INTO v_dt_iban_comprador         FROM public.doc_types WHERE name = 'IBAN do Comprador';
  SELECT id INTO v_dt_origem_fundos          FROM public.doc_types WHERE name = 'Comprovativo de Origem de Fundos';
  SELECT id INTO v_dt_certidao_comercial_c   FROM public.doc_types WHERE name = 'Certidão Comercial do Comprador';
  SELECT id INTO v_dt_rcbe_comprador         FROM public.doc_types WHERE name = 'RCBE do Comprador';
  SELECT id INTO v_dt_cc_rep_comprador       FROM public.doc_types WHERE name = 'CC do Representante Legal (Comprador)';
  SELECT id INTO v_dt_nipc_comprador         FROM public.doc_types WHERE name = 'NIPC do Comprador';
  SELECT id INTO v_dt_iban_empresa_comprador FROM public.doc_types WHERE name = 'IBAN do Comprador (Empresa)';
  SELECT id INTO v_dt_pep                    FROM public.doc_types WHERE name = 'Declaração PEP';
  SELECT id INTO v_dt_impic                  FROM public.doc_types WHERE name = 'Comunicação IMPIC';
  SELECT id INTO v_dt_ia_comprador           FROM public.doc_types WHERE name = 'Verificação IA — Comprador';
  SELECT id INTO v_dt_cc_vendedor_ext        FROM public.doc_types WHERE name = 'CC/Passaporte do Vendedor (Externo)';
  SELECT id INTO v_dt_nif_vendedor_ext       FROM public.doc_types WHERE name = 'NIF do Vendedor (Externo)';
  SELECT id INTO v_dt_caderneta_ext          FROM public.doc_types WHERE name = 'Caderneta Predial (Externo)';
  SELECT id INTO v_dt_certidao_ext           FROM public.doc_types WHERE name = 'Certidão Permanente (Externo)';
  SELECT id INTO v_dt_ce_ext                 FROM public.doc_types WHERE name = 'Certificado Energético (Externo)';
  SELECT id INTO v_dt_distrate               FROM public.doc_types WHERE name = 'Distrate de Hipoteca';
  SELECT id INTO v_dt_decl_condominio        FROM public.doc_types WHERE name = 'Declaração de Não-Dívida ao Condomínio';
  SELECT id INTO v_dt_dir_preferencia        FROM public.doc_types WHERE name = 'Direitos de Preferência';
  SELECT id INTO v_dt_cpcv_assinado          FROM public.doc_types WHERE name = 'Cópia CPCV Assinado';
  SELECT id INTO v_dt_escr_assinada          FROM public.doc_types WHERE name = 'Cópia Escritura Assinada';
  SELECT id INTO v_dt_arrend_assinado        FROM public.doc_types WHERE name = 'Cópia Contrato de Arrendamento Assinado';
  SELECT id INTO v_dt_compr_sinal            FROM public.doc_types WHERE name = 'Comprovativo de Pagamento de Sinal (CPCV)';
  SELECT id INTO v_dt_compr_final            FROM public.doc_types WHERE name = 'Comprovativo de Pagamento Final (Escritura)';
  SELECT id INTO v_dt_compr_caucao           FROM public.doc_types WHERE name = 'Comprovativo de Pagamento de Caução';

  IF v_dt_cc_comprador IS NULL THEN
    RAISE EXCEPTION 'doc_types catalogue missing — apply 20260516_neg_process_foundations first.';
  END IF;

  -- ── 1. tpl_processes ──
  INSERT INTO public.tpl_processes (name, description, process_type, is_active)
  VALUES (
    'Processo de Negócio',
    'Processo de fecho de negócios (PROC-NEG): recolha documental, CPCV, pré-escritura, escritura/contrato final, encerramento. Cobre os 4 cenários: pleno, pleno_agencia, comprador_externo, angariacao_externa. Stages CPCV e Pré-Escritura são auto-bypassadas conforme deals.payment_structure e business_type.',
    'negocio',
    true
  )
  RETURNING id INTO v_proc_id;

  -- ── 2. tpl_stages ──
  INSERT INTO public.tpl_stages (tpl_process_id, name, description, order_index)
  VALUES (v_proc_id, 'Recolha Documental', 'Documentos do comprador, do vendedor (se externo), do imóvel (se externo), e compliance KYC.', 1)
  RETURNING id INTO v_stage_recolha_id;

  INSERT INTO public.tpl_stages (tpl_process_id, name, description, order_index)
  VALUES (v_proc_id, 'CPCV', 'Contrato de Promessa de Compra e Venda. Auto-bypass se payment_structure ∈ {escritura_only, single}.', 2)
  RETURNING id INTO v_stage_cpcv_id;

  INSERT INTO public.tpl_stages (tpl_process_id, name, description, order_index)
  VALUES (v_proc_id, 'Pré-Escritura', 'Distrate, condomínio, agendamento e preparação da escritura. Skip para arrendamento.', 3)
  RETURNING id INTO v_stage_pre_escr_id;

  INSERT INTO public.tpl_stages (tpl_process_id, name, description, order_index)
  VALUES (v_proc_id, 'Escritura / Contrato Final', 'Assinatura final, recebimento do remanescente, faturação e pagamentos. Para arrendamento, é o contrato de arrendamento.', 4)
  RETURNING id INTO v_stage_escr_id;

  INSERT INTO public.tpl_stages (tpl_process_id, name, description, order_index)
  VALUES (v_proc_id, 'Encerramento', 'Emails finais, inquérito de satisfação, review Google, fecho administrativo.', 5)
  RETURNING id INTO v_stage_encerr_id;

  -- =================================================================
  -- STAGE 1 — Recolha Documental
  -- =================================================================

  -- Task 1.1: Documentos do Comprador (singular)
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_recolha_id, 'Documentos do Comprador (Singular)', 'Aplicável quando há pelo menos um comprador pessoa singular. Em deals com múltiplos compradores, junta-se um ficheiro por comprador a cada subtask (com label).', 'COMPOSITE', true, 'normal', 1, '{"applies_when":{"buyer_has_singular":true}}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'CC/Passaporte', true, 0, jsonb_build_object('type','upload','doc_type_id', v_dt_cc_comprador)),
    (v_task_id, 'NIF', true, 1, jsonb_build_object('type','upload','doc_type_id', v_dt_nif_comprador)),
    (v_task_id, 'Comprovativo de Morada', true, 2, jsonb_build_object('type','upload','doc_type_id', v_dt_morada_comprador)),
    (v_task_id, 'IBAN', true, 3, jsonb_build_object('type','upload','doc_type_id', v_dt_iban_comprador)),
    (v_task_id, 'Comprovativo de Origem de Fundos', true, 4, jsonb_build_object('type','upload','doc_type_id', v_dt_origem_fundos));

  -- Task 1.2: Documentos do Comprador (Empresa)
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_recolha_id, 'Documentos do Comprador (Empresa)', 'Aplicável quando há pelo menos um comprador pessoa colectiva.', 'COMPOSITE', false, 'normal', 2, '{"applies_when":{"buyer_has_coletiva":true}}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Certidão Comercial', true, 0, jsonb_build_object('type','upload','doc_type_id', v_dt_certidao_comercial_c)),
    (v_task_id, 'RCBE', true, 1, jsonb_build_object('type','upload','doc_type_id', v_dt_rcbe_comprador)),
    (v_task_id, 'CC do Representante Legal', true, 2, jsonb_build_object('type','upload','doc_type_id', v_dt_cc_rep_comprador)),
    (v_task_id, 'NIPC', true, 3, jsonb_build_object('type','upload','doc_type_id', v_dt_nipc_comprador)),
    (v_task_id, 'IBAN', true, 4, jsonb_build_object('type','upload','doc_type_id', v_dt_iban_empresa_comprador));

  -- Task 1.3: Documentos do Vendedor Externo (só angariacao_externa)
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_recolha_id, 'Documentos do Vendedor (Externo)', 'Pedidos à outra agência. Apenas quando deal_type=''angariacao_externa''. Em pleno/pleno_agencia/comprador_externo o vendedor é interno e os documentos do imóvel vêm da angariação.', 'COMPOSITE', false, 'normal', 3, '{"applies_when":{"deal_type":"angariacao_externa"}}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'CC/Passaporte do Vendedor', true, 0, jsonb_build_object('type','upload','doc_type_id', v_dt_cc_vendedor_ext)),
    (v_task_id, 'NIF do Vendedor', true, 1, jsonb_build_object('type','upload','doc_type_id', v_dt_nif_vendedor_ext));

  -- Task 1.4: Documentos do Imóvel (Externo)
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_recolha_id, 'Documentos do Imóvel (Externo)', 'Pedidos à outra agência angariadora. Apenas quando deal_type=''angariacao_externa''.', 'COMPOSITE', false, 'normal', 4, '{"applies_when":{"deal_type":"angariacao_externa"}}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Caderneta Predial', true, 0, jsonb_build_object('type','upload','doc_type_id', v_dt_caderneta_ext)),
    (v_task_id, 'Certidão Permanente', true, 1, jsonb_build_object('type','upload','doc_type_id', v_dt_certidao_ext)),
    (v_task_id, 'Certificado Energético', true, 2, jsonb_build_object('type','upload','doc_type_id', v_dt_ce_ext));

  -- Task 1.5: Compliance KYC
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_recolha_id, 'Compliance KYC', 'Declaração PEP, comunicação IMPIC e output da verificação IA dos documentos do comprador. Obrigatório legal.', 'COMPOSITE', true, 'normal', 5, '{}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Declaração PEP assinada', true, 0, jsonb_build_object('type','upload','doc_type_id', v_dt_pep)),
    (v_task_id, 'Comunicação IMPIC submetida', true, 1, jsonb_build_object('type','upload','doc_type_id', v_dt_impic)),
    (v_task_id, 'Verificação IA dos documentos do comprador', false, 2, jsonb_build_object('type','upload','doc_type_id', v_dt_ia_comprador, 'hint','Será gerada automaticamente quando todos os documentos do comprador estiverem carregados.'));

  -- =================================================================
  -- STAGE 2 — CPCV
  -- =================================================================

  -- Task 2.1: Preparar minuta CPCV
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_cpcv_id, 'Preparar minuta CPCV', 'Se a angariação é nossa: geramos a minuta. Se externa: recebemos da outra agência e verificamos. Por agora upload manual da minuta; geração automática via tpl_doc_library fica para commit ''cpcv-template''.', 'COMPOSITE', true, 'normal', 1, '{}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Minuta CPCV preparada/recebida', true, 0, jsonb_build_object('type','checklist','hint','Upload futuro: doc_library_id da minuta CPCV (commit cpcv-template).'));

  -- Task 2.2: Enviar CPCV para assinatura
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_cpcv_id, 'Enviar CPCV para assinatura', 'Envio às partes (compradores, vendedores, e parceiros se houver agência externa).', 'COMPOSITE', true, 'normal', 2, '{}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'CPCV enviado a todas as partes', true, 0, jsonb_build_object('type','checklist','hint','Promovido a subtask type=email quando o tpl_email_library tiver template ''Envio de CPCV para assinatura''.'));

  -- Task 2.3: CPCV assinado (HOOK B)
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_cpcv_id, 'CPCV assinado por todas as partes', 'Marcar quando todas as partes assinaram. O hook propaga para deal_payments(moment=cpcv).is_signed=true, deal_events(event_type=cpcv).occurred_at, e deals.cpcv_actual_date.', 'COMPOSITE', true, 'urgent', 3, '{"hook":"cpcv_signed"}'::jsonb)
  RETURNING id INTO v_task_cpcv_assinado_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_cpcv_assinado_id, 'CPCV assinado', true, 0, jsonb_build_object('type','checklist'));

  -- Task 2.4: Foto e descrição IA do momento (marketing)
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config, dependency_task_id)
  VALUES (v_stage_cpcv_id, 'Foto e descrição IA do momento', 'Captura uma foto do momento de assinatura e gera uma descrição com IA para publicação no Instagram/LinkedIn. Cria row em deal_marketing_moments.', 'COMPOSITE', false, 'normal', 4, '{}'::jsonb, v_task_cpcv_assinado_id)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Foto do momento carregada', false, 0, jsonb_build_object('type','checklist','hint','Promovido a subtask type=upload com photo gallery quando o componente <DealMarketingMomentUpload> estiver pronto.')),
    (v_task_id, 'Descrição IA gerada e revista', false, 1, jsonb_build_object('type','checklist','hint','Promovido a subtask type=ai_caption quando o componente estiver pronto.'));

  -- Task 2.5: Sinal recebido (HOOK C)
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config, dependency_task_id)
  VALUES (v_stage_cpcv_id, 'Sinal recebido', 'Upload do comprovativo de pagamento do sinal. O hook propaga para deal_payments(moment=cpcv).is_received=true e cria row em company_transactions (income, draft).', 'COMPOSITE', true, 'urgent', 5, '{"hook":"cpcv_received"}'::jsonb, v_task_cpcv_assinado_id)
  RETURNING id INTO v_task_sinal_recebido_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_sinal_recebido_id, 'Comprovativo de Pagamento de Sinal', true, 0, jsonb_build_object('type','upload','doc_type_id', v_dt_compr_sinal));

  -- Task 2.6: Faturação CPCV
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config, dependency_task_id)
  VALUES (v_stage_cpcv_id, 'Faturação CPCV', 'Emitir factura à agência (ou ao colega/cliente conforme cenário) e enviar às partes necessárias. Cobre todos os splits em deal_payment_splits.', 'COMPOSITE', true, 'normal', 6, '{}'::jsonb, v_task_sinal_recebido_id)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Factura agência emitida', true, 0, jsonb_build_object('type','checklist','hint','UI futura listará deal_payment_splits para emitir factura por agente.')),
    (v_task_id, 'Factura enviada às partes', true, 1, jsonb_build_object('type','checklist'));

  -- Task 2.7: Pagamento aos consultores e parceiros
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config, dependency_task_id)
  VALUES (v_stage_cpcv_id, 'Pagamento aos consultores e parceiros', 'Processar pagamento conforme deal_payment_splits (consultor principal + parceiro interno + referrals + rede).', 'COMPOSITE', true, 'normal', 7, '{}'::jsonb, v_task_sinal_recebido_id)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Pagamento processado a todas as partes', true, 0, jsonb_build_object('type','checklist','hint','UI futura marcará consultant_paid=true em deal_payment_splits por agente.'));

  -- Task 2.8: Direitos de Preferência (só se angariação nossa)
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_cpcv_id, 'Direitos de Preferência', 'Submeter pedido de direitos de preferência (Câmara Municipal, IGESPAR, IHRU, arrendatário). Apenas quando a angariação é nossa (~75% dos casos). Integração com Chrome extension consome doc_registry da angariação para preencher o formulário.', 'COMPOSITE', false, 'normal', 8, '{"applies_when":{"angariacao_interna":true}}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Pedido submetido', false, 0, jsonb_build_object('type','checklist','hint','Promovido a subtask type=external_form quando o webhook da Chrome extension estiver pronto.')),
    (v_task_id, 'Resposta recebida', false, 1, jsonb_build_object('type','upload','doc_type_id', v_dt_dir_preferencia));

  -- Task 2.9: Guardar cópia CPCV
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config, dependency_task_id)
  VALUES (v_stage_cpcv_id, 'Guardar cópia CPCV assinado', 'Upload da cópia digitalizada do CPCV assinado por todas as partes.', 'COMPOSITE', true, 'normal', 9, '{}'::jsonb, v_task_cpcv_assinado_id)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Cópia CPCV Assinado', true, 0, jsonb_build_object('type','upload','doc_type_id', v_dt_cpcv_assinado));

  -- =================================================================
  -- STAGE 3 — Pré-Escritura
  -- =================================================================

  -- Task 3.1: Email checklist pré-escritura aos clientes
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_pre_escr_id, 'Email checklist aos clientes', 'Enviar email aos compradores com a checklist do que precisam para a escritura: distrate (se financiamento), declaração de não-dívida ao condomínio, comprovativo IRS, etc.', 'COMPOSITE', true, 'normal', 1, '{}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Email enviado aos clientes', true, 0, jsonb_build_object('type','checklist','hint','Promovido a subtask type=email quando o tpl_email_library tiver template ''Checklist Pré-Escritura''.'));

  -- Task 3.2: Distrate de Hipoteca (condicional)
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_pre_escr_id, 'Distrate de Hipoteca', 'Solicitar e receber o distrate da entidade financiadora do vendedor. Apenas quando há hipoteca activa.', 'COMPOSITE', false, 'normal', 2, '{"applies_when":{"property_has_mortgage":true}}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Distrate recebido', false, 0, jsonb_build_object('type','upload','doc_type_id', v_dt_distrate));

  -- Task 3.3: Declaração de não-dívida ao condomínio
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_pre_escr_id, 'Declaração de não-dívida ao condomínio', 'Solicitar à administração do condomínio. Validade típica: 3 meses.', 'COMPOSITE', true, 'normal', 3, '{"applies_when":{"property_has_condominium":true}}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Declaração recebida', true, 0, jsonb_build_object('type','upload','doc_type_id', v_dt_decl_condominio));

  -- Task 3.4: Agendar escritura
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_pre_escr_id, 'Agendar escritura', 'Marcar data, local, hora e notário/cartório. Actualiza a row em deal_events(event_type=escritura) já criada na submissão. Reagendamentos incrementam reschedule_count.', 'COMPOSITE', true, 'urgent', 4, '{"hook":"schedule_escritura"}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Escritura agendada', true, 0, jsonb_build_object('type','checklist','hint','Promovido a subtask type=schedule_event quando o populate engine suportar materialização em deal_events.'));

  -- Task 3.5: Confirmar presença das partes
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_pre_escr_id, 'Confirmar presença das partes', 'Contactar compradores, vendedores e parceiros para confirmar presença na escritura. Actualiza deal_events.attendees.', 'COMPOSITE', true, 'normal', 5, '{}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Presenças confirmadas', true, 0, jsonb_build_object('type','checklist'));

  -- Task 3.6: Preparar pasta física
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_pre_escr_id, 'Preparar pasta física', 'Cópia do CPCV + comprovativos de pagamento + KYC + distrate + declarações. Levar ao notário no dia da escritura.', 'COMPOSITE', true, 'normal', 6, '{}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Pasta física pronta', true, 0, jsonb_build_object('type','checklist'));

  -- =================================================================
  -- STAGE 4 — Escritura / Contrato Final
  -- =================================================================

  -- Task 4.1: Escritura/Contrato assinado (HOOK B)
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_escr_id, 'Escritura / Contrato assinado', 'Marcar quando assinado. O hook propaga para deal_payments(moment=escritura|single).is_signed=true, deal_events(event_type=escritura|contrato_arrendamento).occurred_at, deals.escritura_actual_date.', 'COMPOSITE', true, 'urgent', 1, '{"hook":"escritura_signed"}'::jsonb)
  RETURNING id INTO v_task_escr_assinada_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_escr_assinada_id, 'Escritura/Contrato assinado', true, 0, jsonb_build_object('type','checklist'));

  -- Task 4.2: Foto e descrição IA do momento
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config, dependency_task_id)
  VALUES (v_stage_escr_id, 'Foto e descrição IA do momento', 'Captura foto da escritura e gera descrição IA. Cria row em deal_marketing_moments.', 'COMPOSITE', false, 'normal', 2, '{}'::jsonb, v_task_escr_assinada_id)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Foto do momento carregada', false, 0, jsonb_build_object('type','checklist')),
    (v_task_id, 'Descrição IA gerada e revista', false, 1, jsonb_build_object('type','checklist'));

  -- Task 4.3: Pagamento final recebido (HOOK C)
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config, dependency_task_id)
  VALUES (v_stage_escr_id, 'Pagamento final recebido', 'Upload do comprovativo do remanescente. O hook propaga para deal_payments.is_received=true e cria company_transactions (income, draft).', 'COMPOSITE', true, 'urgent', 3, '{"hook":"escritura_received"}'::jsonb, v_task_escr_assinada_id)
  RETURNING id INTO v_task_pago_final_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_pago_final_id, 'Comprovativo de Pagamento Final', true, 0, jsonb_build_object('type','upload','doc_type_id', v_dt_compr_final, 'hint','Para arrendamento: usar comprovativo de caução em vez deste.'));

  -- Task 4.4: Faturação final
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config, dependency_task_id)
  VALUES (v_stage_escr_id, 'Faturação final', 'Emitir e enviar facturas finais (agência + rede + consultor + parceiros).', 'COMPOSITE', true, 'normal', 4, '{}'::jsonb, v_task_pago_final_id)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Facturas emitidas', true, 0, jsonb_build_object('type','checklist')),
    (v_task_id, 'Facturas enviadas às partes', true, 1, jsonb_build_object('type','checklist'));

  -- Task 4.5: Pagamento final aos consultores
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config, dependency_task_id)
  VALUES (v_stage_escr_id, 'Pagamento aos consultores e parceiros', 'Processar pagamentos finais conforme deal_payment_splits.', 'COMPOSITE', true, 'normal', 5, '{}'::jsonb, v_task_pago_final_id)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Pagamento processado a todas as partes', true, 0, jsonb_build_object('type','checklist'));

  -- Task 4.6: Guardar cópia da escritura/contrato
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config, dependency_task_id)
  VALUES (v_stage_escr_id, 'Guardar cópia da escritura/contrato', 'Upload da cópia digitalizada (escritura para venda/trespasse, contrato para arrendamento).', 'COMPOSITE', true, 'normal', 6, '{}'::jsonb, v_task_escr_assinada_id)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Cópia Escritura Assinada', false, 0, jsonb_build_object('type','upload','doc_type_id', v_dt_escr_assinada,'hint','Para venda/trespasse.')),
    (v_task_id, 'Cópia Contrato Arrendamento Assinado', false, 1, jsonb_build_object('type','upload','doc_type_id', v_dt_arrend_assinado,'hint','Para arrendamento.'));

  -- =================================================================
  -- STAGE 5 — Encerramento
  -- =================================================================

  -- Task 5.1: Email de agradecimento aos clientes
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_encerr_id, 'Email de agradecimento aos clientes', 'Email final aos compradores com cópia da escritura em anexo.', 'COMPOSITE', true, 'normal', 1, '{}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Email de agradecimento enviado', true, 0, jsonb_build_object('type','checklist','hint','Promovido a subtask type=email quando o template ''Agradecimento + Escritura'' estiver na biblioteca.'));

  -- Task 5.2: Email à Remax Convictus
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_encerr_id, 'Email à Remax Convictus', 'Comunicar fecho do processo à rede.', 'COMPOSITE', true, 'normal', 2, '{}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Email à rede enviado', true, 0, jsonb_build_object('type','checklist'));

  -- Task 5.3: Inquérito de satisfação
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_encerr_id, 'Inquérito de satisfação', 'Enviar inquérito de satisfação aos compradores. Implementação na app (formulário interno) com link partilhável.', 'COMPOSITE', false, 'normal', 3, '{}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Inquérito enviado', false, 0, jsonb_build_object('type','checklist','hint','Promovido a subtask type=external_form quando o módulo de inquéritos estiver em produção.'));

  -- Task 5.4: Pedido de review no Google
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_encerr_id, 'Pedido de review no Google', 'Solicitar review no Google My Business. Link partilhável copiável da própria task.', 'COMPOSITE', false, 'normal', 4, '{}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Review solicitada', false, 0, jsonb_build_object('type','checklist'));

  -- Task 5.5: Fechar negócio
  INSERT INTO public.tpl_tasks (tpl_stage_id, title, description, action_type, is_mandatory, priority, order_index, config)
  VALUES (v_stage_encerr_id, 'Fechar negócio', 'Última task: marca deals.status=''completed'' e move o negócio no pipeline para a stage terminal won (que dispara automaticamente negocios.won_date e syncLeadEstado).', 'COMPOSITE', true, 'urgent', 5, '{"hook":"close_deal"}'::jsonb)
  RETURNING id INTO v_task_id;

  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config) VALUES
    (v_task_id, 'Negócio fechado', true, 0, jsonb_build_object('type','checklist'));

  RAISE NOTICE 'PROC-NEG template seeded successfully (id=%)', v_proc_id;
END
$do$;

-- ==================================================================
-- REVERT
-- ==================================================================
-- DELETE FROM public.tpl_processes
--   WHERE process_type = 'negocio'
--     AND name = 'Processo de Negócio';
-- (Cascade FK em tpl_stages → tpl_tasks → tpl_subtasks remove o resto.)
