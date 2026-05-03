'use client'

import { useMemo, useState } from 'react'
import { Receipt } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useLedger } from '@/hooks/use-ledger'
import { usePersonalExpenses } from '@/hooks/use-personal-expenses'
import { PersonalExpenseDetailSheet } from './personal-expense-detail-sheet'
import { UnifiedRow } from './unified-row'
import {
  ledgerToUnified,
  personalToUnified,
  applyUnifiedFilter,
  type UnifiedFilter,
  type UnifiedEntry,
} from '@/lib/financial/unified-entry'
import type { PersonalExpense } from '@/types/personal-expense'
import { cn } from '@/lib/utils'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  title: string
  subtitle?: string
  /** Filtro a aplicar — só entries que casem aparecem na lista. */
  filter: UnifiedFilter
  /** Total para mostrar no header (calculado pelo parent). */
  totalAmount: number
  /** Callback quando uma despesa pessoal é editada/eliminada. */
  onPersonalChanged?: () => void
}

export function KpiDetailSheet({
  open, onOpenChange, agentId, title, subtitle, filter, totalAmount, onPersonalChanged,
}: Props) {
  const [selectedPersonal, setSelectedPersonal] = useState<PersonalExpense | null>(null)

  const range = filter.from || filter.to ? { from: filter.from, to: filter.to } : undefined
  const ledger = useLedger({ scope: { kind: 'agent', agentId }, range })
  const personal = usePersonalExpenses({
    from: filter.from,
    to: filter.to,
    limit: 100,
  })

  const filtered = useMemo<UnifiedEntry[]>(() => {
    const skipCompany = filter.source === 'personal'
    const skipPersonal = filter.source === 'company'

    const all = [
      ...(skipCompany ? [] : ledger.entries.map(ledgerToUnified)),
      ...(skipPersonal ? [] : personal.data.map(personalToUnified)),
    ]
    return applyUnifiedFilter(all, filter).sort((a, b) => b.date.localeCompare(a.date))
  }, [ledger.entries, personal.data, filter])

  const loading = ledger.loading || personal.loading

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={cn(
            'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
            'w-full sm:max-w-[520px] rounded-l-3xl sm:rounded-l-3xl',
          )}
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
            <SheetTitle className="flex items-center justify-between gap-2 text-base">
              <span>{title}</span>
              <span className="text-base font-semibold tabular-nums">
                {fmtCurrency(totalAmount)}
              </span>
            </SheetTitle>
            {subtitle && (
              <SheetDescription className="text-xs">{subtitle}</SheetDescription>
            )}
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            {loading && filtered.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
                <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Sem movimentos.</p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {filtered.map((e) => (
                  <li key={e.key}>
                    <UnifiedRow
                      entry={e}
                      onClick={
                        e.personalExpense
                          ? () => setSelectedPersonal(e.personalExpense!)
                          : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <PersonalExpenseDetailSheet
        expense={selectedPersonal}
        onOpenChange={(o) => { if (!o) setSelectedPersonal(null) }}
        onChanged={() => {
          personal.refetch()
          onPersonalChanged?.()
        }}
      />
    </>
  )
}
