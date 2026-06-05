'use client'

import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getCategoryIcon } from '@/lib/financial/personal-expense-categories'
import { ShoppingBag, Banknote, Sliders } from 'lucide-react'
import type { UnifiedEntry } from '@/lib/financial/unified-entry'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })

export const TYPE_BADGES: Record<UnifiedEntry['type'], { label: string; cls: string }> = {
  commission: {
    label: 'Comissão',
    cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  },
  shop: {
    label: 'Loja',
    cls: 'bg-sky-500/10 text-sky-700 border-sky-500/30',
  },
  adjustment: {
    label: 'Ajuste',
    cls: 'bg-slate-500/10 text-slate-700 border-slate-500/30',
  },
  personal: {
    label: 'Pessoal',
    cls: 'bg-violet-500/10 text-violet-700 border-violet-500/30',
  },
}

function getEntryIcon(entry: UnifiedEntry): React.ComponentType<{ className?: string }> {
  if (entry.personalExpense) {
    return getCategoryIcon(entry.personalExpense.category)
  }
  switch (entry.type) {
    case 'commission': return Banknote
    case 'shop': return ShoppingBag
    case 'adjustment': return Sliders
    default: return Banknote
  }
}

export function UnifiedRow({
  entry, onClick,
}: { entry: UnifiedEntry; onClick?: () => void }) {
  const { label, cls } = TYPE_BADGES[entry.type]
  const isCredit = entry.side === 'in'
  const SideIcon = isCredit ? ArrowUpCircle : ArrowDownCircle
  const TypeIcon = getEntryIcon(entry)
  const Wrapper = onClick ? 'button' : 'div'
  const clickable = !!onClick

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group relative w-full text-left rounded-2xl ring-1 ring-border/40 bg-background/60 p-3 sm:p-4',
        'transition-all',
        clickable && 'cursor-pointer hover:ring-border/70 hover:shadow-[0_4px_16px_-6px_rgb(0_0_0_/_0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Ícone esquerdo: tipo (loja/comissão/categoria pessoal) */}
        <div className={cn(
          'shrink-0 rounded-xl p-2',
          isCredit ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600',
        )}>
          <TypeIcon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate text-foreground">
                {entry.description}
              </p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-1.5 py-0 h-4 font-medium', cls)}
                >
                  {label}
                </Badge>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {fmtDate(entry.date)}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className={cn(
                'flex items-center gap-1 justify-end',
                isCredit ? 'text-emerald-600' : 'text-red-600',
              )}>
                <SideIcon className="h-3.5 w-3.5" />
                <span className="text-base font-semibold tabular-nums whitespace-nowrap">
                  {fmtCurrency(entry.amount)}
                </span>
              </div>
              {entry.balanceAfter != null && (
                <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                  Saldo: {fmtCurrency(entry.balanceAfter)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Wrapper>
  )
}
