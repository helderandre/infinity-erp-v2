'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Phone,
  UserPlus,
  Home,
  LogIn,
  Download,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConsultantAlertsSheet, type ConsultantAlertRow } from './consultant-alerts-sheet'

type Severity = 'ok' | 'warning' | 'danger'
type TabKey = 'logins' | 'atividade' | 'downloads'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'logins', label: 'Logins' },
  { key: 'atividade', label: 'Telefonemas, Leads & Angariações' },
  { key: 'downloads', label: 'Downloads BD' },
]

function formatDaysAgo(days: number | null): string {
  if (days == null) return 'sem registo'
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 30) return `há ${days}d`
  if (days < 365) return `há ${Math.floor(days / 30)}m`
  return `há ${Math.floor(days / 365)}a`
}

function severityClasses(s: Severity) {
  if (s === 'danger') {
    return {
      border: 'border-red-500/30',
      bg: 'bg-red-500/[0.04]',
      bgHover: 'hover:bg-red-500/[0.08]',
      dot: 'bg-red-500',
      icon: 'text-red-500',
      text: 'text-red-700 dark:text-red-400',
      sub: 'text-red-600/80 dark:text-red-400/80',
    }
  }
  if (s === 'warning') {
    return {
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/[0.04]',
      bgHover: 'hover:bg-amber-500/[0.08]',
      dot: 'bg-amber-500',
      icon: 'text-amber-500',
      text: 'text-amber-700 dark:text-amber-500',
      sub: 'text-amber-700/80 dark:text-amber-500/80',
    }
  }
  return {
    border: 'border-border/50',
    bg: 'bg-background',
    bgHover: 'hover:bg-muted/40',
    dot: 'bg-emerald-500',
    icon: 'text-muted-foreground',
    text: 'text-foreground/85',
    sub: 'text-muted-foreground',
  }
}

const sevRank = (s: Severity): number => (s === 'danger' ? 0 : s === 'warning' ? 1 : 2)

const worstSeverity = (...arr: Severity[]): Severity => {
  if (arr.includes('danger')) return 'danger'
  if (arr.includes('warning')) return 'warning'
  return 'ok'
}

export function ConsultantAlertsTab() {
  const [rows, setRows] = useState<ConsultantAlertRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ConsultantAlertRow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [tab, setTab] = useState<TabKey>('logins')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/consultant-alerts', { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Falha a carregar alertas')
      }
      const body = await res.json()
      setRows(body.consultants ?? [])
      setError(null)
    } catch (err) {
      setError((err as Error).message)
      setRows([])
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAcknowledged = useCallback((consultantId: string, eventId: string) => {
    setRows((prev) => {
      if (!prev) return prev
      return prev.map((r) => {
        if (r.consultant_id !== consultantId) return r
        const remaining = r.unacknowledged_exports.filter((e) => e.id !== eventId)
        const unackCount = remaining.length
        const exportsSev: Severity = unackCount > 0 ? 'danger' : 'ok'
        const wasDanger = r.exports.severity === 'danger'
        const newRed = Math.max(0, r.red_count - (wasDanger && exportsSev === 'ok' ? 1 : 0))
        return {
          ...r,
          unacknowledged_exports: remaining,
          exports: {
            ...r.exports,
            severity: exportsSev,
            unacknowledged_count: unackCount,
            last_event: remaining[0] ?? null,
          },
          red_count: newRed,
        }
      })
    })
    setSelected((prev) => {
      if (!prev || prev.consultant_id !== consultantId) return prev
      const remaining = prev.unacknowledged_exports.filter((e) => e.id !== eventId)
      const severity: Severity = remaining.length > 0 ? 'danger' : 'ok'
      return {
        ...prev,
        unacknowledged_exports: remaining,
        exports: {
          ...prev.exports,
          severity,
          unacknowledged_count: remaining.length,
          last_event: remaining[0] ?? null,
        },
      }
    })
  }, [])

  // Counts por tab para o badge no selector
  const counts = useMemo(() => {
    if (!rows) return { logins: 0, atividade: 0, downloads: 0 }
    return {
      logins: rows.filter((r) => r.logins.severity !== 'ok').length,
      atividade: rows.filter((r) =>
        worstSeverity(r.calls.severity, r.leads.severity, r.acquisitions.severity) !== 'ok'
      ).length,
      downloads: rows.filter((r) => r.exports.unacknowledged_count > 0).length,
    }
  }, [rows])

  const openDetail = (row: ConsultantAlertRow) => {
    setSelected(row)
    setSheetOpen(true)
  }

  if (rows === null) {
    return (
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-600 dark:text-red-400">
        Erro a carregar alertas: {error}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 space-y-5">
      {/* Pill tabs */}
      <div className="flex p-1 rounded-full bg-muted/60 border border-border/30 w-fit max-w-full overflow-x-auto">
        {TABS.map((t) => {
          const isActive = tab === t.key
          const count = counts[t.key]
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {count > 0 && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-semibold',
                    isActive
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                      : 'bg-foreground/10 text-foreground',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'logins' && <LoginsView rows={rows} onSelect={openDetail} />}
      {tab === 'atividade' && <AtividadeView rows={rows} onSelect={openDetail} />}
      {tab === 'downloads' && <DownloadsView rows={rows} onSelect={openDetail} />}

      <ConsultantAlertsSheet
        consultant={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onAcknowledged={handleAcknowledged}
      />
    </div>
  )
}

// ─── Header partilhado: avatar + nome ─────────────────────────────────

function ConsultantHeader({ row }: { row: ConsultantAlertRow }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10 shrink-0">
        {row.profile_photo_url
          ? <AvatarImage src={row.profile_photo_url} alt={row.commercial_name} />
          : null}
        <AvatarFallback className="text-xs">
          {row.commercial_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{row.commercial_name}</p>
      </div>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <div className="rounded-full bg-emerald-500/10 p-4 mb-3">
        <TrendingUp className="h-6 w-6 text-emerald-500" />
      </div>
      <h3 className="text-base font-medium">{title}</h3>
      <p className="text-sm mt-1">{description}</p>
    </div>
  )
}

function CardWrapper({
  severity,
  onClick,
  children,
}: {
  severity: Severity
  onClick: () => void
  children: React.ReactNode
}) {
  const c = severityClasses(severity)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group text-left w-full rounded-2xl border p-4 transition-all',
        'hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
        c.border, c.bg, c.bgHover,
      )}
    >
      {children}
    </button>
  )
}

// ─── Tab 1 — Logins ───────────────────────────────────────────────────

function LoginsView({
  rows,
  onSelect,
}: { rows: ConsultantAlertRow[]; onSelect: (r: ConsultantAlertRow) => void }) {
  const sorted = useMemo(() =>
    [...rows].sort((a, b) => {
      const sa = sevRank(a.logins.severity)
      const sb = sevRank(b.logins.severity)
      if (sa !== sb) return sa - sb
      return (b.logins.days_since ?? 0) - (a.logins.days_since ?? 0)
    }), [rows])

  const withAlerts = sorted.filter((r) => r.logins.severity !== 'ok')
  const clean = sorted.filter((r) => r.logins.severity === 'ok')

  return (
    <div className="space-y-5">
      {withAlerts.length === 0 ? (
        <EmptyState title="Sem alertas de login" description="Todos os consultores têm sessões recentes." />
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            {withAlerts.length} consultor{withAlerts.length === 1 ? '' : 'es'} sem actividade recente
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {withAlerts.map((row) => <LoginCard key={row.consultant_id} row={row} onClick={() => onSelect(row)} />)}
          </div>
        </div>
      )}
      {clean.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            {clean.length} com sessões recentes
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clean.map((row) => <LoginCard key={row.consultant_id} row={row} onClick={() => onSelect(row)} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function LoginCard({ row, onClick }: { row: ConsultantAlertRow; onClick: () => void }) {
  const c = severityClasses(row.logins.severity)
  return (
    <CardWrapper severity={row.logins.severity} onClick={onClick}>
      <ConsultantHeader row={row} />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Última sessão</p>
          <div className="mt-1 inline-flex items-center gap-1.5">
            <LogIn className={cn('h-3.5 w-3.5', c.icon)} />
            <span className={cn('text-sm font-semibold', c.text)}>
              {row.logins.last_at ? formatDaysAgo(row.logins.days_since) : 'Nunca'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Este mês</p>
          <p className="text-sm font-semibold mt-1 tabular-nums">{row.logins.count_this_month}</p>
        </div>
      </div>
    </CardWrapper>
  )
}

// ─── Tab 2 — Atividade (telefonemas, leads, angariações) ───────────────

function AtividadeView({
  rows,
  onSelect,
}: { rows: ConsultantAlertRow[]; onSelect: (r: ConsultantAlertRow) => void }) {
  const enriched = useMemo(() =>
    rows.map((r) => ({
      row: r,
      worst: worstSeverity(r.calls.severity, r.leads.severity, r.acquisitions.severity),
    })).sort((a, b) => sevRank(a.worst) - sevRank(b.worst)), [rows])

  const withAlerts = enriched.filter((e) => e.worst !== 'ok')
  const clean = enriched.filter((e) => e.worst === 'ok')

  return (
    <div className="space-y-5">
      {withAlerts.length === 0 ? (
        <EmptyState title="Sem alertas de atividade" description="Todos os consultores estão activos." />
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            {withAlerts.length} consultor{withAlerts.length === 1 ? '' : 'es'} com alertas
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {withAlerts.map(({ row, worst }) => (
              <AtividadeCard key={row.consultant_id} row={row} worst={worst} onClick={() => onSelect(row)} />
            ))}
          </div>
        </div>
      )}
      {clean.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-3">{clean.length} sem alertas</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clean.map(({ row, worst }) => (
              <AtividadeCard key={row.consultant_id} row={row} worst={worst} onClick={() => onSelect(row)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AtividadeCard({
  row,
  worst,
  onClick,
}: { row: ConsultantAlertRow; worst: Severity; onClick: () => void }) {
  const items: { key: string; icon: LucideIcon; label: string; severity: Severity; detail: string }[] = [
    {
      key: 'calls',
      icon: Phone,
      label: 'Telefonemas',
      severity: row.calls.severity,
      detail: row.calls.last_at ? formatDaysAgo(row.calls.days_since) : 'sem registos',
    },
    {
      key: 'leads',
      icon: UserPlus,
      label: 'Leads',
      severity: row.leads.severity,
      detail: row.leads.last_at ? formatDaysAgo(row.leads.days_since) : 'sem leads',
    },
    {
      key: 'acquisitions',
      icon: Home,
      label: 'Angariações',
      severity: row.acquisitions.severity,
      detail: row.acquisitions.last_at ? formatDaysAgo(row.acquisitions.days_since) : 'nenhuma',
    },
  ]
  items.sort((a, b) => sevRank(a.severity) - sevRank(b.severity))

  return (
    <CardWrapper severity={worst} onClick={onClick}>
      <ConsultantHeader row={row} />
      <ul className="mt-3 space-y-1.5">
        {items.map((m) => {
          const c = severityClasses(m.severity)
          const Icon = m.icon
          return (
            <li key={m.key} className="flex items-center gap-2.5">
              <span className="relative shrink-0 inline-flex items-center justify-center">
                <Icon className={cn('h-3.5 w-3.5', c.icon)} />
                <span className={cn('absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full ring-1 ring-background', c.dot)} />
              </span>
              <span className={cn('text-[12px] font-medium flex-1 min-w-0 truncate', c.text)}>{m.label}</span>
              <span className={cn('text-[11px] tabular-nums truncate text-right', c.sub)}>{m.detail}</span>
            </li>
          )
        })}
      </ul>
    </CardWrapper>
  )
}

// ─── Tab 3 — Downloads BD ─────────────────────────────────────────────

function DownloadsView({
  rows,
  onSelect,
}: { rows: ConsultantAlertRow[]; onSelect: (r: ConsultantAlertRow) => void }) {
  const sorted = useMemo(() =>
    [...rows].sort((a, b) => {
      if (b.exports.unacknowledged_count !== a.exports.unacknowledged_count) {
        return b.exports.unacknowledged_count - a.exports.unacknowledged_count
      }
      return a.commercial_name.localeCompare(b.commercial_name, 'pt-PT')
    }), [rows])

  const withPending = sorted.filter((r) => r.exports.unacknowledged_count > 0)
  const clean = sorted.filter((r) => r.exports.unacknowledged_count === 0)

  return (
    <div className="space-y-5">
      {withPending.length === 0 ? (
        <EmptyState title="Sem downloads por verificar" description="Não há exports da BD a aguardar revisão." />
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            {withPending.length} consultor{withPending.length === 1 ? '' : 'es'} com downloads por verificar
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {withPending.map((row) => <DownloadCard key={row.consultant_id} row={row} onClick={() => onSelect(row)} />)}
          </div>
        </div>
      )}
      {clean.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-3">{clean.length} sem pendências</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clean.map((row) => <DownloadCard key={row.consultant_id} row={row} onClick={() => onSelect(row)} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function DownloadCard({ row, onClick }: { row: ConsultantAlertRow; onClick: () => void }) {
  const count = row.exports.unacknowledged_count
  const severity: Severity = count > 0 ? 'danger' : 'ok'
  const c = severityClasses(severity)
  return (
    <CardWrapper severity={severity} onClick={onClick}>
      <ConsultantHeader row={row} />
      <div className="mt-3 flex items-center gap-2.5">
        <span className="relative shrink-0 inline-flex items-center justify-center">
          <Download className={cn('h-3.5 w-3.5', c.icon)} />
          {count > 0 && (
            <span className={cn('absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full ring-1 ring-background', c.dot)} />
          )}
        </span>
        <span className={cn('text-sm font-semibold flex-1', c.text)}>
          {count > 0
            ? `${count} download${count === 1 ? '' : 's'} por verificar`
            : 'Sem pendências'}
        </span>
        {count === 0 && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
        {count > 0 && <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
      </div>
      {row.exports.last_event && (
        <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
          Último: {new Date(row.exports.last_event.created_at).toLocaleDateString('pt-PT', {
            day: '2-digit', month: 'short',
          })}
        </p>
      )}
    </CardWrapper>
  )
}
