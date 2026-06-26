import type { SubtaskRule } from '../../types'
import {
  aiCaptionRule,
  checklistRule,
  emailRule,
  generateDocRule,
  moloniInvoiceRule,
  payPartiesRule,
  scheduleEventRule,
  uploadRule,
} from './factories'

/**
 * Modelo provisório do CPCV (clonado da minuta CMI em PDF — migration
 * 20260625_neg_cpcv_doc_template_and_schedule). UUID estável: a rule aponta para
 * cá e o admin substitui o PDF real em Definições › Templates de documentos sem
 * mudar código. Espelha o `geracao_cmi` da angariação.
 */
const CPCV_DOC_LIBRARY_ID = 'cf0cb71e-9d3a-4b2c-8e1f-5a6d7c8b9e0f'

/**
 * Registry de subtarefas hardcoded do PROC-NEG (fecho de negócio).
 *
 * openspec/changes/rebuild-fecho-process. Port 1:1 das 48 `tpl_subtasks`
 * do template `tpl_processes process_type='negocio'` (id
 * ca943474-2514-4781-b91f-83e76a8b7831). `rule.taskKind` === `proc_tasks.title`
 * (o esqueleto de tasks continua SQL-seeded pela RPC populate_process_tasks;
 * o registry só é dono das subtarefas).
 *
 * ⚠️ Os títulos de task disambiguados ("(CPCV)"/"(Escritura)") dependem da
 * migration 20260623_neg_template_hardcoded_handoff.sql (deploy-time).
 *
 * Tipos de card hoje: hybrid (Component:null + config.type). O passo de
 * faturação ("Emitir fatura da agência") já está promovido a `moloni_invoice`
 * (emite a fatura fiscal no Moloni, destinatário/valor via deriveFaturaTarget).
 * Os restantes passos de pagamento/condomínio/dir. preferência/inquérito ainda
 * nascem como `checklist`/`upload` e são promovidos a `supplier_invoice_intake`
 * / `tracked_request` / `external_form` num commit seguinte (sem mudar a chave).
 *
 * Chaves prefixadas `neg_` — únicas em todo o registry (não colidem com as 43
 * da angariação).
 */

// ───────────────────── A · Recolha Documental (stage 1) ─────────────────────

const BUYER_SINGULAR = 'Documentos do Comprador (Singular)'
const BUYER_EMPRESA = 'Documentos do Comprador (Empresa)'
const SELLER_EXTERNO = 'Documentos do Vendedor (Externo)'
const PROP_EXTERNO = 'Documentos do Imóvel (Externo)'
const KYC = 'Compliance KYC'

const recolhaRules: SubtaskRule[] = [
  // Pedido de documentação às partes (email) — PRIMEIRO passo do fecho.
  // Recipientes/conteúdo variam por cenário (pleno → compradores; angariacao_externa
  // → agência angariadora; comprador_externo → agência do comprador) — o consultor
  // ajusta no compositor; refinamento por cenário fica como follow-up.
  emailRule({
    key: 'neg_pedido_documentacao',
    taskKind: 'Pedido de Documentação',
    title: 'Email de pedido de documentação',
    emailLibraryId: 'd5f0e1a2-3b4c-4d5e-9f60-718293a4b5c6',
  }),

  // Comprador singular — 1 grupo por comprador singular (repeatPerClient).
  uploadRule({ key: 'neg_buyer_sing_cc', taskKind: BUYER_SINGULAR, title: 'CC/Passaporte', repeatPerClient: true, personTypeFilter: 'singular', docTypeId: '7ee72f5d-bfd8-4932-aada-24974a4fd2f6' }),
  uploadRule({ key: 'neg_buyer_sing_nif', taskKind: BUYER_SINGULAR, title: 'NIF', repeatPerClient: true, personTypeFilter: 'singular', docTypeId: '3af2ff80-39c2-4026-a435-9066b736889b' }),
  uploadRule({ key: 'neg_buyer_sing_morada', taskKind: BUYER_SINGULAR, title: 'Comprovativo de Morada', repeatPerClient: true, personTypeFilter: 'singular', docTypeId: 'c52280f0-8750-41d1-a832-48afa036d2e4' }),
  uploadRule({ key: 'neg_buyer_sing_iban', taskKind: BUYER_SINGULAR, title: 'IBAN', repeatPerClient: true, personTypeFilter: 'singular', docTypeId: 'f5858b2a-d83b-49f6-bf52-233455143d06' }),
  uploadRule({ key: 'neg_buyer_sing_fundos', taskKind: BUYER_SINGULAR, title: 'Comprovativo de Origem de Fundos', repeatPerClient: true, personTypeFilter: 'singular', docTypeId: '00e39126-38fc-4c1c-baf4-b9daa716ff80' }),

  // Comprador empresa — 1 grupo por comprador colectivo.
  uploadRule({ key: 'neg_buyer_emp_certidao', taskKind: BUYER_EMPRESA, title: 'Certidão Comercial', repeatPerClient: true, personTypeFilter: 'coletiva', docTypeId: '4f0a2800-8477-46ea-b8f7-df380a29b409' }),
  uploadRule({ key: 'neg_buyer_emp_rcbe', taskKind: BUYER_EMPRESA, title: 'RCBE', repeatPerClient: true, personTypeFilter: 'coletiva', docTypeId: '3be392d8-7d42-4f3a-b659-f1fb12ab592d' }),
  uploadRule({ key: 'neg_buyer_emp_cc_rep', taskKind: BUYER_EMPRESA, title: 'CC do Representante Legal', repeatPerClient: true, personTypeFilter: 'coletiva', docTypeId: 'e447e131-62db-47ee-88a4-b062123b13ac' }),
  uploadRule({ key: 'neg_buyer_emp_nipc', taskKind: BUYER_EMPRESA, title: 'NIPC', repeatPerClient: true, personTypeFilter: 'coletiva', docTypeId: '58f40bc9-ad13-418b-b421-144de5d5472d' }),
  uploadRule({ key: 'neg_buyer_emp_iban', taskKind: BUYER_EMPRESA, title: 'IBAN', repeatPerClient: true, personTypeFilter: 'coletiva', docTypeId: '74f9e833-ef07-4021-b41b-e0e209b68056' }),

  // Vendedor + imóvel externos — só angariacao_externa.
  uploadRule({ key: 'neg_seller_ext_cc', taskKind: SELLER_EXTERNO, title: 'CC/Passaporte do Vendedor', appliesWhen: { deal_type: 'angariacao_externa' }, docTypeId: 'f1a31187-dd67-404d-8d6c-0381c7efff13' }),
  uploadRule({ key: 'neg_seller_ext_nif', taskKind: SELLER_EXTERNO, title: 'NIF do Vendedor', appliesWhen: { deal_type: 'angariacao_externa' }, docTypeId: '3149f076-7a74-4f73-aaa8-32bb70e2e382' }),
  uploadRule({ key: 'neg_prop_ext_caderneta', taskKind: PROP_EXTERNO, title: 'Caderneta Predial', appliesWhen: { deal_type: 'angariacao_externa' }, docTypeId: '5b6bde4f-4c2e-42ca-b6d1-01f2d267e5a8' }),
  uploadRule({ key: 'neg_prop_ext_certidao', taskKind: PROP_EXTERNO, title: 'Certidão Permanente', appliesWhen: { deal_type: 'angariacao_externa' }, docTypeId: '08c2268b-1c1b-4a06-a65e-62b8a50681ff' }),
  uploadRule({ key: 'neg_prop_ext_ce', taskKind: PROP_EXTERNO, title: 'Certificado Energético', appliesWhen: { deal_type: 'angariacao_externa' }, docTypeId: '5ef41aa4-b10b-40d0-891e-e92a040f6b9a' }),

  // Compliance KYC.
  uploadRule({ key: 'neg_kyc_pep', taskKind: KYC, title: 'Declaração PEP assinada', docTypeId: '9162f8be-9b73-465a-ac4b-b60aba9e9303' }),
  uploadRule({ key: 'neg_kyc_impic', taskKind: KYC, title: 'Comunicação IMPIC submetida', docTypeId: 'f377a835-3fa5-4f32-8dbd-7e23f3e9511f' }),
  uploadRule({ key: 'neg_kyc_ia_docs', taskKind: KYC, title: 'Verificação IA dos documentos do comprador', hint: 'Será gerada automaticamente quando todos os documentos do comprador estiverem carregados.', docTypeId: '5b8a8b70-369a-4d9a-9b5f-66cb50bea6fd' }),
]

// ───────────────── B + C · CPCV / Assinatura / Pós-CPCV (stage 2) ─────────────

const cpcvRules: SubtaskRule[] = [
  // "Criar CPCV" com o MESMO design do "Criar CMI": gera/preenche o documento
  // (PDF) a partir do template em tpl_doc_library. Modelo provisório = clone da
  // minuta CMI; substituível pelo PDF real do CPCV sem mudar a chave.
  generateDocRule({ key: 'neg_cpcv_minuta', taskKind: 'Preparar minuta CPCV', title: 'CPCV gerado', docLibraryId: CPCV_DOC_LIBRARY_ID, hint: 'Modelo provisório (minuta CMI). Substituir pelo PDF real do CPCV em Definições › Templates de documentos.' }),
  emailRule({ key: 'neg_cpcv_envio', taskKind: 'Enviar CPCV para assinatura', title: 'CPCV enviado a todas as partes', emailLibraryId: 'f08d3510-6d11-4e9e-8819-0530dd5d6dbe' }),
  // Registar data/hora/local do CPCV (hook schedule_cpcv → deal_events(cpcv)).
  // A task 'Registar data do CPCV' é seeded pela migration 20260625.
  scheduleEventRule({ key: 'neg_cpcv_agendar', taskKind: 'Registar data do CPCV', title: 'Data/hora/local do CPCV registados' }),
  checklistRule({ key: 'neg_cpcv_assinado', taskKind: 'CPCV assinado por todas as partes', title: 'CPCV assinado' }),
  aiCaptionRule({ key: 'neg_cpcv_momento', taskKind: 'Foto e descrição IA do momento (CPCV)', title: 'Momento de marketing (foto + legenda)', momentType: 'cpcv' }),
  uploadRule({ key: 'neg_cpcv_sinal', taskKind: 'Sinal recebido', title: 'Comprovativo de Pagamento de Sinal', docTypeId: '4adbe5e9-70f5-4574-afe9-2e0902e5e927' }),
  moloniInvoiceRule({ key: 'neg_cpcv_fatura_emitida', taskKind: 'Faturação CPCV', title: 'Emitir fatura da agência (Moloni)', moment: 'cpcv', hint: 'Destinatário e valor são calculados automaticamente pelo cenário do negócio.' }),
  checklistRule({ key: 'neg_cpcv_fatura_enviada', taskKind: 'Faturação CPCV', title: 'Factura enviada às partes' }),
  payPartiesRule({ key: 'neg_cpcv_pagamento', taskKind: 'Pagamento aos consultores e parceiros (CPCV)', title: 'Pagamento processado a todas as partes', moment: 'cpcv', hint: 'A repartição (consultor/rede/agência/parceira) é calculada automaticamente — igual ao mapa de gestão.' }),
  checklistRule({ key: 'neg_cpcv_dirpref_pedido', taskKind: 'Direitos de Preferência', title: 'Pedido submetido', appliesWhen: { angariacao_interna: true }, hint: 'Promovido a external_form com webhook da Chrome extension Casa Pronta.' }),
  uploadRule({ key: 'neg_cpcv_dirpref_resposta', taskKind: 'Direitos de Preferência', title: 'Resposta recebida', appliesWhen: { angariacao_interna: true }, docTypeId: 'd686d904-7654-454c-a866-51b504e2a0e0' }),
  uploadRule({ key: 'neg_cpcv_guardar', taskKind: 'Guardar cópia CPCV assinado', title: 'Cópia CPCV Assinado', docTypeId: 'a49d1798-16a7-49ee-b904-cc4aad20af4b' }),
]

// ───────────────────── D · Pré-Escritura (stage 3) ─────────────────────

const preEscrituraRules: SubtaskRule[] = [
  emailRule({ key: 'neg_pre_email_checklist', taskKind: 'Email checklist aos clientes', title: 'Email enviado aos clientes', emailLibraryId: '06a436ef-c9b5-4f72-b4b0-c7100ee8fb9f' }),
  uploadRule({ key: 'neg_pre_distrate', taskKind: 'Distrate de Hipoteca', title: 'Distrate recebido', appliesWhen: { property_has_mortgage: true }, docTypeId: '299e6f3f-faaa-41a8-ba49-d13f14481b95' }),
  uploadRule({ key: 'neg_pre_condominio', taskKind: 'Declaração de não-dívida ao condomínio', title: 'Declaração recebida', appliesWhen: { property_has_condominium: true }, docTypeId: 'cf891c88-6484-4629-a6f0-f3a8da2a116b', hint: 'Promovido a tracked_request (por pedir → pedido → recebido), com guias IMT/Imposto de Selo.' }),
  scheduleEventRule({ key: 'neg_pre_agendar', taskKind: 'Agendar escritura', title: 'Escritura agendada' }),
  checklistRule({ key: 'neg_pre_presencas', taskKind: 'Confirmar presença das partes', title: 'Presenças confirmadas' }),
  checklistRule({ key: 'neg_pre_pasta', taskKind: 'Preparar pasta física', title: 'Pasta física pronta' }),
]

// ───────────────── E · Escritura / Contrato Final (stage 4) ─────────────────

const GUARDAR_ESCRITURA = 'Guardar cópia da escritura/contrato'

const escrituraRules: SubtaskRule[] = [
  checklistRule({ key: 'neg_esc_assinado', taskKind: 'Escritura / Contrato assinado', title: 'Escritura/Contrato assinado' }),
  aiCaptionRule({ key: 'neg_esc_momento', taskKind: 'Foto e descrição IA do momento (Escritura)', title: 'Momento de marketing (foto + legenda)', momentType: 'escritura' }),
  uploadRule({ key: 'neg_esc_pagamento_final', taskKind: 'Pagamento final recebido', title: 'Comprovativo de Pagamento Final', hint: 'Para arrendamento: usar comprovativo de caução.', docTypeId: '6435ea93-14a9-4b44-bc2b-66cc83183236' }),
  moloniInvoiceRule({ key: 'neg_esc_fatura_emitida', taskKind: 'Faturação final', title: 'Emitir fatura da agência (Moloni)', moment: 'escritura', hint: 'Destinatário e valor são calculados automaticamente pelo cenário do negócio.' }),
  checklistRule({ key: 'neg_esc_fatura_enviada', taskKind: 'Faturação final', title: 'Facturas enviadas às partes' }),
  payPartiesRule({ key: 'neg_esc_pagamento', taskKind: 'Pagamento aos consultores e parceiros (Escritura)', title: 'Pagamento processado a todas as partes', moment: 'escritura', hint: 'A repartição (consultor/rede/agência/parceira) é calculada automaticamente — igual ao mapa de gestão.' }),
  uploadRule({ key: 'neg_esc_guardar_venda', taskKind: GUARDAR_ESCRITURA, title: 'Cópia Escritura Assinada', hint: 'Para venda/trespasse.', docTypeId: 'd9cd92dd-9b4b-41f3-aba5-5e1ecb22556a' }),
  uploadRule({ key: 'neg_esc_guardar_arrend', taskKind: GUARDAR_ESCRITURA, title: 'Cópia Contrato Arrendamento Assinado', hint: 'Para arrendamento.', docTypeId: '25ca0f8a-c9b7-42bb-9ae3-d49fc1b7b523' }),
]

// ───────────────────── F · Encerramento (stage 5) ─────────────────────

const encerramentoRules: SubtaskRule[] = [
  emailRule({ key: 'neg_enc_agradecimento', taskKind: 'Email de agradecimento aos clientes', title: 'Email de agradecimento enviado', emailLibraryId: '4b01e450-95d3-417c-b174-f310b42e08fd' }),
  emailRule({ key: 'neg_enc_remax', taskKind: 'Email à Remax Convictus', title: 'Email à rede enviado', emailLibraryId: '358b8728-4b18-4527-9e22-301550f0c4cf', isMandatory: false }),
  checklistRule({ key: 'neg_enc_inquerito', taskKind: 'Inquérito de satisfação', title: 'Inquérito enviado', isMandatory: false, hint: 'Liga ao card de inquérito de satisfação já existente.' }),
  checklistRule({ key: 'neg_enc_review', taskKind: 'Pedido de review no Google', title: 'Review solicitada', isMandatory: false }),
  checklistRule({ key: 'neg_enc_fechar', taskKind: 'Fechar negócio', title: 'Negócio fechado' }),
]

export const negocioRules: SubtaskRule[] = [
  ...recolhaRules,
  ...cpcvRules,
  ...preEscrituraRules,
  ...escrituraRules,
  ...encerramentoRules,
]
