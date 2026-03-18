export interface PropostaData {
  // 01. IDENTIFICAÇÃO DAS PARTES
  proprietario_nome: string
  proponente_nome: string

  // 02. A PROPOSTA
  morada: string
  concelho: string
  zona: string
  angariacao_ref: string // e.g. "ANG-2025-0001"

  // Natureza da transacção
  natureza: 'arrendamento' | 'propriedade_plena' | 'cedencia_posicao' | 'superficie' | 'outro'
  natureza_outro?: string // if natureza === 'outro'

  // Financiamento
  tem_financiamento: boolean
  valor_financiamento?: number // cents

  // Valores
  preco: number
  valor_contrato: number
  valor_reforco_1?: number
  data_reforco_1?: string // DD/MM/YYYY
  valor_reforco_2?: number
  data_reforco_2?: string // DD/MM/YYYY
  valor_conclusao: number

  // Data e condições
  data_proposta: string // DD/MM/YYYY
  condicoes_complementares?: string
}
