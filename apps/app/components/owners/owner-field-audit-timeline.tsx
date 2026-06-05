'use client'

import { useEffect, useMemo, useState } from 'react'
import { UserPen, History, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Spinner } from '@/components/kibo-ui/spinner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AuditRow {
  id: string
  owner_id: string
  field_name: string
  old_value: string | null
  new_value: string | null
  edited_by_auth_user_id: string | null
  edited_via: string
  subtask_id: string | null
  proc_task_id: string | null
  subtask_title: string | null
  created_at: string
}

interface Props {
  ownerId: string
}

const FIELD_LABELS: Record<string, string> = {
  naturality: 'Naturalidade',
  address: 'Morada',
  marital_status: 'Estado civil',
  legal_rep_naturality: 'Naturalidade (Rep. legal)',
  legal_rep_address: 'Morada (Rep. legal)',
  legal_rep_marital_status: 'Estado civil (Rep. legal)',
}

const VIA_LABELS: Record<string, string> = {
  owner_app: 'Via app',
  owner_angariacao_checklist: 'Via checklist',
  erp: 'Via ERP',
  unknown: 'Origem desconhecida',
}

function fmt(value: string | null): string {
  if (value === null || value === '') return '(vazio)'
  return value
}

interface Group {
  key: string
  rows: AuditRow[]
  subtaskTitle: string | null
  start: Date
  end: Date
}

function groupRows(rows: AuditRow[]): Group[] {
  // Group by subtask_id within a 30-min sliding window. Rows with subtask_id=null
  // are NOT grouped (each is its own item).
  const groups: Group[] = []

  for (const r of rows) {
    if (!r.subtask_id) {
      groups.push({
        key: r.id,
        rows: [r],
        subtaskTitle: null,
        start: new Date(r.created_at),
        end: new Date(r.created_at),
      })
      continue
    }

    const t = new Date(r.created_at).getTime()
    // Try to extend the most recent group with same subtask_id within 30min
    const last = groups[groups.length - 1]
    if (
      last &&
      last.rows[0].subtask_id === r.subtask_id &&
      Math.abs(last.start.getTime() - t) <= 30 * 60_000
    ) {
      last.rows.push(r)
      last.end = new Date(Math.min(last.end.getTime(), t))
      last.start = new Date(Math.max(last.start.getTime(), t))
      continue
    }

    groups.push({
      key: r.id,
      rows: [r],
      subtaskTitle: r.subtask_title,
      start: new Date(r.created_at),
      end: new Date(r.created_at),
    })
  }

  return groups
}

export function OwnerFieldAuditTimeline({ ownerId }: Props) {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/owners/${ownerId}/audit?limit=100`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json?.error ?? `HTTP ${res.status}`)
        }
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        setRows(json.rows ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message ?? 'Erro a carregar histórico')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ownerId])

  const groups = useMemo(() => groupRows(rows), [rows])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Spinner variant="infinite" size={14} />
        A carregar histórico...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20 p-3 text-sm text-red-700 dark:text-red-400">
        {error}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Sem alterações registadas neste proprietário.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const first = group.rows[0]
        const isGroup = group.rows.length > 1
        const isExpanded = expanded.has(group.key)
        const dur = Math.max(
          1,
          Math.round(Math.abs(group.start.getTime() - group.end.getTime()) / 60_000)
        )

        return (
          <div
            key={group.key}
            className="rounded-md border bg-card p-3"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                <UserPen className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                {isGroup ? (
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Set(expanded)
                      if (next.has(group.key)) next.delete(group.key)
                      else next.add(group.key)
                      setExpanded(next)
                    }}
                    className="text-sm font-medium text-left flex items-center gap-1 hover:text-foreground/80"
                  >
                    {group.rows.length} alterações em {dur}min
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 transition-transform',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  </button>
                ) : (
                  <p className="text-sm font-medium truncate">
                    {FIELD_LABELS[first.field_name] ?? first.field_name}
                    : <span className="text-muted-foreground font-normal">{fmt(first.old_value)}</span>
                    <span className="mx-1.5 text-muted-foreground">→</span>
                    <span className="font-medium">{fmt(first.new_value)}</span>
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {VIA_LABELS[first.edited_via] ?? first.edited_via}
                  {' · '}
                  {formatDistanceToNow(new Date(first.created_at), { addSuffix: true, locale: pt })}
                  {group.subtaskTitle && (
                    <>
                      {' · '}
                      <span>Subtarefa: {group.subtaskTitle}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {isGroup && isExpanded && (
              <ul className="mt-3 space-y-1.5 pl-11 text-sm">
                {group.rows.map((r) => (
                  <li key={r.id} className="flex items-baseline gap-2">
                    <span className="font-medium">
                      {FIELD_LABELS[r.field_name] ?? r.field_name}:
                    </span>
                    <span className="text-muted-foreground">{fmt(r.old_value)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{fmt(r.new_value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
