'use client'

import { useEffect, useState, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TrendingUp, AlertCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConsultantAlertsSheet, type ConsultantAlertRow } from './consultant-alerts-sheet'

export function ConsultantAlertsTab() {
  const [rows, setRows] = useState<ConsultantAlertRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ConsultantAlertRow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

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
        const exportsSev: 'ok' | 'warning' | 'danger' = unackCount > 0 ? 'danger' : 'ok'
        const wasDanger = r.exports.severity === 'danger'
        const newRed = Math.max(0, r.red_count - (wasDanger && exportsSev === 'ok' ? 1 : 0))
        const updated: ConsultantAlertRow = {
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
        return updated
      }).sort((a, b) => {
        if (b.red_count !== a.red_count) return b.red_count - a.red_count
        if (b.yellow_count !== a.yellow_count) return b.yellow_count - a.yellow_count
        return a.commercial_name.localeCompare(b.commercial_name, 'pt-PT')
      })
    })
    setSelected((prev) => {
      if (!prev || prev.consultant_id !== consultantId) return prev
      const remaining = prev.unacknowledged_exports.filter((e) => e.id !== eventId)
      const severity: 'ok' | 'warning' | 'danger' = remaining.length > 0 ? 'danger' : 'ok'
      const updated: ConsultantAlertRow = {
        ...prev,
        unacknowledged_exports: remaining,
        exports: {
          ...prev.exports,
          severity,
          unacknowledged_count: remaining.length,
          last_event: remaining[0] ?? null,
        },
      }
      return updated
    })
  }, [])

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

  const withAlerts = rows.filter((r) => r.red_count > 0 || r.yellow_count > 0)
  const clean = rows.filter((r) => r.red_count === 0 && r.yellow_count === 0)

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 space-y-5">
      {withAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <div className="rounded-full bg-emerald-500/10 p-4 mb-3">
            <TrendingUp className="h-6 w-6 text-emerald-500" />
          </div>
          <h3 className="text-base font-medium">Sem alertas</h3>
          <p className="text-sm mt-1">Todos os consultores estão em dia.</p>
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            {withAlerts.length} consultor{withAlerts.length === 1 ? '' : 'es'} com alertas
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {withAlerts.map((row) => (
              <ConsultantAlertCard
                key={row.consultant_id}
                row={row}
                onClick={() => { setSelected(row); setSheetOpen(true) }}
              />
            ))}
          </div>
        </div>
      )}

      {clean.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            {clean.length} sem alertas
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clean.map((row) => (
              <ConsultantAlertCard
                key={row.consultant_id}
                row={row}
                onClick={() => { setSelected(row); setSheetOpen(true) }}
              />
            ))}
          </div>
        </div>
      )}

      <ConsultantAlertsSheet
        consultant={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onAcknowledged={handleAcknowledged}
      />
    </div>
  )
}

function ConsultantAlertCard({ row, onClick }: { row: ConsultantAlertRow; onClick: () => void }) {
  const hasAlerts = row.red_count > 0 || row.yellow_count > 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group text-left rounded-2xl border p-4 transition-all',
        'hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
        row.red_count > 0
          ? 'border-red-500/30 bg-red-500/[0.04] hover:bg-red-500/[0.08]'
          : row.yellow_count > 0
            ? 'border-amber-500/30 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
            : 'border-border/50 bg-background hover:bg-muted/40',
      )}
    >
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
          {hasAlerts ? (
            <div className="flex items-center gap-2 mt-1">
              {row.red_count > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                  <AlertCircle className="h-3 w-3" />
                  {row.red_count}
                </span>
              )}
              {row.yellow_count > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-500 font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  {row.yellow_count}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">Tudo em ordem</p>
          )}
        </div>
      </div>
    </button>
  )
}
