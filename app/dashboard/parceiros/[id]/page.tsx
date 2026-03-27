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
  ThumbsUp, ThumbsDown, GitCompareArrows, Phone, Mail, Globe,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const fmtCurrency = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })

export default function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [partner, setPartner] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'info' | 'dashboard' | 'feedback' | 'orders'>('info')
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareId, setCompareId] = useState('')
  const [compareData, setCompareData] = useState<any>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [allSuppliers, setAllSuppliers] = useState<{ id: string; name: string }[]>([])

  const fetchData = useCallback(async () => {
    try {
      // Stats endpoint returns supplier info + all stats
      const statsRes = await fetch(`/api/encomendas/suppliers/${id}/stats`)
      if (statsRes.ok) {
        const s = await statsRes.json()
        setStats(s)
        setPartner(s.supplier)
      } else {
        // Fallback: try fetching just the supplier
        const supRes = await fetch(`/api/encomendas/suppliers/${id}`)
        if (supRes.ok) {
          const sup = await supRes.json()
          setPartner(sup)
        }
      }
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (compareOpen && allSuppliers.length === 0) {
      fetch('/api/encomendas/suppliers?active=true')
        .then(r => r.json())
        .then(d => setAllSuppliers((Array.isArray(d) ? d : d.data || []).filter((s: any) => s.id !== id)))
        .catch(() => {})
    }
  }, [compareOpen, id, allSuppliers.length])

  const handleCompare = async () => {
    if (!compareId) return
    setCompareLoading(true)
    try {
      const res = await fetch(`/api/encomendas/suppliers/compare?ids=${id},${compareId}`)
      if (res.ok) setCompareData(await res.json())
    } catch { toast.error('Erro ao comparar') }
    finally { setCompareLoading(false) }
  }

  const toggleFeedbackPublic = async (feedbackId: string, isPublic: boolean) => {
    const res = await fetch(`/api/encomendas/suppliers/${id}/feedback`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback_id: feedbackId, is_public: isPublic }),
    })
    if (res.ok) { toast.success(isPublic ? 'Feedback tornado público' : 'Feedback tornado privado'); fetchData() }
  }

  if (loading) return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )

  if (!partner) return <div className="p-6 text-muted-foreground">Parceiro não encontrado.</div>

  const kpis = stats?.kpis
  const monthly = stats?.monthly || []
  const feedback = stats?.feedback || []
  const orders = stats?.orders || []
  const ratingTrend = stats?.rating_trend || []
  const statusBreakdown = stats?.status_breakdown || {}
  const hasSupplierData = kpis && kpis.total_orders > 0
  const recommendPct = feedback.length > 0 ? Math.round(feedback.filter((f: any) => f.would_recommend).length / feedback.length * 100) : null
  const maxVolume = Math.max(...monthly.map((m: any) => m.volume), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="rounded-full mt-1" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{partner.name}</h1>
            {partner.is_recommended && <Badge className="bg-emerald-500/10 text-emerald-600 rounded-full text-[10px]">Recomendado</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            {partner.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{partner.email}</span>}
            {partner.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{partner.phone}</span>}
            {partner.website && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{partner.website}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {kpis?.rating_count > 0 && (
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={cn('h-4 w-4', s <= Math.round(kpis.rating_avg) ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-200')} />
              ))}
              <span className="text-sm font-bold ml-1">{kpis.rating_avg}</span>
              <span className="text-xs text-muted-foreground">({kpis.rating_count})</span>
            </div>
          )}
          {hasSupplierData && (
            <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-xs" onClick={() => setCompareOpen(true)}>
              <GitCompareArrows className="h-3.5 w-3.5" />Comparar
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      {hasSupplierData && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Encomendas', value: String(kpis.total_orders), icon: Package },
            { label: 'Volume Total', value: fmtCurrency.format(kpis.total_volume), icon: TrendingUp },
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
      )}

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm">
        {([
          ['info', 'Informação'],
          ...(hasSupplierData ? [['dashboard', 'Dashboard'], ['feedback', 'Feedback'], ['orders', 'Encomendas']] : []),
        ] as [string, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={cn('px-4 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
              tab === key ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}>{label}</button>
        ))}
      </div>

      {/* ═══ Info ═══ */}
      {tab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-3">
            <h3 className="text-sm font-semibold">Detalhes</h3>
            <div className="space-y-2 text-sm">
              {partner.person_type && <InfoRow label="Tipo" value={partner.person_type === 'coletiva' ? 'Empresa' : 'Singular'} />}
              {partner.nif && <InfoRow label="NIF" value={partner.nif} />}
              {partner.contact_person && <InfoRow label="Contacto" value={partner.contact_person} />}
              {partner.address && <InfoRow label="Morada" value={partner.address} />}
              {partner.city && <InfoRow label="Cidade" value={partner.city} />}
            </div>
          </div>
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-3">
            <h3 className="text-sm font-semibold">Comercial</h3>
            <div className="space-y-2 text-sm">
              {partner.specialties?.length > 0 && <InfoRow label="Especialidades" value={partner.specialties.join(', ')} />}
              {partner.service_areas?.length > 0 && <InfoRow label="Áreas" value={partner.service_areas.join(', ')} />}
              {partner.commercial_conditions && <InfoRow label="Condições" value={partner.commercial_conditions} />}
            </div>
          </div>
          {partner.internal_notes && (
            <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 md:col-span-2">
              <h3 className="text-sm font-semibold mb-2">Notas Internas</h3>
              <p className="text-sm text-muted-foreground">{partner.internal_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ Dashboard ═══ */}
      {tab === 'dashboard' && hasSupplierData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold mb-4">Volume Mensal</h3>
            <div className="flex items-end gap-1 h-40">
              {monthly.map((m: any) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-md bg-neutral-900 dark:bg-white" style={{ height: `${Math.max((m.volume / maxVolume) * 100, 2)}%` }} />
                  <span className="text-[8px] text-muted-foreground">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold mb-4">Tempo de Entrega (dias úteis)</h3>
            <div className="flex items-end gap-1 h-40">
              {monthly.map((m: any) => {
                const maxDel = Math.max(...monthly.map((x: any) => x.avg_delivery || 0), 1)
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className={cn('w-full rounded-t-md', m.avg_delivery ? 'bg-amber-500' : 'bg-transparent')}
                      style={{ height: m.avg_delivery ? `${Math.max((m.avg_delivery / maxDel) * 100, 4)}%` : '0%' }} />
                    <span className="text-[8px] text-muted-foreground">{m.month.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold mb-4">Rating Mensal</h3>
            <div className="flex items-end gap-1 h-40">
              {ratingTrend.map((m: any) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className={cn('w-full rounded-t-md', m.avg_rating ? 'bg-emerald-500' : 'bg-transparent')}
                    style={{ height: m.avg_rating ? `${(m.avg_rating / 5) * 100}%` : '0%' }} />
                  <span className="text-[8px] text-muted-foreground">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold mb-4">Estados</h3>
            <div className="space-y-2">
              {Object.entries(statusBreakdown).map(([status, count]: [string, any]) => {
                const total = Object.values(statusBreakdown).reduce((s: number, c: any) => s + c, 0)
                const pct = total > 0 ? (count / total) * 100 : 0
                const labels: Record<string, string> = { ordered: 'Encomendado', at_store: 'Na Loja', picked_up: 'Levantado', completed: 'Concluído', cancelled: 'Cancelado' }
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
          ) : feedback.map((f: any) => (
            <div key={f.id} className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="flex">{[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={cn('h-3.5 w-3.5', s <= f.rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-200')} />
                    ))}</div>
                    <span className="text-xs text-muted-foreground">{f.is_anonymous ? 'Anónimo' : f.user?.commercial_name || '—'}</span>
                    <span className="text-xs text-muted-foreground">· {format(new Date(f.created_at), 'dd/MM/yyyy', { locale: pt })}</span>
                    {f.would_recommend
                      ? <Badge variant="secondary" className="text-[9px] gap-1 rounded-full bg-emerald-500/10 text-emerald-600"><ThumbsUp className="h-2.5 w-2.5" />Recomenda</Badge>
                      : <Badge variant="secondary" className="text-[9px] gap-1 rounded-full bg-red-500/10 text-red-600"><ThumbsDown className="h-2.5 w-2.5" />Não recomenda</Badge>
                    }
                  </div>
                  {f.comment && <p className="text-sm mt-1">{f.comment}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">Encomenda: {f.order?.reference || '—'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">{f.is_public ? 'Público' : 'Privado'}</span>
                  <Switch checked={f.is_public} onCheckedChange={(checked) => toggleFeedbackPublic(f.id, checked)} className="scale-75" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Orders ═══ */}
      {tab === 'orders' && (
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/20 text-xs text-muted-foreground">
              <th className="text-left px-4 py-2 font-medium">Referência</th>
              <th className="text-left px-4 py-2 font-medium">Estado</th>
              <th className="text-right px-4 py-2 font-medium">Valor</th>
              <th className="text-right px-4 py-2 font-medium">Dias</th>
              <th className="text-left px-4 py-2 font-medium">Data</th>
            </tr></thead>
            <tbody className="divide-y">{orders.map((o: any) => (
              <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-medium">{o.reference}</td>
                <td className="px-4 py-2.5"><Badge variant="secondary" className="text-[10px] rounded-full">{o.status}</Badge></td>
                <td className="px-4 py-2.5 text-right font-medium">{fmtCurrency.format(o.total_cost || 0)}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{o.ordered_at && o.at_store_at ? `${Math.round((new Date(o.at_store_at).getTime() - new Date(o.ordered_at).getTime()) / 86400000)}d` : '—'}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{format(new Date(o.created_at), 'dd/MM/yyyy', { locale: pt })}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* ═══ Compare Dialog ═══ */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><GitCompareArrows className="h-5 w-5" />Comparar Fornecedores</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-xl border bg-muted/20 p-3 text-center">
                <p className="text-sm font-bold">{partner.name}</p>
              </div>
              <span className="text-xs text-muted-foreground font-medium">VS</span>
              <div className="flex-1">
                <Select value={compareId} onValueChange={setCompareId}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar fornecedor..." /></SelectTrigger>
                  <SelectContent className="rounded-xl">{allSuppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <Button size="sm" className="rounded-full" disabled={!compareId || compareLoading} onClick={handleCompare}>Comparar</Button>
            </div>

            {compareData?.suppliers && (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">Métrica</th>
                    <th className="text-center px-4 py-2 font-medium">{compareData.suppliers[0]?.supplier?.name}</th>
                    <th className="text-center px-4 py-2 font-medium">{compareData.suppliers[1]?.supplier?.name}</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {[
                      { label: 'Encomendas', key: 'total_orders', fmt: (v: number) => String(v) },
                      { label: 'Volume', key: 'total_volume', fmt: (v: number) => fmtCurrency.format(v) },
                      { label: 'Activas', key: 'active_orders', fmt: (v: number) => String(v) },
                      { label: 'Entrega Média', key: 'avg_delivery_days', fmt: (v: any) => v ? `${v} dias` : '—' },
                      { label: 'Rating', key: 'rating_avg', fmt: (v: number) => v ? `${v} ★` : '—' },
                      { label: 'Feedback', key: 'feedback_count', fmt: (v: number) => String(v) },
                      { label: 'Recomendam', key: 'recommend_pct', fmt: (v: any) => v !== null ? `${v}%` : '—' },
                    ].map(({ label, key, fmt: f }) => {
                      const a = compareData.suppliers[0]?.[key]
                      const b = compareData.suppliers[1]?.[key]
                      const better = key === 'avg_delivery_days' ? (a && b ? (a < b ? 0 : a > b ? 1 : -1) : -1) : (a > b ? 0 : a < b ? 1 : -1)
                      return (
                        <tr key={key}>
                          <td className="px-4 py-2 text-muted-foreground">{label}</td>
                          <td className={cn('px-4 py-2 text-center font-medium', better === 0 && 'text-emerald-600')}>{f(a)}</td>
                          <td className={cn('px-4 py-2 text-center font-medium', better === 1 && 'text-emerald-600')}>{f(b)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
