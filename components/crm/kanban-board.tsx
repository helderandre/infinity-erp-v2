'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { CheckSquare, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KanbanCard } from '@/components/crm/kanban-card'
import { LostReasonDialog } from '@/components/crm/lost-reason-dialog'
import { BulkActionsMenu, type BulkAction } from '@/components/crm/bulk-actions-menu'
import {
  BulkSendPropertiesDialog,
  type BulkSendNegocio,
} from '@/components/crm/bulk-send-properties-dialog'
import {
  BulkPipelineActionDialog,
  type BulkPipelineMode,
} from '@/components/crm/bulk-pipeline-action-dialog'
import {
  BulkSendMessageDialog,
  type BulkMessageContact,
} from '@/components/crm/bulk-send-message-dialog'
import {
  BulkSendMatchesDialog,
  type BulkMatchTarget,
} from '@/components/crm/bulk-send-matches-dialog'
import {
  BulkCreateTaskDialog,
  type BulkTaskTarget,
} from '@/components/crm/bulk-create-task-dialog'
import { CsvExportDialog } from '@/components/shared/csv-export-dialog'
import { toast } from 'sonner'
import type {
  PipelineType,
  LeadsPipelineStage,
} from '@/types/leads-crm'

interface KanbanBoardType {
  pipeline_type: string
  columns: KanbanColumn[]
  totals: { negocios: number; expected_value: number; weighted_value: number }
}

interface KanbanColumn {
  stage: LeadsPipelineStage
  negocios: any[]
  count: number
  total_value: number
  weighted_value?: number
  total_commission?: number
}

interface KanbanBoardProps {
  pipelineType: PipelineType
  filters?: {
    search?: string
    pipelineStageId?: string
    temperatura?: string
    consultantId?: string
    /**
     * Referências mode: filter négocios where the current user is the
     * referrer (i.e. is owed a commission slice) instead of the assigned
     * consultor. The kanban renders them in their *current owner's* stage
     * columns so the referrer can see where each deal sits.
     */
    referrerConsultantId?: string
    /**
     * Surface only négocios that came in via an internal referral
     * (referrer_consultant_id IS NOT NULL). Used by the Pipeline page's
     * "Só referenciados" toggle.
     */
    onlyReferenced?: boolean
  }
  /**
   * Read-only mode — used by the Referências page where the viewer is the
   * referrer, not the consultor working the deal. Disables drag-to-move
   * stage transitions and the multi-select / bulk-actions surface.
   */
  readOnly?: boolean
  onCardClick?: (negocio: { id: string; lead_id?: string | null; contact_id?: string | null }) => void
  /**
   * Bumping this number triggers a silent re-fetch — used by the parent CRM
   * page after a lead is qualified or added so the new card appears without
   * the user having to refresh.
   */
  refreshKey?: number
  /**
   * Disparado depois de uma mutação com sucesso a partir do board (drag para
   * outra stage, lost reason confirmado, etc.). Permite ao parent invalidar
   * widgets-irmãos (SummaryBar com totais, badges de pipeline, lista) que de
   * outra forma ficariam desactualizados até o user mudar de pipeline.
   */
  onMutated?: () => void
}

const formatEUR = (value: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(value)

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="min-w-[230px] w-[230px] flex-shrink-0 space-y-3">
          <Skeleton className="h-10 w-full rounded-2xl" />
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} className="h-[100px] w-full rounded-2xl" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

interface ColumnProps {
  column: KanbanColumn
  isDragOver: boolean
  onDragOver: (e: React.DragEvent<HTMLDivElement>, stageId: string) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent<HTMLDivElement>, stage: LeadsPipelineStage) => void
  onCardDragStart: (negocioId: string) => void
  onCardClick?: (negocio: { id: string; lead_id?: string | null; contact_id?: string | null }) => void
  // Multi-select bridging
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAllInStage: (stageId: string) => void
  /** Read-only — disables drag/drop + the select-all column toggle. */
  readOnly?: boolean
}

function KanbanColumnView({
  column,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardDragStart,
  onCardClick,
  selectedIds,
  onToggleSelect,
  onToggleSelectAllInStage,
  readOnly = false,
}: ColumnProps) {
  const { stage, negocios, count, total_commission } = column
  // Stage color comes from leads_pipeline_stages.color (hex #RRGGBB) seeded
  // by supabase/migrations/20260426_pipeline_stage_colors.sql. Falls back
  // to a neutral slate for stages without a color set.
  const color = stage.color || '#64748b'

  // Column-level select-all state — three buckets so the icon can show the
  // right indeterminate / checked / unchecked variant.
  const stageSelectionState: 'none' | 'some' | 'all' = useMemo(() => {
    if (negocios.length === 0) return 'none'
    let selected = 0
    for (const n of negocios) if (selectedIds.has(n.id)) selected++
    if (selected === 0) return 'none'
    if (selected === negocios.length) return 'all'
    return 'some'
  }, [negocios, selectedIds])

  return (
    <div
      className="min-w-[230px] w-[230px] flex-shrink-0 flex flex-col"
      onDragOver={readOnly ? undefined : (e) => onDragOver(e, stage.id)}
      onDragLeave={readOnly ? undefined : onDragLeave}
      onDrop={readOnly ? undefined : (e) => onDrop(e, stage)}
    >
      {/* Column header — pastel-gradient + accent bar in stage colour
           (financeiro KpiCard design language). */}
      <div
        className={cn(
          'relative overflow-hidden flex items-center justify-between gap-2 px-3 py-2.5',
          'rounded-t-2xl border border-b-0 border-border/30 backdrop-blur-sm',
          'bg-gradient-to-br to-transparent',
          isDragOver && 'ring-2 ring-primary ring-offset-0',
        )}
        style={{
          backgroundImage: `linear-gradient(to bottom right, ${color}33, transparent)`,
        }}
      >
        {/* Accent bar — full-colour left edge, like FinanceiroKpiCard */}
        <span
          className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full"
          style={{ backgroundColor: color }}
        />

        {/* Stage name + colour dot + terminal badge */}
        <div className="inline-flex items-center gap-1.5 min-w-0 pl-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-semibold truncate">{stage.name}</span>
          {stage.is_terminal && stage.terminal_type && (
            <span
              className={cn(
                'inline-flex items-center text-[9px] h-4 px-1.5 font-medium rounded-full',
                stage.terminal_type === 'won'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-red-500 text-white',
              )}
            >
              {stage.terminal_type === 'won' ? 'Ganho' : 'Perdido'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Select all in this column. Indeterminate state when only
              some are selected — clicking still toggles all on/off. Hidden
              entirely in read-only mode (no bulk surface). */}
          {!readOnly && negocios.length > 0 && (
            <button
              type="button"
              onClick={() => onToggleSelectAllInStage(stage.id)}
              title={
                stageSelectionState === 'all'
                  ? 'Desmarcar todos nesta coluna'
                  : 'Selecionar todos nesta coluna'
              }
              aria-label={
                stageSelectionState === 'all'
                  ? 'Desmarcar todos nesta coluna'
                  : 'Selecionar todos nesta coluna'
              }
              className="h-6 w-6 rounded-md flex items-center justify-center transition-colors hover:bg-foreground/10"
              style={{
                color: stageSelectionState === 'none' ? `${color}88` : color,
              }}
            >
              {stageSelectionState === 'all' ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : stageSelectionState === 'some' ? (
                // Indeterminate: rendered as a filled square of stage colour
                <span
                  className="h-3 w-3 rounded-[3px] ring-1 ring-inset"
                  style={{
                    backgroundColor: `${color}55`,
                    boxShadow: `inset 0 0 0 1px ${color}`,
                  }}
                />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {/* Count chip — tinted with the stage colour */}
          <span
            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full text-[11px] font-bold tabular-nums shrink-0 ring-1 ring-inset"
            style={{
              backgroundColor: `${color}26`,
              color,
              boxShadow: `inset 0 0 0 1px ${color}33`,
            }}
          >
            {count}
          </span>
        </div>
      </div>

      {/* Column commission row — always visible, formatted clearly */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 backdrop-blur-sm border border-y-0 border-border/30">
        <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Comissão</span>
        <span className="text-[11px] font-semibold tabular-nums">{formatEUR(total_commission ?? 0)}</span>
      </div>

      {/* Cards area */}
      <div
        className={cn(
          'flex-1 rounded-b-2xl border border-t-0 border-border/30 bg-muted/20 p-2 space-y-2 shadow-lg',
          'min-h-[120px] transition-colors duration-200',
          isDragOver && 'bg-primary/5 border-primary/30'
        )}
      >
        {negocios.map((negocio) => (
          <KanbanCard
            key={negocio.id}
            negocio={negocio}
            onDragStart={onCardDragStart}
            onClick={onCardClick ? () => onCardClick(negocio) : undefined}
            selected={selectedIds.has(negocio.id)}
            onToggleSelect={readOnly ? undefined : onToggleSelect}
            readOnly={readOnly}
            stageColor={color}
          />
        ))}

        {negocios.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/60 italic">
            Sem negocios
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main board ───────────────────────────────────────────────────────────────

export function KanbanBoard({ pipelineType, filters, onCardClick, refreshKey, onMutated, readOnly = false }: KanbanBoardProps) {
  const [board, setBoard] = useState<KanbanBoardType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Multi-select: lifted to the board so cards from any column can be
  // selected together. Empty Set when no selection is active.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  // Bulk action dialog state — only one is open at a time.
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null)
  // Bulk "marcar perdido" reuses LostReasonDialog with its own state so
  // the single-card drag-to-lost flow stays untouched.
  const [bulkLostOpen, setBulkLostOpen] = useState(false)

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)

  // Lost reason dialog
  const [lostDialog, setLostDialog] = useState<{
    open: boolean
    negocioId: string
    targetStage: LeadsPipelineStage
  } | null>(null)

  const dragLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch board data ──────────────────────────────────────────────────────

  const filterSearch = filters?.search ?? ''
  const filterStage = filters?.pipelineStageId ?? ''
  const filterTemp = filters?.temperatura ?? ''
  const filterConsultant = filters?.consultantId ?? ''
  const filterReferrer = filters?.referrerConsultantId ?? ''
  const filterOnlyReferenced = !!filters?.onlyReferenced

  const fetchBoard = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterConsultant) params.set('assigned_consultant_id', filterConsultant)
      if (filterReferrer) params.set('referrer_consultant_id', filterReferrer)
      if (filterOnlyReferenced) params.set('only_referenced', '1')
      if (filterStage) params.set('pipeline_stage_id', filterStage)
      if (filterTemp) params.set('temperatura', filterTemp)
      if (filterSearch) params.set('search', filterSearch)
      const url = `/api/crm/kanban/${pipelineType}${params.size > 0 ? `?${params}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Erro ao carregar o quadro')
      const data = await res.json()
      setBoard(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [pipelineType, filterSearch, filterStage, filterTemp, filterConsultant, filterReferrer, filterOnlyReferenced])

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

  // ── Multi-select handlers ─────────────────────────────────────────────────

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Toggle every negócio in a stage. If they're all already selected,
  // clears them; otherwise adds the missing ones.
  const toggleSelectAllInStage = useCallback((stageId: string) => {
    setSelectedIds((prev) => {
      const stageNegocios =
        (board?.columns ?? []).find((c) => c.stage.id === stageId)?.negocios ?? []
      if (stageNegocios.length === 0) return prev
      const allSelected = stageNegocios.every((n) => prev.has(n.id))
      const next = new Set(prev)
      if (allSelected) {
        for (const n of stageNegocios) next.delete(n.id)
      } else {
        for (const n of stageNegocios) next.add(n.id)
      }
      return next
    })
  }, [board])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Adapt the raw kanban negocios into the shape the bulk send dialog
  // wants — both the selected subset and the full board (so the dialog
  // can offer "send via that other deal" for contacts with >1 negócio).
  const toBulkNegocio = useCallback((n: any): BulkSendNegocio => {
    const contact = n.contact ?? n.leads ?? n.lead
    return {
      id: n.id,
      lead_id: (n.lead_id ?? n.contact_id ?? contact?.id) ?? null,
      contact_name: contact?.full_name || contact?.nome || 'Sem nome',
      tipo: n.tipo ?? null,
      estado: n.estado ?? null,
      pipeline_stage_name:
        n.leads_pipeline_stages?.name ??
        n.pipeline_stage?.name ??
        n.stage?.name ??
        null,
    }
  }, [])

  const allBulkNegocios = useMemo<BulkSendNegocio[]>(() => {
    if (!board) return []
    const list: BulkSendNegocio[] = []
    for (const c of board.columns) for (const n of c.negocios) list.push(toBulkNegocio(n))
    return list
  }, [board, toBulkNegocio])

  const selectedBulkNegocios = useMemo<BulkSendNegocio[]>(
    () => allBulkNegocios.filter((n) => selectedIds.has(n.id)),
    [allBulkNegocios, selectedIds],
  )

  // Deduped contact list for the bulk-message dialog. One row per
  // unique lead — no duplicate sends when the user selected several
  // cards belonging to the same person. The first matching card's id
  // becomes the `source_negocio_id` so the activity row attaches to a
  // specific deal in the timeline.
  const selectedMessageContacts = useMemo<BulkMessageContact[]>(() => {
    if (!board) return []
    const seen = new Set<string>()
    const list: BulkMessageContact[] = []
    for (const c of board.columns) {
      for (const n of c.negocios) {
        if (!selectedIds.has(n.id)) continue
        const contact = n.contact ?? n.leads ?? n.lead
        const leadId =
          n.lead_id ?? n.contact_id ?? contact?.id ?? null
        if (!leadId || seen.has(leadId)) continue
        seen.add(leadId)
        list.push({
          id: leadId,
          name:
            contact?.full_name ??
            contact?.nome ??
            'Sem nome',
          email: contact?.email ?? null,
          phone: contact?.telemovel ?? contact?.phone ?? null,
          source_negocio_id: n.id,
        })
      }
    }
    return list
  }, [board, selectedIds])

  // The terminal-lost stage of the active pipeline (used by "Marcar perdido").
  const terminalLostStage = useMemo(() => {
    if (!board) return null
    return (
      board.columns.find(
        (c) => c.stage.is_terminal && c.stage.terminal_type === 'lost',
      )?.stage ?? null
    )
  }, [board])

  // All stages of the active pipeline (used by "Mover de fase" picker).
  const pipelineStages = useMemo(() => {
    if (!board) return []
    return board.columns.map((c) => ({
      id: c.stage.id,
      name: c.stage.name,
      color: c.stage.color ?? null,
      is_terminal: c.stage.is_terminal ?? false,
      terminal_type: c.stage.terminal_type ?? null,
    }))
  }, [board])

  const handleBulkAction = useCallback((action: BulkAction) => {
    if (action === 'mark_lost') {
      if (!terminalLostStage) {
        toast.error('Sem fase "Perdido" neste pipeline.')
        return
      }
      setBulkLostOpen(true)
      return
    }
    setBulkAction(action)
  }, [terminalLostStage])

  // Submit bulk "marcar perdido" once the user confirms the LostReasonDialog.
  const handleBulkLostConfirm = useCallback(
    async (reason: string, notes?: string) => {
      setBulkLostOpen(false)
      if (!terminalLostStage || selectedIds.size === 0) return
      try {
        const res = await fetch('/api/crm/negocios/bulk-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            negocio_ids: Array.from(selectedIds),
            patch: {
              pipeline_stage_id: terminalLostStage.id,
              lost_reason: reason,
              lost_notes: notes,
            },
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json?.error ?? 'Falha ao marcar como perdido')
          return
        }
        const okCount = (json.results ?? []).filter((r: any) => r.ok).length
        const failCount = (json.results ?? []).length - okCount
        if (failCount === 0) {
          toast.success(
            `${okCount} ${okCount === 1 ? 'negócio marcado' : 'negócios marcados'} como perdido`,
          )
        } else {
          toast.warning(`${okCount} marcado(s), ${failCount} falhou`)
        }
        fetchBoard({ silent: true })
        clearSelection()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro inesperado')
      }
    },
    [terminalLostStage, selectedIds, fetchBoard, clearSelection],
  )

  // Drop ids that no longer exist (e.g. after a refresh) so the bar
  // doesn't keep counting ghosts.
  useEffect(() => {
    if (selectedIds.size === 0 || !board) return
    const liveIds = new Set<string>()
    for (const c of board.columns) for (const n of c.negocios) liveIds.add(n.id)
    let needsClean = false
    for (const id of selectedIds) {
      if (!liveIds.has(id)) { needsClean = true; break }
    }
    if (!needsClean) return
    setSelectedIds((prev) => {
      const next = new Set<string>()
      for (const id of prev) if (liveIds.has(id)) next.add(id)
      return next
    })
  }, [board, selectedIds])

  // Silent refresh when the parent bumps refreshKey — e.g. after qualifying
  // a lead in MyLeadsSheet. Skips the loading skeleton so the new card just
  // appears in place without a flash.
  const refreshKeyRef = useRef(refreshKey)
  useEffect(() => {
    if (refreshKey === undefined) return
    if (refreshKeyRef.current === refreshKey) return
    refreshKeyRef.current = refreshKey
    fetchBoard({ silent: true })
  }, [refreshKey, fetchBoard])

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, stageId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragLeaveTimerRef.current) clearTimeout(dragLeaveTimerRef.current)
    setDragOverStageId(stageId)
  }

  function handleDragLeave() {
    dragLeaveTimerRef.current = setTimeout(() => {
      setDragOverStageId(null)
    }, 80)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, targetStage: LeadsPipelineStage) {
    e.preventDefault()
    setDragOverStageId(null)

    const negocioId = e.dataTransfer.getData('negocio_id')
    if (!negocioId || !draggedId) return
    setDraggedId(null)

    // BULK PATH — the dragged card is part of an active multi-selection.
    // Move every selected card to the target stage in one shot.
    if (selectedIds.has(negocioId) && selectedIds.size > 1) {
      if (targetStage.is_terminal && targetStage.terminal_type === 'lost') {
        // Re-uses the same LostReasonDialog wired by the menu's "Marcar
        // perdido" action; on confirm it calls bulk-update with the
        // pipeline's terminal-lost stage + reason.
        setBulkLostOpen(true)
        return
      }
      bulkMoveStage(targetStage)
      return
    }

    // SINGLE PATH — original drag behaviour.
    const currentColumn = board?.columns.find((col) =>
      col.negocios.some((n) => n.id === negocioId)
    )
    if (currentColumn?.stage.id === targetStage.id) return

    if (targetStage.is_terminal && targetStage.terminal_type === 'lost') {
      setLostDialog({ open: true, negocioId, targetStage })
    } else {
      moveNegocio(negocioId, targetStage.id)
    }
  }

  // Bulk move every selected card to `targetStage`. Optimistically
  // re-shapes the local board so the cards land in the target column
  // before the server responds; reverts on failure via fetchBoard().
  async function bulkMoveStage(targetStage: LeadsPipelineStage) {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    if (board) {
      const movedNegocios = board.columns
        .flatMap((c) => c.negocios)
        .filter((n) => selectedIds.has(n.id))
        .map((n) => ({ ...n, pipeline_stage_id: targetStage.id }))

      const updatedColumns = board.columns.map((col) => {
        // Strip the selected ids from every column (they're going away).
        const remaining = col.negocios.filter((n) => !selectedIds.has(n.id))
        // Append them onto the target column.
        const next =
          col.stage.id === targetStage.id
            ? [...remaining, ...movedNegocios]
            : remaining
        return { ...col, negocios: next, count: next.length }
      })
      setBoard({ ...board, columns: updatedColumns })
    }

    try {
      const res = await fetch('/api/crm/negocios/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocio_ids: ids,
          patch: { pipeline_stage_id: targetStage.id },
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error ?? 'Falha ao mover')
        fetchBoard()
        return
      }
      const okCount = (json.results ?? []).filter((r: any) => r.ok).length
      const failCount = (json.results ?? []).length - okCount
      if (failCount === 0) {
        toast.success(
          `${okCount} ${okCount === 1 ? 'negócio movido' : 'negócios movidos'}`,
        )
      } else {
        toast.warning(`${okCount} movido(s), ${failCount} falhou`)
        fetchBoard({ silent: true })
      }
      clearSelection()
      onMutated?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao mover')
      fetchBoard()
    }
  }

  // ── Move negocio ──────────────────────────────────────────────────────────

  async function moveNegocio(
    negocioId: string,
    stageId: string,
    lostReason?: string,
    lostNotes?: string
  ) {
    // Optimistic update
    if (board) {
      const updatedColumns = board.columns.map((col) => {
        const hasNegocio = col.negocios.some((n) => n.id === negocioId)
        if (!hasNegocio) {
          const targetCol = board.columns.find((c) => c.stage.id === stageId)
          if (col.stage.id === stageId && targetCol) {
            const movedNegocio = board.columns
              .flatMap((c) => c.negocios)
              .find((n) => n.id === negocioId)
            if (movedNegocio) {
              return {
                ...col,
                negocios: [...col.negocios, { ...movedNegocio, pipeline_stage_id: stageId }],
                count: col.count + 1,
              }
            }
          }
          return col
        }
        return {
          ...col,
          negocios: col.negocios.filter((n) => n.id !== negocioId),
          count: Math.max(0, col.count - 1),
        }
      })
      setBoard({ ...board, columns: updatedColumns })
    }

    try {
      const body: Record<string, unknown> = { pipeline_stage_id: stageId }
      if (lostReason) body.lost_reason = lostReason
      if (lostNotes) body.lost_notes = lostNotes

      const res = await fetch(`/api/crm/negocios/${negocioId}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        fetchBoard()
      } else {
        // Avisar o parent para refrescar widgets-irmãos (SummaryBar, badges,
        // contagens por pipeline) — o board já tem optimistic update local.
        onMutated?.()
      }
    } catch {
      fetchBoard()
    }
  }

  function handleLostConfirm(reason: string, notes?: string) {
    if (!lostDialog) return
    const { negocioId, targetStage } = lostDialog
    setLostDialog(null)
    moveNegocio(negocioId, targetStage.id, reason, notes)
  }

  function handleLostCancel() {
    setLostDialog(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Board */}
      {loading ? (
        <BoardSkeleton />
      ) : (
        <ScrollableBoard>
          <div className="flex gap-3 min-w-max">
            {(board?.columns ?? []).map((column) => (
              <KanbanColumnView
                key={column.stage.id}
                column={column}
                isDragOver={!readOnly && dragOverStageId === column.stage.id}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onCardDragStart={setDraggedId}
                onCardClick={onCardClick}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelected}
                onToggleSelectAllInStage={toggleSelectAllInStage}
                readOnly={readOnly}
              />
            ))}
          </div>
        </ScrollableBoard>
      )}

      {/* Lost reason dialog */}
      <LostReasonDialog
        open={lostDialog?.open ?? false}
        onConfirm={handleLostConfirm}
        onCancel={handleLostCancel}
      />

      {/* Floating multi-select bar — sticks to the bottom of the viewport
          whenever at least one card is selected. Hosts the actions menu
          + the Cancelar button which clears every selected id at once. */}
      {selectedIds.size > 0 && (
        <div
          className={cn(
            'fixed left-1/2 -translate-x-1/2 z-50',
            'inline-flex items-center gap-2 rounded-full',
            'bg-foreground text-background shadow-2xl',
            'pl-4 pr-2 py-2 animate-in fade-in slide-in-from-bottom-3 duration-200',
          )}
          // Sit above the mobile bottom-nav (var publishes the real measured
          // height; falls back to 0 on desktop where the nav isn't rendered,
          // so the desktop offset stays at the original ~24px).
          style={{
            bottom: 'calc(var(--mobile-nav-height, 0px) + 1.5rem)',
          }}
          role="status"
          aria-live="polite"
        >
          <span className="text-sm font-medium tabular-nums">
            {selectedIds.size}{' '}
            {selectedIds.size === 1 ? 'selecionado' : 'selecionados'}
          </span>
          <div className="h-4 w-px bg-background/20" />
          <BulkActionsMenu count={selectedIds.size} onAction={handleBulkAction} />
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

      {/* Bulk-action dialogs — only the requested one mounts at a time. */}
      <BulkSendPropertiesDialog
        open={bulkAction === 'send_properties'}
        onOpenChange={(o) => !o && setBulkAction(null)}
        selectedNegocios={selectedBulkNegocios}
        boardNegocios={allBulkNegocios}
        onDone={() => {
          // Refresh the board so sent_at / dossier-driven badges update,
          // and clear the selection so the user starts fresh.
          fetchBoard({ silent: true })
          clearSelection()
        }}
      />

      <BulkPipelineActionDialog
        open={
          bulkAction === 'change_temperature' ||
          bulkAction === 'reassign_consultant' ||
          bulkAction === 'move_stage'
        }
        onOpenChange={(o) => !o && setBulkAction(null)}
        mode={
          bulkAction === 'change_temperature'
            ? 'temperatura'
            : bulkAction === 'reassign_consultant'
              ? 'consultor'
              : ('stage' as BulkPipelineMode)
        }
        negocioIds={Array.from(selectedIds)}
        stages={pipelineStages}
        onDone={() => {
          fetchBoard({ silent: true })
          clearSelection()
        }}
      />

      {/* Bulk "marcar perdido" — separate LostReasonDialog instance from
          the single-card drag-to-lost flow above. */}
      <LostReasonDialog
        open={bulkLostOpen}
        onConfirm={handleBulkLostConfirm}
        onCancel={() => setBulkLostOpen(false)}
      />

      {/* Bulk WhatsApp / Email — same shell, mode-driven. Contact list
          is already deduped above so the same lead never receives the
          message twice. */}
      <BulkSendMessageDialog
        open={
          bulkAction === 'whatsapp_message' ||
          bulkAction === 'email_message'
        }
        onOpenChange={(o) => !o && setBulkAction(null)}
        mode={bulkAction === 'email_message' ? 'email' : 'whatsapp'}
        contacts={selectedMessageContacts}
        onDone={() => {
          fetchBoard({ silent: true })
          clearSelection()
        }}
      />

      {/* Bulk matches rígidos — each negócio gets its own tailored set
          of imóveis based on the matching engine, sent through the same
          bulk-send-properties endpoint with per-target property_ids. */}
      <BulkSendMatchesDialog
        open={bulkAction === 'send_matches'}
        onOpenChange={(o) => !o && setBulkAction(null)}
        targets={selectedBulkNegocios.map<BulkMatchTarget>((n) => ({
          negocio_id: n.id,
          contact_name: n.contact_name,
        }))}
        onDone={() => {
          fetchBoard({ silent: true })
          clearSelection()
        }}
      />

      {/* Bulk "Criar tarefa" — same task copied onto every selected
          negócio, attached via entity_type='negocio'. */}
      <BulkCreateTaskDialog
        open={bulkAction === 'add_task'}
        onOpenChange={(o) => !o && setBulkAction(null)}
        targets={selectedBulkNegocios.map<BulkTaskTarget>((n) => ({
          negocio_id: n.id,
          contact_name: n.contact_name,
        }))}
        onDone={() => {
          // Tasks live elsewhere — no need to reload the board, just
          // close the menu and clear the selection.
          clearSelection()
        }}
      />

      {/* Bulk CSV export — re-uses the existing CsvExportDialog with the
          new `extraParams` slot to scope by negocio_ids. */}
      <CsvExportDialog
        open={bulkAction === 'export_csv'}
        onOpenChange={(o) => !o && setBulkAction(null)}
        endpoint="/api/export/negocios"
        title="Negócios selecionados"
        showConsultantFilter={false}
        scopeLabel={`${selectedIds.size} ${selectedIds.size === 1 ? 'negócio' : 'negócios'} selecionado${selectedIds.size === 1 ? '' : 's'}`}
        extraParams={{ negocio_ids: Array.from(selectedIds).join(',') }}
      />
    </div>
  )
}

// ─── ScrollableBoard ──────────────────────────────────────────────────────
//
// Wrapper que adiciona affordances de scroll horizontal:
//  • Mirror de scrollbar no TOPO (sincronizada bidireccionalmente com o board)
//  • Gradient fade nas margens esquerda/direita quando há mais conteúdo
//    para um dos lados
//
// O conteúdo real continua a ser scrollável normalmente — adicionamos só
// indicadores visuais para PCs sem trackpad horizontal natural.
function ScrollableBoard({ children }: { children: React.ReactNode }) {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [contentWidth, setContentWidth] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [scrollState, setScrollState] = useState({ left: 0, max: 0 })
  const dragRef = useRef<{ startX: number; startThumbLeft: number } | null>(null)

  // Mede dimensões do board + observa redimensionamentos.
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const inner = board.firstElementChild as HTMLElement | null
    if (!inner) return

    const measure = () => {
      setContentWidth(inner.scrollWidth)
      setViewportWidth(board.clientWidth)
      setScrollState({
        left: board.scrollLeft,
        max: board.scrollWidth - board.clientWidth,
      })
    }
    measure()

    const ro = new ResizeObserver(measure)
    ro.observe(board)
    ro.observe(inner)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [children])

  const handleBoardScroll = () => {
    const board = boardRef.current
    if (!board) return
    setScrollState({
      left: board.scrollLeft,
      max: board.scrollWidth - board.clientWidth,
    })
  }

  // ── Custom thumb: sempre visível enquanto a barra estiver expandida ──
  const hasOverflow = contentWidth > viewportWidth + 1
  const thumbWidth = hasOverflow
    ? Math.max(40, (viewportWidth / contentWidth) * viewportWidth)
    : 0
  const trackWidth = viewportWidth
  const maxThumbLeft = Math.max(0, trackWidth - thumbWidth)
  const thumbLeft =
    scrollState.max > 0 ? (scrollState.left / scrollState.max) * maxThumbLeft : 0

  const setBoardLeftFromThumbPx = (thumbPx: number) => {
    const board = boardRef.current
    if (!board || maxThumbLeft <= 0) return
    const clamped = Math.max(0, Math.min(maxThumbLeft, thumbPx))
    const ratio = clamped / maxThumbLeft
    board.scrollLeft = ratio * scrollState.max
  }

  const onThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { startX: e.clientX, startThumbLeft: thumbLeft }
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
  }

  const onThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    setBoardLeftFromThumbPx(dragRef.current.startThumbLeft + dx)
  }

  const onThumbPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    try {
      ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current) return
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const clickX = e.clientX - rect.left
    setBoardLeftFromThumbPx(clickX - thumbWidth / 2)
  }

  const showLeftFade = scrollState.left > 4
  const showRightFade = scrollState.max - scrollState.left > 4

  return (
    <div className="group/board relative">
      {/* Mirror scrollbar no topo — colapsa para 0 height por defeito,
          expande no hover de qualquer parte do board. Thumb custom sempre
          visível durante hover (não depende do scrollbar nativo do browser,
          que é invisível por defeito em macOS). */}
      <div
        className={cn(
          'overflow-hidden transition-[height,opacity,margin] duration-150 ease-out',
          hasOverflow
            ? 'h-0 opacity-0 group-hover/board:h-3 group-hover/board:opacity-100 group-hover/board:mb-1'
            : 'h-0 opacity-0',
        )}
        aria-hidden
      >
        <div
          ref={trackRef}
          onClick={onTrackClick}
          className="relative h-3 w-full rounded-full bg-muted/40 cursor-pointer"
        >
          <div
            role="presentation"
            onPointerDown={onThumbPointerDown}
            onPointerMove={onThumbPointerMove}
            onPointerUp={onThumbPointerUp}
            onPointerCancel={onThumbPointerUp}
            className={cn(
              'absolute top-0 h-3 rounded-full bg-foreground/30 hover:bg-foreground/50',
              'transition-colors duration-150 cursor-grab active:cursor-grabbing shadow-sm',
            )}
            style={{
              width: `${thumbWidth}px`,
              transform: `translateX(${thumbLeft}px)`,
            }}
          />
        </div>
      </div>

      {/* Container do board com fades nas margens */}
      <div className="relative">
        <div
          ref={boardRef}
          onScroll={handleBoardScroll}
          className="overflow-x-auto pb-4"
        >
          {children}
        </div>

        {/* Fade esquerdo */}
        <div
          className={cn(
            'pointer-events-none absolute left-0 top-0 bottom-4 w-10 transition-opacity duration-200',
            'bg-gradient-to-r from-background via-background/70 to-transparent',
            showLeftFade ? 'opacity-100' : 'opacity-0',
          )}
        />
        {/* Fade direito */}
        <div
          className={cn(
            'pointer-events-none absolute right-0 top-0 bottom-4 w-10 transition-opacity duration-200',
            'bg-gradient-to-l from-background via-background/70 to-transparent',
            showRightFade ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>
    </div>
  )
}
