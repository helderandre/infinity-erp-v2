'use client'

import { format, isToday, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Briefcase, Sparkles, Calendar, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NegocioListItemData {
  id: string
  tipo: string | null
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
  'Compra': { color: '#3b82f6', label: 'Compra' },
  'Venda': { color: '#10b981', label: 'Venda' },
  'Compra e Venda': { color: '#8b5cf6', label: 'C+V' },
  'Arrendatário': { color: '#f59e0b', label: 'Arrendatário' },
  'Arrendador': { color: '#fb923c', label: 'Senhorio' },
}

const TEMP_TAG: Record<string, { color: string; emoji: string; label: string }> = {
  'Frio': { color: '#3b82f6', emoji: '❄️', label: 'Frio' },
  'Morno': { color: '#f59e0b', emoji: '🌤️', label: 'Morno' },
  'Quente': { color: '#ef4444', emoji: '🔥', label: 'Quente' },
}

interface NegocioListItemProps {
  negocio: NegocioListItemData
  onSelect: () => void
  onDelete?: () => void
}

export function NegocioListItem({ negocio, onSelect, onDelete }: NegocioListItemProps) {
  const tipo = negocio.tipo || ''
  const tipoTag = TIPO_TAG[tipo] || { color: '#64748b', label: tipo || 'Negócio' }
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
        'group relative w-full rounded-2xl border backdrop-blur-sm transition-colors',
        isNewToday
          ? 'border-amber-400/70 bg-amber-50/70 dark:bg-amber-500/15 hover:bg-amber-100/80 dark:hover:bg-amber-500/20'
          : 'border-border/40 bg-background/60 hover:bg-background/80',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left flex items-center gap-4 p-3"
      >
        <div
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${tipoTag.color}1a`, color: tipoTag.color }}
        >
          <Briefcase className="h-7 w-7" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isNewToday && (
              <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                <Sparkles className="h-2.5 w-2.5" />
                Novo hoje
              </span>
            )}
            <span
              className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${tipoTag.color}1a`, color: tipoTag.color }}
            >
              {tipoTag.label}
            </span>
            {tempTag && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${tempTag.color}1a`, color: tempTag.color }}
              >
                <span aria-hidden>{tempTag.emoji}</span>
                {tempTag.label}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold leading-tight truncate pr-8">
            {title}
            {negocio.localizacao && (
              <span className="text-muted-foreground font-normal"> em {negocio.localizacao}</span>
            )}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {stageName && (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stageColor }} />
                <span className="truncate">{stageName}</span>
              </span>
            )}
            {stageName && priceStr && <span className="text-muted-foreground/40">·</span>}
            {priceStr && (
              <span className="tabular-nums font-semibold text-foreground">{priceStr}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
            {createdDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-2.5 w-2.5" />
                {format(createdDate, "d 'de' MMM yyyy", { locale: pt })}
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
          className="absolute top-3 right-3 h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground/40 hover:text-destructive transition-all opacity-0 group-hover:opacity-100"
          aria-label="Eliminar negócio"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
