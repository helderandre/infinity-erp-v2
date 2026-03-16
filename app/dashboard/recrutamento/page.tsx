'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale/pt'
import {
  Users,
  Percent,
  Clock,
  TrendingUp,
  Bell,
  ArrowRight,
  AlertTriangle,
  AlertCircle,
  Info,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  getCandidates,
  getRecruitmentKPIs,
  getRecruitmentAlerts,
} from '@/app/dashboard/recrutamento/actions'
import type { RecruitmentCandidate } from '@/types/recruitment'
import { CANDIDATE_STATUSES, CANDIDATE_SOURCES } from '@/types/recruitment'
import type { AlertSeverity } from '@/types/recruitment'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Types ───────────────────────────────────────────────────────────────────

interface KPIs {
  total: number
  byStatus: Record<string, number>
  bySource: Record<string, number>
  conversionRate: number
  avgTimeToDecision: number | null
}

interface AlertSummary {
  total: number
  urgent: number
  warning: number
  info: number
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RecrutamentoDashboardPage() {
  const [kpis, setKpis] = useState<KPIs>({
    total: 0,
    byStatus: {},
    bySource: {},
    conversionRate: 0,
    avgTimeToDecision: null,
  })
  const [alertSummary, setAlertSummary] = useState<AlertSummary>({
    total: 0,
    urgent: 0,
    warning: 0,
    info: 0,
  })
  const [recentCandidates, setRecentCandidates] = useState<RecruitmentCandidate[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [kpiRes, alertsRes, candidatesRes] = await Promise.all([
      getRecruitmentKPIs(),
      getRecruitmentAlerts(),
      getCandidates(),
    ])

    if (!kpiRes.error) {
      setKpis({
        total: kpiRes.total,
        byStatus: kpiRes.byStatus,
        bySource: kpiRes.bySource,
        conversionRate: kpiRes.conversionRate,
        avgTimeToDecision: kpiRes.avgTimeToDecision,
      })
    }

    if (!alertsRes.error && alertsRes.alerts) {
      const alerts = alertsRes.alerts
      setAlertSummary({
        total: alerts.length,
        urgent: alerts.filter((a) => a.severity === 'urgent').length,
        warning: alerts.filter((a) => a.severity === 'warning').length,
        info: alerts.filter((a) => a.severity === 'info').length,
      })
    }

    if (!candidatesRes.error) {
      setRecentCandidates(candidatesRes.candidates.slice(0, 10))
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const terminalStatuses = ['joined', 'declined']
  const inPipeline = recentCandidates.length > 0
    ? kpis.total - (kpis.byStatus['joined'] || 0) - (kpis.byStatus['declined'] || 0)
    : 0

  // Source stats for bar chart
  const maxSourceCount = Math.max(...Object.values(kpis.bySource), 1)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard de Recrutamento</h1>
        <p className="text-muted-foreground text-sm">
          Visao geral do pipeline e actividade recente
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard
          icon={Users}
          iconBg="bg-blue-100 text-blue-700"
          label="Total Candidatos"
          value={kpis.total}
          loading={loading}
        />
        <KPICard
          icon={Percent}
          iconBg="bg-emerald-100 text-emerald-700"
          label="Taxa de Conversao"
          value={`${kpis.conversionRate.toFixed(1)}%`}
          loading={loading}
        />
        <KPICard
          icon={Clock}
          iconBg="bg-amber-100 text-amber-700"
          label="Tempo Medio ate Decisao"
          value={kpis.avgTimeToDecision !== null ? `${kpis.avgTimeToDecision}d` : 'N/A'}
          loading={loading}
        />
        <KPICard
          icon={TrendingUp}
          iconBg="bg-purple-100 text-purple-700"
          label="Em Pipeline"
          value={inPipeline}
          loading={loading}
        />
      </div>

      {/* Alerts + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alerts Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Bell className="h-4 w-4" />
              Alertas
            </CardTitle>
            <Link href="/dashboard/recrutamento/alertas">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Ver todos
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : alertSummary.total === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Sem alertas pendentes
              </p>
            ) : (
              <div className="space-y-3">
                {alertSummary.urgent > 0 && (
                  <AlertRow
                    severity="urgent"
                    count={alertSummary.urgent}
                    label="Urgentes"
                    icon={AlertTriangle}
                  />
                )}
                {alertSummary.warning > 0 && (
                  <AlertRow
                    severity="warning"
                    count={alertSummary.warning}
                    label="Avisos"
                    icon={AlertCircle}
                  />
                )}
                {alertSummary.info > 0 && (
                  <AlertRow
                    severity="info"
                    count={alertSummary.info}
                    label="Informativos"
                    icon={Info}
                  />
                )}
                <p className="text-muted-foreground pt-1 text-xs">
                  {alertSummary.total} alerta{alertSummary.total !== 1 ? 's' : ''} no total
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Actividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentCandidates.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Sem actividade recente
              </p>
            ) : (
              <div className="space-y-3">
                {recentCandidates.map((candidate) => {
                  const statusInfo = CANDIDATE_STATUSES[candidate.status]
                  return (
                    <Link
                      key={candidate.id}
                      href={`/dashboard/recrutamento/${candidate.id}`}
                      className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {candidate.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {candidate.full_name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {candidate.updated_at
                            ? formatDistanceToNow(new Date(candidate.updated_at), {
                                locale: pt,
                                addSuffix: true,
                              })
                            : 'Data indisponivel'}
                        </p>
                      </div>
                      <Badge className={cn('text-[10px] shrink-0', statusInfo.color)}>
                        {statusInfo.label}
                      </Badge>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Source */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : Object.keys(kpis.bySource).length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(kpis.bySource)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => (
                    <div key={source} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          {CANDIDATE_SOURCES[source as keyof typeof CANDIDATE_SOURCES] || source}
                        </span>
                        <span className="text-muted-foreground font-medium">{count}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${(count / maxSourceCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-7 w-24 rounded-full" />
                ))}
              </div>
            ) : Object.keys(kpis.byStatus).length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">Sem dados</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(kpis.byStatus)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => {
                    const statusInfo =
                      CANDIDATE_STATUSES[status as keyof typeof CANDIDATE_STATUSES]
                    return (
                      <Badge
                        key={status}
                        className={cn('gap-1.5 text-sm px-3 py-1', statusInfo?.color)}
                      >
                        {statusInfo?.label || status}
                        <span className="font-bold">{count}</span>
                      </Badge>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KPICard({
  icon: Icon,
  iconBg,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  label: string
  value: string | number
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            iconBg
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-12" />
          ) : (
            <p className="text-xl font-bold">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function AlertRow({
  severity,
  count,
  label,
  icon: Icon,
}: {
  severity: AlertSeverity
  count: number
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  const colors: Record<AlertSeverity, string> = {
    urgent: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          colors[severity]
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
      </div>
      <Badge variant="secondary" className="text-xs font-bold">
        {count}
      </Badge>
    </div>
  )
}
