'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Handshake, ChevronRight } from 'lucide-react'
import { usePartnersOverview, formatEUR, type PartnerOverview } from '@/hooks/use-partner-ledger'
import { PartnerLedgerDetail } from '@/components/partner-ledger/partner-ledger-detail'

function initials(name: string | null) {
  if (!name) return '?'
  const p = name.trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?'
}

export function PartnerLedgerOverview() {
  const { partners, loading } = usePartnersOverview()
  const [selected, setSelected] = useState<PartnerOverview | null>(null)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Parceiros — Conta corrente</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Comissões de referência e pagamentos por parceiro
        </p>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : partners.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
          <Handshake className="h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Sem parceiros</p>
          <p className="text-sm text-muted-foreground">Parceiros com referências aparecem aqui.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((p) => (
            <button
              key={p.partner_id}
              onClick={() => setSelected(p)}
              className={cn(
                'group text-left rounded-2xl border border-border/50 bg-card p-4',
                'hover:border-border hover:shadow-md transition-all',
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {p.profile_photo_url && <AvatarImage src={p.profile_photo_url} alt={p.commercial_name ?? ''} />}
                  <AvatarFallback className="text-xs font-semibold bg-muted">{initials(p.commercial_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{p.commercial_name ?? 'Sem nome'}</p>
                  {p.total_a_receber > 0 && (
                    <Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[9px] rounded-full bg-amber-100 text-amber-700">
                      {formatEUR(p.total_a_receber)} a receber
                    </Badge>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground shrink-0" />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo</span>
                <span className={cn('text-lg font-bold tabular-nums', p.saldo < 0 ? 'text-red-600' : 'text-foreground')}>
                  {formatEUR(p.saldo)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-2">
            <SheetTitle>{selected?.commercial_name ?? 'Parceiro'}</SheetTitle>
            <SheetDescription>Conta corrente do parceiro</SheetDescription>
          </SheetHeader>
          {selected && <PartnerLedgerDetail partnerId={selected.partner_id} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}
