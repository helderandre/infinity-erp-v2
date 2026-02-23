import { z } from 'zod'

// Schema de criacao de lead (campos minimos)
export const createLeadSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').trim(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional().or(z.literal('')),
  telemovel: z.string().optional().or(z.literal('')),
  origem: z.string().optional(),
  agent_id: z.string().uuid().optional().or(z.literal('')),
  estado: z.string().optional(),
  observacoes: z.string().optional(),
})

// Schema de actualizacao de lead (todos os campos opcionais)
export const updateLeadSchema = z.object({
  // Dados basicos
  nome: z.string().min(1).trim().optional(),
  full_name: z.string().trim().optional().nullable(),
  email: z.string().email().optional().nullable(),
  telefone: z.string().optional().nullable(),
  telemovel: z.string().optional().nullable(),
  telefone_fixo: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  temperatura: z.string().optional().nullable(),
  data: z.string().optional().nullable(),
  origem: z.string().optional().nullable(),
  agent_id: z.string().uuid().optional().nullable(),
  forma_contacto: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),

  // Consentimentos
  consentimento_contacto: z.boolean().optional(),
  consentimento_webmarketing: z.boolean().optional(),
  meio_contacto_preferencial: z.string().optional().nullable(),
  data_contacto: z.string().optional().nullable(),

  // Dados pessoais
  genero: z.string().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  nacionalidade: z.string().optional().nullable(),

  // Documentos
  tipo_documento: z.string().optional().nullable(),
  numero_documento: z.string().optional().nullable(),
  nif: z.string().optional().nullable(),
  pais_emissor: z.string().optional().nullable(),
  data_validade_documento: z.string().optional().nullable(),
  documento_identificacao_url: z.string().url().optional().nullable(),
  documento_identificacao_frente_url: z.string().url().optional().nullable(),
  documento_identificacao_verso_url: z.string().url().optional().nullable(),

  // Morada
  codigo_postal: z.string().optional().nullable(),
  localidade: z.string().optional().nullable(),
  pais: z.string().optional().nullable(),
  distrito: z.string().optional().nullable(),
  concelho: z.string().optional().nullable(),
  freguesia: z.string().optional().nullable(),
  zona: z.string().optional().nullable(),
  morada: z.string().optional().nullable(),

  // Empresa
  tem_empresa: z.boolean().optional(),
  empresa: z.string().optional().nullable(),
  nipc: z.string().optional().nullable(),
  morada_empresa: z.string().optional().nullable(),
  telefone_empresa: z.string().optional().nullable(),
  email_empresa: z.string().email().optional().nullable(),
  website_empresa: z.string().url().optional().nullable(),
})

// Schema de criacao de negocio
export const createNegocioSchema = z.object({
  lead_id: z.string().uuid('Lead ID inválido'),
  tipo: z.enum(['Compra', 'Venda', 'Compra e Venda', 'Arrendatário', 'Arrendador', 'Outro']),
  estado: z.string().optional(),
  observacoes: z.string().optional(),
  tipo_imovel: z.string().optional(),
  localizacao: z.string().optional(),
  estado_imovel: z.string().optional(),
  area_m2: z.number().positive().optional(),
  quartos: z.number().int().min(0).optional(),
  orcamento: z.number().positive().optional(),
  orcamento_max: z.number().positive().optional(),
  renda_max_mensal: z.number().positive().optional(),
  area_min_m2: z.number().positive().optional(),
  quartos_min: z.number().int().min(0).optional(),
  preco_venda: z.number().positive().optional(),
  renda_pretendida: z.number().positive().optional(),
})

// Schema de actualizacao de negocio (todos os campos do formulario)
export const updateNegocioSchema = z.object({
  tipo: z.string().optional(),
  estado: z.string().optional(),
  observacoes: z.string().optional().nullable(),
  tipo_imovel: z.string().optional().nullable(),
  localizacao: z.string().optional().nullable(),
  estado_imovel: z.string().optional().nullable(),
  area_m2: z.number().optional().nullable(),
  quartos: z.number().optional().nullable(),
  orcamento: z.number().optional().nullable(),
  orcamento_max: z.number().optional().nullable(),
  renda_max_mensal: z.number().optional().nullable(),
  area_min_m2: z.number().optional().nullable(),
  quartos_min: z.number().optional().nullable(),
  preco_venda: z.number().optional().nullable(),
  renda_pretendida: z.number().optional().nullable(),
  credito_pre_aprovado: z.boolean().optional().nullable(),
  valor_credito: z.number().optional().nullable(),
  capital_proprio: z.number().optional().nullable(),
  financiamento_necessario: z.boolean().optional().nullable(),
  prazo_compra: z.string().optional().nullable(),
  motivacao_compra: z.string().optional().nullable(),
  tem_elevador: z.boolean().optional().nullable(),
  tem_estacionamento: z.boolean().optional().nullable(),
  tem_garagem: z.boolean().optional().nullable(),
  tem_exterior: z.boolean().optional().nullable(),
  tem_varanda: z.boolean().optional().nullable(),
  tem_piscina: z.boolean().optional().nullable(),
  tem_porteiro: z.boolean().optional().nullable(),
  tem_arrumos: z.boolean().optional().nullable(),
  classe_imovel: z.string().optional().nullable(),
  casas_banho: z.number().optional().nullable(),
  num_wc: z.number().optional().nullable(),
  total_divisoes: z.number().optional().nullable(),
  distrito: z.string().optional().nullable(),
  concelho: z.string().optional().nullable(),
  freguesia: z.string().optional().nullable(),
  situacao_profissional: z.string().optional().nullable(),
  rendimento_mensal: z.number().optional().nullable(),
  tem_fiador: z.boolean().optional().nullable(),
  duracao_minima_contrato: z.string().optional().nullable(),
  caucao_rendas: z.number().optional().nullable(),
  aceita_animais: z.boolean().optional().nullable(),
  mobilado: z.boolean().optional().nullable(),
  // Campos _venda (para tipo "Compra e Venda")
  localizacao_venda: z.string().optional().nullable(),
  tipo_imovel_venda: z.string().optional().nullable(),
  estado_imovel_venda: z.string().optional().nullable(),
  tem_elevador_venda: z.boolean().optional().nullable(),
  tem_estacionamento_venda: z.boolean().optional().nullable(),
  tem_garagem_venda: z.boolean().optional().nullable(),
  tem_exterior_venda: z.boolean().optional().nullable(),
  tem_varanda_venda: z.boolean().optional().nullable(),
  tem_piscina_venda: z.boolean().optional().nullable(),
  tem_porteiro_venda: z.boolean().optional().nullable(),
  tem_arrumos_venda: z.boolean().optional().nullable(),
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
export type CreateNegocioInput = z.infer<typeof createNegocioSchema>
export type UpdateNegocioInput = z.infer<typeof updateNegocioSchema>
