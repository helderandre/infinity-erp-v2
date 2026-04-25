'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Clock, AlertTriangle, User, Euro, Home, MapPin, Sparkles, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { temperaturaEmoji, type Temperatura } from '@/components/negocios/temperatura-selector'
import { parseObservations } from '@/components/crm/observations-dialog'

interface KanbanCardProps {
  negocio: any
  onDragStart: (negocioId: string) => void
  onClick?: () => void
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

export function KanbanCard({ negocio, onDragStart, onClick: onClickProp }: KanbanCardProps) {
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

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      className={cn(
        'bg-card rounded-xl border border-border/20 p-2.5 shadow-sm cursor-grab active:cursor-grabbing',
        'hover:shadow-lg hover:bg-card transition-all duration-200 select-none'
      )}
    >
      {/* Top row: name + temperatura emoji + observations indicator */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-[12px] text-foreground leading-snug truncate flex items-center gap-1">
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
