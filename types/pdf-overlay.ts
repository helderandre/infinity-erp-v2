export interface PdfTemplateField {
  id: string
  template_id: string
  page_number: number
  x_percent: number
  y_percent: number
  width_percent: number
  height_percent: number
  variable_key: string
  display_label: string | null
  font_size: number
  font_color: string
  text_align: 'left' | 'center' | 'right'
  transform: string | null
  is_required: boolean
  ai_detected: boolean
  ai_confidence: number | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TemplateDefault {
  id: string
  section: string
  template_id: string
  label: string | null
  updated_at: string
  updated_by: string | null
}

export interface AiDetectedField {
  page_number: number
  x_percent: number
  y_percent: number
  width_percent: number
  height_percent: number
  variable_key: string
  display_label: string
  confidence: number
}

// Known variable keys and their labels for auto-suggestion
export const KNOWN_VARIABLES: Record<string, string> = {
  nome_completo: 'Nome Completo',
  nome_profissional: 'Nome Profissional',
  cc_numero: 'N.º CC',
  cc_validade: 'Validade CC',
  cc_data_emissao: 'Data Emissão CC',
  data_nascimento: 'Data de Nascimento',
  nif: 'NIF',
  niss: 'NISS',
  naturalidade: 'Naturalidade',
  estado_civil: 'Estado Civil',
  morada_completa: 'Morada Completa',
  codigo_postal: 'Código Postal',
  localidade: 'Localidade',
  telemovel: 'Telemóvel',
  email_pessoal: 'Email Pessoal',
  email_profissional: 'Email Profissional',
  iban: 'IBAN',
  contacto_emergencia: 'Contacto Emergência',
  telefone_emergencia: 'Tel. Emergência',
  data_contrato: 'Data do Contrato',
  data_hoje: 'Data de Hoje',
  empresa: 'Empresa',
  taxa_comissao: 'Taxa de Comissão',
  salario_base: 'Salário Base',
  data_inicio: 'Data de Início',
}

export const TEMPLATE_SECTIONS: Record<string, string> = {
  contrato_entrada: 'Contrato de Entrada',
  contrato_prestacao: 'Contrato Prestação Serviços',
  proposta_compra: 'Proposta de Compra',
  proposta_arrendamento: 'Proposta de Arrendamento',
  cpcv: 'CPCV',
  ficha_cliente: 'Ficha de Cliente',
  mandato: 'Mandato de Mediação',
}
