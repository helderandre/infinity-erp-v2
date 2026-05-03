'use client'

import { Clock, Hourglass } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
          'w-full sm:max-w-[480px] rounded-l-3xl sm:rounded-l-3xl',
        )}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Hourglass className="h-5 w-5" />
            Próximas entradas
          </SheetTitle>
          <SheetDescription className="text-xs">
            Comissões já assinadas mas ainda não recebidas — total {fmtCurrency(totalAmount)}.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {entries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
              <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Sem comissões pendentes de recebimento.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {entries.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-card border border-border/40 px-3 py-2.5 transition-colors hover:border-border min-w-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="rounded-full p-2 bg-amber-500/10 shrink-0">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {p.payment_moment ?? 'Pagamento'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          Assinado {fmtDate(p.signed_date)}
                        </span>
                        {p.kind === 'split' && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-indigo-500/10 text-indigo-700 border-indigo-500/30">
                            Partilha
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0 whitespace-nowrap text-amber-700">
                    {fmtCurrency(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
