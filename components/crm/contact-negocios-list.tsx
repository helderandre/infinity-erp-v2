'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { differenceInDays, parseISO } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TrendingUp,
  User,
  Clock,
  AlertTriangle,
  Plus,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/constants'
import {
  PIPELINE_TYPE_LABELS,
  PIPELINE_TYPE_COLORS,
  derivePipelineTypeFromTipo,
} from '@/lib/constants-leads-crm'
import type { LeadsNegocioWithRelations, PipelineType } from '@/types/leads-crm'
import { temperaturaEmoji, type Temperatura } from '@/components/negocios/temperatura-selector'

const TIPO_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  'Compra':         { bg: 'bg-blue-500/15',    text: 'text-blue-700',    label: 'Compra' },
  'Venda':          { bg: 'bg-emerald-500/15', text: 'text-emerald-700', label: 'Venda' },
  'Compra e Venda': { bg: 'bg-violet-500/15',  text: 'text-violet-700',  label: 'C+V' },
  'Arrendatário':   { bg: 'bg-amber-500/15',   text: 'text-amber-700',   label: 'Arrend.' },
  'Arrendador':     { bg: 'bg-orange-500/15',  text: 'text-orange-700',  label: 'Senhorio' },
}

const TEMPERATURA_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  'Frio':   { bg: 'bg-blue-500/15',  text: 'text-blue-700',  label: 'Frio' },
  'Morno':  { bg: 'bg-amber-500/15', text: 'text-amber-700', label: 'Morno' },
  'Quente': { bg: 'bg-red-500/15',   text: 'text-red-700',   label: 'Quente' },
}

interface ContactNegociosListProps {
  contactId: string
  onCreateClick?: () => void
}

export function ContactNegociosList({
  contactId,
  onCreateClick,
}: ContactNegociosListProps) {
  const router = useRouter()
  const [negocios, setNegocios] = useState<LeadsNegocioWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchNegocios = useCallback(async () => {
    setIsLoading(true)
    try {
      // `lead_id` is the DB column name; also pass `contact_id` for backwards-compat
      const res = await fetch(
        `/api/crm/negocios?lead_id=${contactId}&contact_id=${contactId}&per_page=100`
      )
      if (!res.ok) throw new Error()
      const json = await res.json()
      setNegocios(json.data ?? [])
    } catch {
      setNegocios([])
    } finally {
      setIsLoading(false)
    }
  }, [contactId])

  useEffect(() => {
    fetchNegocios()
  }, [fetchNegocios])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (negocios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Inbox className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">Sem negócios associados</p>
        <p className="text-xs mt-1 mb-4">Crie o primeiro negócio para este contacto</p>
        {onCreateClick && (
          <Button size="sm" variant="outline" onClick={onCreateClick}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo negócio
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {negocios.map((negocio) => (
        <NegocioCard
          key={negocio.id}
          negocio={negocio}
          onClick={() => router.push(`/dashboard/crm/negocios/${negocio.id}`)}
        />
      ))}
    </div>
  )
}

function NegocioCard({
  negocio,
  onClick,
}: {
  negocio: LeadsNegocioWithRelations
  onClick: () => void
}) {
  // `pipeline_type` may not exist as a direct DB column — derive from `tipo` if needed
  const resolvedPipelineType: PipelineType =
    negocio.pipeline_type ?? derivePipelineTypeFromTipo(negocio.tipo)
  const colors = PIPELINE_TYPE_COLORS[resolvedPipelineType] ?? PIPELINE_TYPE_COLORS.comprador
  const label = PIPELINE_TYPE_LABELS[resolvedPipelineType] ?? resolvedPipelineType
  // Stage data may be under either `pipeline_stage` or the join alias `leads_pipeline_stages`
  const stage = negocio.pipeline_stage ?? (negocio as any).leads_pipeline_stages
  const stageName = stage?.name ?? '—'
  const stageColor = stage?.color as string | undefined
  const isTerminal = stage?.is_terminal ?? false
  const terminalType = stage?.terminal_type
  const tipo = negocio.tipo as string | undefined
  const tipoBadge = tipo ? TIPO_BADGE[tipo] : null
  const temperatura = (negocio as any).temperatura as Temperatura | undefined
  const tempEmoji = temperaturaEmoji(temperatura)
  const tempBadge = temperatura ? TEMPERATURA_BADGE[temperatura] : null

  const daysInStage = negocio.stage_entered_at
    ? differenceInDays(new Date(), parseISO(negocio.stage_entered_at))
    : null

  const slaOverdue =
    negocio.pipeline_stage?.sla_days != null &&
    daysInStage != null &&
    daysInStage > negocio.pipeline_stage.sla_days

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-4 text-left transition-all duration-200',
        'hover:shadow-lg hover:bg-card/80',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: pipeline + stage */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {tipoBadge ? (
              <Badge
                variant="secondary"
                className={cn('text-[10px] font-semibold rounded-full px-2', tipoBadge.bg, tipoBadge.text)}
              >
                {tipoBadge.label}
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className={cn('text-xs font-medium', colors.bg, colors.text)}
              >
                {label}
              </Badge>
            )}

            {tempBadge && (
              <Badge
                variant="secondary"
                className={cn('text-[10px] font-semibold rounded-full px-2 inline-flex items-center gap-1', tempBadge.bg, tempBadge.text)}
              >
                {tempEmoji && <span aria-hidden>{tempEmoji}</span>}
                {tempBadge.label}
              </Badge>
            )}

            {stageName && stageName !== '—' && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={stageColor ? { backgroundColor: `${stageColor}22`, color: stageColor } : { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
              >
                {stageColor && <span className="h-1 w-1 rounded-full" style={{ backgroundColor: stageColor }} />}
                {stageName}
              </span>
            )}

            {isTerminal && terminalType === 'won' && (
              <Badge className="bg-emerald-500/15 text-emerald-700 text-xs">
                Ganho
              </Badge>
            )}
            {isTerminal && terminalType === 'lost' && (
              <Badge className="bg-red-500/15 text-red-700 text-xs">
                Perdido
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {negocio.expected_value != null && (
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {formatCurrency(negocio.expected_value)}
              </span>
            )}

            {(negocio.consultant ?? negocio.dev_users)?.commercial_name && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {(negocio.consultant ?? negocio.dev_users)!.commercial_name}
              </span>
            )}

            {daysInStage != null && (
              <span
                className={cn(
                  'flex items-center gap-1',
                  slaOverdue && 'text-red-600 font-medium'
                )}
              >
                {slaOverdue ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {daysInStage === 0
                  ? 'Hoje'
                  : `${daysInStage} dia${daysInStage !== 1 ? 's' : ''} nesta fase`}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
