// Shape unificada para o ledger — funciona tanto para a CC dos consultores
// (`conta_corrente_transactions`) como para a CC da empresa
// (`company_transactions`). Permite reutilizar a mesma UI.

export type LedgerScope =
  | { kind: 'agent'; agentId: string }
  | { kind: 'company' }

export interface LedgerEntry {
  id: string
  date: string
  side: 'in' | 'out'
  /** Family alta-nível para o filtro das sub-tabs. */
  family: 'commission' | 'expense' | 'other'
  category: string
  categoryLabel: string
  description: string
  amount: number
  /** Apenas válido para scope='agent' (CC do consultor). */
  balanceAfter?: number | null
}
