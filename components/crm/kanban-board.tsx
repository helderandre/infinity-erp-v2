'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Users } from 'lucide-react'
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
  weighted_value: number
}

interface KanbanBoardProps {
  pipelineType: PipelineType
}

const formatEUR = (value: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(value)

interface Consultant {
  id: string
  commercial_name: string | null
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="min-w-[280px] w-[280px] flex-shrink-0 space-y-3">
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
}

function KanbanColumnView({
  column,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardDragStart,
}: ColumnProps) {
  const { stage, negocios, count, total_value } = column

  return (
    <div
      className="min-w-[280px] w-[280px] flex-shrink-0 flex flex-col"
      onDragOver={(e) => onDragOver(e, stage.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage)}
    >
      {/* Column header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2.5 rounded-t-2xl border border-b-0 border-border/30',
          'bg-card/60 backdrop-blur-sm',
          isDragOver && 'ring-2 ring-primary ring-offset-0'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: stage.color || '#94a3b8' }}
          />
          <span className="text-sm font-medium text-foreground truncate">{stage.name}</span>
          {stage.is_terminal && stage.terminal_type && (
            <Badge
              variant={stage.terminal_type === 'won' ? 'default' : 'destructive'}
              className="text-[9px] h-4 px-1.5 py-0 font-medium rounded-full"
            >
              {stage.terminal_type === 'won' ? 'Ganho' : 'Perdido'}
            </Badge>
          )}
        </div>
        <Badge variant="secondary" className="ml-2 shrink-0 text-xs h-5 rounded-full">
          {count}
        </Badge>
      </div>

      {/* Column value */}
      {total_value > 0 && (
        <div className="px-3 py-1 bg-muted/30 backdrop-blur-sm border border-y-0 border-border/30">
          <span className="text-[11px] text-muted-foreground">{formatEUR(total_value)}</span>
        </div>
      )}

      {/* Cards area */}
      <div
        className={cn(
          'flex-1 rounded-b-2xl border border-t-0 border-border/30 bg-muted/10 p-2 space-y-2',
          'min-h-[120px] transition-colors duration-200',
          isDragOver && 'bg-primary/5 border-primary/30'
        )}
      >
        {negocios.map((negocio) => (
          <KanbanCard
            key={negocio.id}
            negocio={negocio}
            onDragStart={onCardDragStart}
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

export function KanbanBoard({ pipelineType }: KanbanBoardProps) {
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

  // Consultant filter
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [selectedConsultant, setSelectedConsultant] = useState<string>('all')

  const dragLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch board data ──────────────────────────────────────────────────────

  const fetchBoard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (selectedConsultant !== 'all') {
        params.set('agent_id', selectedConsultant)
      }
      const url = `/api/crm/kanban/${pipelineType}${params.size > 0 ? `?${params}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Erro ao carregar o quadro')
      const data = await res.json()
      setBoard(data)

      // Extract unique consultants from negocios for filter
      const seen = new Set<string>()
      const found: Consultant[] = []
      for (const col of data.columns ?? []) {
        for (const neg of col.negocios ?? []) {
          const c = neg.consultant ?? neg.dev_users
          if (c && !seen.has(c.id)) {
            seen.add(c.id)
            found.push({ id: c.id, commercial_name: c.commercial_name })
          }
        }
      }
      setConsultants(found)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [pipelineType, selectedConsultant])

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

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
      {/* Consultant filter */}
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select
          value={selectedConsultant}
          onValueChange={(val) => setSelectedConsultant(val)}
        >
          <SelectTrigger className="h-8 w-[220px] text-sm rounded-full">
            <SelectValue placeholder="Filtrar por consultor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os consultores</SelectItem>
            {consultants.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.commercial_name ?? 'Sem nome'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
