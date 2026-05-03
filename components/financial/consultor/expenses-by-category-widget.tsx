'use client'

import { useMemo, useState } from 'react'
import { useLedger } from '@/hooks/use-ledger'
import { usePersonalExpensesSummary } from '@/hooks/use-personal-expenses'
import { ExpensesDonut, LOJA_CATEGORY, type ExpenseSlice } from './expenses-donut'
import { PeriodPicker, rangeForPeriod, type PeriodValue } from './period-picker'

interface Props {
  agentId: string
}

/**
 * Widget self-contained do donut "Despesas por categoria":
 * - Period picker (Esta semana / Este mês / Este ano / Personalizado)
 * - Fetcha conta corrente + summary das despesas pessoais para o range
 * - Compõe slices: loja institucional (1 fatia) + categorias pessoais
 */
export function ExpensesByCategoryWidget({ agentId }: Props) {
  const [period, setPeriod] = useState<PeriodValue>({ preset: 'month' })

  const range = useMemo(() => rangeForPeriod(period), [period])

  const ledger = useLedger({ scope: { kind: 'agent', agentId }, range })
  const personal = usePersonalExpensesSummary({
    from: range.from,
    to: range.to,
  })

  const slices = useMemo<ExpenseSlice[]>(() => {
    const lojaTotal = ledger.entries
      .filter((e) => e.family === 'expense' && e.category === 'marketing_purchase')
      .reduce((s, e) => s + e.amount, 0)

    const personalSlices = (personal.data?.by_category ?? []).map((c) => ({
      category: c.category,
      amount: c.amount,
    }))

    return [
      ...(lojaTotal > 0 ? [{ category: LOJA_CATEGORY, amount: lojaTotal }] : []),
      ...personalSlices,
    ]
  }, [ledger.entries, personal.data])

  const subtitle = period.preset === 'custom' && range.from && range.to
    ? `${range.from} – ${range.to}`
    : 'Loja institucional + despesas pessoais'

  return (
    <ExpensesDonut
      title="Despesas por categoria"
      subtitle={subtitle}
      data={slices}
      loading={(ledger.loading || personal.loading) && slices.length === 0}
      rightAction={<PeriodPicker value={period} onChange={setPeriod} />}
      emptyText="Sem despesas registadas neste período."
    />
  )
}
