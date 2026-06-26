import type { SubtaskContext, SubtaskRule } from '../../types'

/**
 * Factories para as rules de PROC-NEG. As subtarefas de fecho são quase
 * todas **hybrid** (`Component: null` → renderizadas pelo switch legacy de
 * `subtask-card-list.tsx` via `config.type`), portanto cabem num punhado de
 * builders declarativos em vez de 48 ficheiros. Cada factory devolve um
 * `SubtaskRule` completo.
 */

/** No-op complete — o card legacy conclui via o PUT tradicional. */
const noopComplete: SubtaskRule['complete'] = async () => {}

/**
 * titleBuilder: anexa o nome do comprador quando a rule é `repeatPerClient`
 * (ex.: "CC/Passaporte — João Silva"), à semelhança do per-owner da
 * angariação. Sem cliente → título fixo.
 */
function clientTitle(fixed: string): (ctx: SubtaskContext) => string {
  return (ctx) => (ctx.client ? `${fixed} — ${ctx.client.name}` : fixed)
}

interface CommonArgs {
  key: string
  taskKind: string
  title: string
  description?: string
  repeatPerClient?: boolean
  personTypeFilter?: 'all' | 'singular' | 'coletiva'
  appliesWhen?: SubtaskRule['appliesWhen']
  isMandatory?: boolean
  hint?: string
}

function base(args: CommonArgs, config: Record<string, unknown>): SubtaskRule {
  return {
    key: args.key,
    taskKind: args.taskKind,
    description: args.description,
    repeatPerClient: args.repeatPerClient,
    personTypeFilter: args.personTypeFilter,
    appliesWhen: args.appliesWhen,
    isMandatory: args.isMandatory,
    hint: args.hint,
    titleBuilder: clientTitle(args.title),
    Component: null,
    configBuilder: () => config,
    complete: noopComplete,
  }
}

/** Upload de documento (escreve em doc_registry via o card legacy). */
export function uploadRule(args: CommonArgs & { docTypeId: string }): SubtaskRule {
  return base(args, { type: 'upload', doc_type_id: args.docTypeId })
}

/** Compositor de email (envia + regista em log_emails). */
export function emailRule(args: CommonArgs & { emailLibraryId: string }): SubtaskRule {
  return base(args, { type: 'email', email_library_id: args.emailLibraryId })
}

/** Checklist simples (toggle concluído). */
export function checklistRule(args: CommonArgs): SubtaskRule {
  return base(args, { type: 'checklist' })
}

/** Momento de marketing (foto + legenda IA) ligado a deal_marketing_moments. */
export function aiCaptionRule(
  args: CommonArgs & { momentType: 'cpcv' | 'escritura' }
): SubtaskRule {
  return base(args, { type: 'ai_caption', moment_type: args.momentType })
}

/** Agendamento de evento (sincroniza deal_events via o endpoint schedule-event). */
export function scheduleEventRule(args: CommonArgs): SubtaskRule {
  return base(args, { type: 'schedule_event' })
}

/**
 * Geração/preenchimento de documento — mesmo design do "Criar CMI" da angariação.
 * O card legacy (`subtask-card-list.tsx` case `generate_doc` → `SubtaskCardDoc`)
 * resolve o template em `tpl_doc_library` por `doc_library_id` e abre o
 * `SubtaskDocSheet` (HTML) ou o `SubtaskPdfSheet` (quando `template_type='pdf'`,
 * preenchimento de campos do PDF). Para já o CPCV aponta para a 'Minuta CPCV'
 * (clone provisório da minuta CMI em PDF); quando existir o PDF real do CPCV,
 * substitui-se o template em Definições › Templates de documentos — sem mudar
 * esta chave.
 */
export function generateDocRule(
  args: CommonArgs & { docLibraryId: string }
): SubtaskRule {
  return base(args, { type: 'generate_doc', doc_library_id: args.docLibraryId })
}

/**
 * Pedido de fatura via Moloni — emite a fatura de comissão da agência do
 * momento (`cpcv`/`escritura`) como documento fiscal real (reportado à AT).
 * O card embebe o fluxo rascunho → finalizar e pré-preenche destinatário +
 * valor a partir do cenário do negócio (`deriveFaturaTarget`):
 *  - angariação nossa  → proprietário, comissão total;
 *  - angariação externa → agência parceira, só a nossa parte.
 *
 * `moment` é o grupo do passo: 'cpcv' casa `deal_payments.payment_moment='cpcv'`;
 * 'escritura' casa `'escritura'` OU `'single'` (arrendamento/trespasse).
 */
export function moloniInvoiceRule(
  args: CommonArgs & { moment: 'cpcv' | 'escritura' }
): SubtaskRule {
  return base(args, { type: 'moloni_invoice', moment: args.moment })
}

/**
 * Pagar às partes — repartição "quem recebe o quê" do pagamento do momento, com
 * o MESMO cálculo do mapa de gestão (`/api/deals/[id]/payout-breakdown`): parte
 * de cada consultor (toggle Pago), Convictus (rede), margem da agência e agência
 * parceira. `moment` mapeia como no `moloniInvoiceRule`.
 */
export function payPartiesRule(
  args: CommonArgs & { moment: 'cpcv' | 'escritura' }
): SubtaskRule {
  return base(args, { type: 'pay_parties', moment: args.moment })
}
