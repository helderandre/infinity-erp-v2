'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Receipt, ShoppingBag, Banknote, Sliders } from 'lucide-react'
import { useLedger } from '@/hooks/use-ledger'
import { usePersonalExpenses } from '@/hooks/use-personal-expenses'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { PersonalExpenseDetailSheet } from './personal-expense-detail-sheet'
import type { PersonalExpense } from '@/types/personal-expense'
import type { LedgerEntry } from '@/lib/financial/ledger-types'
import { cn } from '@/lib/utils'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })

type FilterKind = 'all' | 'company' | 'personal'

interface Props {
  agentId: string
  /** Limite de entries combinadas a mostrar antes de "carregar mais". */
  initialLimit?: number
  onPersonalChanged?: () => void
}

interface UnifiedEntry {
  /** Combinação para garantir uniqueness mesmo com IDs duplicados entre fontes. */
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

const TYPE_BADGES: Record<UnifiedEntry['type'], { label: string; cls: string; icon: any }> = {
  commission: {
    label: 'Comissão',
    cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
    icon: Banknote,
  },
  shop: {
    label: 'Loja',
    cls: 'bg-sky-500/10 text-sky-700 border-sky-500/30',
    icon: ShoppingBag,
  },
  adjustment: {
    label: 'Ajuste',
    cls: 'bg-slate-500/10 text-slate-700 border-slate-500/30',
    icon: Sliders,
  },
  personal: {
    label: 'Pessoal',
    cls: 'bg-violet-500/10 text-violet-700 border-violet-500/30',
    icon: Receipt,
  },
}

function ledgerToUnified(e: LedgerEntry): UnifiedEntry {
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

function personalToUnified(p: PersonalExpense): UnifiedEntry {
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

export function UnifiedLedger({ agentId, initialLimit = 30, onPersonalChanged }: Props) {
  const [filter, setFilter] = useState<FilterKind>('all')
  const [limit, setLimit] = useState(initialLimit)
  const [selectedPersonal, setSelectedPersonal] = useState<PersonalExpense | null>(null)

  const ledger = useLedger({ scope: { kind: 'agent', agentId } })
  const personal = usePersonalExpenses({ limit: 50 })

  const merged = useMemo<UnifiedEntry[]>(() => {
    const all = [
      ...ledger.entries.map(ledgerToUnified),
      ...personal.data.map(personalToUnified),
    ]
    return all.sort((a, b) => b.date.localeCompare(a.date))
  }, [ledger.entries, personal.data])

  const filtered = useMemo(() => {
    if (filter === 'all') return merged
    if (filter === 'company') return merged.filter((e) => e.source === 'company')
    return merged.filter((e) => e.source === 'personal')
  }, [merged, filter])

  const visible = filtered.slice(0, limit)
  const hasMore = filtered.length > limit
  const loading = ledger.loading || personal.loading

  return (
    <>
      <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-xs font-semibold tracking-tight">Movimentos</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Todos os ganhos e despesas — empresa e pessoais
            </p>
          </div>
          <FilterChips value={filter} onChange={setFilter} />
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
              Sem movimentos {filter === 'company' ? 'da empresa' : filter === 'personal' ? 'pessoais' : ''}.
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

function UnifiedRow({
  entry, onClick,
}: { entry: UnifiedEntry; onClick?: () => void }) {
  const { label, cls, icon: BadgeIcon } = TYPE_BADGES[entry.type]
  const isCredit = entry.side === 'in'
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-xl bg-card border border-border/40 px-3 py-2.5 text-left',
        onClick && 'hover:bg-muted/40 hover:border-border transition-colors cursor-pointer',
      )}
    >
      <div className={cn(
        'shrink-0 rounded-full p-2',
        isCredit ? 'bg-emerald-500/10' : 'bg-red-500/10',
      )}>
        {isCredit
          ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          : <TrendingDown className="h-3.5 w-3.5 text-red-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.description}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-muted-foreground">{fmtDate(entry.date)}</span>
          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 h-4 gap-1', cls)}>
            <BadgeIcon className="h-2.5 w-2.5" />
            {label}
          </Badge>
        </div>
      </div>
      <span className={cn(
        'text-sm font-semibold tabular-nums shrink-0 whitespace-nowrap',
        isCredit ? 'text-emerald-600' : 'text-red-600',
      )}>
        {isCredit ? '+' : '−'} {fmtCurrency(entry.amount)}
      </span>
    </Wrapper>
  )
}
