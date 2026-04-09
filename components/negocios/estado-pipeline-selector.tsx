'use client'

import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface PipelineStage {
  id: string
  name: string
  color: string | null
  order_index: number
  is_terminal: boolean
  terminal_type: 'won' | 'lost' | null
  pipeline_type: 'comprador' | 'vendedor' | 'arrendatario' | 'arrendador'
}

export type NegocioTipo =
  | 'Compra'
  | 'Venda'
  | 'Compra e Venda'
  | 'Arrendatário'
  | 'Arrendador'
  | string

/** Map negocio tipo → DB pipeline_type */
export function tipoToPipelineType(
  tipo: NegocioTipo | undefined,
  perspective?: 'compra' | 'venda',
): 'comprador' | 'vendedor' | 'arrendatario' | 'arrendador' {
  if (tipo === 'Compra e Venda') {
    return perspective === 'venda' ? 'vendedor' : 'comprador'
  }
  if (tipo === 'Compra') return 'comprador'
  if (tipo === 'Venda') return 'vendedor'
  if (tipo === 'Arrendatário') return 'arrendatario'
  if (tipo === 'Arrendador') return 'arrendador'
  return 'comprador'
}

interface EstadoPipelineSelectorProps {
  tipo: NegocioTipo | undefined
  perspective?: 'compra' | 'venda'
  pipelineStageId: string | null | undefined
  /** Fallback if pipeline_stage_id not yet set: shown stage name (legacy estado) */
  fallbackLabel?: string | null
  onChange: (stage: PipelineStage) => void
}

export function EstadoPipelineSelector({
  tipo,
  perspective,
  pipelineStageId,
  fallbackLabel,
  onChange,
}: EstadoPipelineSelectorProps) {
  const pipelineType = tipoToPipelineType(tipo, perspective)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/crm/pipeline-stages?pipeline_type=${pipelineType}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PipelineStage[]) => {
        if (cancelled) return
        const sorted = (data || []).sort((a, b) => a.order_index - b.order_index)
        setStages(sorted)
      })
      .catch(() => {
        if (!cancelled) setStages([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pipelineType])

  const current = stages.find((s) => s.id === pipelineStageId)
  const triggerLabel = current?.name || fallbackLabel || (loading ? '…' : 'Sem estado')
  const triggerColor = current?.color || '#94a3b8'

  function handleChange(stageId: string) {
    const stage = stages.find((s) => s.id === stageId)
    if (stage) onChange(stage)
  }

  return (
    <Select value={pipelineStageId || undefined} onValueChange={handleChange}>
      <SelectTrigger
        className={cn(
          'h-7 w-auto gap-1.5 rounded-full border-0 px-2.5 text-[11px] font-semibold',
          '[&>svg]:h-3 [&>svg]:w-3',
        )}
        style={{
          backgroundColor: `${triggerColor}26`,
          color: triggerColor,
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full inline-block shrink-0"
          style={{ backgroundColor: triggerColor }}
        />
        <SelectValue>{triggerLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {stages.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full inline-block"
                style={{ backgroundColor: s.color || '#94a3b8' }}
              />
              {s.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
