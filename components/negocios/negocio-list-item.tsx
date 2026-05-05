'use client'

import { format, isToday, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Briefcase, Calendar, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NegocioListItemData {
  id: string
  tipo: string | null
  business_type?: string | null
  tipo_imovel?: string | null
  quartos_min?: number | null
  localizacao?: string | null
  orcamento?: number | null
  orcamento_max?: number | null
  preco_venda?: number | null
  temperatura?: string | null
  estado?: string | null
  created_at: string
  leads_pipeline_stages?: { name?: string | null; color?: string | null } | null
  pipeline_stage?: { name?: string | null; color?: string | null } | null
}

const fmt = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const TIPO_TAG: Record<string, { color: string; label: string }> = {
  Comprador:    { color: '#3b82f6', label: 'Comprador' },
  Vendedor:     { color: '#10b981', label: 'Vendedor' },
  Arrendatário: { color: '#f59e0b', label: 'Arrendatário' },
  Senhorio:     { color: '#fb923c', label: 'Senhorio' },
  Compra:       { color: '#3b82f6', label: 'Comprador' },
  Venda:        { color: '#10b981', label: 'Vendedor' },
  Arrendador:   { color: '#fb923c', label: 'Senhorio' },
}

const TEMP_TAG: Record<string, { color: string; emoji: string; label: string }> = {
  'Frio': { color: '#3b82f6', emoji: '❄️', label: 'Frio' },
  'Morno': { color: '#f59e0b', emoji: '🌤️', label: 'Morno' },
  'Quente': { color: '#ef4444', emoji: '🔥', label: 'Quente' },
}

// Business type — operação económica do negócio. Cores escolhidas
// para distinguir das do tipo (perspective).
const BIZ_TYPE_TAG: Record<string, { color: string; label: string }> = {
  'Venda': { color: '#0ea5e9', label: 'Venda' },           // sky-500
  'Arrendamento': { color: '#a855f7', label: 'Arrendamento' }, // purple-500
  'Trespasse': { color: '#f97316', label: 'Trespasse' },   // orange-500
}

interface NegocioListItemProps {
  negocio: NegocioListItemData
  onSelect: () => void
  onDelete?: () => void
}

/**
 * Negócio list item — mini "background card" estilo glassmorphism
 * (gradient neutro + 2 mini mesh blobs + border) match com o aside
 * do profile e com o right pane outer. Cada item parece um pequeno
 * pedaço de vidro fosco a flutuar dentro do gray glass do pane.
 *
 * Border + soft shadow servem para destacar o item do gradient pai
 * (que tem cor muito parecida — sem isto fundiam-se).
 */
export function NegocioListItem({ negocio, onSelect, onDelete }: NegocioListItemProps) {
  const tipo = negocio.tipo || ''
  const tipoTag = TIPO_TAG[tipo] || { color: '#64748b', label: tipo || 'Oportunidade' }
  const tempTag = negocio.temperatura ? TEMP_TAG[negocio.temperatura] : null

  const stage = negocio.leads_pipeline_stages || negocio.pipeline_stage
  const stageName = stage?.name || negocio.estado || null
  const stageColor = stage?.color || '#64748b'

  let createdDate: Date | null = null
  try {
    createdDate = negocio.created_at ? parseISO(negocio.created_at) : null
  } catch {
    createdDate = null
  }
  const isNewToday = createdDate ? isToday(createdDate) : false

  const subjectBits: string[] = []
  if (negocio.tipo_imovel) subjectBits.push(negocio.tipo_imovel)
  if (negocio.quartos_min) subjectBits.push(`T${negocio.quartos_min}+`)
  const subject = subjectBits.join(' ')
  const title = subject || tipoTag.label

  const bizType = negocio.business_type ? BIZ_TYPE_TAG[negocio.business_type] : null

  const minPrice = negocio.orcamento ?? negocio.preco_venda
  const maxPrice = negocio.orcamento_max
  const priceStr =
    minPrice && maxPrice && maxPrice !== minPrice
      ? `${fmt.format(minPrice)} – ${fmt.format(maxPrice)}`
      : minPrice
      ? fmt.format(minPrice)
      : null

  return (
    <div
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl border transition-all',
        // Mais claro — quase branco com tint subtil para se destacar
        // do gray glass do pane parent.
        'bg-gradient-to-br from-white via-neutral-50 to-white',
        'dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-800',
        'border-white/70 dark:border-white/10',
        'shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.6),0_2px_8px_-2px_rgb(0_0_0_/_0.08),0_1px_2px_-1px_rgb(0_0_0_/_0.04)]',
        'hover:shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.7),0_4px_12px_-2px_rgb(0_0_0_/_0.1),0_1px_3px_-1px_rgb(0_0_0_/_0.06)]',
      )}
    >
      {/* Mini mesh blobs — neutros muito subtis para acompanhar o
          tom claro sem voltar a parecer gray médio. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -top-10 -left-8 h-32 w-32 rounded-full bg-neutral-200/40 dark:bg-neutral-700/30 blur-2xl" />
        <div className="absolute -bottom-10 -right-8 h-32 w-32 rounded-full bg-neutral-100/60 dark:bg-neutral-700/30 blur-2xl" />
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="relative w-full text-left flex items-center gap-3 p-3"
      >
        {/* Icon — colorido (identifica tipo) num square translúcido */}
        <div
          className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/50 dark:border-white/10"
          style={{ backgroundColor: `${tipoTag.color}1f`, color: tipoTag.color }}
        >
          <Briefcase className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0 space-y-0.5">
          {/* Title row + "NOVO" label discreta */}
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold leading-tight truncate flex-1 pr-6">
              {title}
              {negocio.localizacao && (
                <span className="text-muted-foreground font-normal"> · {negocio.localizacao}</span>
              )}
            </p>
            {isNewToday && (
              <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0">
                Novo
              </span>
            )}
          </div>

          {/* Stage chip — prominente, na cor da fase. Comunica o
              estado do negócio com peso visual claro. */}
          {stageName && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: `${stageColor}1f`,
                  color: stageColor,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stageColor }} />
                {stageName}
              </span>
              {bizType && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: `${bizType.color}1a`,
                    color: bizType.color,
                  }}
                >
                  {bizType.label}
                </span>
              )}
            </div>
          )}

          {/* Sub-meta — tipo / temp via dots monocromáticos */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tipoTag.color }} />
              <span>{tipoTag.label}</span>
            </span>
            {!stageName && bizType && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span style={{ color: bizType.color }} className="font-medium">{bizType.label}</span>
              </>
            )}
            {tempTag && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span aria-hidden>{tempTag.emoji}</span>
              </>
            )}
          </div>

          {/* Price + date — bottom row */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {priceStr && (
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {priceStr}
              </span>
            )}
            {createdDate && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 ml-auto">
                <Calendar className="h-2.5 w-2.5" />
                {format(createdDate, "d MMM yyyy", { locale: pt })}
              </span>
            )}
          </div>
        </div>
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute top-3 right-3 z-10 h-7 w-7 inline-flex items-center justify-center rounded-full bg-white/40 dark:bg-white/5 backdrop-blur-sm text-muted-foreground/50 hover:text-destructive hover:bg-white/70 dark:hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
          aria-label="Eliminar oportunidade"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
