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

export function KanbanBoard({ pipelineType, filters, onCardClick, refreshKey, onMutated }: KanbanBoardProps) {
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
                isDragOver={dragOverStageId === column.stage.id}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onCardDragStart={setDraggedId}
                onCardClick={onCardClick}
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
