'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Clock, AlertTriangle, User, Euro, Home, MapPin, Sparkles, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KanbanCardProps {
  negocio: any
  onDragStart: (negocioId: string) => void
  onEntryClick?: (entry: any) => void
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

// ─── Lead Entry Card (unqualified) ──────────────────────────────────────────

function EntryCard({ entry, onDragStart, onEntryClick }: { entry: any; onDragStart: (id: string) => void; onEntryClick?: (entry: any) => void }) {
  const router = useRouter()
  const contact = entry.contact
  const consultant = entry.assigned_consultant
  const daysInStage = entry.days_in_stage ?? 0
  const slaOverdue = entry.sla_overdue ?? false

  const displayName = contact?.nome || entry.raw_name || 'Sem nome'
  const source = entry.source
  const hasReferral = entry.has_referral

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData('entry_id', entry.id)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(entry.id)
  }

  function handleClick() {
    if (contact?.id) {
      router.push(`/dashboard/leads/${contact.id}?tab=leads&entry=${entry.id}`)
    } else if (onEntryClick) {
      onEntryClick(entry)
    }
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      className={cn(
        'bg-card rounded-2xl border border-dashed border-border/40 p-3 shadow-sm cursor-pointer',
        'hover:shadow-lg hover:border-primary/30 hover:bg-card transition-all duration-200 select-none',
        slaOverdue && 'border-l-2 border-l-red-400'
      )}
    >
      {/* Top row: name + source badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <UserPlus className="h-3 w-3 text-primary/60 shrink-0" />
          <p className="font-semibold text-sm text-foreground leading-snug truncate">
            {displayName}
          </p>
        </div>
        {source && (
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 py-0 font-medium rounded-full shrink-0">
            {SOURCE_LABELS[source] || source}
          </Badge>
        )}
      </div>

      {/* Message snippet */}
      {entry.notes && (
        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
          {entry.notes}
        </p>
      )}

      {/* Referral badge */}
      {hasReferral && (
        <div className="mt-1.5">
          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 py-0 rounded-full gap-0.5">
            <Sparkles className="h-2.5 w-2.5" />
            Referência{entry.referral_pct ? ` ${entry.referral_pct}%` : ''}
          </Badge>
        </div>
      )}

      {/* Footer: consultant + days */}
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

// ─── Negócio Card (qualified) ───────────────────────────────────────────────

function NegocioCard({ negocio, onDragStart }: { negocio: any; onDragStart: (id: string) => void }) {
  const router = useRouter()

  const contact = negocio.contact ?? negocio.leads
  const consultant = negocio.consultant ?? negocio.dev_users
  const daysInStage = negocio.days_in_stage ?? 0
  const slaOverdue = negocio.sla_overdue ?? false

  const tipo = negocio.tipo as string | undefined
  const isCompraVenda = tipo === 'Compra e Venda'
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
        <div className="flex gap-1 shrink-0">
          {isCompraVenda && (
            <>
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-blue-500/15 text-blue-600">C</span>
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/15 text-emerald-600">V</span>
            </>
          )}
          {negocio.origem && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 py-0 font-medium rounded-full">
              {SOURCE_LABELS[negocio.origem] || negocio.origem}
            </Badge>
          )}
        </div>
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

      {/* Referral badge */}
      {hasReferral && (
        <div className="mt-1.5">
          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 py-0 rounded-full gap-0.5">
            <Sparkles className="h-2.5 w-2.5" />
            Ref.{negocio.referral_side === 'angariacao' ? ' Ang.' : negocio.referral_side === 'comprador' ? ' Comp.' : ''}
            {negocio.referral_pct ? ` ${negocio.referral_pct}%` : ''}
          </Badge>
        </div>
      )}

      {/* Value */}
      {hasValue && (
        <div className="flex items-center gap-1 mt-2">
          <Euro className="h-3 w-3 text-muted-foreground" />
          {valueLabel && <span className="text-[10px] text-muted-foreground">{valueLabel}</span>}
          <span className="text-sm font-semibold">{formatEUR(displayValue!)}</span>
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

// ─── Export: auto-select card type based on _type ───────────────────────────

export function KanbanCard({ negocio, onDragStart, onEntryClick }: KanbanCardProps) {
  if (negocio._type === 'entry') {
    return <EntryCard entry={negocio} onDragStart={onDragStart} onEntryClick={onEntryClick} />
  }
  return <NegocioCard negocio={negocio} onDragStart={onDragStart} />
}
