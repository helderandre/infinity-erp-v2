'use client'

import { Clock, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FinanceiroSheet } from '@/components/financial/sheets/financeiro-sheet'
import { cn } from '@/lib/utils'

interface UpcomingEntry {
  id: string
  amount: number
  payment_moment: string | null
  signed_date: string | null
  kind: 'own' | 'split'
  deal_id?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: UpcomingEntry[]
  totalAmount: number
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export function UpcomingEntriesSheet({ open, onOpenChange, entries, totalAmount }: Props) {
  return (
    <FinanceiroSheet
      open={open}
      onOpenChange={onOpenChange}
      title="A receber"
      accent={
        <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" />
      }
      subtitle={
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span>Pendente · cumulativo</span>
          <span className="text-muted-foreground/60">·</span>
          <span>Comissões assinadas pendentes de recebimento</span>
        </span>
      }
      size="wide"
      footer={
        <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">
          Fechar
        </Button>
      }
    >
      {/* Total tile */}
      <div className="rounded-2xl ring-1 ring-border/40 p-5 bg-gradient-to-br from-amber-500/15 to-transparent">
        <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
          Total
        </p>
        <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums mt-1">
          {fmtCurrency(totalAmount)}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {entries.length === 0
            ? 'Sem entradas no período.'
            : `${entries.length} pagamento${entries.length === 1 ? '' : 's'} assinado${entries.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {/* Entries list */}
      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 py-12 text-center text-sm text-muted-foreground">
            <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Sem entradas para listar.
          </div>
        ) : (
          entries.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl p-2 bg-amber-500/10 text-amber-600 shrink-0">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium truncate">
                      {p.payment_moment ?? 'Pagamento'}
                    </p>
                    {p.kind === 'split' && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-indigo-500/10 text-indigo-700 border-indigo-500/30">
                        Partilha
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Assinado {fmtDate(p.signed_date)}
                  </p>
                </div>
                <span className="text-base font-semibold tabular-nums shrink-0 whitespace-nowrap text-amber-700">
                  {fmtCurrency(p.amount)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </FinanceiroSheet>
  )
}
