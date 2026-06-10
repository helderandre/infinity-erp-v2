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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Phone, Mail, Clock, Gift, Check, Send, X, Undo2, ArrowRight, Search, SlidersHorizontal, Kanban as KanbanIcon, List, Plus, Briefcase, Sparkles, MoveRight, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ENTRY_SOURCE_LABELS } from '@/lib/constants-leads-crm'
import { QualifyEntryDialog } from '@/components/crm/qualify-entry-dialog'
import { NegocioDetailSheet } from '@/components/crm/negocio-detail-sheet'
import { LostReasonDialog } from '@/components/crm/lost-reason-dialog'
import { BulkReferralDialog } from '@/components/crm/bulk-referral-dialog'
import { invalidate, subscribe } from '@/lib/crm/invalidator'
import { LeadEntrySheet } from '@/components/leads/lead-entry-sheet'
import { LeadEntryDialog } from '@/components/leads/lead-entry-dialog'
import { LeadEditSheet } from '@/components/leads/lead-edit-sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SourceBadge } from '@/components/leads/source-badge'
import { PhaseTabs, type PhaseTab } from '@/components/leads/phase-tabs'
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
  /** For source='portal', form_data.portal holds the portal slug. */
  form_data?: { portal?: string | null } | null
  has_referral?: boolean
  /** Set quando a entry é arrastada para "Perdido" (status='discarded'). */
  lost_reason?: string | null
  contact?: { id: string; nome: string | null; telemovel: string | null; email: string | null } | null
  campaign?: { id: string; name: string | null } | null
  /** The opportunity generated when this entry was qualified (reverse embed
   *  of negocios.entry_id). Present only on converted entries. */
  deal?: { id: string; pipeline_stage_id: string | null }[] | null
  assigned_consultant?: { id: string; commercial_name: string | null } | null
  referrals?: ReferralLite[] | null
}

interface LeadsKanbanProps {
  /**
   * Optional controlled view. When provided, the kanban hides its internal
   * Minhas/Referenciadas toggle and follows the parent's state — used when
   * the toggle is lifted to the page hero (see app/dashboard/crm/leads/page.tsx).
   */
  view?: View
  onViewChange?: (v: View) => void
  /**
   * Surface a Consultor filter in the filters popover (client-side, derived
   * from the loaded entries' assigned_consultant). Used by the Parceiros app
   * so a partner can narrow their referred leads to a single recipient
   * consultor. Off by default → the main ERP leads page is unaffected.
   */
  showConsultantFilter?: boolean
  /**
   * Emits the novo/contactado/qualificado counts computed from the currently
   * filtered entries. Lets a parent (e.g. the Parceiros leads hero) show KPI
   * figures that track the active filters instead of the raw totals.
   */
  onFilteredCountsChange?: (counts: { novo: number; contactado: number; qualificado: number }) => void
  /**
   * Referenciadas view only: when provided, qualified referred cards show a
   * "Ver oportunidade" button that calls this with the generated négocio id.
   * Used by the Parceiros portal to send the partner to their Oportunidades
   * board (the surface where they're allowed to see the deal). The main ERP
   * omits it because a referrer can't open the négocio detail directly.
   */
  onOpenReferredDeal?: (dealId: string) => void
  /**
   * Referenciadas view: whether to show the "Cancelar" action that pulls a
   * still-pending referral back to the referrer. On by default for the main
   * ERP; the Parceiros app sets it false (a partner can't reclaim a lead).
   */
  allowCancelReferral?: boolean
}

export function LeadsKanban({
  view: controlledView,
  onViewChange,
  showConsultantFilter = false,
  onFilteredCountsChange,
  onOpenReferredDeal,
  allowCancelReferral = true,
}: LeadsKanbanProps = {}) {
  const { user } = useUser()
  const [internalView, setInternalView] = useState<View>('minhas')
  const view = controlledView ?? internalView
  const setView = onViewChange ?? setInternalView
  const isControlled = controlledView !== undefined
  const readOnly = view === 'referenciadas'

  const [entries, setEntries] = useState<LeadEntry[]>([])
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('')
  // Consultor filter (Parceiros only — see showConsultantFilter). Holds the
  // assigned_consultant id; client-side, so it just narrows the loaded set.
  const [consultantFilter, setConsultantFilter] = useState<string>('')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [newOpen, setNewOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<ColumnKey | null>(null)
  const [qualifyEntry, setQualifyEntry] = useState<any | null>(null)
  const [lostEntry, setLostEntry] = useState<LeadEntry | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  // Opportunity (négocio) detail — opened in place from a qualified card or the
  // post-qualify toast, so the consultant stays on the pipeline instead of
  // bouncing to the contact's négocio page.
  const [dealSheetId, setDealSheetId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  // Edit / delete the underlying contact from a card. `editDeleteMode` jumps the
  // sheet straight to the delete confirmation (card "Eliminar" action).
  const [editEntry, setEditEntry] = useState<LeadEntry | null>(null)
  const [editDeleteMode, setEditDeleteMode] = useState(false)

  // ── Mobile long-press → toggle selection (same as the desktop checkbox). ──
  const lpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lpStartRef = useRef<{ x: number; y: number } | null>(null)
  const suppressOpenRef = useRef(false)

  // Multi-select → bulk "Mover" / "Referenciar" (Minhas view only).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [referOpen, setReferOpen] = useState(false)
  const [bulkLostOpen, setBulkLostOpen] = useState(false)

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
  }, [setView])

  // When the page lifts the view, clear selection on view change too.
  useEffect(() => {
    if (isControlled) setSelectedIds(new Set())
  }, [view, isControlled])

  // Pesquisa + filtros client-side (nome/email/telefone + origem + consultor).
  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((e) => {
      if (sourceFilter && e.source !== sourceFilter) return false
      if (consultantFilter && e.assigned_consultant?.id !== consultantFilter) return false
      if (!q) return true
      const c = e.contact
      return (
        (c?.nome?.toLowerCase().includes(q) ?? false) ||
        (c?.email?.toLowerCase().includes(q) ?? false) ||
        (c?.telemovel?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [entries, search, sourceFilter, consultantFilter])

  // Origens presentes nas entries carregadas — alimenta o filtro de Origem.
  const availableSources = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) if (e.source) set.add(e.source)
    return Array.from(set)
  }, [entries])

  // Consultores presentes nas entries carregadas — alimenta o filtro de
  // Consultor (Parceiros). Deriva da própria data para não expor staff alheio.
  const availableConsultants = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) {
      const c = e.assigned_consultant
      if (c?.id) map.set(c.id, c.commercial_name ?? 'Consultor')
    }
    return Array.from(map, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [entries])

  // Emit filtered counts upward (Parceiros hero KPIs track the filters).
  useEffect(() => {
    if (!onFilteredCountsChange) return
    let novo = 0, contactado = 0, qualificado = 0
    for (const e of filteredEntries) {
      if (e.status === 'new' || e.status === 'seen') novo++
      else if (e.status === 'processing') contactado++
      else if (e.status === 'converted') qualificado++
    }
    onFilteredCountsChange({ novo, contactado, qualificado })
  }, [filteredEntries, onFilteredCountsChange])

  const hasActiveFilters = search.trim() !== '' || sourceFilter !== '' || consultantFilter !== ''
  const clearFilters = useCallback(() => {
    setSearch('')
    setSourceFilter('')
    setConsultantFilter('')
  }, [])

  const byColumn = useMemo(() => {
    const map: Record<ColumnKey, LeadEntry[]> = { novo: [], contactado: [], qualificado: [], perdido: [] }
    for (const e of filteredEntries) {
      const col = COLUMNS.find((c) => c.statuses.includes(e.status))
      if (col) map[col.key].push(e)
    }
    return map
  }, [filteredEntries])

  async function patchStatus(id: string, status: string, extra?: Record<string, unknown>) {
    const res = await fetch(`/api/lead-entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extra }),
    })
    if (!res.ok) throw new Error('patch_failed')
  }

  function applyDrop(col: Column, id: string) {
    const entry = entries.find((e) => e.id === id)
    if (!entry || col.statuses.includes(entry.status)) return
    if (col.qualify) { setQualifyEntry(entry); return }
    if (col.lost) { setLostEntry(entry); return }
    void moveStatus(id, col.setStatus!)
  }

  function onDropToColumn(col: Column) {
    setOverCol(null)
    const id = dragId
    setDragId(null)
    if (!id) return
    applyDrop(col, id)
  }

  // ── Long-press a card to toggle its selection (mobile = desktop checkbox).
  //    A quick tap still opens the lead; a scroll cancels the press. ──
  const startLongPress = useCallback((id: string) => (e: React.TouchEvent) => {
    if (readOnly) return
    const t = e.touches[0]
    lpStartRef.current = { x: t.clientX, y: t.clientY }
    if (lpTimerRef.current) clearTimeout(lpTimerRef.current)
    lpTimerRef.current = setTimeout(() => {
      toggleSelect(id)
      suppressOpenRef.current = true
      setTimeout(() => { suppressOpenRef.current = false }, 400)
      try { navigator.vibrate?.(15) } catch {}
      lpTimerRef.current = null
    }, 500)
  }, [readOnly, toggleSelect])

  const moveLongPress = useCallback((e: React.TouchEvent) => {
    const s = lpStartRef.current
    if (!s || !lpTimerRef.current) return
    const t = e.touches[0]
    if (Math.abs(t.clientX - s.x) > 10 || Math.abs(t.clientY - s.y) > 10) {
      clearTimeout(lpTimerRef.current)
      lpTimerRef.current = null
    }
  }, [])

  const endLongPress = useCallback(() => {
    if (lpTimerRef.current) { clearTimeout(lpTimerRef.current); lpTimerRef.current = null }
  }, [])

  // ── Bulk move the selected cards to a stage at once. ──
  async function bulkMove(status: string, extra?: Record<string, unknown>) {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const prev = entries
    const lostReason = typeof extra?.lost_reason === 'string' ? extra.lost_reason : undefined
    setEntries((es) =>
      es.map((e) =>
        ids.includes(e.id)
          ? { ...e, status, ...(lostReason !== undefined ? { lost_reason: lostReason } : {}) }
          : e,
      ),
    )
    clearSelection()
    try {
      await Promise.all(ids.map((id) => patchStatus(id, status, extra)))
      invalidate('lead-entries')
      toast.success(`${ids.length} lead${ids.length === 1 ? '' : 's'} movida${ids.length === 1 ? '' : 's'}`)
    } catch {
      setEntries(prev)
      toast.error('Não foi possível mover as leads.')
    }
  }

  async function moveStatus(id: string, status: string, extra?: Record<string, unknown>) {
    const prev = entries
    // Reflecte o motivo na entry para o chip aparecer de imediato, sem
    // esperar por um refetch.
    const lostReason =
      typeof extra?.lost_reason === 'string' ? (extra.lost_reason as string) : undefined
    setEntries((es) =>
      es.map((e) =>
        e.id === id
          ? { ...e, status, ...(lostReason !== undefined ? { lost_reason: lostReason } : {}) }
          : e,
      ),
    )
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
      {/* Minhas / Referenciadas toggle — hidden when the page lifts the view. */}
      {!isControlled && (
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
      )}

      {/* Filtros + vista + Novo — mesmo padrão da página Oportunidades. */}
      <div className="mb-3 flex items-center gap-1.5 flex-wrap sm:flex-nowrap sm:justify-end">
        {/* Pesquisa */}
        <div className="relative flex-1 min-w-[140px] sm:flex-initial sm:w-[220px]">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2" />
          <Input
            placeholder="Pesquisar por nome, email ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-7 rounded-full h-8 text-xs bg-card/90 backdrop-blur-sm border border-border/30 shadow-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2"
              aria-label="Limpar pesquisa"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filtros popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="relative shrink-0 inline-flex items-center justify-center sm:gap-1.5 h-8 w-8 sm:w-auto sm:px-3 rounded-full bg-card/90 backdrop-blur-sm border border-border/30 shadow-sm text-xs text-muted-foreground hover:bg-card transition-colors"
              aria-label="Filtros"
            >
              <SlidersHorizontal className="h-3 w-3 text-muted-foreground" />
              <span className="hidden sm:inline">Filtros</span>
              {hasActiveFilters && (
                <span className="absolute sm:static -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sky-400 ring-2 ring-background sm:ring-0" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3 space-y-3">
            {showConsultantFilter && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Consultor</p>
                <Select
                  value={consultantFilter || 'all'}
                  onValueChange={(v) => setConsultantFilter(v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="h-9 w-full rounded-full text-xs">
                    <SelectValue placeholder="Todos os consultores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os consultores</SelectItem>
                    {availableConsultants.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Origem</p>
              <Select
                value={sourceFilter || 'all'}
                onValueChange={(v) => setSourceFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="h-9 w-full rounded-full text-xs">
                  <SelectValue placeholder="Qualquer origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer origem</SelectItem>
                  {availableSources.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ENTRY_SOURCE_LABELS[s as keyof typeof ENTRY_SOURCE_LABELS] ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="rounded-full text-xs w-full h-8 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar filtros
              </Button>
            )}
          </PopoverContent>
        </Popover>

        {/* Toggle Kanban / Lista */}
        <div className="inline-flex shrink-0 items-center gap-0.5 p-0.5 rounded-full bg-card/90 backdrop-blur-sm border border-border/30 shadow-sm">
          <button
            onClick={() => setViewMode('kanban')}
            aria-label="Kanban"
            className={cn(
              'inline-flex items-center justify-center sm:gap-1 h-7 w-7 sm:w-auto sm:px-2.5 rounded-full text-[11px] font-medium transition-colors duration-300',
              viewMode === 'kanban'
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            <KanbanIcon className="h-3 w-3" />
            <span className="hidden sm:inline">Kanban</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            aria-label="Lista"
            className={cn(
              'inline-flex items-center justify-center sm:gap-1 h-7 w-7 sm:w-auto sm:px-2.5 rounded-full text-[11px] font-medium transition-colors duration-300',
              viewMode === 'list'
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            <List className="h-3 w-3" />
            <span className="hidden sm:inline">Lista</span>
          </button>
        </div>

        {/* + Novo lead — apenas no modo Minhas. */}
        {!readOnly && (
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="shrink-0 inline-flex items-center justify-center gap-1 h-8 px-2.5 sm:px-3 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[11px] font-semibold shadow-md ring-1 ring-black/5 hover:bg-neutral-800 dark:hover:bg-white/90 transition-colors"
            aria-label="Novo lead"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span className="hidden sm:inline">Novo</span>
          </button>
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
      ) : viewMode === 'list' ? (
        <LeadEntriesList
          entries={filteredEntries}
          onOpen={(id) => setSelectedEntryId(id)}
        />
      ) : (
        <div className="rounded-3xl border border-border/40 bg-card/40 supports-[backdrop-filter]:bg-card/30 backdrop-blur-xl shadow-sm overflow-x-auto p-3">
          <div className="flex min-w-max gap-3">
            {COLUMNS.map((col) => {
              const items = byColumn[col.key]
              const isOver = overCol === col.key
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
                      isOver && 'ring-2 ring-primary ring-offset-0',
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
                      isOver && 'border-primary/30 bg-primary/5',
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
                          // Qualified referred lead → let the partner jump to the
                          // opportunity it generated (opt-in via onOpenReferredDeal).
                          const refDealId = e.deal?.[0]?.id ?? null
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
                                allowCancelReferral && !TERMINAL_STATUSES.includes(e.status)
                                  ? () => cancelReferral(e)
                                  : undefined
                              }
                              dealId={onOpenReferredDeal ? refDealId : null}
                              onOpenDeal={
                                onOpenReferredDeal && refDealId
                                  ? () => onOpenReferredDeal(refDealId)
                                  : undefined
                              }
                            />
                          )
                        }
                        const dealId = e.deal?.[0]?.id ?? null
                        return (
                          <LeadCard
                            key={e.id}
                            entry={e}
                            stageColor={col.color}
                            view="minhas"
                            draggable={!col.qualify}
                            selected={selectedIds.has(e.id)}
                            selectionActive={selectedIds.size > 0}
                            onToggleSelect={toggleSelect}
                            onDragStart={() => setDragId(e.id)}
                            onTouchStart={startLongPress(e.id)}
                            onTouchMove={moveLongPress}
                            onTouchEnd={endLongPress}
                            onOpen={() => {
                              if (suppressOpenRef.current) return
                              // In selection mode, a tap toggles selection
                              // instead of opening the lead.
                              if (selectedIds.size > 0) { toggleSelect(e.id); return }
                              setSelectedEntryId(e.id)
                            }}
                            dealId={dealId}
                            onOpenDeal={dealId ? () => setDealSheetId(dealId) : undefined}
                            onEdit={e.contact ? () => { setEditDeleteMode(false); setEditEntry(e) } : undefined}
                            onDelete={e.contact ? () => { setEditDeleteMode(true); setEditEntry(e) } : undefined}
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
        onViewOpportunity={(negocioId) => setDealSheetId(negocioId)}
      />

      {/* Opportunity detail — same sheet as the Oportunidades pipeline, opened
          in place from a qualified card / the post-qualify toast. */}
      <NegocioDetailSheet
        negocioId={dealSheetId}
        open={!!dealSheetId}
        onOpenChange={(o) => !o && setDealSheetId(null)}
        onChanged={fetchEntries}
      />

      {/* Lost reason — reused from the negócios board */}
      <LostReasonDialog
        open={!!lostEntry}
        onConfirm={(reason, notes) => confirmLost(reason, notes)}
        onCancel={() => setLostEntry(null)}
      />

      {/* Editar / Eliminar contacto directamente do card. Edita/apaga o
          contacto via /api/leads/[id] (auth: dono ou gestão). Ao apagar,
          refrescamos o board em vez de navegar para fora. */}
      {editEntry?.contact && (
        <LeadEditSheet
          open={!!editEntry}
          onOpenChange={(o) => { if (!o) { setEditEntry(null); setEditDeleteMode(false) } }}
          lead={editEntry.contact as any}
          openDeleteOnMount={editDeleteMode}
          onSaved={() => { setEditEntry(null); fetchEntries() }}
          onDeleted={() => { setEditEntry(null); setEditDeleteMode(false); fetchEntries() }}
        />
      )}

      {/* Floating multi-select bar — Minhas view only. "Referenciar" hands the
          selected leads off to a colleague while keeping me as the referrer. */}
      {!readOnly && selectedIds.size > 0 && (
        <div
          className={cn(
            'fixed left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-1rem)]',
            'inline-flex items-center gap-0.5 sm:gap-1 rounded-full',
            'bg-foreground text-background shadow-2xl',
            'pl-3 pr-1.5 sm:pl-4 sm:pr-2 py-1.5 sm:py-2 animate-in fade-in slide-in-from-bottom-3 duration-200',
          )}
          style={{ bottom: 'calc(var(--mobile-nav-height, 0px) + 1.5rem)' }}
          role="status"
          aria-live="polite"
        >
          <span className="text-xs sm:text-sm font-medium tabular-nums whitespace-nowrap pr-1">
            {selectedIds.size}<span className="hidden sm:inline"> {selectedIds.size === 1 ? 'selecionado' : 'selecionados'}</span>
          </span>
          <div className="h-4 w-px bg-background/20 shrink-0" />
          {/* Mover — bulk move all selected to a stage. */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 sm:px-2.5 rounded-full text-background hover:bg-background/15 hover:text-background gap-1.5"
              >
                <MoveRight className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Mover</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="center" side="top" className="w-44 p-1.5">
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Mover para</p>
              {COLUMNS.filter((c) => !c.qualify).map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => { if (c.lost) setBulkLostOpen(true); else bulkMove(c.setStatus!) }}
                  className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium hover:bg-muted/60 transition-colors"
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  {c.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setReferOpen(true)}
            className="h-7 px-2 sm:px-2.5 rounded-full text-background hover:bg-background/15 hover:text-background gap-1.5"
          >
            <Send className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Referenciar</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            className="h-7 px-2 sm:px-2.5 rounded-full text-background hover:bg-background/15 hover:text-background gap-1.5"
          >
            <X className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Cancelar</span>
          </Button>
        </div>
      )}

      {/* Bulk "Perdido" — one shared reason applied to all selected. */}
      <LostReasonDialog
        open={bulkLostOpen}
        onConfirm={(reason, notes) => { setBulkLostOpen(false); bulkMove('discarded', { lost_reason: reason, lost_notes: notes }) }}
        onCancel={() => setBulkLostOpen(false)}
      />

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

      {/* Novo lead — mesmo formulário rico do Registar Lead (quick actions). */}
      <LeadEntryDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onComplete={() => {
          setNewOpen(false)
          fetchEntries()
          invalidate('lead-entries')
        }}
      />
    </>
  )
}

// ─── List view ──────────────────────────────────────────────────────────────

const STATUS_TO_COLUMN: Record<string, Column> = COLUMNS.reduce((acc, col) => {
  for (const s of col.statuses) acc[s] = col
  return acc
}, {} as Record<string, Column>)

const PHASE_ICONS: Record<ColumnKey, PhaseTab['Icon']> = {
  novo: Sparkles,
  contactado: Phone,
  qualificado: Check,
  perdido: X,
}

function LeadEntriesList({
  entries,
  onOpen,
}: {
  entries: LeadEntry[]
  onOpen: (id: string) => void
}) {
  const [tab, setTab] = useState<ColumnKey>('novo')

  const byPhase = useMemo(() => {
    const map: Record<ColumnKey, LeadEntry[]> = { novo: [], contactado: [], qualificado: [], perdido: [] }
    for (const e of entries) {
      const col = COLUMNS.find((c) => c.statuses.includes(e.status))
      if (col) map[col.key].push(e)
    }
    return map
  }, [entries])

  const tabs: PhaseTab[] = COLUMNS.map((c) => ({
    key: c.key,
    label: c.label,
    color: c.color,
    Icon: PHASE_ICONS[c.key],
    count: byPhase[c.key].length,
  }))

  const items = byPhase[tab] ?? []

  if (entries.length === 0) {
    return (
      <div className="space-y-3">
        <PhaseTabs tabs={tabs} active={tab} onChange={(k) => setTab(k as ColumnKey)} />
        <div className="rounded-2xl border border-dashed border-border/50 bg-card/40 py-12 text-center">
          <p className="text-sm font-medium">Nenhuma lead encontrada</p>
          <p className="text-muted-foreground mt-1 text-xs">Ajusta a pesquisa ou os filtros.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
    <PhaseTabs tabs={tabs} active={tab} onChange={(k) => setTab(k as ColumnKey)} />

    {items.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-border/50 bg-card/40 py-10 text-center">
        <p className="text-muted-foreground text-xs italic">Sem leads em «{COLUMNS.find((c) => c.key === tab)?.label}»</p>
      </div>
    ) : (
    <>
    {/* Mobile — compact card list (same info as the kanban card). */}
    <div className="md:hidden space-y-2">
      {items.map((e) => {
        const col = STATUS_TO_COLUMN[e.status]
        const color = col?.color || '#64748b'
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onOpen(e.id)}
            className="w-full text-left rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-3 pl-3.5 shadow-sm transition-shadow active:shadow-md"
            style={{ boxShadow: `inset 3px 0 0 0 ${color}` }}
          >
            <div className="flex items-center justify-between gap-2">
              <SourceBadge source={e.source} portal={e.form_data?.portal} />
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium shrink-0"
                style={{ backgroundColor: `${color}26`, color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                {col?.label ?? e.status}
              </span>
            </div>
            <p className="mt-2.5 text-[13px] font-semibold leading-snug truncate">{e.contact?.nome ?? 'Sem nome'}</p>
            <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[11px]">
              <Clock className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate">{formatDistanceToNow(new Date(e.created_at), { locale: pt, addSuffix: true })}</span>
            </div>
          </button>
        )
      })}
    </div>

    {/* Desktop — table */}
    <div className="hidden md:block rounded-3xl border border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="border-b border-border/40">
            <th className="text-left px-5 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Nome</th>
            <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
            <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Origem</th>
            <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Contacto</th>
            <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Data</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => {
            const col = STATUS_TO_COLUMN[e.status]
            const color = col?.color || '#64748b'
            const sourceLabel = ENTRY_SOURCE_LABELS[e.source as keyof typeof ENTRY_SOURCE_LABELS] ?? e.source
            return (
              <tr
                key={e.id}
                className="border-b border-border/30 cursor-pointer transition-colors hover:bg-[var(--row-hover)]"
                onClick={() => onOpen(e.id)}
                style={{
                  boxShadow: `inset 3px 0 0 0 ${color}`,
                  ['--row-hover' as never]: `${color}10`,
                }}
              >
                <td className="px-5 py-3 font-medium">{e.contact?.nome ?? 'Sem nome'}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: `${color}26`, color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                    {col?.label ?? e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{sourceLabel}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  <div className="flex items-center gap-2">
                    {e.contact?.telemovel && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{e.contact.telemovel}</span>}
                    {e.contact?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /><span className="line-clamp-1 max-w-[180px]">{e.contact.email}</span></span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {format(new Date(e.created_at), 'd MMM yyyy', { locale: pt })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
    )}
    </div>
  )
}

// ─── New lead entry dialog ────────────────────────────────────────────────────

function LeadCard({
  entry,
  stageColor,
  view,
  draggable,
  selected = false,
  selectionActive = false,
  onToggleSelect,
  onDragStart,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onOpen,
  recipientName,
  referralPct,
  onCancel,
  cancelling = false,
  dealId,
  onOpenDeal,
  onEdit,
  onDelete,
}: {
  entry: LeadEntry
  stageColor: string
  view: View
  draggable: boolean
  selected?: boolean
  /** Some card in the board is selected — show the checkbox so taps can
   *  toggle selection (mobile multi-select affordance). */
  selectionActive?: boolean
  onToggleSelect?: (id: string) => void
  onDragStart?: () => void
  onTouchStart?: (e: React.TouchEvent) => void
  onTouchMove?: (e: React.TouchEvent) => void
  onTouchEnd?: () => void
  onOpen: () => void
  recipientName?: string | null
  referralPct?: number | null
  onCancel?: () => void
  cancelling?: boolean
  /** Set on qualified (converted) entries — the opportunity they generated. */
  dealId?: string | null
  onOpenDeal?: () => void
  /** Editar / eliminar o contacto desta lead (só "minhas"). */
  onEdit?: () => void
  onDelete?: () => void
}) {
  const name = entry.contact?.nome ?? 'Sem nome'
  const selectable = view === 'minhas' && !!onToggleSelect
  const hasMenu = !!(onEdit || onDelete)
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={cn(
        'group bg-card relative overflow-hidden rounded-xl border p-3 shadow-sm transition-all hover:shadow-md',
        draggable && 'cursor-grab active:cursor-grabbing',
        selected && 'shadow-md ring-2 ring-primary',
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
              : selectionActive
                ? 'opacity-100 bg-background/95 border-border/60 text-muted-foreground'
                : 'opacity-0 group-hover:opacity-100 bg-background/95 border-border/60 text-muted-foreground hover:text-foreground hover:bg-background',
          )}
          style={selected ? { backgroundColor: stageColor, borderColor: stageColor, color: '#fff' } : undefined}
        >
          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
      )}

      {/* ⋯ menu — Editar / Eliminar o contacto desta lead (só "minhas"). */}
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="Mais acções"
              title="Editar ou eliminar"
              className={cn(
                'absolute top-1.5 right-8 z-20 h-5 w-5 rounded-md flex items-center justify-center border bg-background/95 border-border/60 text-muted-foreground transition-all hover:text-foreground hover:bg-background data-[state=open]:opacity-100',
                // Hover-reveal on desktop; in selection mode (mobile long-press)
                // show it beside the checkbox without needing hover.
                (selectionActive || selected) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
            >
              <MoreVertical className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit() }}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={(e) => { e.stopPropagation(); onDelete() }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
        className={cn('block w-full pl-2 text-left', selectable && 'pr-6', hasMenu && 'pr-14')}
      >
        {/* Top: company/portal icon + origin tag in its colour. */}
        <div className="flex items-center justify-between gap-2">
          <SourceBadge source={entry.source} portal={entry.form_data?.portal} />
          {entry.has_referral && <Gift className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
        </div>
        {/* Name — primary line. */}
        <p className="mt-2.5 line-clamp-1 text-[13px] font-semibold leading-snug group-hover:underline">{name}</p>
        {/* Time it arrived — secondary line. */}
        <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[11px]">
          <Clock className="h-3 w-3 shrink-0 opacity-70" />
          <span className="truncate">{formatDistanceToNow(new Date(entry.created_at), { locale: pt, addSuffix: true })}</span>
        </div>
        {/* Motivo da perda — chip vermelho quando a lead foi descartada. */}
        {entry.lost_reason && (
          <span className="mt-2 inline-flex max-w-full items-center gap-0.5 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">
            <X className="h-2.5 w-2.5 shrink-0" strokeWidth={3} />
            <span className="line-clamp-1">{entry.lost_reason}</span>
          </span>
        )}
      </button>

      {/* Qualificado: link to the opportunity it generated so the consultant
          can keep accompanying it instead of the lead just sitting here. */}
      {dealId && onOpenDeal && (
        <div className="mt-2 pl-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenDeal()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/25 dark:text-emerald-300"
            title="Abrir a oportunidade gerada por esta lead"
          >
            <Briefcase className="h-3 w-3 shrink-0" />
            Ver oportunidade
            <ArrowRight className="h-3 w-3 shrink-0" />
          </button>
        </div>
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
