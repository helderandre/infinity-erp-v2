import type { SubtaskRule } from '../../types'

// ─── Stage 01 — Task 01.1: Pedido de documento ──────────────────
import { emailPedidoDocRule } from './email-pedido-doc'

// ─── Stage 01 — Task 01.2: Documentos do Imóvel (7) ─────────────
import { uploadCertificadoEnergeticoRule } from './upload-certificado-energetico'
import { uploadCadernetaPredialUrbanaRule } from './upload-caderneta-predial-urbana'
import { uploadCertidaoPermanenteRule } from './upload-certidao-permanente'
import { uploadLicencaUtilizacaoRule } from './upload-licenca-utilizacao'
import { uploadFichaTecnicaHabitacaoRule } from './upload-ficha-tecnica-habitacao'
import { uploadPlantaImovelRule } from './upload-planta-imovel'
import { fieldPropertyHipotecaDividaRule } from './field-property-hipoteca-divida'

// ─── Stage 01 — Task 01.3: Documentos Pessoa Colectiva (7) ──────
import { uploadCertidaoComercialEmpresaRule } from './upload-certidao-comercial-empresa'
import { uploadRcbeRule } from './upload-rcbe'
import { uploadCcPassaporteRepresentanteLegalRule } from './upload-cc-passaporte-representante-legal'
import { fieldNaturalidadeRepresentanteLegalRule } from './field-naturalidade-representante-legal'
import { fieldMoradaRepresentanteLegalRule } from './field-morada-representante-legal'
import { fieldEstadoCivilRepresentanteLegalRule } from './field-estado-civil-representante-legal'
import { uploadFichaBranqueamentoEmpresaRule } from './upload-ficha-branqueamento-empresa'

// ─── Stage 01 — Task 01.4: Documentos Pessoa Singular (5) ───────
import { uploadCcPassaporteSingularRule } from './upload-cc-passaporte-singular'
import { fieldNaturalidadeSingularRule } from './field-naturalidade-singular'
import { fieldMoradaAtualSingularRule } from './field-morada-atual-singular'
import { fieldEstadoCivilSingularRule } from './field-estado-civil-singular'
import { uploadFichaBranqueamentoCapitaisSingularRule } from './upload-ficha-branqueamento-capitais-singular'

// ─── Stage 01 — tasks restantes ─────────────────────────────────
import { geracaoCmiRule } from './geracao-cmi'
import { verificarCmiRule } from './verificar-cmi'
import { emailEnvioCmiRule } from './email-envio-cmi'
import { verificarRespostaEmailCmiRule } from './verificar-resposta-email-cmi'
import { scheduleRecolhaCmiFbcRule } from './schedule-recolha-cmi-fbc'
import { confirmarRecolhaCmiFbcRule } from './confirmar-recolha-cmi-fbc'
import { confirmarCmiPreenchimentoRule } from './confirmar-cmi-preenchimento'
import { confirmarFbcPreenchimentoRule } from './confirmar-fbc-preenchimento'
import { confirmarEntregaOriginaisSedeRule } from './confirmar-entrega-originais-sede'
import { uploadCmiDigitalizadoRule } from './upload-cmi-digitalizado'

// ─── Stage 02 — Link e descrição ────────────────────────────────
import { fieldPropertyDescricaoRule } from './field-property-descricao'
import { formPropertyCompletarDadosRule } from './form-property-completar-dados'
import { uploadPropertyFotografiasRule } from './upload-property-fotografias'

// ─── Stage 03 — Draft e aprovação ───────────────────────────────
import { checklistDraftMaxworkRule } from './checklist-draft-maxwork'
import { fieldPropertyRemaxDraftNumberRule } from './field-property-remax-draft-number'
import { emailAprovacaoDraftProcessualRule } from './email-aprovacao-draft-processual'
import { verificarRespostaAprovacaoDraftRule } from './verificar-resposta-aprovacao-draft'
import { fieldPropertyBusinessStatusRule } from './field-property-business-status'
import { fieldPropertyRemaxPublishedDateRule } from './field-property-remax-published-date'
import { fieldPropertyExternalRefRule } from './field-property-external-ref'
import { fieldPropertyLinkRemaxRule } from './field-property-link-remax'
import { fieldPropertyNotasJuridicoRule } from './field-property-notas-juridico'

// ─── Stage 04 — Publicação e finalização ────────────────────────
import { fieldPropertyLinkIdealistaRule } from './field-property-link-idealista'
import { fieldPropertyLinkImovirtualRule } from './field-property-link-imovirtual'
import { emailAgradecimentoFinalRule } from './email-agradecimento-final'

/**
 * Barrel de rules do processo de angariação — **todas** as tpl_subtasks
 * do template `c8cd3fcb-968f-4e23-9114-f3421cafa745` migradas para
 * rules hardcoded hybrid (`Component: null`) reutilizando a UI legacy
 * por `config.type`.
 *
 * Após a migration `20260502_split_armazenar_documentos_task.sql`:
 *   - Task "Armazenar documentos" foi renomeada → "Documentos do Imóvel"
 *     e ganha 7 subtasks (imóvel).
 *   - 2 tasks novas: "Documentos Pessoa Colectiva" (7 subtasks) e
 *     "Documentos Pessoa Singular" (5 subtasks).
 *   - Total: 3 tasks × 19 subtasks no grupo de documentos (antes 1×5).
 *
 * Ver `docs/M06-PROCESSOS/INVENTORY-ANGARIACAO-SUBTASKS.md` para mapping
 * tpl_subtask_id → rule.key e `PATTERN-HARDCODED-SUBTASKS.md` para o
 * cookbook de extensão.
 */
export const angariacaoRules: SubtaskRule[] = [
  // Task 01.1 — Pedido de documento
  emailPedidoDocRule,

  // Task 01.2 — Documentos do Imóvel (7)
  uploadCertificadoEnergeticoRule,
  uploadCadernetaPredialUrbanaRule,
  uploadCertidaoPermanenteRule,
  uploadLicencaUtilizacaoRule,
  uploadFichaTecnicaHabitacaoRule,
  uploadPlantaImovelRule,
  fieldPropertyHipotecaDividaRule,

  // Task 01.3 — Documentos Pessoa Colectiva (7)
  uploadCertidaoComercialEmpresaRule,
  uploadRcbeRule,
  uploadCcPassaporteRepresentanteLegalRule,
  fieldNaturalidadeRepresentanteLegalRule,
  fieldMoradaRepresentanteLegalRule,
  fieldEstadoCivilRepresentanteLegalRule,
  uploadFichaBranqueamentoEmpresaRule,

  // Task 01.4 — Documentos Pessoa Singular (5)
  uploadCcPassaporteSingularRule,
  fieldNaturalidadeSingularRule,
  fieldMoradaAtualSingularRule,
  fieldEstadoCivilSingularRule,
  uploadFichaBranqueamentoCapitaisSingularRule,

  // Stage 01 — restantes tasks (inalteradas)
  geracaoCmiRule,
  verificarCmiRule,
  emailEnvioCmiRule,
  verificarRespostaEmailCmiRule,
  scheduleRecolhaCmiFbcRule,
  confirmarRecolhaCmiFbcRule,
  confirmarCmiPreenchimentoRule,
  confirmarFbcPreenchimentoRule,
  confirmarEntregaOriginaisSedeRule,
  uploadCmiDigitalizadoRule,

  // Stage 02
  fieldPropertyDescricaoRule,
  formPropertyCompletarDadosRule,
  uploadPropertyFotografiasRule,

  // Stage 03
  checklistDraftMaxworkRule,
  fieldPropertyRemaxDraftNumberRule,
  emailAprovacaoDraftProcessualRule,
  verificarRespostaAprovacaoDraftRule,
  fieldPropertyBusinessStatusRule,
  fieldPropertyRemaxPublishedDateRule,
  fieldPropertyExternalRefRule,
  fieldPropertyLinkRemaxRule,
  fieldPropertyNotasJuridicoRule,

  // Stage 04
  fieldPropertyLinkIdealistaRule,
  fieldPropertyLinkImovirtualRule,
  emailAgradecimentoFinalRule,
]
