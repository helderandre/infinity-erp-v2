import { z } from 'zod'

const uuidRegex = /^[0-9a-f-]{36}$/

// === Pedido de Crédito ===

export const createCreditRequestSchema = z.object({
  lead_id: z.string().regex(uuidRegex),
  negocio_id: z.string().regex(uuidRegex).optional().nullable(),
  property_id: z.string().regex(uuidRegex).optional().nullable(),

  // Imóvel
  imovel_valor_avaliacao: z.number().positive().optional().nullable(),
  imovel_valor_escritura: z.number().positive().optional().nullable(),
  imovel_tipo: z.string().max(100).optional().nullable(),
  imovel_finalidade: z.enum([
    'habitacao_propria_permanente',
    'habitacao_propria_secundaria',
    'investimento',
  ]).optional().nullable(),

  // Dados pessoais titular 1
  data_nascimento_titular: z.string().optional().nullable(),
  estado_civil: z.enum([
    'solteiro', 'casado', 'uniao_facto', 'divorciado', 'viuvo',
  ]).optional().nullable(),
  numero_dependentes: z.number().int().min(0).default(0),

  // Financeiro
  rendimento_mensal_liquido: z.number().min(0).optional().nullable(),
  rendimento_anual_bruto: z.number().min(0).optional().nullable(),
  entidade_patronal: z.string().max(200).optional().nullable(),
  tipo_contrato_trabalho: z.enum([
    'efetivo', 'termo_certo', 'termo_incerto', 'independente', 'reformado', 'outro',
  ]).optional().nullable(),
  antiguidade_emprego_meses: z.number().int().min(0).optional().nullable(),
  outros_rendimentos: z.number().min(0).optional().nullable(),
  fonte_outros_rendimentos: z.string().max(200).optional().nullable(),

  // Encargos
  encargos_creditos_existentes: z.number().min(0).default(0),
  encargos_cartoes: z.number().min(0).default(0),
  encargos_pensao_alimentos: z.number().min(0).default(0),
  outros_encargos: z.number().min(0).default(0),
  despesas_fixas_mensais: z.number().min(0).default(0),

  // Capital
  capital_proprio: z.number().min(0).optional().nullable(),
  origem_capital: z.enum([
    'poupanca', 'venda_imovel', 'doacao', 'heranca', 'outro',
  ]).optional().nullable(),
  tem_fiador: z.boolean().default(false),

  // 2º titular
  tem_segundo_titular: z.boolean().default(false),
  segundo_titular_nome: z.string().max(200).optional().nullable(),
  segundo_titular_nif: z.string().max(20).optional().nullable(),
  segundo_titular_data_nascimento: z.string().optional().nullable(),
  segundo_titular_rendimento_liquido: z.number().min(0).optional().nullable(),
  segundo_titular_entidade_patronal: z.string().max(200).optional().nullable(),
  segundo_titular_tipo_contrato: z.enum([
    'efetivo', 'termo_certo', 'termo_incerto', 'independente', 'reformado', 'outro',
  ]).optional().nullable(),
  segundo_titular_encargos: z.number().min(0).default(0),

  // Crédito
  montante_solicitado: z.number().positive().optional().nullable(),
  prazo_anos: z.number().int().min(1).max(40).optional().nullable(),
  tipo_taxa: z.enum(['fixa', 'variavel', 'mista']).default('variavel'),

  // RGPD
  rgpd_consentimento: z.boolean(),

  notas: z.string().max(5000).optional().nullable(),
})

export const updateCreditRequestSchema = createCreditRequestSchema.partial().extend({
  status: z.enum([
    'novo', 'recolha_docs', 'analise_financeira', 'submetido_bancos',
    'pre_aprovado', 'aprovado', 'contratado', 'escriturado', 'concluido',
    'recusado', 'desistencia', 'expirado',
  ]).optional(),
  data_escritura_prevista: z.string().optional().nullable(),
  data_escritura_real: z.string().optional().nullable(),
  motivo_recusa: z.string().max(1000).optional().nullable(),
  motivo_desistencia: z.string().max(1000).optional().nullable(),
})

// === Proposta de Banco ===

export const createProposalSchema = z.object({
  banco: z.string().min(1).max(100),
  banco_contacto: z.string().max(200).optional().nullable(),
  banco_email: z.string().email().optional().nullable(),
  banco_telefone: z.string().max(20).optional().nullable(),
  tem_protocolo: z.boolean().default(false),
  protocolo_ref: z.string().max(100).optional().nullable(),

  montante_aprovado: z.number().positive().optional().nullable(),
  prazo_aprovado_anos: z.number().int().min(1).max(40).optional().nullable(),
  tipo_taxa: z.enum(['fixa', 'variavel', 'mista']).optional().nullable(),
  spread: z.number().min(0).max(10).optional().nullable(),
  euribor_referencia: z.string().max(50).optional().nullable(),
  taxa_fixa_valor: z.number().min(0).max(20).optional().nullable(),
  taxa_fixa_periodo_anos: z.number().int().min(1).max(40).optional().nullable(),
  taeg: z.number().min(0).max(30).optional().nullable(),
  mtic: z.number().positive().optional().nullable(),
  prestacao_mensal: z.number().positive().optional().nullable(),
  ltv_aprovado: z.number().min(0).max(100).optional().nullable(),
  financiamento_percentagem: z.number().min(0).max(100).optional().nullable(),

  seguro_vida_mensal: z.number().min(0).optional().nullable(),
  seguro_multirriscos_anual: z.number().min(0).optional().nullable(),
  seguro_incluido_prestacao: z.boolean().default(false),

  comissao_avaliacao: z.number().min(0).optional().nullable(),
  comissao_dossier: z.number().min(0).optional().nullable(),
  comissao_formalizacao: z.number().min(0).optional().nullable(),
  imposto_selo_credito: z.number().min(0).optional().nullable(),
  imposto_selo_comissoes: z.number().min(0).optional().nullable(),

  condicoes_especiais: z.string().max(2000).optional().nullable(),
  exige_domiciliacao_salario: z.boolean().default(false),
  exige_cartao_credito: z.boolean().default(false),
  exige_seguros_banco: z.boolean().default(false),
  outros_produtos_obrigatorios: z.string().max(500).optional().nullable(),

  data_validade_aprovacao: z.string().optional().nullable(),
  notas: z.string().max(5000).optional().nullable(),
})

export const updateProposalSchema = createProposalSchema.partial().extend({
  status: z.enum([
    'rascunho', 'submetida', 'em_analise', 'pre_aprovada',
    'aprovada', 'recusada', 'expirada', 'aceite', 'contratada',
  ]).optional(),
  data_submissao: z.string().optional().nullable(),
  data_resposta: z.string().optional().nullable(),
  data_aprovacao: z.string().optional().nullable(),
  data_contratacao: z.string().optional().nullable(),
  motivo_recusa: z.string().max(1000).optional().nullable(),
})

// === Simulação ===

export const simulationSchema = z.object({
  valor_imovel: z.number().positive(),
  montante_credito: z.number().positive(),
  prazo_anos: z.number().int().min(1).max(40),
  euribor: z.number().min(-1).max(15),
  spread: z.number().min(0).max(10),
  periodo_revisao_meses: z.coerce.number().refine(v => [3, 6, 12].includes(v)).optional(),
  rendimento_mensal: z.number().min(0).optional(),
  euribor_cenarios: z.array(z.number().min(-1).max(15)).max(5).optional(),
  label: z.string().max(100).optional(),
  notas: z.string().max(1000).optional(),
})

// === Actividade ===

export const createActivitySchema = z.object({
  tipo: z.enum([
    'status_change', 'nota', 'chamada_banco', 'chamada_cliente',
    'email_banco', 'email_cliente', 'reuniao', 'documento_recebido',
    'documento_enviado', 'proposta_recebida', 'proposta_aceite',
    'simulacao', 'avaliacao_imovel', 'escritura',
  ]),
  descricao: z.string().min(1).max(2000),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// === Banco ===

export const bankSchema = z.object({
  nome: z.string().min(1).max(100),
  nome_completo: z.string().max(200).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  tem_protocolo: z.boolean().default(false),
  protocolo_ref: z.string().max(100).optional().nullable(),
  protocolo_validade: z.string().optional().nullable(),
  spread_protocolo: z.number().min(0).max(10).optional().nullable(),
  gestor_nome: z.string().max(200).optional().nullable(),
  gestor_email: z.string().email().optional().nullable(),
  gestor_telefone: z.string().max(20).optional().nullable(),
  agencia: z.string().max(200).optional().nullable(),
  comissao_percentagem: z.number().min(0).max(10).optional().nullable(),
  comissao_minima: z.number().min(0).optional().nullable(),
  comissao_maxima: z.number().min(0).optional().nullable(),
  documentos_exigidos: z.array(z.object({
    nome: z.string(),
    categoria: z.enum([
      'identificacao', 'rendimentos', 'patrimonio', 'imovel', 'fiscal', 'empresa', 'geral',
    ]),
    obrigatorio: z.boolean(),
  })).optional().nullable(),
  notas: z.string().max(2000).optional().nullable(),
})

// === Documento de crédito ===

export const creditDocumentSchema = z.object({
  nome: z.string().min(1).max(200),
  categoria: z.enum([
    'identificacao', 'rendimentos', 'patrimonio', 'imovel', 'fiscal', 'empresa', 'geral',
  ]),
  obrigatorio: z.boolean().default(true),
  bancos_requeridos: z.array(z.string()).optional().nullable(),
  titular: z.enum(['titular_1', 'titular_2', 'ambos']).default('titular_1'),
  data_validade: z.string().optional().nullable(),
  notas: z.string().max(1000).optional().nullable(),
})
