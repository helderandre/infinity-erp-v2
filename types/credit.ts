// === M17 — Intermediação de Crédito Habitação ===

// === Status Types ===

export type CreditRequestStatus =
  | 'novo'
  | 'recolha_docs'
  | 'analise_financeira'
  | 'submetido_bancos'
  | 'pre_aprovado'
  | 'aprovado'
  | 'contratado'
  | 'escriturado'
  | 'concluido'
  | 'recusado'
  | 'desistencia'
  | 'expirado'

export type ProposalStatus =
  | 'rascunho'
  | 'submetida'
  | 'em_analise'
  | 'pre_aprovada'
  | 'aprovada'
  | 'recusada'
  | 'expirada'
  | 'aceite'
  | 'contratada'

export type CreditDocStatus =
  | 'pendente'
  | 'solicitado'
  | 'recebido'
  | 'validado'
  | 'rejeitado'
  | 'expirado'

export type CreditDocCategory =
  | 'identificacao'
  | 'rendimentos'
  | 'patrimonio'
  | 'imovel'
  | 'fiscal'
  | 'empresa'
  | 'geral'

export type CreditActivityType =
  | 'status_change'
  | 'nota'
  | 'chamada_banco'
  | 'chamada_cliente'
  | 'email_banco'
  | 'email_cliente'
  | 'reuniao'
  | 'documento_recebido'
  | 'documento_enviado'
  | 'proposta_recebida'
  | 'proposta_aceite'
  | 'simulacao'
  | 'avaliacao_imovel'
  | 'escritura'

export type PropertyPurpose =
  | 'habitacao_propria_permanente'
  | 'habitacao_propria_secundaria'
  | 'investimento'

export type EmploymentContractType =
  | 'efetivo'
  | 'termo_certo'
  | 'termo_incerto'
  | 'independente'
  | 'reformado'
  | 'outro'

export type RateType = 'fixa' | 'variavel' | 'mista'

export type CapitalOrigin =
  | 'poupanca'
  | 'venda_imovel'
  | 'doacao'
  | 'heranca'
  | 'outro'

export type CivilStatus =
  | 'solteiro'
  | 'casado'
  | 'uniao_facto'
  | 'divorciado'
  | 'viuvo'

// === Entities ===

export interface CreditRequest {
  id: string
  reference: string | null
  negocio_id: string | null
  lead_id: string
  property_id: string | null
  assigned_to: string
  status: CreditRequestStatus

  // Imóvel
  imovel_valor_avaliacao: number | null
  imovel_valor_escritura: number | null
  imovel_tipo: string | null
  imovel_finalidade: PropertyPurpose | null

  // Dados pessoais titular 1 (regra BdP: idade + prazo ≤ 75)
  data_nascimento_titular: string | null
  estado_civil: CivilStatus | null
  numero_dependentes: number

  // Financeiro titular 1
  rendimento_mensal_liquido: number | null
  rendimento_anual_bruto: number | null
  entidade_patronal: string | null
  tipo_contrato_trabalho: EmploymentContractType | null
  antiguidade_emprego_meses: number | null
  outros_rendimentos: number | null
  fonte_outros_rendimentos: string | null

  // Encargos
  encargos_creditos_existentes: number
  encargos_cartoes: number
  encargos_pensao_alimentos: number
  outros_encargos: number
  despesas_fixas_mensais: number

  // Capital
  capital_proprio: number | null
  origem_capital: CapitalOrigin | null
  tem_fiador: boolean

  // 2º titular
  tem_segundo_titular: boolean
  segundo_titular_nome: string | null
  segundo_titular_nif: string | null
  segundo_titular_data_nascimento: string | null
  segundo_titular_rendimento_liquido: number | null
  segundo_titular_entidade_patronal: string | null
  segundo_titular_tipo_contrato: EmploymentContractType | null
  segundo_titular_encargos: number

  // Crédito
  montante_solicitado: number | null
  prazo_anos: number | null
  tipo_taxa: RateType
  ltv_calculado: number | null

  // Métricas
  taxa_esforco: number | null
  rendimento_disponivel: number | null

  // RGPD
  rgpd_consentimento: boolean
  rgpd_consentimento_data: string | null
  rgpd_consentimento_ip: string | null

  // Datas de marco
  data_submissao_bancos: string | null
  data_pre_aprovacao: string | null
  data_aprovacao_final: string | null
  data_escritura_prevista: string | null
  data_escritura_real: string | null
  data_conclusao: string | null

  // Encerramento
  motivo_recusa: string | null
  motivo_desistencia: string | null
  notas: string | null

  created_at: string
  updated_at: string
}

export interface CreditProposal {
  id: string
  pedido_credito_id: string
  banco: string
  banco_contacto: string | null
  banco_email: string | null
  banco_telefone: string | null
  tem_protocolo: boolean
  protocolo_ref: string | null
  status: ProposalStatus

  montante_aprovado: number | null
  prazo_aprovado_anos: number | null
  tipo_taxa: RateType | null
  spread: number | null
  euribor_referencia: string | null
  taxa_fixa_valor: number | null
  taxa_fixa_periodo_anos: number | null
  taeg: number | null
  mtic: number | null
  prestacao_mensal: number | null
  ltv_aprovado: number | null
  financiamento_percentagem: number | null

  seguro_vida_mensal: number | null
  seguro_multirriscos_anual: number | null
  seguro_incluido_prestacao: boolean

  comissao_avaliacao: number | null
  comissao_dossier: number | null
  comissao_formalizacao: number | null
  imposto_selo_credito: number | null
  imposto_selo_comissoes: number | null

  condicoes_especiais: string | null
  exige_domiciliacao_salario: boolean
  exige_cartao_credito: boolean
  exige_seguros_banco: boolean
  outros_produtos_obrigatorios: string | null

  data_submissao: string | null
  data_resposta: string | null
  data_aprovacao: string | null
  data_validade_aprovacao: string | null
  data_contratacao: string | null

  motivo_recusa: string | null
  is_selected: boolean
  notas: string | null

  created_at: string
  updated_at: string
}

export interface CreditDocument {
  id: string
  pedido_credito_id: string
  nome: string
  categoria: CreditDocCategory
  status: CreditDocStatus
  file_url: string | null
  file_name: string | null
  file_size: number | null
  file_mimetype: string | null
  doc_registry_id: string | null
  data_solicitado: string | null
  data_recebido: string | null
  data_validade: string | null
  obrigatorio: boolean
  bancos_requeridos: string[] | null
  notas: string | null
  motivo_rejeicao: string | null
  titular: 'titular_1' | 'titular_2' | 'ambos'
  order_index: number
  created_at: string
  updated_at: string
}

export interface CreditSimulation {
  id: string
  pedido_credito_id: string | null
  created_by: string
  valor_imovel: number
  montante_credito: number
  capital_proprio: number
  prazo_anos: number
  euribor: number
  spread: number
  taxa_juro: number
  tipo_taxa: RateType
  periodo_revisao_meses: number
  prestacao_mensal: number
  total_juros: number
  mtic: number
  ltv: number
  taxa_esforco: number | null
  imposto_selo_credito: number | null
  total_imposto_selo_juros: number | null
  seguro_vida_mensal_estimado: number | null
  seguro_multirriscos_anual_estimado: number | null
  encargo_credito_mensal: number | null
  rendimento_mensal_liquido: number | null
  label: string | null
  notas: string | null
  created_at: string
}

export interface CreditActivity {
  id: string
  pedido_credito_id: string
  user_id: string
  tipo: CreditActivityType
  descricao: string
  metadata: Record<string, unknown> | null
  created_at: string
  // Joined
  user_name?: string
}

export interface CreditBank {
  id: string
  nome: string
  nome_completo: string | null
  logo_url: string | null
  tem_protocolo: boolean
  protocolo_ref: string | null
  protocolo_validade: string | null
  spread_protocolo: number | null
  gestor_nome: string | null
  gestor_email: string | null
  gestor_telefone: string | null
  agencia: string | null
  comissao_percentagem: number | null
  comissao_minima: number | null
  comissao_maxima: number | null
  documentos_exigidos: BankDocRequirement[] | null
  is_active: boolean
  notas: string | null
  created_at: string
  updated_at: string
}

export interface BankDocRequirement {
  nome: string
  categoria: CreditDocCategory
  obrigatorio: boolean
}

// === Composite types for UI ===

export interface CreditRequestWithRelations extends CreditRequest {
  lead: {
    id: string
    nome: string
    email: string | null
    telemovel: string | null
    nif: string | null
  }
  negocio?: {
    id: string
    tipo: string
    orcamento: number | null
    estado: string
  } | null
  property?: {
    id: string
    title: string
    listing_price: number | null
    city: string | null
  } | null
  assigned_user: { id: string; commercial_name: string }
  propostas: CreditProposal[]
  documentos: CreditDocument[]
  simulacoes: CreditSimulation[]
}

export interface CreditRequestListItem extends CreditRequest {
  lead_nome: string
  lead_email: string | null
  property_title: string | null
  assigned_user_name: string
  propostas_count: number
  docs_pendentes: number
  docs_total: number
  melhor_spread: number | null
}

export interface CreditMetrics {
  total_propostas: number
  propostas_aprovadas: number
  melhor_spread: number | null
  melhor_prestacao: number | null
  docs_pendentes: number
  docs_total: number
  dias_em_processo: number
}

// === Simulation types ===

export interface SimulationInput {
  valor_imovel: number
  montante_credito: number
  prazo_anos: number
  euribor: number
  spread: number
  periodo_revisao_meses?: 3 | 6 | 12
  rendimento_mensal?: number
  euribor_cenarios?: number[]
}

export interface SimulationResult {
  prestacao_mensal: number
  total_juros: number
  mtic: number
  ltv: number
  capital_proprio: number
  taxa_esforco?: number
  imposto_selo_credito: number
  total_imposto_selo_juros: number
  seguro_vida_mensal_estimado: number
  seguro_multirriscos_anual_estimado: number
  encargo_credito_mensal: number
  tabela_amortizacao: AmortizationRow[]
}

export interface AmortizationRow {
  mes: number
  prestacao: number
  capital: number
  juros: number
  imposto_selo_juros: number
  capital_em_divida: number
}

export interface StressTestResult {
  cenario_base: { prestacao: number; total_juros: number }
  cenarios: {
    euribor: number
    prestacao: number
    total_juros: number
    variacao: number
  }[]
}
