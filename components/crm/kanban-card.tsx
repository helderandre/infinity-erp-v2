'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUser } from '@/hooks/use-user'
import {
  Clock, AlertTriangle, Euro, Home, MapPin, Sparkles, Check, Phone, Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TEMPERATURA_OPTIONS,
  temperaturaEmoji,
  type Temperatura,
} from '@/components/negocios/temperatura-selector'

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
  /** Stage colour (hex) used for the selected ring, accent stripe and
   *  checkbox accent. Falls back to a neutral primary-ish blue. */
  stageColor?: string
  /** Read-only — disables HTML5 drag and the cmd-click multi-select. The
   *  card stays clickable so the détail sheet can still open. Used by the
   *  Referências page where the viewer is the referrer, not the owner. */
  readOnly?: boolean
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
  landing_page: 'Landing',
  partner: 'Parceiro',
  organic: 'Orgânico',
  walk_in: 'Walk-in',
  phone_call: 'Telefone',
  social_media: 'Redes',
  other: 'Outro',
}

function temperaturaColor(t: Temperatura | undefined | null): string | null {
  if (!t) return null
  return TEMPERATURA_OPTIONS.find((o) => o.value === t)?.color ?? null
}

function initialsFromName(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Deterministic palette for avatar fallbacks — stable per name so the same
// contact keeps the same colour across renders/columns.
const AVATAR_PALETTE = [
  { bg: 'bg-rose-100 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-200' },
  { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-200' },
  { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-200' },
  { bg: 'bg-sky-100 dark:bg-sky-500/20', text: 'text-sky-700 dark:text-sky-200' },
  { bg: 'bg-violet-100 dark:bg-violet-500/20', text: 'text-violet-700 dark:text-violet-200' },
  { bg: 'bg-fuchsia-100 dark:bg-fuchsia-500/20', text: 'text-fuchsia-700 dark:text-fuchsia-200' },
]

function paletteFor(seed: string): { bg: string; text: string } {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

// ─── Negócio Card ──────────────────────────────────────────────────────────

export function KanbanCard({
  negocio,
  onDragStart,
  onClick: onClickProp,
  selected = false,
  onToggleSelect,
  stageColor,
  readOnly = false,
}: KanbanCardProps) {
  const router = useRouter()

  const contact = negocio.contact ?? negocio.leads
  const { user: currentUser } = useUser()
  const consultant = negocio.consultant ?? negocio.dev_users
  // Hide the consultor block when the deal is owned by the viewer themselves
  // — they don't need a footer reminding them of their own name/photo.
  const isOwnDeal = !!currentUser?.id && consultant?.id === currentUser.id
  const daysInStage = negocio.days_in_stage ?? 0
  const slaOverdue = negocio.sla_overdue ?? false

  const tipo = negocio.tipo as string | undefined
  const temperatura = negocio.temperatura as Temperatura | undefined
  const tempEmoji = temperaturaEmoji(temperatura)
  const tempColor = temperaturaColor(temperatura)
  const tipoImovel = negocio.tipo_imovel as string | null
  const quartosMin = negocio.quartos_min as number | null
  const localizacao = negocio.localizacao as string | null
  const orcamento = negocio.orcamento as number | null
  const orcamentoMax = negocio.orcamento_max as number | null
  const expectedValue = negocio.expected_value
  const hasReferral = negocio.has_referral
  // Internal user → user referral. When set, the négocio came from another
  // consultor who keeps a commission slice. Card gets a sky tint + a
  // "Referenciado por X" badge so the recipient knows where it came from.
  const referrerConsultantId = negocio.referrer_consultant_id as string | null | undefined
  const referrerName = negocio.referrer?.commercial_name as string | null | undefined
  const referralPctRaw = negocio.referral_pct as number | string | null | undefined
  const referralPct = typeof referralPctRaw === 'number'
    ? referralPctRaw
    : typeof referralPctRaw === 'string'
      ? parseFloat(referralPctRaw)
      : null
  const isInternalReferral = !!referrerConsultantId

  // Compute the slice in € so the badge can show actual money. Mirrors the
  // formula used by /api/crm/kanban totals: gross × commission_factor × pct.
  const tipoForFactor = tipo ?? ''
  const isRentalCard =
    tipoForFactor === 'Arrendatário' || tipoForFactor === 'Senhorio' || tipoForFactor === 'Arrendador'
  const commissionFactor = isRentalCard ? 1.5 * 0.5 : 0.05 * 0.5
  const grossForCommission = Number.isFinite(Number(expectedValue))
    ? Number(expectedValue)
    : 0
  const referralCommission =
    isInternalReferral && referralPct !== null && Number.isFinite(referralPct)
      ? grossForCommission * commissionFactor * (referralPct / 100)
      : null

  const isBuyer = tipo === 'Comprador' || tipo === 'Compra' || tipo === 'Arrendatário'
  const displayValue = isBuyer
    ? (orcamentoMax ?? orcamento ?? expectedValue ?? null)
    : (expectedValue ?? negocio.preco_venda ?? null)
  const hasValue = displayValue !== null && displayValue !== undefined
  const valueLabel = isBuyer ? 'até' : null

  const contactName = contact?.full_name || contact?.nome || 'Sem nome'

  const sourceLabel = negocio.origem ? (SOURCE_LABELS[negocio.origem] || negocio.origem) : null
  const typology = [
    tipoImovel,
    quartosMin ? `T${quartosMin}+` : null,
  ].filter(Boolean).join(' · ')

  const metaParts = [typology || null, localizacao || null, sourceLabel].filter(Boolean) as string[]

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
      draggable={!readOnly}
      onDragStart={readOnly ? undefined : handleDragStart}
      onClick={(e) => {
        // Cmd / Ctrl click also toggles selection — mac/windows convention,
        // handy for quickly multi-selecting without aiming for the checkbox.
        // Disabled in read-only mode (no multi-select surface there).
        if (!readOnly && (e.metaKey || e.ctrlKey) && onToggleSelect) {
          e.stopPropagation()
          onToggleSelect(negocio.id)
          return
        }
        handleClick()
      }}
      className={cn(
        'group/kanban-card relative bg-card rounded-xl border border-border/40 pl-3 pr-2.5 py-2.5 overflow-hidden',
        'shadow-[0_2px_4px_-2px_rgba(0,0,0,0.08),0_4px_12px_-4px_rgba(0,0,0,0.06)]',
        'dark:shadow-[0_2px_4px_-2px_rgba(0,0,0,0.4),0_4px_12px_-4px_rgba(0,0,0,0.3)]',
        readOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
        'hover:shadow-[0_4px_8px_-2px_rgba(0,0,0,0.12),0_8px_20px_-6px_rgba(0,0,0,0.1)]',
        'dark:hover:shadow-[0_4px_8px_-2px_rgba(0,0,0,0.5),0_8px_20px_-6px_rgba(0,0,0,0.4)]',
        'hover:border-border/70 hover:-translate-y-px transition-all duration-150 select-none',
        selected && 'shadow-md',
        // Internal referral: sky tint + sky border so referred-in deals are
        // visually distinct from the rest of the recipient's pipeline.
        isInternalReferral && !selected &&
          'border-sky-300/70 dark:border-sky-700/70 bg-sky-50/40 dark:bg-sky-950/20',
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
      {/* Stage accent stripe — full-height ribbon on the left edge. Gives the
          card a strong visual anchor by stage colour even when scrolled. */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: ringColor }}
      />

      {/* Selection checkbox — top-right. Visually hidden until hover or
          selection so it doesn't crowd the card by default. */}
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

      {/* Header: name + temperatura + meta */}
      <div className={cn('min-w-0', onToggleSelect && 'pr-6')}>
        <p className="font-semibold text-[13px] text-foreground leading-tight truncate flex items-center gap-1.5">
          {tempColor && (
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: tempColor }}
              title={temperatura ? `Temperatura: ${temperatura}` : undefined}
            />
          )}
          <span className="truncate">{contactName}</span>
          {tempEmoji && <span aria-hidden className="text-[11px] shrink-0">{tempEmoji}</span>}
        </p>

        {/* Meta row — typology · localização · source. Single line,
            truncates to keep the card compact. */}
        {metaParts.length > 0 && (
          <p className="text-[10px] text-muted-foreground leading-snug truncate mt-0.5 flex items-center gap-1">
            {typology && <Home className="h-2.5 w-2.5 shrink-0 opacity-70" />}
            {!typology && localizacao && <MapPin className="h-2.5 w-2.5 shrink-0 opacity-70" />}
            <span className="truncate">{metaParts.join(' · ')}</span>
          </p>
        )}

        {/* Phone — tap-to-call without triggering the card navigation. */}
        {contact?.telemovel && (
          <a
            href={`tel:${contact.telemovel}`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            draggable={false}
            className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors tabular-nums"
          >
            <Phone className="h-2.5 w-2.5" />
            <span>{contact.telemovel}</span>
          </a>
        )}
      </div>

      {/* Referral badges — internal (consultor → consultor) takes precedence
          visually because it changes the card's whole tone. has_referral is
          the legacy partner/external referral flag and stays compact. */}
      {(isInternalReferral || hasReferral) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {isInternalReferral && (
            <Badge
              variant="secondary"
              className="text-[9px] h-4 px-1.5 py-0 rounded-full gap-0.5 bg-sky-500/15 text-sky-700 dark:text-sky-300 hover:bg-sky-500/15 max-w-[200px]"
            >
              <Send className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">
                {referrerName ? `Ref. ${referrerName}` : 'Referenciado'}
              </span>
              {referralPct !== null && Number.isFinite(referralPct) ? (
                <span className="shrink-0 tabular-nums">{referralPct}%</span>
              ) : null}
              {referralCommission !== null && referralCommission > 0 ? (
                <span className="shrink-0 tabular-nums">
                  · {formatEUR(referralCommission)}
                </span>
              ) : null}
            </Badge>
          )}
          {hasReferral && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 py-0 rounded-full gap-0.5">
              <Sparkles className="h-2.5 w-2.5" />
              Ref.{negocio.referral_side === 'angariacao' ? ' Ang.' : negocio.referral_side === 'comprador' ? ' Comp.' : ''}
              {negocio.referral_pct ? ` ${negocio.referral_pct}%` : ''}
            </Badge>
          )}
        </div>
      )}

      {/* Value — primary financial signal. Tabular-nums for column alignment. */}
      {hasValue && (
        <div className="mt-2 flex items-baseline gap-1.5">
          <Euro className="h-3 w-3 text-muted-foreground self-center" />
          {valueLabel && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {valueLabel}
            </span>
          )}
          <span className="text-[15px] font-bold tabular-nums leading-none text-foreground">
            {formatEUR(displayValue!)}
          </span>
        </div>
      )}

      {/* Footer: consultor avatar + name · days in stage */}
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/30 gap-2">
        {isOwnDeal ? (
          <span aria-hidden />
        ) : consultant?.commercial_name ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar size="sm" className="h-5 w-5">
              {consultant.profile?.profile_photo_url && (
                <AvatarImage
                  src={consultant.profile.profile_photo_url}
                  alt={consultant.commercial_name}
                />
              )}
              <AvatarFallback
                className={cn(
                  'text-[9px] font-semibold',
                  paletteFor(consultant.commercial_name).bg,
                  paletteFor(consultant.commercial_name).text,
                )}
              >
                {initialsFromName(consultant.commercial_name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-[10px] text-muted-foreground truncate">
              {consultant.commercial_name}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground/50 italic">Sem consultor</span>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {slaOverdue ? (
            <Badge variant="destructive" className="h-4 px-1.5 text-[10px] font-medium gap-0.5 rounded-full tabular-nums">
              <AlertTriangle className="h-2.5 w-2.5" />
              {daysInStage}d
            </Badge>
          ) : (
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground tabular-nums">
              <Clock className="h-2.5 w-2.5" />
              <span>{daysInStage}d</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
