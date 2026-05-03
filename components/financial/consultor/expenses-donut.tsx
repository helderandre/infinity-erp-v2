'use client'

import { useMemo } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { Receipt, ShoppingBag } from 'lucide-react'
import { getCategoryIcon } from '@/lib/financial/personal-expense-categories'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const PIE_COLORS = [
  '#0ea5e9', '#10b981', '#f59e0b', '#a855f7', '#ef4444',
  '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#ec4899',
  '#06b6d4', '#8b5cf6',
]

/** Categoria sintética para a fatia da loja institucional. */
const LOJA_CATEGORY = 'Loja institucional'

export interface ExpenseSlice {
  category: string
  amount: number
}

interface Props {
  title: string
  subtitle?: string
  /** Lista de fatias — somar todas dá o total mostrado no centro. */
  data: ExpenseSlice[]
  loading?: boolean
  emptyText?: string
  className?: string
}

export function ExpensesDonut({
  title, subtitle, data, loading, emptyText = 'Sem despesas no período.', className,
}: Props) {
  const total = useMemo(() => data.reduce((s, d) => s + d.amount, 0), [data])
  const sorted = useMemo(() => [...data].sort((a, b) => b.amount - a.amount), [data])

  return (
    <div className={cn(
      'rounded-2xl bg-background/60 ring-1 ring-border/40 p-4 sm:p-5 min-w-0 overflow-hidden',
      className,
    )}>
      <div className="mb-3">
        <p className="text-xs font-semibold tracking-tight">{title}</p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-[260px_1fr] items-center">
          <Skeleton className="h-[220px] w-full rounded-2xl" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : data.length === 0 || total === 0 ? (
        <div className="h-[200px] flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
          <Receipt className="h-7 w-7 mb-2 opacity-40" />
          {emptyText}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[260px_1fr] items-center">
          <div className="relative w-full">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <defs>
                  {sorted.map((_, i) => (
                    <linearGradient key={i} id={`donut-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PIE_COLORS[i % PIE_COLORS.length]} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={PIE_COLORS[i % PIE_COLORS.length]} stopOpacity={0.65} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={sorted}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={4}
                  cornerRadius={8}
                  stroke="none"
                  isAnimationActive
                  animationDuration={500}
                >
                  {sorted.map((_, i) => (
                    <Cell key={i} fill={`url(#donut-grad-${i})`} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [fmtCurrency(Number(value)), name]}
                  contentStyle={{
                    borderRadius: 12, fontSize: 12, border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--background) / 0.95)',
                    backdropFilter: 'blur(8px)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Centro */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Total</span>
              <span className="text-base font-bold tracking-tight tabular-nums">{fmtCurrency(total)}</span>
              <span className="text-[10px] text-muted-foreground">{sorted.length} categoria{sorted.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          {/* Legenda */}
          <ul className="space-y-1.5">
            {sorted.slice(0, 6).map((slice, i) => {
              const Icon = slice.category === LOJA_CATEGORY ? ShoppingBag : getCategoryIcon(slice.category)
              const pct = total > 0 ? Math.round((slice.amount / total) * 100) : 0
              return (
                <li
                  key={slice.category}
                  className="flex items-center gap-2 text-[11px] min-w-0"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{slice.category}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0 whitespace-nowrap">
                    {fmtCurrency(slice.amount)} · {pct}%
                  </span>
                </li>
              )
            })}
            {sorted.length > 6 && (
              <li className="text-[11px] text-muted-foreground pl-[18px]">
                +{sorted.length - 6} outras
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export { LOJA_CATEGORY }
