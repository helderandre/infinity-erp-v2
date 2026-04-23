import type { Database } from './database'

export type AcessosCustomSite =
  Database['public']['Tables']['acessos_custom_sites']['Row']

export type HydratedAcessosCustomSite = AcessosCustomSite & {
  can_edit: boolean
  can_delete: boolean
}

// ─── Estrutura (company info) ─────────────────────────────

export interface FaturacaoCompanyData {
  nome: string
  sede: string
  nipc: string
}

export interface ConvictusAgencia {
  nome: string
  morada: string
  telefone: string
}

export interface ConvictusSede {
  nome: string
  morada: string
  telefone: string
  ami: string
}

export interface ConvictusCompanyData {
  agencia: ConvictusAgencia
  sede: ConvictusSede
}

export type AcessosCompanyScope = 'faturacao' | 'convictus'

export interface AcessosCompanyInfoPayload {
  faturacao: FaturacaoCompanyData
  convictus: ConvictusCompanyData
  can_manage: boolean
}
