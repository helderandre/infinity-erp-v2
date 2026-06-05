// @ts-nocheck
'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale/pt'
import { cn } from '@/lib/utils'
import { formatBusinessDays } from '@/lib/business-days'
import {
  ArrowLeft, Star, Package, Truck, TrendingUp, Clock,
  ThumbsUp, ThumbsDown, Eye, EyeOff, BarChart3, GitCompareArrows,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const fmt = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const fmtShort = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k€` : fmt.format(n)

interface SupplierStats {
  supplier: any
  kpis: {
    total_orders: number
    total_volume: number
    active_orders: number
    avg_delivery_days: number | null
    rating_avg: number
    rating_count: number
  }
  monthly: { month: string; orders: number; volume: number; avg_delivery: number | null }[]
  status_breakdown: Record<string, number>
  rating_trend: { month: string; avg_rating: number | null; count: number }[]
  feedback: any[]
  orders: any[]
}

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [data, setData] = useState<SupplierStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'feedback' | 'orders'>('overview')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/encomendas/suppliers/${id}/stats`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      toast.error('Erro ao carregar dados do fornecedor')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleFeedbackPublic = async (feedbackId: string, isPublic: boolean) => {
    const res = await fetch(`/api/encomendas/suppliers/${id}/feedback`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback_id: feedbackId, is_public: isPublic }),
    })
    if (res.ok) {
      toast.success(isPublic ? 'Feedback tornado público' : 'Feedback tornado privado')
      fetchData()
    }
  }

  if (loading) return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )

  if (!data) return <div className="p-6 text-muted-foreground">Fornecedor não encontrado.</div>

  const { supplier, kpis, monthly, status_breakdown, rating_trend, feedback, orders } = data
  const recommendPct = feedback.length > 0
    ? Math.round(feedback.filter(f => f.would_recommend).length / feedback.length * 100)
    : null

  // Chart helpers
  const maxVolume = Math.max(...monthly.map(m => m.volume), 1)
  const maxOrders = Math.max(...monthly.map(m => m.orders), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
          <p className="text-sm text-muted-foreground">{supplier.email || supplier.phone || 'Fornecedor'}</p>
        </div>
        {kpis.rating_count > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={cn('h-4 w-4', s <= Math.round(kpis.rating_avg) ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-200')} />
              ))}
            </div>
            <span className="text-sm font-bold">{kpis.rating_avg}</span>
            <span className="text-xs text-muted-foreground">({kpis.rating_count})</span>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Encomendas', value: String(kpis.total_orders), icon: Package },
          { label: 'Volume Total', value: fmt.format(kpis.total_volume), icon: TrendingUp },
          { label: 'Activas', value: String(kpis.active_orders), icon: Truck },
          { label: 'Entrega Média', value: kpis.avg_delivery_days ? formatBusinessDays(kpis.avg_delivery_days) : '—', icon: Clock },
          { label: 'Recomendam', value: recommendPct !== null ? `${recommendPct}%` : '—', icon: ThumbsUp },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-lg font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tab pills */}
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm">
        {([['overview', 'Visão Geral'] as const, ['feedback', 'Feedback'] as const, ['orders', 'Encomendas'] as const]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('px-4 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
              tab === key ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >{label}</button>
        ))}
      </div>

      {/* ═══ Overview ═══ */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monthly Volume */}
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold mb-4">Volume Mensal</h3>
            <div className="flex items-end gap-1 h-40">
              {monthly.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-md bg-neutral-900 dark:bg-white transition-all"
                    style={{ height: `${Math.max((m.volume / maxVolume) * 100, 2)}%` }} />
                  <span className="text-[8px] text-muted-foreground">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Time Trend */}
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold mb-4">Tempo de Entrega (dias úteis)</h3>
            <div className="flex items-end gap-1 h-40">
              {monthly.map((m) => {
                const maxDel = Math.max(...monthly.map(x => x.avg_delivery || 0), 1)
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className={cn('w-full rounded-t-md transition-all', m.avg_delivery ? 'bg-amber-500' : 'bg-transparent')}
                      style={{ height: m.avg_delivery ? `${Math.max((m.avg_delivery / maxDel) * 100, 4)}%` : '0%' }} />
                    <span className="text-[8px] text-muted-foreground">{m.month.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Rating Trend */}
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold mb-4">Rating Mensal</h3>
            <div className="flex items-end gap-1 h-40">
              {rating_trend.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className={cn('w-full rounded-t-md transition-all', m.avg_rating ? 'bg-emerald-500' : 'bg-transparent')}
                    style={{ height: m.avg_rating ? `${(m.avg_rating / 5) * 100}%` : '0%' }} />
                  <span className="text-[8px] text-muted-foreground">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold mb-4">Estados</h3>
            <div className="space-y-2">
              {Object.entries(status_breakdown).map(([status, count]) => {
                const total = Object.values(status_breakdown).reduce((s, c) => s + c, 0)
                const pct = total > 0 ? (count / total) * 100 : 0
                const labels: Record<string, string> = {
                  ordered: 'Encomendado', in_transit: 'Em Trânsito', at_store: 'Na Loja',
                  picked_up: 'Levantado', completed: 'Concluído', cancelled: 'Cancelado', draft: 'Rascunho', delivered: 'Entregue',
                }
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-xs w-24 text-muted-foreground">{labels[status] || status}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-neutral-900 dark:bg-white" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold w-8 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Feedback ═══ */}
      {tab === 'feedback' && (
        <div className="space-y-3">
          {feedback.length === 0 ? (
            <div className="rounded-2xl border bg-card/50 p-12 text-center">
              <Star className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Sem feedback ainda</p>
            </div>
          ) : (
            feedback.map((f: any) => (
              <div key={f.id} className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={cn('h-3.5 w-3.5', s <= f.rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-200')} />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {f.is_anonymous ? 'Anónimo' : f.user?.commercial_name || '—'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {format(new Date(f.created_at), 'dd/MM/yyyy', { locale: pt })}
                      </span>
                      {f.would_recommend ? (
                        <Badge variant="secondary" className="text-[9px] gap-1 rounded-full bg-emerald-500/10 text-emerald-600">
                          <ThumbsUp className="h-2.5 w-2.5" />Recomenda
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] gap-1 rounded-full bg-red-500/10 text-red-600">
                          <ThumbsDown className="h-2.5 w-2.5" />Não recomenda
                        </Badge>
                      )}
                    </div>
                    {f.comment && <p className="text-sm mt-1">{f.comment}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">Encomenda: {f.order?.reference || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{f.is_public ? 'Público' : 'Privado'}</span>
                    <Switch
                      checked={f.is_public}
                      onCheckedChange={(checked) => toggleFeedbackPublic(f.id, checked)}
                      className="scale-75"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ Orders ═══ */}
      {tab === 'orders' && (
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                <th className="text-left px-4 py-2 font-medium">Referência</th>
                <th className="text-left px-4 py-2 font-medium">Estado</th>
                <th className="text-right px-4 py-2 font-medium">Valor</th>
                <th className="text-right px-4 py-2 font-medium">Dias Entrega</th>
                <th className="text-left px-4 py-2 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o: any) => {
                const deliveryDays = o.ordered_at && o.at_store_at
                  ? Math.round((new Date(o.at_store_at).getTime() - new Date(o.ordered_at).getTime()) / 86400000)
                  : null
                return (
                  <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{o.reference}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary" className="text-[10px] rounded-full">{o.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmt.format(o.total_cost || 0)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {deliveryDays !== null ? `${deliveryDays}d` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {format(new Date(o.created_at), 'dd/MM/yyyy', { locale: pt })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
