import {
  Upload,
  FileEdit,
  FileCheck2,
  CalendarClock,
  FileSignature,
  Images,
  Receipt,
  Banknote,
  ScrollText,
  Mail,
  Send,
  Landmark,
  Building2,
  Users,
  FolderArchive,
  Stamp,
  Heart,
  ClipboardList,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react'
import type { AngariacaoStep } from '../angariacao-timeline/steps'

/**
 * Modelo do processo de FECHO DE NEGÓCIO (PROC-NEG).
 *
 * As 6 FASES são TÍTULOS de agrupamento (header + overview stepper) — não são
 * passos. Os PASSOS são os passos conceptuais; cada passo pode abranger uma ou
 * VÁRIAS `proc_tasks` (`taskTitles`). Ex.: "Guardar e verificar documentação" é
 * UM passo que agrega todas as tasks de documentos.
 *
 * `NEGOCIO_PHASES` alimenta o stepper de OVERVIEW (6 nós).
 */

// ── Fases (apenas agrupamento / overview) ──────────────────────────────
export const NEGOCIO_PHASES: AngariacaoStep[] = [
  { key: 'recolha_cpcv', order: 1, label: 'Recolha & CPCV', shortLabel: 'Recolha', description: 'Documentação e preparação do CPCV.', icon: Upload, action: 'upload', cta: '', requires: [] },
  { key: 'assinatura_cpcv', order: 2, label: 'Assinatura do CPCV', shortLabel: 'CPCV', description: 'Assinatura, momento e fatura do sinal.', icon: FileSignature, action: 'confirm', cta: '', requires: [] },
  { key: 'pos_cpcv', order: 3, label: 'Pós-CPCV', shortLabel: 'Pós-CPCV', description: 'Cópia, pagamento e direitos de preferência.', icon: Banknote, action: 'upload', cta: '', requires: [] },
  { key: 'pre_escritura', order: 4, label: 'Preparação da Escritura', shortLabel: 'Pré-Esc.', description: 'Distrate, agendamento e documentos.', icon: ClipboardList, action: 'confirm', cta: '', requires: [] },
  { key: 'escritura', order: 5, label: 'Dia da Escritura', shortLabel: 'Escritura', description: 'Assinatura, momento e fatura final.', icon: Stamp, action: 'confirm', cta: '', requires: [] },
  { key: 'agradecimentos', order: 6, label: 'Agradecimentos', shortLabel: 'Fecho', description: 'Pagar às partes, agradecer e fechar.', icon: Heart, action: 'email', cta: '', requires: [] },
]

// ── Passos conceptuais ─────────────────────────────────────────────────
export interface NegocioStep {
  key: string
  order: number
  phaseKey: string
  /** Títulos de `proc_tasks` que este passo agrega (1 ou mais). */
  taskTitles: string[]
  label: string
  description: string
  icon: LucideIcon
}

export const NEGOCIO_STEPS: NegocioStep[] = [
  // ── A · Recolha & CPCV (5 passos conceptuais) ──
  { key: 'pedido_documentacao', order: 1, phaseKey: 'recolha_cpcv', taskTitles: ['Pedido de Documentação'], label: 'Pedido de documentação', description: 'Enviar email às partes envolventes a pedir a documentação necessária para elaborar o CPCV.', icon: Mail },
  {
    key: 'guardar_verificar_docs',
    order: 2,
    phaseKey: 'recolha_cpcv',
    taskTitles: [
      'Documentos do Comprador (Singular)',
      'Documentos do Comprador (Empresa)',
      'Documentos do Vendedor (Externo)',
      'Documentos do Imóvel (Externo)',
      'Compliance KYC',
    ],
    label: 'Guardar e verificar documentação',
    description: 'Carregar e verificar a documentação recebida das partes (compradores, vendedores e imóvel).',
    icon: Upload,
  },
  { key: 'criar_enviar_cpcv', order: 3, phaseKey: 'recolha_cpcv', taskTitles: ['Preparar minuta CPCV', 'Enviar CPCV para assinatura'], label: 'Criar / verificar CPCV e enviar', description: 'Criar o CPCV (ou verificar o recebido) e enviá-lo às partes envolventes.', icon: FileEdit },
  { key: 'guardar_cpcv_confirmado', order: 4, phaseKey: 'recolha_cpcv', taskTitles: ['Guardar CPCV confirmado'], label: 'Guardar o CPCV confirmado', description: 'Arquivar a versão final do CPCV depois de confirmada por todas as partes (antes da assinatura).', icon: FileCheck2 },
  { key: 'registar_datas_cpcv', order: 5, phaseKey: 'recolha_cpcv', taskTitles: ['Registar data do CPCV'], label: 'Registar data/hora/local do CPCV', description: 'Registar no sistema a data, hora e local da assinatura do CPCV.', icon: CalendarClock },

  // ── B · Assinatura do CPCV ──
  { key: 'cpcv_assinado', order: 6, phaseKey: 'assinatura_cpcv', taskTitles: ['CPCV assinado por todas as partes'], label: 'CPCV assinado', description: 'Confirmar a assinatura do CPCV por todas as partes.', icon: FileSignature },
  { key: 'momento_cpcv', order: 7, phaseKey: 'assinatura_cpcv', taskTitles: ['Foto e descrição IA do momento (CPCV)'], label: 'Momento de marketing (CPCV)', description: 'Foto do momento + descrição para publicação.', icon: Images },
  { key: 'fatura_cpcv', order: 8, phaseKey: 'assinatura_cpcv', taskTitles: ['Faturação CPCV'], label: 'Pedido de fatura (CPCV)', description: 'Emitir a fatura do sinal ao cliente (ou ao colega, na angariação externa).', icon: Receipt },

  // ── C · Pós-CPCV ──
  { key: 'sinal_recebido', order: 9, phaseKey: 'pos_cpcv', taskTitles: ['Sinal recebido'], label: 'Comprovativo de sinal', description: 'Recolher o comprovativo de pagamento do sinal.', icon: Banknote },
  { key: 'guardar_cpcv', order: 10, phaseKey: 'pos_cpcv', taskTitles: ['Guardar cópia CPCV assinado'], label: 'Guardar cópia do CPCV assinado', description: 'Arquivar a cópia do CPCV assinado.', icon: FileCheck2 },
  { key: 'pagamento_cpcv', order: 11, phaseKey: 'pos_cpcv', taskTitles: ['Pagamento aos consultores e parceiros (CPCV)'], label: 'Pagar às partes', description: 'Processar o pagamento aos consultores e parceiros.', icon: Banknote },
  { key: 'direitos_preferencia', order: 12, phaseKey: 'pos_cpcv', taskTitles: ['Direitos de Preferência'], label: 'Direitos de preferência', description: 'Submeter o pedido de direitos de preferência e recolher a resposta.', icon: ScrollText },

  // ── D · Preparação da Escritura ──
  { key: 'email_checklist', order: 13, phaseKey: 'pre_escritura', taskTitles: ['Email checklist aos clientes'], label: 'Email/dados aos clientes', description: 'Enviar a checklist e os dados da escritura aos clientes.', icon: Mail },
  { key: 'distrate', order: 14, phaseKey: 'pre_escritura', taskTitles: ['Distrate de Hipoteca'], label: 'Distrate de hipoteca', description: 'Avisar do distrate de hipoteca e protocolo APB e recolhê-lo.', icon: Landmark },
  { key: 'condominio', order: 15, phaseKey: 'pre_escritura', taskTitles: ['Declaração de não-dívida ao condomínio'], label: 'Condomínio + IMT/IS', description: 'Acompanhar a declaração de condomínio e guias de IMT/Imposto de Selo.', icon: Building2 },
  { key: 'agendar_escritura', order: 16, phaseKey: 'pre_escritura', taskTitles: ['Agendar escritura'], label: 'Registar data da escritura', description: 'Registar data, hora e local da escritura.', icon: CalendarClock },
  { key: 'confirmar_presencas', order: 17, phaseKey: 'pre_escritura', taskTitles: ['Confirmar presença das partes'], label: 'Confirmar presenças', description: 'Confirmar a presença de todas as partes.', icon: Users },
  { key: 'pasta_fisica', order: 18, phaseKey: 'pre_escritura', taskTitles: ['Preparar pasta física'], label: 'Preparar pasta física', description: 'Imprimir documentos, cópia do CPCV e comprovativos.', icon: FolderArchive },

  // ── E · Dia da Escritura ──
  { key: 'escritura_assinada', order: 19, phaseKey: 'escritura', taskTitles: ['Escritura / Contrato assinado'], label: 'Escritura assinada', description: 'Confirmar a assinatura da escritura/contrato.', icon: Stamp },
  { key: 'momento_escritura', order: 20, phaseKey: 'escritura', taskTitles: ['Foto e descrição IA do momento (Escritura)'], label: 'Momento de marketing (Escritura)', description: 'Foto do momento + descrição para publicação.', icon: Images },
  { key: 'fatura_final', order: 21, phaseKey: 'escritura', taskTitles: ['Faturação final'], label: 'Pedido de fatura (Escritura)', description: 'Emitir a fatura final ao cliente (ou ao colega, na angariação externa).', icon: Receipt },

  // ── F · Agradecimentos ──
  { key: 'pagamento_final', order: 22, phaseKey: 'agradecimentos', taskTitles: ['Pagamento final recebido'], label: 'Comprovativo de pagamento final', description: 'Recolher o comprovativo do pagamento final.', icon: Banknote },
  { key: 'pagamento_escritura', order: 23, phaseKey: 'agradecimentos', taskTitles: ['Pagamento aos consultores e parceiros (Escritura)'], label: 'Pagar às partes', description: 'Processar o pagamento final aos consultores e parceiros.', icon: Banknote },
  { key: 'guardar_escritura', order: 24, phaseKey: 'agradecimentos', taskTitles: ['Guardar cópia da escritura/contrato'], label: 'Guardar cópia da escritura', description: 'Arquivar a cópia da escritura/contrato assinado.', icon: FileCheck2 },
  // Agradecimento + inquérito + review num só passo: o email de agradecimento é
  // o veículo para enviar o inquérito de satisfação, e a review no Google sai do
  // próprio fluxo do inquérito (CTA mostrada aos promoters). Os 3 `proc_tasks`
  // ficam agregados neste passo; a sheet embute o card de inquérito real.
  {
    key: 'email_agradecimento',
    order: 25,
    phaseKey: 'agradecimentos',
    taskTitles: [
      'Email de agradecimento aos clientes',
      'Inquérito de satisfação',
      'Pedido de review no Google',
    ],
    label: 'Agradecimento, inquérito e review',
    description:
      'Num só passo: enviar o email de agradecimento (com a escritura), o inquérito de satisfação e o pedido de review no Google.',
    icon: Heart,
  },
  { key: 'email_remax', order: 26, phaseKey: 'agradecimentos', taskTitles: ['Email à Remax Convictus'], label: 'Email à rede', description: 'Comunicar o fecho à Remax Convictus.', icon: Send },
  { key: 'fechar_negocio', order: 27, phaseKey: 'agradecimentos', taskTitles: ['Fechar negócio'], label: 'Fechar negócio', description: 'Concluir o processo e fechar o negócio.', icon: CheckCircle2 },
]
