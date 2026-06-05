'use client'

import { FileText, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PersonalExpense } from '@/types/personal-expense'

interface Props {
  expense: PersonalExpense
  onClick: () => void
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })

export function PersonalExpenseRow({ expense, onClick }: Props) {
  const isPdf = expense.receipt_mimetype === 'application/pdf'
  const isImage = expense.receipt_mimetype?.startsWith('image/') ?? false
  const hasReceipt = !!expense.receipt_url

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-xl bg-background/60 ring-1 ring-border/30 px-3 py-2.5',
        'hover:ring-border/60 hover:bg-background/80 transition-colors text-left min-w-0'
      )}
    >
      {/* Thumbnail */}
      <div className="shrink-0 h-12 w-12 rounded-lg ring-1 ring-border/40 overflow-hidden bg-muted/50 flex items-center justify-center">
        {hasReceipt && isImage ? (
          <img
            src={expense.receipt_url!}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : isPdf ? (
          <FileText className="h-5 w-5 text-muted-foreground" />
        ) : (
          <Receipt className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {expense.vendor_name || expense.description || 'Despesa'}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-muted-foreground">{fmtDate(expense.expense_date)}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] truncate text-muted-foreground">{expense.category}</span>
        </div>
      </div>

      {/* Valor */}
      <span className="text-sm font-semibold tabular-nums shrink-0 text-red-600 whitespace-nowrap">
        − {fmtCurrency(Number(expense.amount_gross))}
      </span>
    </button>
  )
}
