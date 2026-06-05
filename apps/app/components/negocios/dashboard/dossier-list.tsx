'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Building2,
  CalendarDays,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { NEGOCIO_PROPERTY_STATUS } from '@/lib/constants'
import type { NegocioProperty } from '@/types/lead'
import {
  PropertyReactionButtons,
  type ClientReaction,
} from './property-reaction-buttons'

interface DossierListProps {
  negocioId: string
  properties: NegocioProperty[]
  selectedRowIds: Set<string>
  dossierScores: Map<string, { score: number; reason: string }>
  isLoadingDossierScores?: boolean
  onToggleSelect: (rowId: string) => void
  onSelectAll: (select: boolean) => void
  onClassifyAI: () => void
  onAddExternal: () => void
  onPreviewProperty: (propertyId: string) => void
  onScheduleVisit: (propertyId?: string) => void
  onRemoveProperty: (propId: string) => void
  onReactionChange: (negocioPropertyId: string, next: ClientReaction) => void
}

export function DossierList({
  negocioId,
  properties,
  selectedRowIds,
  dossierScores,
  isLoadingDossierScores,
  onToggleSelect,
  onSelectAll,
  onClassifyAI,
  onAddExternal,
  onPreviewProperty,
  onScheduleVisit,
  onRemoveProperty,
  onReactionChange,
}: DossierListProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return properties
    return properties.filter((ap) => {
      const isExternal = !ap.property_id && ap.external_url
      const p: any = ap.property
      const haystack = isExternal
        ? [ap.external_title, ap.external_url, ap.external_source]
        : [p?.title, p?.external_ref, p?.city, p?.zone, p?.address_street]
      return haystack.filter(Boolean).some((s: string) => s.toLowerCase().includes(q))
    })
  }, [properties, search])

  const allSelected =
    filtered.length > 0 && filtered.every((p) => selectedRowIds.has(p.id))
  const someSelected = filtered.some((p) => selectedRowIds.has(p.id))

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por título, referência, zona…"
          className="rounded-full pl-9 pr-9 h-9 bg-muted/40 border-border/50 focus-visible:bg-background"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full hover:bg-muted/50 inline-flex items-center justify-center text-muted-foreground"
            aria-label="Limpar pesquisa"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {properties.length === 0
              ? 'Sem imóveis no dossier'
              : `${filtered.length}${
                  search ? ` de ${properties.length}` : ''
                } imóv${filtered.length === 1 ? 'el' : 'eis'}`}
          </p>
          {filtered.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <Checkbox
                checked={
                  allSelected
                    ? true
                    : someSelected
                      ? 'indeterminate'
                      : false
                }
                onCheckedChange={(v) => onSelectAll(Boolean(v))}
              />
              Seleccionar todos
            </label>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {properties.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={onClassifyAI}
              disabled={isLoadingDossierScores}
            >
              {isLoadingDossierScores ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="mr-1 h-3 w-3" />
              )}
              Classificar IA
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs"
            onClick={onAddExternal}
          >
            <Link2 className="mr-1 h-3 w-3" /> Adicionar Link
          </Button>
        </div>
      </div>

      {/* List */}
      {properties.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
          <Search className="h-7 w-7 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Sem resultados</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Nenhum imóvel corresponde à pesquisa.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((ap) => (
            <DossierRow
              key={ap.id}
              negocioId={negocioId}
              row={ap}
              selected={selectedRowIds.has(ap.id)}
              dossierScore={ap.property_id ? dossierScores.get(ap.property_id) : undefined}
              onToggleSelect={() => onToggleSelect(ap.id)}
              onPreview={() => ap.property?.id && onPreviewProperty(ap.property.id)}
              onScheduleVisit={() => onScheduleVisit(ap.property?.id || undefined)}
              onRemove={() => onRemoveProperty(ap.id)}
              onReactionChange={(next) => onReactionChange(ap.id, next)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
      <Building2 className="h-8 w-8 text-muted-foreground/20 mb-2" />
      <p className="text-sm text-muted-foreground">Nenhum imóvel adicionado ao dossier</p>
      <p className="text-xs text-muted-foreground/60 mt-1 max-w-[280px]">
        Adicione imóveis a partir das sugestões (Matches) ou um link externo.
      </p>
    </div>
  )
}

interface DossierRowProps {
  negocioId: string
  row: NegocioProperty
  selected: boolean
  dossierScore?: { score: number; reason: string }
  onToggleSelect: () => void
  onPreview: () => void
  onScheduleVisit: () => void
  onRemove: () => void
  onReactionChange: (next: ClientReaction) => void
}

function DossierRow({
  negocioId,
  row,
  selected,
  dossierScore,
  onToggleSelect,
  onPreview,
  onScheduleVisit,
  onRemove,
  onReactionChange,
}: DossierRowProps) {
  const isExternal = !row.property_id && row.external_url
  const p: any = row.property
  const cover =
    p?.dev_property_media?.find((m: any) => m.is_cover)?.url ||
    p?.dev_property_media?.[0]?.url
  const specs = p?.dev_property_specifications
  const propStatus =
    NEGOCIO_PROPERTY_STATUS[row.status as keyof typeof NEGOCIO_PROPERTY_STATUS]
  const price = isExternal ? row.external_price : p?.listing_price
  const reaction = ((row as any).client_reaction as ClientReaction) || null
  const dScoreColor = dossierScore
    ? dossierScore.score >= 80
      ? 'bg-emerald-500 text-white'
      : dossierScore.score >= 60
        ? 'bg-amber-500 text-white'
        : dossierScore.score >= 40
          ? 'bg-orange-500 text-white'
          : 'bg-red-500 text-white'
    : ''

  const title = isExternal
    ? row.external_title || 'Link Externo'
    : p?.title || 'Imóvel'
  const meta = isExternal
    ? row.external_source || 'Portal externo'
    : [p?.external_ref, p?.city, p?.zone].filter(Boolean).join(' · ')

  return (
    <li
      className={cn(
        'group relative rounded-xl border bg-card/60 backdrop-blur-sm transition-colors',
        selected
          ? 'border-primary/60 ring-1 ring-primary/30 bg-primary/5'
          : 'border-border/60 hover:border-border',
      )}
    >
      <div className="flex items-stretch gap-3 px-3 py-2.5">
        {/* Checkbox */}
        <div className="flex items-center shrink-0">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label="Seleccionar imóvel"
          />
        </div>

        {/* Thumb */}
        <div className="h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-muted relative">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              {isExternal ? (
                <Globe className="h-5 w-5 text-muted-foreground/30" />
              ) : (
                <Building2 className="h-5 w-5 text-muted-foreground/30" />
              )}
            </div>
          )}
          {dossierScore && (
            <div className="absolute top-1 right-1">
              <span
                className={cn(
                  'inline-flex items-center text-[9px] font-bold px-1 py-px rounded-full',
                  dScoreColor,
                )}
              >
                {dossierScore.score}%
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">{title}</p>
            {price && (
              <span className="text-xs font-medium text-foreground/80 shrink-0">
                {(Number(price) / 1000).toFixed(0)}k €
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{meta}</p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
            {!isExternal && specs?.bedrooms && <span>{specs.bedrooms} quartos</span>}
            {!isExternal && specs?.area_util && <span>{specs.area_util} m²</span>}
            {row.sent_at && (
              <span className="text-emerald-600">
                · Enviado a {format(new Date(row.sent_at), "d 'de' MMM, HH:mm", { locale: pt })}
              </span>
            )}
            <Badge
              className={cn(
                'rounded-full text-[9px] px-2 border-0 ml-auto sm:ml-0',
                propStatus?.bg,
                propStatus?.text,
              )}
            >
              {propStatus?.label}
            </Badge>
          </div>
          {dossierScore?.reason && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic truncate">
              {dossierScore.reason}
            </p>
          )}
        </div>

        {/* Reactions */}
        <div className="flex items-center shrink-0">
          <PropertyReactionButtons
            negocioId={negocioId}
            negocioPropertyId={row.id}
            reaction={reaction}
            onReactionChange={onReactionChange}
          />
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            title="Agendar visita"
            onClick={(e) => {
              e.stopPropagation()
              onScheduleVisit()
            }}
          >
            <CalendarDays className="h-3.5 w-3.5" />
          </Button>
          {isExternal ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              title="Abrir link"
              onClick={() => window.open(row.external_url!, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          ) : (
            p?.id && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                title="Pré-visualizar"
                onClick={onPreview}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground/50 hover:text-destructive"
            title="Remover do dossier"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </li>
  )
}
