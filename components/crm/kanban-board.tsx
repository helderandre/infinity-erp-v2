'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { KanbanCard } from '@/components/crm/kanban-card'
import { LostReasonDialog } from '@/components/crm/lost-reason-dialog'
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
  }
  onCardClick?: (negocio: { id: string; lead_id?: string | null; contact_id?: string | null }) => void
  /**
   * Bumping this number triggers a silent re-fetch — used by the parent CRM
   * page after a lead is qualified or added so the new card appears without
   * the user having to refresh.
   */
  refreshKey?: number
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
}

function KanbanColumnView({
  column,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardDragStart,
  onCardClick,
}: ColumnProps) {
  const { stage, negocios, count, total_commission } = column

  return (
    <div
      className="min-w-[230px] w-[230px] flex-shrink-0 flex flex-col"
      onDragOver={(e) => onDragOver(e, stage.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage)}
    >
      {/* Column header */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-2.5 py-2 rounded-t-2xl border border-b-0 border-border/30',
          'bg-card/60 backdrop-blur-sm',
          isDragOver && 'ring-2 ring-primary ring-offset-0'
        )}
      >
        {/* Pill: stage name */}
        <div className="inline-flex items-center gap-1.5 min-w-0 px-3 py-1 rounded-full bg-white text-neutral-900 shadow-md ring-1 ring-black/5 dark:bg-neutral-100">
          <span className="text-xs font-semibold truncate">{stage.name}</span>
          {stage.is_terminal && stage.terminal_type && (
            <span
              className={cn(
                'inline-flex items-center text-[9px] h-4 px-1.5 font-medium rounded-full',
                stage.terminal_type === 'won' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
              )}
            >
              {stage.terminal_type === 'won' ? 'Ganho' : 'Perdido'}
            </span>
          )}
        </div>
        {/* Count — bubble on the far right */}
        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-white text-neutral-900 text-[11px] font-bold tabular-nums shadow-md ring-1 ring-black/5 dark:bg-neutral-100 shrink-0">
          {count}
        </span>
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

export function KanbanBoard({ pipelineType, filters, onCardClick, refreshKey }: KanbanBoardProps) {
  const [board, setBoard] = useState<KanbanBoardType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const fetchBoard = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterConsultant) params.set('assigned_consultant_id', filterConsultant)
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
  }, [pipelineType, filterSearch, filterStage, filterTemp, filterConsultant])

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

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

    // Find current stage of the dragged negocio
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
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {(board?.columns ?? []).map((column) => (
              <KanbanColumnView
                key={column.stage.id}
                column={column}
                isDragOver={dragOverStageId === column.stage.id}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onCardDragStart={setDraggedId}
                onCardClick={onCardClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lost reason dialog */}
      <LostReasonDialog
        open={lostDialog?.open ?? false}
        onConfirm={handleLostConfirm}
        onCancel={handleLostCancel}
      />
    </div>
  )
}
