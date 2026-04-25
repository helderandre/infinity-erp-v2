'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Download, Phone, Home, UserPlus, LogIn,
  AlertCircle, AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'

type Severity = 'ok' | 'warning' | 'danger'

type AlertMetric = {
  severity: Severity
  last_at: string | null
  days_since: number | null
}

type ExportEvent = {
  id: string
  created_at: string
  export_type: string
  row_count: number | null
}

export type ConsultantAlertRow = {
  consultant_id: string
  commercial_name: string
  profile_photo_url: string | null
  red_count: number
  yellow_count: number
  acquisitions: AlertMetric
  calls: AlertMetric
  leads: AlertMetric
  logins: AlertMetric & { count_this_month: number }
  exports: {
    severity: Severity
    unacknowledged_count: number
    last_event: ExportEvent | null
  }
  login_chart: { date: string; count: number }[]
  unacknowledged_exports: ExportEvent[]
}

type Props = {
  consultant: ConsultantAlertRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAcknowledged?: (consultantId: string, eventId: string) => void
}

const EXPORT_TYPE_LABELS: Record<string, string> = {
  contacts: 'Contactos',
  leads: 'Leads',
  properties: 'Imóveis',
  consultants: 'Consultores',
  processes: 'Processos',
  negocios: 'Negócios',
  commissions: 'Comissões',
  candidates: 'Recrutamento',
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-PT', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function severityTokens(severity: Severity) {
  if (severity === 'danger') {
    return {
      wrapper: 'border-red-500/30 bg-red-500/[0.06]',
      icon: 'text-red-500',
      dot: 'bg-red-500',
      label: 'Crítico',
      Icon: AlertCircle,
    }
  }
  if (severity === 'warning') {
    return {
      wrapper: 'border-amber-500/30 bg-amber-500/[0.06]',
      icon: 'text-amber-500',
      dot: 'bg-amber-500',
      label: 'Atenção',
      Icon: AlertTriangle,
    }
  }
  return {
    wrapper: 'border-emerald-500/20 bg-emerald-500/[0.04]',
    icon: 'text-emerald-500',
    dot: 'bg-emerald-500',
    label: 'OK',
    Icon: CheckCircle2,
  }
}

function MetricCard({
  icon: Icon,
  title,
  metric,
  formatDescription,
}: {
  icon: typeof Phone
  title: string
  metric: AlertMetric
  formatDescription: (m: AlertMetric) => string
}) {
  const t = severityTokens(metric.severity)
  return (
    <div className={cn('rounded-2xl border p-4 transition-colors', t.wrapper)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/70">
            <Icon className={cn('h-4 w-4', t.icon)} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDescription(metric)}</p>
          </div>
        </div>
        <span className={cn('inline-block h-2 w-2 rounded-full mt-3', t.dot)} />
      </div>
    </div>
  )
}

export function ConsultantAlertsSheet({ consultant, open, onOpenChange, onAcknowledged }: Props) {
  const isMobile = useIsMobile()
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const [locallyAcknowledged, setLocallyAcknowledged] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) setLocallyAcknowledged(new Set())
  }, [open])

  const chartData = useMemo(() => {
    if (!consultant) return []
    return consultant.login_chart.map((p) => ({
      date: p.date,
      dayLabel: new Date(p.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }),
      count: p.count,
    }))
  }, [consultant])

  const visibleExports = useMemo(() => {
    if (!consultant) return []
    return consultant.unacknowledged_exports.filter((e) => !locallyAcknowledged.has(e.id))
  }, [consultant, locallyAcknowledged])

  const handleAcknowledge = async (eventId: string) => {
    if (!consultant) return
    setAcknowledgingId(eventId)
    try {
      const res = await fetch(`/api/dashboard/consultant-alerts/exports/${eventId}/acknowledge`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Falha a marcar como OK')
      }
      setLocallyAcknowledged((prev) => new Set(prev).add(eventId))
      toast.success('Marcado como verificado')
      onAcknowledged?.(consultant.consultant_id, eventId)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setAcknowledgingId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/90 supports-[backdrop-filter]:bg-background/80 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[640px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        {/* Header */}
        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
          <SheetHeader className="p-0 gap-0 flex-row items-center gap-3">
            <Avatar className="h-11 w-11">
              {consultant?.profile_photo_url
                ? <AvatarImage src={consultant.profile_photo_url} alt={consultant.commercial_name} />
                : null}
              <AvatarFallback className="text-sm">
                {consultant?.commercial_name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() ?? '—'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-[20px] font-semibold leading-tight tracking-tight truncate">
                {consultant?.commercial_name ?? 'Consultor'}
              </SheetTitle>
              <SheetDescription className="text-xs mt-0.5">
                Resumo dos alertas de actividade
              </SheetDescription>
            </div>
          </SheetHeader>

          {consultant && (
            <div className="mt-3 flex items-center gap-2">
              {consultant.red_count > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {consultant.red_count} crítico{consultant.red_count === 1 ? '' : 's'}
                </div>
              )}
              {consultant.yellow_count > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {consultant.yellow_count} atenção
                </div>
              )}
              {consultant.red_count === 0 && consultant.yellow_count === 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Sem alertas
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-4">
          {!consultant ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
            </div>
          ) : (
            <>
              {/* 1. Download de BD — custom card with action */}
              <div className={cn(
                'rounded-2xl border p-4',
                consultant.exports.severity === 'danger' && visibleExports.length > 0
                  ? 'border-red-500/30 bg-red-500/[0.06]'
                  : 'border-emerald-500/20 bg-emerald-500/[0.04]',
              )}>
                <div className="flex items-start gap-2.5">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/70 shrink-0">
                    <Download className={cn('h-4 w-4',
                      consultant.exports.severity === 'danger' && visibleExports.length > 0
                        ? 'text-red-500'
                        : 'text-emerald-500',
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Download da base de dados</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {visibleExports.length > 0
                        ? `${visibleExports.length} download${visibleExports.length === 1 ? '' : 's'} por verificar`
                        : 'Sem downloads por verificar'}
                    </p>
                  </div>
                </div>
                {visibleExports.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {visibleExports.map((e) => (
                      <li key={e.id} className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/60 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {EXPORT_TYPE_LABELS[e.export_type] ?? e.export_type}
                            {e.row_count != null && (
                              <span className="text-muted-foreground font-normal"> — {e.row_count} registo{e.row_count === 1 ? '' : 's'}</span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{fmtDateTime(e.created_at)}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full h-7 text-xs shrink-0"
                          disabled={acknowledgingId === e.id}
                          onClick={() => handleAcknowledge(e.id)}
                        >
                          {acknowledgingId === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'OK'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 2. Login + chart */}
              <div className={cn('rounded-2xl border p-4', severityTokens(consultant.logins.severity).wrapper)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/70">
                      <LogIn className={cn('h-4 w-4', severityTokens(consultant.logins.severity).icon)} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Último login</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {consultant.logins.last_at
                          ? `${fmtDateTime(consultant.logins.last_at)} · há ${consultant.logins.days_since} dia${consultant.logins.days_since === 1 ? '' : 's'}`
                          : 'Nunca fez login'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Este mês</p>
                    <p className="text-lg font-semibold leading-none mt-1">{consultant.logins.count_this_month}</p>
                  </div>
                </div>

                <div className="mt-4 h-24 -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                      <XAxis
                        dataKey="dayLabel"
                        tick={{ fontSize: 9, fill: 'currentColor' }}
                        axisLine={false}
                        tickLine={false}
                        interval={Math.ceil(chartData.length / 6)}
                      />
                      <YAxis hide domain={[0, 'dataMax + 1']} />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(0,0,0,0.85)',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: 11,
                          padding: '4px 8px',
                        }}
                        labelStyle={{ color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(v: number) => [`${v}`, 'logins']}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 3. Acquisitions */}
              <MetricCard
                icon={Home}
                title="Última angariação"
                metric={consultant.acquisitions}
                formatDescription={(m) => {
                  if (!m.last_at) return 'Nunca angariou um imóvel'
                  return `${fmtDateTime(m.last_at)} · há ${m.days_since} dia${m.days_since === 1 ? '' : 's'}`
                }}
              />

              {/* 4. Calls */}
              <MetricCard
                icon={Phone}
                title="Último telefonema registado"
                metric={consultant.calls}
                formatDescription={(m) => {
                  if (!m.last_at) return 'Sem telefonemas registados'
                  return `${fmtDateTime(m.last_at)} · há ${m.days_since} dia${m.days_since === 1 ? '' : 's'}`
                }}
              />

              {/* 5. Leads */}
              <MetricCard
                icon={UserPlus}
                title="Última lead atribuída"
                metric={consultant.leads}
                formatDescription={(m) => {
                  if (!m.last_at) return 'Sem leads atribuídas'
                  return `${fmtDateTime(m.last_at)} · há ${m.days_since} dia${m.days_since === 1 ? '' : 's'}`
                }}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
