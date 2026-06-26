// Tipos partilhados entre popup, content script e background.

export interface Pessoa {
  nome: string
  nif: string
}

export interface Requerente {
  nome: string
  nif: string
  email: string
  telefone: string
  endereco: string
}

export interface ImovelPayload {
  descricao_ficha: string
  artigo_matricial: string
  quota_parte?: string
  fracao_autonoma?: string
  area_bruta_privativa: number
  unidade_medida: 'm2' | 'outro'
  area_total?: number
  unidade_medida_total?: 'm2' | 'outro'
  arrendado: boolean
  destino: 'habitacao' | 'comercio' | 'industria' | 'outro'
  endereco: string
  distrito: string
  concelho: string
  freguesia: string
}

export interface TransmissaoPayload {
  tipo_negocio: 'compra_venda' | 'permuta' | 'dacao' | 'doacao'
  preco: number
  moeda: 'EUR'
  /** ISO 8601 (YYYY-MM-DD). A extensão converte para DD-MM-AAAA. */
  data_prevista: string
  observacoes?: string
}

export interface CasaProntaPayload {
  requerente: Requerente
  vendedores: Pessoa[]
  compradores: Pessoa[]
  imovel: ImovelPayload
  transmissao: TransmissaoPayload
}

/** Resumo de um negócio para a lista do popup. */
export interface NegocioResumo {
  id: string
  referencia: string
  estado: string
  vendedor_nome: string | null
  comprador_nome: string | null
  imovel_endereco: string | null
  preco: number | null
}

/** Mensagens chrome.runtime entre popup/background/content. */
export type RuntimeMessage =
  | { type: 'GET_ACTIVE_NEGOCIO' }
  | { type: 'SET_ACTIVE_NEGOCIO'; negocioId: string }
  | { type: 'FILL_FORM'; payload: CasaProntaPayload }
  | { type: 'REQUEST_PAYLOAD'; negocioId: string }
