import type { NegocioResumo, CasaProntaPayload } from './types'

// MOCK partilhado entre popup e content script.
// Passo 7 substitui estas funções por chamadas reais ao Supabase (deals + joins).

const MOCK_NEGOCIOS: NegocioResumo[] = [
  {
    id: 'mock-deal-1',
    referencia: 'DEAL-2026-0007',
    estado: 'active',
    vendedor_nome: 'Maria Silva Costa',
    comprador_nome: 'João Pedro Almeida',
    imovel_endereco: 'Rua das Flores, 15, 2º Dto, Cascais',
    preco: 385000,
  },
  {
    id: 'mock-deal-2',
    referencia: 'DEAL-2026-0011',
    estado: 'draft',
    vendedor_nome: 'Construtora Lusa, Lda.',
    comprador_nome: 'Ana Rita Fernandes',
    imovel_endereco: 'Av. da Liberdade, 200, 5º, Lisboa',
    preco: 720000,
  },
  {
    id: 'mock-deal-3',
    referencia: 'DEAL-2026-0014',
    estado: 'active',
    vendedor_nome: 'António Marques Pereira',
    comprador_nome: 'Sofia Lopes Machado',
    imovel_endereco: 'Rua do Sol, 47, R/C, Sintra',
    preco: 245000,
  },
]

const MOCK_PAYLOADS: Record<string, CasaProntaPayload> = {
  'mock-deal-1': {
    requerente: {
      nome: 'Duarte Costa',
      nif: '253489012',
      email: 'duarte@mube.pt',
      telefone: '912345678',
      endereco: 'Rua da Inovação, 10, 1000-001 Lisboa',
    },
    vendedores: [{ nome: 'Maria Silva Costa', nif: '198765432' }],
    compradores: [{ nome: 'João Pedro Almeida', nif: '234567891' }],
    imovel: {
      descricao_ficha: '12345',
      artigo_matricial: '4567',
      fracao_autonoma: 'C',
      area_bruta_privativa: 95,
      unidade_medida: 'm2',
      area_total: 110,
      unidade_medida_total: 'm2',
      arrendado: false,
      destino: 'habitacao',
      endereco: 'Rua das Flores, 15, 2º Dto',
      distrito: 'Lisboa',
      concelho: 'Cascais',
      freguesia: 'Cascais e Estoril',
    },
    transmissao: {
      tipo_negocio: 'compra_venda',
      preco: 385000,
      moeda: 'EUR',
      data_prevista: '2026-05-15',
      observacoes: 'Escritura prevista para meados de Maio.',
    },
  },
  'mock-deal-2': {
    requerente: {
      nome: 'Duarte Costa',
      nif: '253489012',
      email: 'duarte@mube.pt',
      telefone: '912345678',
      endereco: 'Rua da Inovação, 10, 1000-001 Lisboa',
    },
    vendedores: [{ nome: 'Construtora Lusa, Lda.', nif: '509876543' }],
    compradores: [{ nome: 'Ana Rita Fernandes', nif: '212345678' }],
    imovel: {
      descricao_ficha: '98765',
      artigo_matricial: '8891',
      fracao_autonoma: 'E',
      area_bruta_privativa: 140,
      unidade_medida: 'm2',
      arrendado: false,
      destino: 'habitacao',
      endereco: 'Av. da Liberdade, 200, 5º',
      distrito: 'Lisboa',
      concelho: 'Lisboa',
      freguesia: 'Santo António',
    },
    transmissao: {
      tipo_negocio: 'compra_venda',
      preco: 720000,
      moeda: 'EUR',
      data_prevista: '2026-06-10',
    },
  },
  'mock-deal-3': {
    requerente: {
      nome: 'Duarte Costa',
      nif: '253489012',
      email: 'duarte@mube.pt',
      telefone: '912345678',
      endereco: 'Rua da Inovação, 10, 1000-001 Lisboa',
    },
    vendedores: [
      { nome: 'António Marques Pereira', nif: '187654321' },
      { nome: 'Teresa Pereira Lopes', nif: '187654322' },
    ],
    compradores: [{ nome: 'Sofia Lopes Machado', nif: '298765432' }],
    imovel: {
      descricao_ficha: '55443',
      artigo_matricial: '2214',
      area_bruta_privativa: 78,
      unidade_medida: 'm2',
      area_total: 78,
      unidade_medida_total: 'm2',
      arrendado: false,
      destino: 'habitacao',
      endereco: 'Rua do Sol, 47, R/C',
      distrito: 'Lisboa',
      concelho: 'Sintra',
      freguesia: 'Sintra (Sta. Maria e S. Miguel, S. Martinho e S. Pedro de Penaferrim)',
    },
    transmissao: {
      tipo_negocio: 'compra_venda',
      preco: 245000,
      moeda: 'EUR',
      data_prevista: '2026-04-28',
    },
  },
}

export async function fetchNegocios(): Promise<NegocioResumo[]> {
  await new Promise((r) => setTimeout(r, 150))
  return MOCK_NEGOCIOS
}

export async function fetchNegocioPayload(
  negocioId: string
): Promise<CasaProntaPayload | null> {
  await new Promise((r) => setTimeout(r, 80))
  return MOCK_PAYLOADS[negocioId] ?? null
}
