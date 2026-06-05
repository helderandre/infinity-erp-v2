'use client'

import { useMemo, useState } from 'react'
import { Receipt } from 'lucide-react'
import { useLedger } from '@/hooks/use-ledger'
import { usePersonalExpenses } from '@/hooks/use-personal-expenses'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PersonalExpenseDetailSheet } from './personal-expense-detail-sheet'
import { UnifiedRow } from './unified-row'
import {
  ledgerToUnified,
  personalToUnified,
  applyUnifiedFilter,
  type UnifiedEntry,
} from '@/lib/financial/unified-entry'
import { rangeForPeriod, type PeriodValue } from './period-picker'
import type { PersonalExpense } from '@/types/personal-expense'
import { cn } from '@/lib/utils'

type FilterKind = 'all' | 'company' | 'personal'
type LegacyPeriod = 'month' | 'last3' | 'ytd' | 'all'

function rangeForLegacy(period: LegacyPeriod): { from?: string; to?: string } {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  if (period === 'all') return {}
  if (period === 'month') {
    return {
      from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      to: today,
    }
  }
  if (period === 'last3') {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    return { from: d.toISOString().slice(0, 10), to: today }
  }
  return { from: `${now.getFullYear()}-01-01`, to: today }
}

interface Props {
  agentId: string
  initialLimit?: number
  onPersonalChanged?: () => void
  /** Quando fornecido, period é controlled pelo parent e o Select interno é escondido. */
  externalPeriod?: PeriodValue
}

export function UnifiedLedger({ agentId, initialLimit = 30, onPersonalChanged, externalPeriod }: Props) {
  const isControlled = externalPeriod !== undefined
  const [legacyPeriod, setLegacyPeriod] = useState<LegacyPeriod>('month')
  const [filter, setFilter] = useState<FilterKind>('all')
  const [limit, setLimit] = useState(initialLimit)
  const [selectedPersonal, setSelectedPersonal] = useState<PersonalExpense | null>(null)

  const range = useMemo(() => {
    if (isControlled) return rangeForPeriod(externalPeriod!)
    return rangeForLegacy(legacyPeriod)
  }, [isControlled, externalPeriod, legacyPeriod])

  const ledger = useLedger({ scope: { kind: 'agent', agentId }, range })
  const personal = usePersonalExpenses({ ...range, limit: 100 })

  const merged = useMemo<UnifiedEntry[]>(() => {
    const all = [
      ...ledger.entries.map(ledgerToUnified),
      ...personal.data.map(personalToUnified),
    ]
    return all.sort((a, b) => b.date.localeCompare(a.date))
  }, [ledger.entries, personal.data])

  const filtered = useMemo(() => {
    return applyUnifiedFilter(merged, {
      source: filter,
    })
  }, [merged, filter])

  const visible = filtered.slice(0, limit)
  const hasMore = filtered.length > limit
  const loading = ledger.loading || personal.loading

  return (
    <>
      <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-4 sm:p-5">
        <div className="space-y-3 mb-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-tight">Movimentos</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Todos os ganhos e despesas — empresa e pessoais
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isControlled && (
              <Select value={legacyPeriod} onValueChange={(v) => setLegacyPeriod(v as LegacyPeriod)}>
                <SelectTrigger className="h-8 text-xs w-auto rounded-full bg-muted/50 border-border/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Este mês</SelectItem>
                  <SelectItem value="last3">Últimos 3 meses</SelectItem>
                  <SelectItem value="ytd">Ano corrente</SelectItem>
                  <SelectItem value="all">Tudo</SelectItem>
                </SelectContent>
              </Select>
            )}
            <FilterChips value={filter} onChange={setFilter} />
          </div>
        </div>

        {loading && merged.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
            <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Sem movimentos {filter === 'company' ? 'da empresa' : filter === 'personal' ? 'pessoais' : ''} neste período.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {visible.map((e) => (
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

        {hasMore && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + 30)}
            className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground py-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            Carregar mais
          </button>
        )}
      </div>

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

function FilterChips({ value, onChange }: { value: FilterKind; onChange: (v: FilterKind) => void }) {
  const tabs: Array<{ value: FilterKind; label: string }> = [
    { value: 'all', label: 'Tudo' },
    { value: 'company', label: 'Empresa' },
    { value: 'personal', label: 'Pessoal' },
  ]
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/50 border border-border/30">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
            value === t.value
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
