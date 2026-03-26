'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { CreditStatusBadge } from '@/components/credit/credit-status-badge'
import {
  CREDIT_STATUS_COLORS,
  CREDIT_STATUS_PIPELINE,
  CREDIT_ACTIVITY_TYPE_OPTIONS,
} from '@/lib/constants'
import {
  Landmark,
  Plus,
  TrendingUp,
  FileCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  Percent,
  Euro,
  Building2,
  ArrowRight,
  Activity,
  CheckCircle2,
  XCircle,
  Banknote,
  FileText,
} from 'lucide-react'

interface DashboardData {
  kpis: {
    total_pedidos: number
    pedidos_activos: number
    pedidos_concluidos: number
    pedidos_recusados: number
    volume_pipeline: number
    volume_aprovado: number
    taxa_aprovacao: number
    melhor_spread: number | null
    taxa_esforco_media: number | null
    ltv_medio: number | null
    docs_pendentes: number
    docs_total: number
    total_propostas: number
  }
  status_counts: Record<string, number>
  bank_stats: Record<string, { total: number; aprovadas: number }>
  alertas: { tipo: 'urgente' | 'aviso' | 'info'; mensagem: string; pedido_id?: string; pedido_ref?: string }[]
  actividades: { id: string; pedido_credito_id: string; pedido_ref: string; user_name: string; tipo: string; descricao: string; created_at: string }[]
}

const fmt = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export default function CreditoDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/credit/dashboard')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-80" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!data) return null

  const { kpis, status_counts, bank_stats, alertas, actividades } = data

  const alertIcon = (tipo: string) => {
    switch (tipo) {
      case 'urgente': return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
      case 'aviso': return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
      default: return <Info className="h-4 w-4 text-blue-500 shrink-0" />
    }
  }

  const alertBg = (tipo: string) => {
    switch (tipo) {
      case 'urgente': return 'bg-red-500/10 border-red-500/20'
      case 'aviso': return 'bg-amber-500/10 border-amber-500/20'
      default: return 'bg-blue-500/10 border-blue-500/20'
    }
  }

  const activityTypeLabel = (tipo: string) => {
    return CREDIT_ACTIVITY_TYPE_OPTIONS.find(o => o.value === tipo)?.label || tipo
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intermediação de Crédito</h1>
          <p className="text-muted-foreground">
            Visão geral dos pedidos de crédito habitação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard/credito/pedidos')}>
            Ver Pedidos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button onClick={() => router.push('/dashboard/credito/novo')}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Pedido
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="flex flex-col gap-2">
          {alertas.map((alerta, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm cursor-pointer transition-colors hover:opacity-80 ${alertBg(alerta.tipo)}`}
              onClick={() => alerta.pedido_id && router.push(`/dashboard/credito/${alerta.pedido_id}`)}
            >
              {alertIcon(alerta.tipo)}
              <span className="flex-1">{alerta.mensagem}</span>
              {alerta.pedido_ref && (
                <Badge variant="outline" className="text-xs">{alerta.pedido_ref}</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards — Row 1: Volume */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-sky-500/15 p-2.5">
                <Landmark className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pedidos Ativos</p>
                <p className="text-2xl font-bold">{kpis.pedidos_activos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/15 p-2.5">
                <Banknote className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Volume em Pipeline</p>
                <p className="text-2xl font-bold">{fmt(kpis.volume_pipeline)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-teal-500/15 p-2.5">
                <Euro className="h-5 w-5 text-teal-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Volume Aprovado</p>
                <p className="text-2xl font-bold">{fmt(kpis.volume_aprovado)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-500/15 p-2.5">
                <TrendingUp className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Aprovação</p>
                <p className="text-2xl font-bold">{kpis.taxa_aprovacao}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards — Row 2: Métricas */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-500/15 p-2.5">
                <Percent className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Melhor Spread</p>
                <p className="text-2xl font-bold">
                  {kpis.melhor_spread != null ? `${kpis.melhor_spread}%` : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2.5 ${kpis.taxa_esforco_media && kpis.taxa_esforco_media > 35 ? 'bg-amber-500/15' : 'bg-emerald-500/15'}`}>
                <Activity className={`h-5 w-5 ${kpis.taxa_esforco_media && kpis.taxa_esforco_media > 35 ? 'text-amber-500' : 'text-emerald-500'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa Esforço Média</p>
                <p className="text-2xl font-bold">
                  {kpis.taxa_esforco_media != null ? `${kpis.taxa_esforco_media}%` : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/15 p-2.5">
                <Building2 className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">LTV Médio</p>
                <p className="text-2xl font-bold">
                  {kpis.ltv_medio != null ? `${kpis.ltv_medio}%` : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2.5 ${kpis.docs_pendentes > 0 ? 'bg-amber-500/15' : 'bg-emerald-500/15'}`}>
                <FileText className={`h-5 w-5 ${kpis.docs_pendentes > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Docs Pendentes</p>
                <p className="text-2xl font-bold">{kpis.docs_pendentes}</p>
                <p className="text-xs text-muted-foreground">de {kpis.docs_total} total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom section: Pipeline breakdown + Bank stats + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Pipeline Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Pipeline por Estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {CREDIT_STATUS_PIPELINE.map((status) => {
              const count = status_counts[status] || 0
              const color = CREDIT_STATUS_COLORS[status]
              const total = kpis.total_pedidos || 1
              return (
                <div key={status} className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${color?.dot || 'bg-gray-400'}`} />
                  <span className="text-sm flex-1 truncate">{color?.label || status}</span>
                  <span className="text-sm font-medium tabular-nums">{count}</span>
                  <div className="w-20">
                    <Progress value={(count / total) * 100} className="h-1.5" />
                  </div>
                </div>
              )
            })}
            {/* Terminal statuses */}
            {['recusado', 'desistencia'].map((status) => {
              const count = status_counts[status] || 0
              const color = CREDIT_STATUS_COLORS[status]
              return count > 0 ? (
                <div key={status} className="flex items-center gap-3 opacity-60">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${color?.dot || 'bg-gray-400'}`} />
                  <span className="text-sm flex-1 truncate">{color?.label || status}</span>
                  <span className="text-sm font-medium tabular-nums">{count}</span>
                </div>
              ) : null
            })}
          </CardContent>
        </Card>

        {/* Bank Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Propostas por Banco</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(bank_stats)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([banco, stats]) => (
                <div key={banco} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{banco}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {stats.aprovadas > 0 && (
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {stats.aprovadas}
                      </Badge>
                    )}
                    {(stats.total - stats.aprovadas) > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {stats.total - stats.aprovadas} outra{stats.total - stats.aprovadas !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            {Object.keys(bank_stats).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sem propostas registadas</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Actividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {actividades.slice(0, 8).map((act: any) => (
                <div
                  key={act.id}
                  className="flex gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                  onClick={() => router.push(`/dashboard/credito/${act.pedido_credito_id}`)}
                >
                  <div className="shrink-0 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0">{act.pedido_ref}</Badge>
                      <span className="text-xs text-muted-foreground truncate">{activityTypeLabel(act.tipo)}</span>
                    </div>
                    <p className="text-sm truncate mt-0.5">{act.descricao}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {act.user_name} · {new Date(act.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
              {actividades.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Sem actividade recente</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push('/dashboard/credito/pedidos')}>
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Total de Propostas</p>
                <p className="text-xs text-muted-foreground">{kpis.total_propostas} em {kpis.total_pedidos} pedidos</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push('/dashboard/credito/simulador')}>
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Simulador</p>
                <p className="text-xs text-muted-foreground">Calcular prestações e MTIC</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push('/dashboard/credito/bancos')}>
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Bancos e Protocolos</p>
                <p className="text-xs text-muted-foreground">Gerir parcerias bancárias</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
