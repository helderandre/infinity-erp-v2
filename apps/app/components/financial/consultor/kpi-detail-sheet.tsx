'use client'

import { useMemo, useState } from 'react'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FinanceiroSheet } from '@/components/financial/sheets/financeiro-sheet'
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

export type KpiTone = 'positive' | 'negative' | 'warning' | 'info' | 'neutral'

const TONE_MAP: Record<KpiTone, { from: string; dot: string }> = {
  positive: { from: 'from-emerald-500/15', dot: 'bg-emerald-500' },
  negative: { from: 'from-red-500/15', dot: 'bg-red-500' },
  warning: { from: 'from-amber-500/15', dot: 'bg-amber-500' },
  info: { from: 'from-blue-500/15', dot: 'bg-blue-500' },
  neutral: { from: 'from-slate-500/15', dot: 'bg-slate-500' },
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  title: string
  subtitle?: string
  /** Tom da KPI — controla cores do dot e do gradient. */
  tone?: KpiTone
  /** Filtro a aplicar — só entries que casem aparecem na lista. */
  filter: UnifiedFilter
  /** Total para mostrar no Total tile. */
  totalAmount: number
  /** Callback quando uma despesa pessoal é editada/eliminada. */
  onPersonalChanged?: () => void
}

export function KpiDetailSheet({
  open, onOpenChange, agentId, title, subtitle, tone = 'neutral', filter, totalAmount, onPersonalChanged,
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
  const toneTokens = TONE_MAP[tone]

  return (
    <>
      <FinanceiroSheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        accent={
          <span className={cn('inline-flex h-2 w-2 rounded-full', toneTokens.dot)} />
        }
        subtitle={subtitle}
        size="wide"
        footer={
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">
            Fechar
          </Button>
        }
      >
        {/* Total tile */}
        <div className={cn(
          'rounded-2xl ring-1 ring-border/40 p-5 bg-gradient-to-br to-transparent',
          toneTokens.from,
        )}>
          <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
            Total
          </p>
          {loading ? (
            <Skeleton className="h-8 w-40 mt-2" />
          ) : (
            <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums mt-1">
              {fmtCurrency(totalAmount)}
            </p>
          )}
          {!loading && (
            <p className="text-xs text-muted-foreground mt-2">
              {filtered.length === 0
                ? 'Sem entradas no período.'
                : `${filtered.length} entrada${filtered.length === 1 ? '' : 's'}`}
            </p>
          )}
        </div>

        {/* Entries list */}
        <div className="space-y-2">
          {loading && (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </>
          )}

          {!loading && filtered.length === 0 && (
            <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 py-12 text-center text-sm text-muted-foreground">
              <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Sem entradas para listar.
            </div>
          )}

          {!loading && filtered.map((e) => (
            <UnifiedRow
              key={e.key}
              entry={e}
              onClick={
                e.personalExpense
                  ? () => setSelectedPersonal(e.personalExpense!)
                  : undefined
              }
            />
          ))}
        </div>
      </FinanceiroSheet>

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
