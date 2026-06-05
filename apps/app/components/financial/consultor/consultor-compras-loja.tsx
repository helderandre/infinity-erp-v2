'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShoppingBag, Package, ExternalLink } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MarketingOrder } from '@/types/marketing'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' },
  accepted: { label: 'Aceite', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300' },
  scheduled: { label: 'Agendado', cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300' },
  in_production: { label: 'Em produção', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300' },
  delivered: { label: 'Entregue', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' },
  completed: { label: 'Concluído', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' },
  rejected: { label: 'Rejeitado', cls: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300' },
  cancelled: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300' },
}

export function ConsultorComprasLoja({ agentId, readOnly = false }: { agentId: string; readOnly?: boolean }) {
  const [orders, setOrders] = useState<MarketingOrder[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/marketing/orders?agent_id=${agentId}&limit=50`)
        const json = await res.json()
        setOrders(json.data || [])
        setTotal(json.total || 0)
      } catch {
        setOrders([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [agentId])

  const totalPaid = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
  const pendingCount = orders.filter(
    (o) => o.status !== 'completed' && o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'rejected'
  ).length

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header KPIs */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
          <div className="rounded-xl p-2.5 w-fit bg-blue-500/10">
            <ShoppingBag className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">
            Total encomendas
          </p>
          <p className="text-base sm:text-xl font-bold tracking-tight">{total}</p>
        </div>
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
          <div className="rounded-xl p-2.5 w-fit bg-amber-500/10">
            <Package className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">
            Em curso
          </p>
          <p className="text-base sm:text-xl font-bold tracking-tight">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
          <div className="rounded-xl p-2.5 w-fit bg-red-500/10">
            <ShoppingBag className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">
            Total gasto
          </p>
          <p className="text-base sm:text-xl font-bold tracking-tight text-red-600">
            {fmtCurrency(totalPaid)}
          </p>
        </div>
      </div>

      {/* Action: open Loja */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {readOnly
            ? 'Encomendas do consultor no Infinity Store, debitadas na conta corrente.'
            : 'Encomendas no Infinity Store associadas à tua conta corrente.'}
        </p>
        {!readOnly && (
          <Button asChild size="sm" variant="outline" className="rounded-full gap-2">
            <Link href="/dashboard/marketing/loja">
              Ir à loja
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>

      {/* Orders list */}
      <Card className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
        {orders.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Ainda não tens encomendas registadas.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {orders.map((o) => {
              const status = STATUS_LABELS[o.status] ?? { label: o.status, cls: 'bg-slate-100 text-slate-700' }
              const itemNames = (o.items || []).slice(0, 2).map((i) => i.name).join(', ')
              const moreItems = (o.items || []).length - 2
              return (
                <li key={o.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={cn('rounded-full text-[10px] font-medium border-0', status.cls)}>
                          {status.label}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {fmtDate(o.created_at)}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">
                        {itemNames || 'Encomenda'}
                        {moreItems > 0 && (
                          <span className="text-muted-foreground"> +{moreItems} mais</span>
                        )}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0 text-red-600">
                      {fmtCurrency(Number(o.total_amount || 0))}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
