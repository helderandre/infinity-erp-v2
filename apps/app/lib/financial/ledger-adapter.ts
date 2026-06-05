import { CONTA_CORRENTE_CATEGORIES } from '@/lib/constants'
import type { ContaCorrenteTransaction } from '@/types/marketing'
import type { CompanyTransaction } from '@/types/financial'
import type { LedgerEntry } from './ledger-types'

// ─── Agent scope (conta_corrente_transactions) ─────────────────────────────

export function mapAgentTransaction(t: ContaCorrenteTransaction): LedgerEntry {
  const cat = (CONTA_CORRENTE_CATEGORIES as any)[t.category]
  const family: LedgerEntry['family'] =
    t.category === 'commission'
      ? 'commission'
      : t.category === 'marketing_purchase'
      ? 'expense'
      : 'other'

  return {
    id: t.id,
    date: t.date,
    side: t.type === 'CREDIT' ? 'in' : 'out',
    family,
    category: t.category,
    categoryLabel: cat?.label ?? t.category,
    description: t.description ?? '',
    amount: Number(t.amount || 0),
    balanceAfter: t.balance_after != null ? Number(t.balance_after) : null,
  }
}

// ─── Company scope (company_transactions) ──────────────────────────────────

export function mapCompanyTransaction(t: CompanyTransaction): LedgerEntry {
  const family: LedgerEntry['family'] =
    t.type === 'income' ? 'commission' : 'expense'

  return {
    id: t.id,
    date: t.date,
    side: t.type === 'income' ? 'in' : 'out',
    family,
    category: t.category,
    categoryLabel: t.category,
    description: t.description ?? '',
    amount: Number(t.amount_gross ?? t.amount_net ?? 0),
  }
}
