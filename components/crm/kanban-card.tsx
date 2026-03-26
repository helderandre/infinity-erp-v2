'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Clock, AlertTriangle, User, Euro, Home, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeadsNegocioWithRelations } from '@/types/leads-crm'

interface KanbanCardProps {
  negocio: LeadsNegocioWithRelations
  onDragStart: (negocioId: string) => void
}

const formatEUR = (value: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(value)

export function KanbanCard({ negocio, onDragStart }: KanbanCardProps) {
  const router = useRouter()

  const contact = negocio.contact ?? negocio.leads
  const consultant = negocio.consultant ?? negocio.dev_users
  const daysInStage = negocio.days_in_stage ?? 0
  const slaOverdue = negocio.sla_overdue ?? false

  const neg = negocio as any
  const tipo = neg.tipo as string | undefined
  const isCompraVenda = tipo === 'Compra e Venda'
  const tipoImovel = neg.tipo_imovel as string | null
  const quartosMin = neg.quartos_min as number | null
  const localizacao = neg.localizacao as string | null
  const orcamento = neg.orcamento as number | null
  const orcamentoMax = neg.orcamento_max as number | null
  const expectedValue = negocio.expected_value

  // Best value to show depends on deal type
  const isBuyer = tipo === 'Compra' || tipo === 'Compra e Venda' || tipo === 'Arrendatário'
  const displayValue = isBuyer
    ? (orcamentoMax ?? orcamento ?? expectedValue ?? null)
    : (expectedValue ?? neg.preco_venda ?? null)
  const hasValue = displayValue !== null && displayValue !== undefined
  const valueLabel = isBuyer ? 'até' : null

  // Typology string
  const typology = [
    tipoImovel,
    quartosMin ? `T${quartosMin}+` : null,
  ].filter(Boolean).join(' · ')

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData('negocio_id', negocio.id)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(negocio.id)
  }

  function handleClick() {
    const leadId = negocio.lead_id ?? negocio.contact_id
    router.push(`/dashboard/leads/${leadId}/negocios/${negocio.id}`)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      className={cn(
        'bg-card rounded-2xl border border-border/20 p-3 shadow-sm cursor-grab active:cursor-grabbing',
        'hover:shadow-lg hover:bg-card transition-all duration-200 select-none',
        slaOverdue && 'border-l-2 border-l-red-400'
      )}
    >
      {/* Top row: name + tipo tags */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm text-foreground leading-snug truncate">
          {contact?.full_name || contact?.nome || 'Sem nome'}
        </p>
        {isCompraVenda && (
          <div className="flex gap-1 shrink-0">
            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-blue-500/15 text-blue-600">C</span>
            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/15 text-emerald-600">V</span>
          </div>
        )}
      </div>

      {/* Typology + Location pills */}
      {(typology || localizacao) && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {typology && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-2 py-0.5 rounded-full">
              <Home className="h-2.5 w-2.5" />{typology}
            </span>
          )}
          {localizacao && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-2 py-0.5 rounded-full truncate max-w-[140px]">
              <MapPin className="h-2.5 w-2.5 shrink-0" />{localizacao}
            </span>
          )}
        </div>
      )}

      {/* Value */}
      {hasValue && (
        <div className="flex items-center gap-1 mt-2">
          <Euro className="h-3 w-3 text-muted-foreground" />
          {valueLabel && <span className="text-[10px] text-muted-foreground">{valueLabel}</span>}
          <span className="text-sm font-semibold">
            {formatEUR(displayValue!)}
          </span>
        </div>
      )}

      {/* Footer: consultant + days in stage */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20 gap-2">
        {consultant?.commercial_name ? (
          <div className="flex items-center gap-1 min-w-0">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">
              {consultant.commercial_name}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground/50 italic">Sem consultor</span>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {slaOverdue ? (
            <Badge
              variant="destructive"
              className="h-4 px-1.5 text-[10px] font-medium gap-0.5 rounded-full"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {daysInStage}d
            </Badge>
          ) : (
            <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{daysInStage}d</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
