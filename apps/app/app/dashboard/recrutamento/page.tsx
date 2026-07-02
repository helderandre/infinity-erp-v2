'use client'

/**
 * Dashboard de Recrutamento — layout inspirado no protótipo quintino:
 * cartões de métricas com tile gradiente, funil de recrutamento em barras,
 * próximas entrevistas, alertas e candidaturas recentes.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { format, formatDistanceToNow, addDays } from 'date-fns'
import { pt } from 'date-fns/locale/pt'
import {
  Users,
  Briefcase,
  Calendar,
  TrendingUp,
  Clock,
  Bell,
  ArrowRight,
  AlertTriangle,
  AlertCircle,
  Info,
  Download,
  Video,
  Phone,
} from 'lucide-react'
import { CsvExportDialog } from '@/components/shared/csv-export-dialog'
import { cn } from '@/lib/utils'
import {
  getCandidates,
  getRecruitmentKPIs,
  getRecruitmentAlerts,
  getAllInterviews,
} from '@/app/dashboard/recrutamento/actions'
import type { RecruitmentCandidate, RecruitmentAlert, AlertSeverity, CandidateStatus } from '@/types/recruitment'
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_DOT,
  ACTIVE_PIPELINE_STAGES,
  INTERVIEW_FORMATS,
  normalizeCandidateStatus,
} from '@/types/recruitment'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

// ─── Types ───────────────────────────────────────────────────────────────────

interface KPIs {
  total: number
  byStatus: Record<string, number>
  bySource: Record<string, number>
  conversionRate: number
  avgTimeToDecision: number | null
  avgTimeToHire: number | null
}

interface UpcomingInterview {
  id: string
  candidate_id: string
  candidate_name: string
  interview_date: string
  format: string
  interviewer_name: string | null
}

interface AlertSummary {
  total: number
  urgent: number
  warning: number
  info: number
}

const FUNNEL_STAGES: CandidateStatus[] = [...ACTIVE_PIPELINE_STAGES, 'contratado']

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RecrutamentoDashboardPage() {
  const [kpis, setKpis] = useState<KPIs>({
    total: 0,
    byStatus: {},
    bySource: {},
    conversionRate: 0,
    avgTimeToDecision: null,
    avgTimeToHire: null,
  })
  const [alertSummary, setAlertSummary] = useState<AlertSummary>({ total: 0, urgent: 0, warning: 0, info: 0 })
  const [alerts, setAlerts] = useState<RecruitmentAlert[]>([])
  const [recentCandidates, setRecentCandidates] = useState<RecruitmentCandidate[]>([])
  const [upcomingInterviews, setUpcomingInterviews] = useState<UpcomingInterview[]>([])
  const [exportOpen, setExportOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // `loading` já nasce true — não voltar a fazer set síncrono aqui (o loadData
  // corre uma única vez no mount).
  const loadData = useCallback(async () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const horizonStr = format(addDays(new Date(), 14), 'yyyy-MM-dd')

    const [kpiRes, alertsRes, candidatesRes, interviewsRes] = await Promise.all([
      getRecruitmentKPIs(),
      getRecruitmentAlerts(),
      getCandidates(),
      getAllInterviews(todayStr, horizonStr),
    ])

    if (!kpiRes.error) {
      setKpis({
        total: kpiRes.total,
        byStatus: kpiRes.byStatus,
        bySource: kpiRes.bySource,
        conversionRate: kpiRes.conversionRate,
        avgTimeToDecision: kpiRes.avgTimeToDecision,
        avgTimeToHire: kpiRes.avgTimeToHire,
      })
    }

    if (!alertsRes.error && alertsRes.alerts) {
      setAlerts(alertsRes.alerts)
      setAlertSummary({
        total: alertsRes.alerts.length,
        urgent: alertsRes.alerts.filter((a) => a.severity === 'urgent').length,
        warning: alertsRes.alerts.filter((a) => a.severity === 'warning').length,
        info: alertsRes.alerts.filter((a) => a.severity === 'info').length,
      })
    }

    if (!candidatesRes.error) setRecentCandidates(candidatesRes.candidates.slice(0, 8))
    if (!interviewsRes.error) setUpcomingInterviews((interviewsRes.interviews as UpcomingInterview[]).slice(0, 6))

    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const statusCount = (s: string) => kpis.byStatus[s] || 0
  const inPipeline = ACTIVE_PIPELINE_STAGES.reduce((sum, s) => sum + statusCount(s), 0)
  const maxFunnel = Math.max(...FUNNEL_STAGES.map(statusCount), 1)

  const metrics = [
    { label: 'Total Candidatos', value: kpis.total, icon: Users, gradient: 'from-purple-500 to-pink-600' },
    { label: 'Em Pipeline', value: inPipeline, icon: Briefcase, gradient: 'from-blue-500 to-cyan-600' },
    { label: 'Entrevistas (14 dias)', value: upcomingInterviews.length, icon: Calendar, gradient: 'from-orange-500 to-red-600' },
    { label: 'Contratados', value: statusCount('contratado'), icon: TrendingUp, gradient: 'from-green-500 to-emerald-600' },
  ]

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de Recrutamento</h1>
          <p className="text-muted-foreground text-sm">Visão geral do processo de contratação</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => setExportOpen(true)}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          <Link href="/dashboard/recrutamento/candidatos">
            <Button size="sm" className="rounded-full gap-1.5">
              Candidatos
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric cards (quintino: gradient icon tiles) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4 sm:p-5">
              <div
                className={cn(
                  'mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white sm:h-11 sm:w-11',
                  m.gradient,
                )}
              >
                <m.icon className="h-5 w-5" />
              </div>
              {loading ? (
                <Skeleton className="h-8 w-14" />
              ) : (
                <p className="text-2xl font-bold sm:text-3xl">{m.value}</p>
              )}
              <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funil + Próximas Entrevistas */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Funil de Recrutamento</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {FUNNEL_STAGES.map((s) => (
                  <Skeleton key={s} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {FUNNEL_STAGES.map((stage) => {
                  const count = statusCount(stage)
                  const pct = kpis.total > 0 ? Math.round((count / kpis.total) * 100) : 0
                  return (
                    <div key={stage}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: CANDIDATE_STATUS_DOT[stage] }}
                          />
                          {CANDIDATE_STATUSES[stage].label}
                        </span>
                        <span className="text-muted-foreground">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-muted">
                        <div
                          className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all"
                          style={{ width: `${(count / maxFunnel) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between border-t border-border/30 pt-3 text-xs text-muted-foreground">
                  <span>Taxa de conversão: <span className="font-semibold text-foreground">{kpis.conversionRate.toFixed(1)}%</span></span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Tempo até contratação: <span className="font-semibold text-foreground">{kpis.avgTimeToHire !== null ? `${kpis.avgTimeToHire} dias` : '—'}</span>
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Próximas Entrevistas</CardTitle>
            <Link href="/dashboard/recrutamento/calendario">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Calendário
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : upcomingInterviews.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Sem entrevistas nos próximos 14 dias
              </p>
            ) : (
              <div className="space-y-2.5">
                {upcomingInterviews.map((iv) => (
                  <Link
                    key={iv.id}
                    href={`/dashboard/recrutamento/${iv.candidate_id}`}
                    className="block rounded-xl bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium">{iv.candidate_name}</p>
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          iv.format === 'video_call'
                            ? 'bg-purple-100 text-purple-700'
                            : iv.format === 'phone'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-blue-100 text-blue-700',
                        )}
                      >
                        {iv.format === 'video_call' ? <Video className="h-2.5 w-2.5" /> : iv.format === 'phone' ? <Phone className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}
                        {INTERVIEW_FORMATS[iv.format as keyof typeof INTERVIEW_FORMATS] ?? iv.format}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(iv.interview_date), 'd MMM', { locale: pt })}
                      </span>
                      {iv.interviewer_name && <span className="truncate">{iv.interviewer_name}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertas + Candidaturas Recentes */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm">
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
              <p className="text-muted-foreground py-6 text-center text-sm">Sem alertas pendentes</p>
            ) : (
              <div className="space-y-2.5">
                {alertSummary.urgent > 0 && (
                  <AlertRow severity="urgent" count={alertSummary.urgent} label="Urgentes" icon={AlertTriangle} />
                )}
                {alertSummary.warning > 0 && (
                  <AlertRow severity="warning" count={alertSummary.warning} label="Avisos" icon={AlertCircle} />
                )}
                {alertSummary.info > 0 && (
                  <AlertRow severity="info" count={alertSummary.info} label="Informativos" icon={Info} />
                )}
                {alerts.slice(0, 3).map((alert, i) => (
                  <Link
                    key={`${alert.candidate_id}-${alert.type}-${i}`}
                    href={`/dashboard/recrutamento/${alert.candidate_id}`}
                    className={cn(
                      'block rounded-lg border-l-2 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40',
                      alert.severity === 'urgent'
                        ? 'border-l-red-500'
                        : alert.severity === 'warning'
                          ? 'border-l-amber-500'
                          : 'border-l-blue-500',
                    )}
                  >
                    <p className="truncate text-xs font-medium">{alert.candidate_name}</p>
                    <p className="text-muted-foreground truncate text-xs">{alert.message}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Candidaturas Recentes</CardTitle>
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
              <p className="text-muted-foreground py-6 text-center text-sm">Sem candidaturas recentes</p>
            ) : (
              <div className="divide-y divide-border/30">
                {recentCandidates.map((candidate) => {
                  const statusInfo = CANDIDATE_STATUSES[normalizeCandidateStatus(candidate.status)]
                  return (
                    <Link
                      key={candidate.id}
                      href={`/dashboard/recrutamento/${candidate.id}`}
                      className="flex items-center gap-3 px-1 py-2.5 transition-colors hover:bg-muted/30"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-[10px] font-bold">
                          {getInitials(candidate.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{candidate.full_name}</p>
                        <p className="text-muted-foreground text-xs">
                          {candidate.created_at
                            ? formatDistanceToNow(new Date(candidate.created_at), { locale: pt, addSuffix: true })
                            : '—'}
                        </p>
                      </div>
                      {candidate.recruiter?.commercial_name && (
                        <span className="text-muted-foreground hidden max-w-[120px] truncate text-xs sm:block">
                          {candidate.recruiter.commercial_name}
                        </span>
                      )}
                      <Badge className={cn('shrink-0 text-[10px]', statusInfo.color)}>{statusInfo.label}</Badge>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CsvExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        endpoint="/api/export/candidates"
        title="Candidatos"
      />
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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
    <div className="flex items-center gap-3 rounded-md border p-2.5">
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', colors[severity])}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="flex-1 text-sm font-medium">{label}</p>
      <Badge variant="secondary" className="text-xs font-bold">
        {count}
      </Badge>
    </div>
  )
}
