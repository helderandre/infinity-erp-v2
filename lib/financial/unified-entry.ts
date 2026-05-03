import type { LedgerEntry } from './ledger-types'
import type { PersonalExpense } from '@/types/personal-expense'

/**
 * Shape unificada para um movimento da conta corrente do consultor —
 * mistura entries de `conta_corrente_transactions` (empresa) com despesas
 * pessoais de `agent_personal_expenses`.
 */
export interface UnifiedEntry {
  /** Combinação para uniqueness mesmo com IDs duplicados entre fontes. */
  key: string
  date: string
  side: 'in' | 'out'
  source: 'company' | 'personal'
  /** Sub-tipo para badge: comissão, loja, ajuste, pessoal. */
  type: 'commission' | 'shop' | 'adjustment' | 'personal'
  description: string
  amount: number
  /** Saldo após movimento (só para entries da CC empresa). */
  balanceAfter?: number | null
  /** Despesa pessoal completa, para abrir o detail sheet. */
  personalExpense?: PersonalExpense
}

export function ledgerToUnified(e: LedgerEntry): UnifiedEntry {
  const type: UnifiedEntry['type'] =
    e.family === 'commission' ? 'commission'
      : e.category === 'marketing_purchase' ? 'shop'
        : 'adjustment'
  return {
    key: `cc-${e.id}`,
    date: e.date,
    side: e.side,
    source: 'company',
    type,
    description: e.description,
    amount: e.amount,
    balanceAfter: e.balanceAfter ?? null,
  }
}

export function personalToUnified(p: PersonalExpense): UnifiedEntry {
  return {
    key: `pe-${p.id}`,
    date: p.expense_date,
    side: 'out',
    source: 'personal',
    type: 'personal',
    description: p.vendor_name || p.description || p.category,
    amount: Number(p.amount_gross),
    personalExpense: p,
  }
}

export interface UnifiedFilter {
  source?: 'company' | 'personal' | 'all'
  side?: 'in' | 'out'
  /** Restrição por sub-tipo (commission/shop/adjustment/personal). */
  types?: Array<UnifiedEntry['type']>
  /** ISO date inclusive. */
  from?: string
  to?: string
}

export function applyUnifiedFilter(
  entries: UnifiedEntry[],
  filter: UnifiedFilter
): UnifiedEntry[] {
  return entries.filter((e) => {
    if (filter.source && filter.source !== 'all' && e.source !== filter.source) return false
    if (filter.side && e.side !== filter.side) return false
    if (filter.types && !filter.types.includes(e.type)) return false
    if (filter.from && e.date < filter.from) return false
    if (filter.to && e.date > filter.to) return false
    return true
  })
}
