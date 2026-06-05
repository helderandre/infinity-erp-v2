'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { CompanyTransaction, CompanyCategory } from '@/types/financial'

interface CompanyStatsViewProps {
  transactions: CompanyTransaction[]
  categories: CompanyCategory[]
  type: 'income' | 'expense'
  totalIncome: number
  totalExpense: number
  onTypeChange: (type: 'income' | 'expense') => void
  /** Esconde o toggle Receitas/Despesas — usado quando a página só lida com despesas */
  hideTypeToggle?: boolean
  /** Esconde o card border externo (quando o componente já está dentro de outro card) */
  hideOuterCard?: boolean
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
const fmtCurrencyFull = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

/** Paleta determinística — usada se a categoria não tiver `color` definida */
const FALLBACK_PALETTE = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#6366f1', // indigo
  '#f97316', // orange
]

function colorForCategory(name: string, definedColor: string | null, idx: number): string {
  if (definedColor && /^#[0-9a-f]{3,8}$/i.test(definedColor)) return definedColor
  return FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length]
}

export function CompanyStatsView({
  transactions,
  categories,
  type,
  totalIncome,
  totalExpense,
  onTypeChange,
  hideTypeToggle = false,
  hideOuterCard = false,
}: CompanyStatsViewProps) {
  const filtered = useMemo(
    () => transactions.filter((t) => t.type === type),
    [transactions, type],
  )

  const total = type === 'income' ? totalIncome : totalExpense

  // Agrupar por categoria
  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const tx of filtered) {
      const value = Number(tx.amount_gross || tx.amount_net || 0)
      map.set(tx.category, (map.get(tx.category) || 0) + value)
    }
    const arr = Array.from(map.entries())
      .map(([name, value]) => {
        const cat = categories.find((c) => c.name === name)
        return { name, value, definedColor: cat?.color || null }
      })
      .sort((a, b) => b.value - a.value)

    return arr.map((item, idx) => ({
      ...item,
      color: colorForCategory(item.name, item.definedColor, idx),
      pct: total > 0 ? Math.round((item.value / total) * 100) : 0,
    }))
  }, [filtered, categories, total])

  const isEmpty = byCategory.length === 0 || total === 0

  const wrapperClass = hideOuterCard
    ? ''
    : 'rounded-3xl border bg-card/50 backdrop-blur-sm p-5 sm:p-6 shadow-sm'

  return (
    <div className={wrapperClass}>
      {/* Toggle Receitas / Despesas */}
      {!hideTypeToggle && (
        <div className="flex items-center justify-center gap-1 p-1 rounded-full bg-muted/40 mb-6">
          <button
            type="button"
            onClick={() => onTypeChange('income')}
            className={`flex-1 px-4 py-2 text-xs font-medium rounded-full transition-all duration-300 flex items-center justify-center gap-1.5 ${
              type === 'income'
                ? 'bg-card shadow-sm text-emerald-600'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Receitas
            <span className="text-[10px] opacity-70 tabular-nums">({fmtCurrency(totalIncome)})</span>
          </button>
          <button
            type="button"
            onClick={() => onTypeChange('expense')}
            className={`flex-1 px-4 py-2 text-xs font-medium rounded-full transition-all duration-300 flex items-center justify-center gap-1.5 ${
              type === 'expense'
                ? 'bg-card shadow-sm text-red-600'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingDown className="h-3.5 w-3.5" />
            Despesas
            <span className="text-[10px] opacity-70 tabular-nums">({fmtCurrency(totalExpense)})</span>
          </button>
        </div>
      )}

      {/* Donut chart */}
      <div className="relative h-[260px] w-full">
        {isEmpty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <div className="h-32 w-32 rounded-full border-8 border-muted/30" />
            <p className="text-sm mt-3">Sem {type === 'income' ? 'receitas' : 'despesas'} neste período</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={85}
                  outerRadius={120}
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                >
                  {byCategory.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [fmtCurrencyFull(value), name]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Centro do donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Total {type === 'income' ? 'Receitas' : 'Despesas'}
              </p>
              <p className="text-2xl font-bold tracking-tight tabular-nums mt-0.5">
                {fmtCurrencyFull(total)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Lista de categorias */}
      {!isEmpty && (
        <div className="mt-6 space-y-2">
          {byCategory.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors"
            >
              {/* Bolha com % */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white tabular-nums shadow-sm"
                style={{ backgroundColor: item.color }}
              >
                {item.pct}%
              </div>
              {/* Nome */}
              <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
              {/* Valor */}
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                {fmtCurrencyFull(item.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
