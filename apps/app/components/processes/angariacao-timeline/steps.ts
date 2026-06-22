import {
  Mail,
  Upload,
  FileSignature,
  Send,
  FileCheck2,
  Images,
  Heart,
  type LucideIcon,
} from 'lucide-react'

/**
 * Modelo plano do processo de angariação — a "linha" de passos.
 *
 * Cada passo é a unidade: acção + concluído (quem/quando). NÃO há
 * task→subtask aninhado — um passo é um passo. Os artefactos (documentos,
 * CMI) vivem no seu sítio natural (documentos do imóvel); o passo apenas
 * escreve/aponta para lá.
 *
 * `action` decide o que o passo FAZ quando o consultor o abre:
 *   - email        → compositor de email (envia + regista no log)
 *   - upload       → uploader de ficheiros (escreve nos documentos do imóvel)
 *   - generate_doc → gerador de documento (ex.: CMI)
 *   - confirm      → confirmação simples ("feito? sim") + timestamp
 *
 * `requires` = o que é preciso neste passo (mostrado no detalhe). NÃO são
 * subtarefas a concluir uma a uma — é a informação do que o passo trata.
 */
export type StepAction = 'email' | 'upload' | 'generate_doc' | 'confirm'

export interface AngariacaoStep {
  /** chave estável (vive em proc_subtasks.subtask_key) */
  key: string
  /** ordem na linha (1..N) */
  order: number
  /** título completo (detalhe / mobile) */
  label: string
  /** título curto (stepper horizontal em PC) */
  shortLabel: string
  /** descrição do que acontece neste passo */
  description: string
  /** ícone Lucide */
  icon: LucideIcon
  /** acção que o passo executa */
  action: StepAction
  /** rótulo do CTA principal do passo */
  cta: string
  /** o que é preciso / trata neste passo (informativo, não checklist) */
  requires: string[]
}

export const ANGARIACAO_STEPS: AngariacaoStep[] = [
  {
    key: 'pedido_documentacao',
    order: 1,
    label: 'Pedido de Documentação',
    shortLabel: 'Pedido',
    description:
      'Enviar email ao cliente a pedir os dados do imóvel, a documentação e a Ficha de Branqueamento de Capitais.',
    icon: Mail,
    action: 'email',
    cta: 'Enviar email',
    requires: [
      'Cartão de Cidadão / Passaporte dos proprietários',
      'Caderneta Predial Urbana',
      'Certidão Permanente do Registo Predial',
      'Licença de Utilização',
      'Ficha Técnica de Habitação',
      'Planta do imóvel',
      'Ficha de Branqueamento de Capitais (anexada no email)',
    ],
  },
  {
    key: 'recolha_documentos',
    order: 2,
    label: 'Recolha de Documentos',
    shortLabel: 'Documentos',
    description:
      'Carregar os ficheiros recebidos. A IA extrai os dados e preenche a informação do imóvel.',
    icon: Upload,
    action: 'upload',
    cta: 'Carregar ficheiros',
    requires: [
      'Documentos do imóvel recebidos do cliente',
      'Documentos de identificação dos proprietários',
      'Ficha de Branqueamento de Capitais preenchida',
    ],
  },
  {
    key: 'geracao_cmi',
    order: 3,
    label: 'Geração do CMI',
    shortLabel: 'CMI',
    description:
      'Gerar o Contrato de Mediação Imobiliária a partir dos dados recolhidos.',
    icon: FileSignature,
    action: 'generate_doc',
    cta: 'Gerar CMI',
    requires: [
      'Dados do imóvel completos',
      'Proprietários e respectivas quotas',
      'Valor e regime de comissão acordados',
    ],
  },
  {
    key: 'envio_cmi',
    order: 4,
    label: 'Envio do CMI',
    shortLabel: 'Envio',
    description: 'Enviar o CMI ao cliente por email para assinatura.',
    icon: Send,
    action: 'email',
    cta: 'Enviar CMI',
    requires: ['CMI gerado e revisto', 'Email do cliente confirmado'],
  },
  {
    key: 'cmi_assinado',
    order: 5,
    label: 'CMI Assinado',
    shortLabel: 'Assinado',
    description: 'Guardar no sistema o CMI assinado pelo cliente.',
    icon: FileCheck2,
    action: 'confirm',
    cta: 'Guardar assinado',
    requires: ['CMI assinado por todos os proprietários'],
  },
  {
    key: 'descricao_imagens',
    order: 6,
    label: 'Descrição e Imagens do Imóvel',
    shortLabel: 'Descrição',
    description:
      'Escrever a descrição do imóvel e adicionar as imagens para a publicação.',
    icon: Images,
    action: 'upload',
    cta: 'Adicionar descrição e imagens',
    requires: [
      'Descrição comercial do imóvel',
      'Fotografias do imóvel',
      'Imóvel pronto para publicação nos portais',
    ],
  },
  {
    key: 'email_agradecimento',
    order: 7,
    label: 'Email de Agradecimento',
    shortLabel: 'Agradecer',
    description:
      'Enviar email de agradecimento aos clientes depois de o imóvel estar publicado.',
    icon: Heart,
    action: 'email',
    cta: 'Enviar agradecimento',
    requires: ['Imóvel publicado', 'Email dos clientes confirmado'],
  },
]
