'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Clock, AlertTriangle, User, Euro, Home, MapPin, Sparkles, MessageCircle, Check, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { temperaturaEmoji, type Temperatura } from '@/components/negocios/temperatura-selector'
import { parseObservations } from '@/components/crm/observations-dialog'

interface KanbanCardProps {
  negocio: any
  onDragStart: (negocioId: string) => void
  onClick?: () => void
  /** Multi-select state — when true, the card renders a checked checkbox
   *  and a stage-coloured ring around the whole card. */
  selected?: boolean
  /** Toggles the card's id in/out of the selection set. Receives the
   *  card id and is the single way of changing selection from a card. */
  onToggleSelect?: (negocioId: string) => void
  /** Stage colour (hex) used for the selected ring + checkbox accent.
   *  Falls back to the primary token if not provided. */
  stageColor?: string
}

const formatEUR = (value: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(value)

const SOURCE_LABELS: Record<string, string> = {
  meta_ads: 'Meta',
  google_ads: 'Google',
  website: 'Website',
  landing_page: 'Landing Page',
  partner: 'Parceiro',
  organic: 'Orgânico',
  walk_in: 'Walk-in',
  phone_call: 'Telefone',
  social_media: 'Redes Sociais',
  other: 'Outro',
}

// ─── Negócio Card ──────────────────────────────────────────────────────────

export function KanbanCard({
  negocio,
  onDragStart,
  onClick: onClickProp,
  selected = false,
  onToggleSelect,
  stageColor,
}: KanbanCardProps) {
  const router = useRouter()

  const contact = negocio.contact ?? negocio.leads
  const consultant = negocio.consultant ?? negocio.dev_users
  const daysInStage = negocio.days_in_stage ?? 0
  const slaOverdue = negocio.sla_overdue ?? false

  const tipo = negocio.tipo as string | undefined
  const temperatura = negocio.temperatura as Temperatura | undefined
  const tempEmoji = temperaturaEmoji(temperatura)
  const observationsCount = parseObservations(negocio.observacoes as string | null).length
  const tipoImovel = negocio.tipo_imovel as string | null
  const quartosMin = negocio.quartos_min as number | null
  const localizacao = negocio.localizacao as string | null
  const orcamento = negocio.orcamento as number | null
  const orcamentoMax = negocio.orcamento_max as number | null
  const expectedValue = negocio.expected_value
  const hasReferral = negocio.has_referral

  const isBuyer = tipo === 'Compra' || tipo === 'Compra e Venda' || tipo === 'Arrendatário'
  const displayValue = isBuyer
    ? (orcamentoMax ?? orcamento ?? expectedValue ?? null)
    : (expectedValue ?? negocio.preco_venda ?? null)
  const hasValue = displayValue !== null && displayValue !== undefined
  const valueLabel = isBuyer ? 'até' : null

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
    if (onClickProp) {
      onClickProp()
      return
    }
    const leadId = negocio.lead_id ?? negocio.contact_id
    router.push(`/dashboard/leads/${leadId}/negocios/${negocio.id}`)
  }

  const ringColor = stageColor || '#3b82f6'

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={(e) => {
        // Cmd / Ctrl click also toggles selection — mac/windows convention,
        // handy for quickly multi-selecting without aiming for the checkbox.
        if ((e.metaKey || e.ctrlKey) && onToggleSelect) {
          e.stopPropagation()
          onToggleSelect(negocio.id)
          return
        }
        handleClick()
      }}
      className={cn(
        'group/kanban-card relative bg-card rounded-xl border border-border/20 p-2.5 shadow-sm cursor-grab active:cursor-grabbing',
        'hover:shadow-lg hover:bg-card transition-all duration-200 select-none',
        // When selected: full-colour stage ring + slight stage tint
        selected && 'shadow-md',
      )}
      style={
        selected
          ? {
              boxShadow: `0 0 0 2px ${ringColor}, 0 4px 14px -6px ${ringColor}55`,
              backgroundImage: `linear-gradient(to bottom right, ${ringColor}10, transparent 70%)`,
            }
          : undefined
      }
    >
      {/* Selection checkbox — top-right. Always rendered when an
          onToggleSelect handler is provided; visually hidden until hover
          or selection so it doesn't crowd the card by default. */}
      {onToggleSelect && (
        <button
          type="button"
          draggable={false}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect(negocio.id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={selected ? 'Desmarcar' : 'Selecionar'}
          title={selected ? 'Desmarcar' : 'Selecionar'}
          className={cn(
            'absolute top-1.5 right-1.5 z-10 h-5 w-5 rounded-md flex items-center justify-center transition-all',
            'border',
            selected
              ? 'opacity-100'
              : 'opacity-0 group-hover/kanban-card:opacity-100 bg-background/95 border-border/60 text-muted-foreground hover:text-foreground hover:bg-background',
          )}
          style={
            selected
              ? {
                  backgroundColor: ringColor,
                  borderColor: ringColor,
                  color: '#fff',
                }
              : undefined
          }
        >
          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
      )}

      {/* Top row: name + temperatura emoji + observations indicator */}
      <div className="flex items-start justify-between gap-2">
        <p className={cn(
          'font-semibold text-[12px] text-foreground leading-snug truncate flex items-center gap-1',
          // Reserve space for the checkbox so the name doesn't slide under it.
          onToggleSelect && 'pr-6',
        )}>
          {contact?.full_name || contact?.nome || 'Sem nome'}
          {tempEmoji && <span aria-hidden className="text-xs">{tempEmoji}</span>}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          {negocio.origem && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 py-0 font-medium rounded-full">
              {SOURCE_LABELS[negocio.origem] || negocio.origem}
            </Badge>
          )}
          {observationsCount > 0 && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 h-4 text-[9px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
              title={`${observationsCount} observação${observationsCount === 1 ? '' : 'ões'}`}
            >
              <MessageCircle className="h-2.5 w-2.5" />
              {observationsCount}
            </span>
          )}
        </div>
      </div>

      {/* Phone — tap-to-call without triggering the card navigation. */}
      {contact?.telemovel && (
        <a
          href={`tel:${contact.telemovel}`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          draggable={false}
          className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Phone className="h-2.5 w-2.5" />
          <span className="tabular-nums">{contact.telemovel}</span>
        </a>
      )}

      {/* Typology + Location pills */}
      {(typology || localizacao) && (
        <div className="flex flex-wrap gap-1 mt-1">
          {typology && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-1.5 py-0 h-4 rounded-full">
              <Home className="h-2.5 w-2.5" />{typology}
            </span>
          )}
          {localizacao && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-1.5 py-0 h-4 rounded-full truncate max-w-[120px]">
              <MapPin className="h-2.5 w-2.5 shrink-0" />{localizacao}
            </span>
          )}
        </div>
      )}

      {/* Referral badge */}
      {hasReferral && (
        <div className="mt-1">
          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 py-0 rounded-full gap-0.5">
            <Sparkles className="h-2.5 w-2.5" />
            Ref.{negocio.referral_side === 'angariacao' ? ' Ang.' : negocio.referral_side === 'comprador' ? ' Comp.' : ''}
            {negocio.referral_pct ? ` ${negocio.referral_pct}%` : ''}
          </Badge>
        </div>
      )}

      {/* Value */}
      {hasValue && (
        <div className="flex items-center gap-1 mt-1.5">
          <Euro className="h-3 w-3 text-muted-foreground" />
          {valueLabel && <span className="text-[10px] text-muted-foreground">{valueLabel}</span>}
          <span className="text-[12px] font-semibold">{formatEUR(displayValue!)}</span>
        </div>
      )}

      {/* Footer: consultant + days in stage */}
      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/20 gap-2">
        {consultant?.commercial_name ? (
          <div className="flex items-center gap-1 min-w-0">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground truncate">
              {consultant.commercial_name}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground/50 italic">Sem consultor</span>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {slaOverdue ? (
            <Badge variant="destructive" className="h-4 px-1.5 text-[10px] font-medium gap-0.5 rounded-full">
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
