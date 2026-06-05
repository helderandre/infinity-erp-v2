'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Briefcase, ExternalLink, ArrowUpRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { getDeals } from '@/app/dashboard/financeiro/deals/actions'
import type { Deal, DealStatus, DealScenario } from '@/types/deal'
import { DEAL_SCENARIOS, DEAL_STATUSES, PAYMENT_MOMENTS } from '@/types/deal'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

function PaymentMomentBadges({ payments }: { payments: Deal['payments'] }) {
  if (!payments || payments.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex items-center gap-3">
      {payments.map((p) => {
        let dot = 'bg-slate-300'
        if (p.is_received) dot = 'bg-emerald-500'
        else if (p.is_signed) dot = 'bg-amber-500'
        return (
          <span key={p.id} className="inline-flex items-center gap-1 text-xs whitespace-nowrap">
            <span className={cn('inline-block h-2 w-2 rounded-full', dot)} />
            {PAYMENT_MOMENTS[p.payment_moment] ?? p.payment_moment}
          </span>
        )
      })}
    </div>
  )
}

export function ConsultorComissoes({ agentId }: { agentId: string }) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await getDeals({ consultant_id: agentId, page: 1 })
      if (!res.error) {
        setDeals(res.deals)
        setTotal(res.total)
      }
      setLoading(false)
    }
    load()
  }, [agentId])

  const totalCommission = deals.reduce((s, d) => s + Number(d.commission_total || 0), 0)
  const activeCount = deals.filter((d) => d.status === 'active' || d.status === 'pending').length

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
          <div className="rounded-xl p-2.5 w-fit bg-slate-500/10">
            <Briefcase className="h-4 w-4 text-slate-600" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">
            Total negócios
          </p>
          <p className="text-base sm:text-xl font-bold tracking-tight">{total}</p>
        </div>
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
          <div className="rounded-xl p-2.5 w-fit bg-blue-500/10">
            <ArrowUpRight className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">
            Activos
          </p>
          <p className="text-base sm:text-xl font-bold tracking-tight">{activeCount}</p>
        </div>
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
          <div className="rounded-xl p-2.5 w-fit bg-emerald-500/10">
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">
            Comissão total
          </p>
          <p className="text-base sm:text-xl font-bold tracking-tight text-emerald-600">
            {fmtCurrency(totalCommission)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Os teus negócios e o estado de pagamento de cada momento.</p>
        <Button asChild size="sm" variant="outline" className="rounded-full gap-2">
          <Link href="/dashboard/financeiro/comissoes">
            Ver tudo
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <Card className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
        {deals.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Ainda não tens negócios registados.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Data</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Imóvel</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Tipo</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Valor</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Comissão</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Estado</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Momentos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((d) => {
                const status = DEAL_STATUSES[d.status as DealStatus]
                return (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer transition-colors duration-200 hover:bg-muted/30"
                    onClick={() => window.location.assign(`/dashboard/financeiro/deals/${d.id}`)}
                  >
                    <TableCell className="text-sm whitespace-nowrap">{fmtDate(d.deal_date)}</TableCell>
                    <TableCell className="text-sm max-w-[180px] truncate">
                      {d.property ? `${d.property.external_ref ?? ''} ${d.property.title}`.trim() : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {DEAL_SCENARIOS[d.deal_type as DealScenario]?.label ?? d.deal_type}
                    </TableCell>
                    <TableCell className="text-sm text-right">{fmtCurrency(d.deal_value)}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmtCurrency(d.commission_total)}</TableCell>
                    <TableCell>
                      {status && <Badge className={cn(status.color, 'rounded-full text-[10px] font-medium border-0')}>{status.label}</Badge>}
                    </TableCell>
                    <TableCell><PaymentMomentBadges payments={d.payments} /></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
