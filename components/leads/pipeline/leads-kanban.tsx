'use client'

/**
 * Leads pipeline — kanban of lead ENTRIES by lifecycle status (distinct from
 * the opportunities/negócios board). Lean 4-column set:
 *   Novo (new/seen) · Contactado (processing) · Qualificado (converted) · Perdido (discarded)
 *
 * Two views via a Minhas/Referenciadas toggle:
 *   • Minhas        — entries assigned to me. Drag to advance, qualify, lose,
 *                     multi-select → bulk "Referenciar".
 *   • Referenciadas — entries I referred to other consultores, shown in their
 *                     current phase (read-only) so I can see how they're
 *                     progressing. Each card shows the recipient + my % and,
 *                     while still pending, a "Cancelar" to pull it back.
 *
 * Visual language matches the Oportunidades board (components/crm/kanban-board.tsx).
 * Clicking a card opens the same LeadEntrySheet used on the Oportunidades page.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Phone, Mail, Clock, Gift, Check, Send, X, Undo2, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ENTRY_SOURCE_LABELS } from '@/lib/constants-leads-crm'
import { QualifyEntryDialog } from '@/components/crm/qualify-entry-dialog'
import { LostReasonDialog } from '@/components/crm/lost-reason-dialog'
import { BulkReferralDialog } from '@/components/crm/bulk-referral-dialog'
import { invalidate, subscribe } from '@/lib/crm/invalidator'
import { LeadEntrySheet } from '@/components/leads/lead-entry-sheet'
import { useUser } from '@/hooks/use-user'

type ColumnKey = 'novo' | 'contactado' | 'qualificado' | 'perdido'
type View = 'minhas' | 'referenciadas'

interface Column {
  key: ColumnKey
  label: string
  statuses: string[]
  setStatus?: string
  color: string
  qualify?: boolean
  lost?: boolean
}

const COLUMNS: Column[] = [
  { key: 'novo', label: 'Novo', statuses: ['new', 'seen'], setStatus: 'new', color: '#3b82f6' },
  { key: 'contactado', label: 'Contactado', statuses: ['processing'], setStatus: 'processing', color: '#f59e0b' },
  { key: 'qualificado', label: 'Qualificado', statuses: ['converted'], color: '#10b981', qualify: true },
  { key: 'perdido', label: 'Perdido', statuses: ['discarded'], color: '#ef4444', lost: true },
]

const ALL_STATUSES = 'new,seen,processing,converted,discarded'
const TERMINAL_STATUSES = ['converted', 'discarded']

interface ReferralLite {
  id: string
  status: string
  from_consultant_id: string | null
  referral_pct: number | string | null
}

interface LeadEntry {
  id: string
  status: string
  source: string
  created_at: string
  contact_id: string | null
  has_referral?: boolean
  contact?: { id: string; nome: string | null; telemovel: string | null; email: string | null } | null
  campaign?: { id: string; name: string | null } | null
  assigned_consultant?: { id: string; commercial_name: string | null } | null
  referrals?: ReferralLite[] | null
}

export function LeadsKanban() {
  const { user } = useUser()
  const [view, setView] = useState<View>('minhas')
  const readOnly = view === 'referenciadas'

  const [entries, setEntries] = useState<LeadEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<ColumnKey | null>(null)
  const [qualifyEntry, setQualifyEntry] = useState<any | null>(null)
  const [lostEntry, setLostEntry] = useState<LeadEntry | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Multi-select → bulk "Referenciar" (Minhas view only).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [referOpen, setReferOpen] = useState(false)

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const url =
        view === 'referenciadas'
          ? `/api/lead-entries?scope=referred&status=${ALL_STATUSES}&limit=300`
          : `/api/lead-entries?status=${ALL_STATUSES}&limit=300`
      const res = await fetch(url)
      const json = await res.json()
      setEntries(Array.isArray(json.data) ? json.data : [])
    } catch {
      toast.error('Erro ao carregar leads.')
    } finally {
      setLoading(false)
    }
  }, [view])

  // Refetch on mount + view change, and when entry referrals change elsewhere
  // (so the Referenciadas view stays in sync after a bulk referral).
  useEffect(() => {
    fetchEntries()
    return subscribe('referrals', fetchEntries)
  }, [fetchEntries])

  // Drop selected ids that no longer exist so the floating bar never counts ghosts.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const live = new Set(entries.map((e) => e.id))
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (live.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [entries])

  const switchView = useCallback((v: View) => {
    setView(v)
    setSelectedIds(new Set())
  }, [])

  const byColumn = useMemo(() => {
    const map: Record<ColumnKey, LeadEntry[]> = { novo: [], contactado: [], qualificado: [], perdido: [] }
    for (const e of entries) {
      const col = COLUMNS.find((c) => c.statuses.includes(e.status))
      if (col) map[col.key].push(e)
    }
    return map
  }, [entries])

  async function patchStatus(id: string, status: string, extra?: Record<string, unknown>) {
    const res = await fetch(`/api/lead-entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extra }),
    })
    if (!res.ok) throw new Error('patch_failed')
  }

  function onDropToColumn(col: Column) {
    setOverCol(null)
    const id = dragId
    setDragId(null)
    if (!id) return
    const entry = entries.find((e) => e.id === id)
    if (!entry || col.statuses.includes(entry.status)) return

    if (col.qualify) {
      setQualifyEntry(entry)
      return
    }
    if (col.lost) {
      setLostEntry(entry)
      return
    }
    void moveStatus(id, col.setStatus!)
  }

  async function moveStatus(id: string, status: string, extra?: Record<string, unknown>) {
    const prev = entries
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, status } : e)))
    try {
      await patchStatus(id, status, extra)
      invalidate('lead-entries')
    } catch {
      setEntries(prev)
      toast.error('Não foi possível mover o lead.')
    }
  }

  async function confirmLost(reason: string, notes?: string) {
    if (!lostEntry) return
    const id = lostEntry.id
    setLostEntry(null)
    await moveStatus(id, 'discarded', { lost_reason: reason, lost_notes: notes })
  }

  // Cancel a referral I made (Referenciadas view). Returns the lead to me.
  const cancelReferral = useCallback(
    async (entry: LeadEntry) => {
      const ref = entry.referrals?.find(
        (r) => r.from_consultant_id === user?.id && r.status !== 'cancelled',
      )
      if (!ref) {
        toast.error('Referência não encontrada')
        return
      }
      setCancellingId(entry.id)
      try {
        const res = await fetch(`/api/crm/referrals/${ref.id}`, { method: 'DELETE' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Erro ao cancelar')
        toast.success('Referência cancelada — a lead voltou para ti')
        invalidate(['lead-entries', 'referrals'])
        fetchEntries()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao cancelar a referência')
      } finally {
        setCancellingId(null)
      }
    },
    [user?.id, fetchEntries],
  )

  return (
    <>
      {/* Minhas / Referenciadas toggle */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="bg-muted inline-flex items-center gap-0.5 rounded-full p-0.5">
          {(['minhas', 'referenciadas'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => switchView(v)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                view === v
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v === 'minhas' ? 'Minhas' : 'Referenciadas'}
            </button>
          ))}
        </div>
        {readOnly && (
          <span className="text-muted-foreground text-[11px]">
            Leads que referenciaste a outros consultores — vê em que fase estão.
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar leads…
        </div>
      ) : readOnly && entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Send className="text-muted-foreground/30 h-10 w-10" />
          <p className="text-sm font-medium">Ainda não referenciaste nenhuma lead</p>
          <p className="text-muted-foreground max-w-xs text-xs">
            Em &quot;Minhas&quot;, seleciona uma ou mais leads e usa &quot;Referenciar&quot; para as enviar a um colega.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {COLUMNS.map((col) => {
              const items = byColumn[col.key]
              return (
                <div
                  key={col.key}
                  className="flex w-[270px] min-w-[270px] flex-shrink-0 flex-col"
                  onDragOver={
                    readOnly
                      ? undefined
                      : (e) => {
                          e.preventDefault()
                          setOverCol(col.key)
                        }
                  }
                  onDragLeave={readOnly ? undefined : () => setOverCol((c) => (c === col.key ? null : c))}
                  onDrop={readOnly ? undefined : () => onDropToColumn(col)}
                >
                  {/* Header — gradient + accent bar (Oportunidades language) */}
                  <div
                    className={cn(
                      'relative flex items-center justify-between gap-2 overflow-hidden px-3 py-2.5',
                      'rounded-t-2xl border border-b-0 border-border/30 backdrop-blur-sm',
                      overCol === col.key && 'ring-2 ring-primary ring-offset-0',
                    )}
                    style={{ backgroundImage: `linear-gradient(to bottom right, ${col.color}33, transparent)` }}
                  >
                    <span
                      className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full"
                      style={{ backgroundColor: col.color }}
                    />
                    <div className="inline-flex min-w-0 items-center gap-1.5 pl-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: col.color }} />
                      <span className="truncate text-xs font-semibold">{col.label}</span>
                    </div>
                    <span
                      className="inline-flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ring-1 ring-inset"
                      style={{ backgroundColor: `${col.color}26`, color: col.color, boxShadow: `inset 0 0 0 1px ${col.color}33` }}
                    >
                      {items.length}
                    </span>
                  </div>

                  {/* Cards area */}
                  <div
                    className={cn(
                      'flex-1 space-y-2 rounded-b-2xl border border-t-0 border-border/30 bg-muted/20 p-2 shadow-lg',
                      'min-h-[60vh] transition-colors duration-200',
                      overCol === col.key && 'border-primary/30 bg-primary/5',
                    )}
                  >
                    {items.length === 0 ? (
                      <div className="text-muted-foreground/60 flex h-20 items-center justify-center text-xs italic">
                        Sem leads
                      </div>
                    ) : (
                      items.map((e) => {
                        if (readOnly) {
                          const myRef = e.referrals?.find(
                            (r) => r.from_consultant_id === user?.id && r.status !== 'cancelled',
                          )
                          const pctRaw = myRef?.referral_pct
                          const pct = typeof pctRaw === 'string' ? parseFloat(pctRaw) : pctRaw ?? null
                          return (
                            <LeadCard
                              key={e.id}
                              entry={e}
                              stageColor={col.color}
                              view="referenciadas"
                              draggable={false}
                              onOpen={() => setSelectedEntryId(e.id)}
                              recipientName={e.assigned_consultant?.commercial_name ?? null}
                              referralPct={pct}
                              cancelling={cancellingId === e.id}
                              onCancel={
                                TERMINAL_STATUSES.includes(e.status) ? undefined : () => cancelReferral(e)
                              }
                            />
                          )
                        }
                        return (
                          <LeadCard
                            key={e.id}
                            entry={e}
                            stageColor={col.color}
                            view="minhas"
                            draggable={!col.qualify}
                            selected={selectedIds.has(e.id)}
                            onToggleSelect={toggleSelect}
                            onDragStart={() => setDragId(e.id)}
                            onOpen={() => setSelectedEntryId(e.id)}
                            onQualify={
                              col.key !== 'qualificado' && col.key !== 'perdido'
                                ? () => setQualifyEntry(e)
                                : undefined
                            }
                          />
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lead detail — same sheet as the Oportunidades page */}
      <LeadEntrySheet
        entryId={selectedEntryId}
        open={!!selectedEntryId}
        onOpenChange={(o) => !o && setSelectedEntryId(null)}
        onQualify={(e) => {
          setSelectedEntryId(null)
          setQualifyEntry(e)
        }}
        onStatusChange={fetchEntries}
      />

      {/* Qualify popup — "what does this person want" → creates the opportunity */}
      <QualifyEntryDialog
        open={!!qualifyEntry}
        onOpenChange={(o) => !o && setQualifyEntry(null)}
        entry={qualifyEntry}
        onQualified={() => {
          setQualifyEntry(null)
          fetchEntries()
        }}
      />

      {/* Lost reason — reused from the negócios board */}
      <LostReasonDialog
        open={!!lostEntry}
        onConfirm={(reason, notes) => confirmLost(reason, notes)}
        onCancel={() => setLostEntry(null)}
      />

      {/* Floating multi-select bar — Minhas view only. "Referenciar" hands the
          selected leads off to a colleague while keeping me as the referrer. */}
      {!readOnly && selectedIds.size > 0 && (
        <div
          className={cn(
            'fixed left-1/2 -translate-x-1/2 z-50',
            'inline-flex items-center gap-2 rounded-full',
            'bg-foreground text-background shadow-2xl',
            'pl-4 pr-2 py-2 animate-in fade-in slide-in-from-bottom-3 duration-200',
          )}
          style={{ bottom: 'calc(var(--mobile-nav-height, 0px) + 1.5rem)' }}
          role="status"
          aria-live="polite"
        >
          <span className="text-sm font-medium tabular-nums">
            {selectedIds.size} {selectedIds.size === 1 ? 'selecionado' : 'selecionados'}
          </span>
          <div className="h-4 w-px bg-background/20" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setReferOpen(true)}
            className="h-7 px-2.5 rounded-full text-background hover:bg-background/15 hover:text-background gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Referenciar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            className="h-7 px-2.5 rounded-full text-background hover:bg-background/15 hover:text-background gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </Button>
        </div>
      )}

      {/* Bulk "Referenciar" — entry referrals (flip assigned_consultant_id to
          the recipient + record my slice via leads_referrals). */}
      <BulkReferralDialog
        open={referOpen}
        onOpenChange={setReferOpen}
        kind="entry"
        ids={Array.from(selectedIds)}
        onDone={() => {
          fetchEntries()
          clearSelection()
          invalidate('lead-entries')
        }}
      />
    </>
  )
}

function LeadCard({
  entry,
  stageColor,
  view,
  draggable,
  selected = false,
  onToggleSelect,
  onDragStart,
  onOpen,
  onQualify,
  recipientName,
  referralPct,
  onCancel,
  cancelling = false,
}: {
  entry: LeadEntry
  stageColor: string
  view: View
  draggable: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
  onDragStart?: () => void
  onOpen: () => void
  onQualify?: () => void
  recipientName?: string | null
  referralPct?: number | null
  onCancel?: () => void
  cancelling?: boolean
}) {
  const name = entry.contact?.nome ?? 'Sem nome'
  const sourceLabel = ENTRY_SOURCE_LABELS[entry.source as keyof typeof ENTRY_SOURCE_LABELS] ?? entry.source
  const selectable = view === 'minhas' && !!onToggleSelect
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={cn(
        'group bg-card relative overflow-hidden rounded-xl border p-2.5 shadow-sm transition-shadow hover:shadow-md',
        draggable && 'cursor-grab active:cursor-grabbing',
        selected && 'shadow-md',
      )}
      style={selected ? { boxShadow: `0 0 0 2px ${stageColor}` } : undefined}
    >
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: stageColor }} />

      {/* Selection checkbox — Minhas view only; revealed on hover or when selected. */}
      {selectable && (
        <button
          type="button"
          draggable={false}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect!(entry.id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={selected ? 'Desmarcar' : 'Selecionar'}
          title={selected ? 'Desmarcar' : 'Selecionar'}
          className={cn(
            'absolute top-1.5 right-1.5 z-10 h-5 w-5 rounded-md flex items-center justify-center transition-all border',
            selected
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 bg-background/95 border-border/60 text-muted-foreground hover:text-foreground hover:bg-background',
          )}
          style={selected ? { backgroundColor: stageColor, borderColor: stageColor, color: '#fff' } : undefined}
        >
          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
      )}

      <button
        onClick={(e) => {
          // Cmd/Ctrl-click toggles selection without opening the lead.
          if (selectable && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            e.stopPropagation()
            onToggleSelect!(entry.id)
            return
          }
          onOpen()
        }}
        className={cn('block w-full pl-1.5 text-left', selectable && 'pr-6')}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-1 text-sm font-medium hover:underline">{name}</span>
          {entry.has_referral && <Gift className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
            {sourceLabel}
          </span>
          {entry.campaign?.name && (
            <span className="text-muted-foreground line-clamp-1 text-[10px]">{entry.campaign.name}</span>
          )}
        </div>
        <div className="text-muted-foreground mt-1.5 flex flex-col gap-0.5 text-[11px]">
          {entry.contact?.telemovel && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {entry.contact.telemovel}
            </span>
          )}
          {entry.contact?.email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span className="line-clamp-1">{entry.contact.email}</span>
            </span>
          )}
        </div>
        <div className="text-muted-foreground/70 mt-1 flex items-center gap-1 text-[10px]">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(entry.created_at), { locale: pt, addSuffix: true })}
        </div>
      </button>

      {/* Minhas: qualify shortcut. */}
      {view === 'minhas' && onQualify && (
        <Button size="sm" variant="outline" className="ml-1.5 mt-2 h-7 text-[11px]" onClick={onQualify}>
          Qualificar
        </Button>
      )}

      {/* Referenciadas: recipient + my slice, and a way to pull it back while pending. */}
      {view === 'referenciadas' && (
        <div className="mt-2 flex items-center justify-between gap-2 pl-1.5">
          <span className="text-foreground/80 inline-flex min-w-0 items-center gap-1 text-[11px]">
            <ArrowRight className="h-3 w-3 shrink-0 text-sky-600 dark:text-sky-400" />
            <span className="truncate">{recipientName || 'Consultor'}</span>
            {referralPct != null && Number.isFinite(referralPct) && (
              <span className="shrink-0 font-medium tabular-nums text-sky-600 dark:text-sky-400">
                · {referralPct}%
              </span>
            )}
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              title="Cancelar a referência (a lead volta para ti)"
              className="bg-muted/60 text-foreground/80 hover:bg-muted hover:text-foreground inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Undo2 className="h-3 w-3" />
              {cancelling ? '…' : 'Cancelar'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
