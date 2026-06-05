'use client'

import { Home, Euro, MapPin, Landmark, Pencil, Ruler, Building2 } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

const eur = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function formatRange(min: number | null, max: number | null, suffix = ''): string | null {
  if (min == null && max == null) return null
  if (min != null && max != null) {
    if (min === max) return `${eur.format(min)}${suffix}`
    return `${eur.format(min)} – ${eur.format(max)}${suffix}`
  }
  if (min != null) return `desde ${eur.format(min)}${suffix}`
  return `até ${eur.format(max!)}${suffix}`
}

const AMENITY_ITEMS: { field: string; emoji: string; label: string }[] = [
  { field: 'tem_elevador', emoji: '🏗️', label: 'Elevador' },
  { field: 'tem_estacionamento', emoji: '🅿️', label: 'Estacionamento' },
  { field: 'tem_garagem', emoji: '🚗', label: 'Garagem' },
  { field: 'tem_exterior', emoji: '🌿', label: 'Exterior' },
  { field: 'tem_varanda', emoji: '🌸', label: 'Varanda' },
  { field: 'tem_piscina', emoji: '🏊', label: 'Piscina' },
  { field: 'tem_porteiro', emoji: '🔒', label: 'Porteiro' },
  { field: 'tem_arrumos', emoji: '📦', label: 'Arrumos' },
  { field: 'tem_carregamento_ev', emoji: '🔌', label: 'EV' },
  { field: 'tem_praia', emoji: '🏖️', label: 'Praia' },
  { field: 'tem_quintal', emoji: '🌳', label: 'Quintal' },
  { field: 'tem_terraco', emoji: '☀️', label: 'Terraço' },
  { field: 'tem_jardim', emoji: '🌻', label: 'Jardim' },
  { field: 'tem_mobilado', emoji: '🛋️', label: 'Mobilado' },
  { field: 'tem_arrecadacao', emoji: '🗄️', label: 'Arrecadação' },
  { field: 'tem_aquecimento', emoji: '🔥', label: 'Aquecimento' },
  { field: 'tem_cozinha_equipada', emoji: '🍳', label: 'Cozinha Eq.' },
  { field: 'tem_ar_condicionado', emoji: '❄️', label: 'AC' },
  { field: 'tem_energias_renovaveis', emoji: '♻️', label: 'Renováveis' },
  { field: 'tem_gas', emoji: '🔵', label: 'Gás' },
  { field: 'tem_seguranca', emoji: '🛡️', label: 'Segurança' },
  { field: 'tem_transportes', emoji: '🚇', label: 'Transportes' },
  { field: 'tem_vistas', emoji: '🏔️', label: 'Vistas' },
]

interface NegocioImovelSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientName: string
  tipo: string
  isBuyerType: boolean
  form: Record<string, unknown>
  onOpenFullEdit?: () => void
}

// ─── Helpers ───────────────────────────────────────────────────────────

type Item = { label: string; value: string }

function bool(v: unknown): boolean | null {
  if (v === true) return true
  if (v === false) return false
  return null
}

function num(form: Record<string, unknown>, field: string): number | null {
  const v = form[field]
  return typeof v === 'number' && !Number.isNaN(v) ? v : null
}

function str(form: Record<string, unknown>, field: string): string | null {
  const v = form[field]
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

// ─── Section wrapper ────────────────────────────────────────────────────

function GlassSection({
  icon, iconColor, title, children,
}: {
  icon: React.ReactNode
  iconColor: 'sky' | 'violet' | 'rose' | 'amber' | 'indigo' | 'teal'
  title: string
  children: React.ReactNode
}) {
  const ringMap: Record<typeof iconColor, string> = {
    sky: 'from-sky-400/25 to-sky-600/5 ring-sky-500/25',
    violet: 'from-violet-400/25 to-violet-600/5 ring-violet-500/25',
    rose: 'from-rose-400/25 to-rose-600/5 ring-rose-500/25',
    amber: 'from-amber-400/25 to-amber-600/5 ring-amber-500/25',
    indigo: 'from-indigo-400/25 to-indigo-600/5 ring-indigo-500/25',
    teal: 'from-teal-400/25 to-teal-600/5 ring-teal-500/25',
  } as const
  return (
    <section className="rounded-2xl border border-border/40 bg-background/55 supports-[backdrop-filter]:bg-background/35 backdrop-blur-2xl shadow-[0_4px_14px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('inline-flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br ring-1 ring-inset', ringMap[iconColor])}>
          {icon}
        </span>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      </div>
      {children}
    </section>
  )
}

function ItemGrid({ items }: { items: Item[] }) {
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{it.label}</p>
          <p className="text-sm font-semibold tracking-tight truncate">{it.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────

export function NegocioImovelSheet({
  open, onOpenChange, clientName, tipo, isBuyerType, form, onOpenFullEdit,
}: NegocioImovelSheetProps) {
  const isMobile = useIsMobile()

  // Tipo discrimination (post-refactor accepts both legacy and new)
  const isCompra = tipo === 'Comprador' || tipo === 'Compra'
  const isVenda = tipo === 'Vendedor' || tipo === 'Venda'
  const isArrendatario = tipo === 'Arrendatário'
  const isArrendador = tipo === 'Senhorio' || tipo === 'Arrendador'
  const isSeller = isVenda || isArrendador
  // (isBuyerType prop also covers the "Compra e Venda" case for the buyer side)

  // ── Price ─────────────────────────────────────────────────────────────
  const priceLabel = isArrendatario
    ? 'Renda máxima'
    : isArrendador
      ? 'Renda pretendida'
      : isBuyerType
        ? 'Orçamento'
        : 'Preço pretendido'

  const price = (() => {
    if (isArrendatario) return formatRange(null, num(form, 'renda_max_mensal'), '/mês')
    if (isArrendador) return formatRange(null, num(form, 'renda_pretendida'), '/mês')
    if (isBuyerType) return formatRange(num(form, 'orcamento'), num(form, 'orcamento_max'))
    return formatRange(num(form, 'preco_venda'), num(form, 'preco_venda_max'))
  })()

  // ── Specs (changes per tipo) ──────────────────────────────────────────
  const tipoImovel = str(form, 'tipo_imovel')
  const estadoImovel = str(form, 'estado_imovel')
  const classeImovel = str(form, 'classe_imovel')

  // Buyer-side: ranges/minima (procura)
  const buyerSpecs = (() => {
    const items: Item[] = []
    if (tipoImovel) items.push({ label: 'Tipo', value: tipoImovel })
    const quartosMin = num(form, 'quartos_min')
    const quartosMax = num(form, 'quartos_max')
    if (quartosMin != null && quartosMax != null) {
      items.push({ label: 'Tipologia', value: quartosMin === quartosMax ? `T${quartosMin}` : `T${quartosMin} – T${quartosMax}` })
    } else if (quartosMin != null) {
      items.push({ label: 'Tipologia', value: `T${quartosMin}+` })
    } else if (quartosMax != null) {
      items.push({ label: 'Tipologia', value: `até T${quartosMax}` })
    }
    const wcMin = num(form, 'wc_min') ?? num(form, 'num_wc')
    if (wcMin != null) items.push({ label: 'WCs', value: `≥ ${wcMin}` })
    const areaMin = num(form, 'area_min_m2')
    if (areaMin != null) items.push({ label: 'Área', value: `≥ ${areaMin} m²` })
    if (estadoImovel) items.push({ label: 'Estado', value: estadoImovel })
    if (classeImovel) items.push({ label: 'Classe', value: classeImovel })
    return items
  })()

  // Seller-side: actual property fields
  const sellerSpecs = (() => {
    const items: Item[] = []
    if (tipoImovel) items.push({ label: 'Tipo', value: tipoImovel })
    const quartos = num(form, 'quartos')
    if (quartos != null) items.push({ label: 'Quartos', value: String(quartos) })
    const casasBanho = num(form, 'casas_banho')
    if (casasBanho != null) items.push({ label: 'Casas de banho', value: String(casasBanho) })
    const area = num(form, 'area_m2')
    if (area != null) items.push({ label: 'Área', value: `${area} m²` })
    const totalDivisoes = num(form, 'total_divisoes')
    if (totalDivisoes != null) items.push({ label: 'Total divisões', value: String(totalDivisoes) })
    if (estadoImovel) items.push({ label: 'Estado', value: estadoImovel })
    if (classeImovel) items.push({ label: 'Classe', value: classeImovel })
    return items
  })()

  const specs = isSeller ? sellerSpecs : buyerSpecs

  // ── Localização ───────────────────────────────────────────────────────
  const zones: string[] = (() => {
    const structured = form.zonas as Array<{ label?: string }> | null | undefined
    if (Array.isArray(structured) && structured.length > 0) {
      const labels = structured
        .map((z) => (typeof z?.label === 'string' ? z.label : null))
        .filter((s): s is string => !!s && s.trim() !== '')
      if (labels.length > 0) return labels
    }
    const raw = str(form, 'localizacao') ?? ''
    const split = raw.split(',').map((z) => z.trim()).filter(Boolean)
    if (split.length > 0) return split
    return [form.distrito, form.concelho, form.freguesia]
      .filter(Boolean)
      .map((v) => String(v))
  })()

  // Seller side also has explicit district/county/parish — surface them
  const sellerLocItems: Item[] = (() => {
    if (!isSeller) return []
    const items: Item[] = []
    const localizacao = str(form, 'localizacao')
    if (localizacao) items.push({ label: 'Localização', value: localizacao })
    const distrito = str(form, 'distrito')
    if (distrito) items.push({ label: 'Distrito', value: distrito })
    const concelho = str(form, 'concelho')
    if (concelho) items.push({ label: 'Concelho', value: concelho })
    const freguesia = str(form, 'freguesia')
    if (freguesia) items.push({ label: 'Freguesia', value: freguesia })
    return items
  })()

  // ── Contexto + financiamento (Comprador/Arrendatário) ─────────────────
  const buyerContextItems: Item[] = (() => {
    if (!isCompra && !isArrendatario) return []
    const items: Item[] = []
    const motivacao = str(form, 'motivacao_compra')
    if (motivacao) items.push({ label: 'Motivação', value: motivacao })
    const prazo = str(form, 'prazo_compra')
    if (prazo) items.push({ label: 'Prazo', value: prazo })
    if (isArrendatario) {
      const situacaoProfissional = str(form, 'situacao_profissional')
      if (situacaoProfissional) items.push({ label: 'Situação', value: situacaoProfissional })
      const rendimento = num(form, 'rendimento_mensal')
      if (rendimento != null) items.push({ label: 'Rendimento', value: `${eur.format(rendimento)}/mês` })
      const fiador = bool(form.tem_fiador)
      if (fiador !== null) items.push({ label: 'Fiador', value: fiador ? 'Sim' : 'Não' })
      const mobilado = bool(form.mobilado)
      if (mobilado !== null) items.push({ label: 'Mobilado', value: mobilado ? 'Sim' : 'Não' })
    }
    return items
  })()

  const financiamento = bool(form.financiamento_necessario)
  const capitalProprio = num(form, 'capital_proprio')
  const creditoPreAprovado = bool(form.credito_pre_aprovado)
  const valorCredito = num(form, 'valor_credito')

  // ── Condições do arrendador ───────────────────────────────────────────
  const arrendadorItems: Item[] = (() => {
    if (!isArrendador) return []
    const items: Item[] = []
    const duracao = str(form, 'duracao_minima_contrato')
    if (duracao) items.push({ label: 'Duração mínima', value: duracao })
    const caucao = num(form, 'caucao_rendas')
    if (caucao != null) items.push({ label: 'Caução (rendas)', value: String(caucao) })
    const animais = bool(form.aceita_animais)
    if (animais !== null) items.push({ label: 'Aceita animais', value: animais ? 'Sim' : 'Não' })
    const mobilado = bool(form.mobilado)
    if (mobilado !== null) items.push({ label: 'Mobilado', value: mobilado ? 'Sim' : 'Não' })
    return items
  })()

  // ── Amenities ─────────────────────────────────────────────────────────
  const enabledAmenities = AMENITY_ITEMS.filter((a) => !!form[a.field])

  const hasAnything = !!price || specs.length > 0 || zones.length > 0 || sellerLocItems.length > 0
    || buyerContextItems.length > 0 || arrendadorItems.length > 0 || enabledAmenities.length > 0
    || (isBuyerType && financiamento !== null)

  const sectionLabel = isSeller ? 'Imóvel' : 'O que procura'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0 border-border/40 shadow-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
            : 'w-full sm:max-w-[560px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}
        <SheetHeader
          className={cn(
            'px-6 pb-4 border-b border-border/40 shrink-0 flex-row items-start justify-between gap-3',
            isMobile ? 'pt-8' : 'pt-6',
          )}
        >
          <div className="min-w-0 flex-1">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Home className="h-5 w-5" />
              {sectionLabel}
            </SheetTitle>
            <SheetDescription className="text-[12px] truncate">{clientName}</SheetDescription>
          </div>
          {onOpenFullEdit && (
            <button
              type="button"
              onClick={onOpenFullEdit}
              className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border/60 bg-background hover:bg-muted/50 active:scale-[0.97] transition-colors text-[11px] font-medium tracking-tight text-foreground/85 mr-10"
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
              Editar
            </button>
          )}
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-3">
          {/* Preço — número grande dominante */}
          <section className="rounded-2xl border border-border/40 bg-background/55 supports-[backdrop-filter]:bg-background/35 backdrop-blur-2xl shadow-[0_4px_14px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400/25 to-emerald-600/5 ring-1 ring-inset ring-emerald-500/25 shrink-0 mt-0.5">
                <Euro className="h-4 w-4 text-emerald-700 dark:text-emerald-300" strokeWidth={2.25} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{priceLabel}</p>
                {price ? (
                  <p className="text-2xl font-bold tabular-nums leading-tight tracking-tight mt-0.5">{price}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic mt-1">Não definido</p>
                )}
              </div>
            </div>
          </section>

          {/* Especificações */}
          {specs.length > 0 && (
            <GlassSection
              icon={<Ruler className="h-3.5 w-3.5 text-sky-700 dark:text-sky-300" strokeWidth={2.25} />}
              iconColor="sky"
              title="Especificações"
            >
              <ItemGrid items={specs} />
            </GlassSection>
          )}

          {/* Localização (Vendedor / Senhorio) ou Zonas (Comprador / Arrendatário) */}
          {(sellerLocItems.length > 0 || zones.length > 0) && (
            <GlassSection
              icon={<MapPin className="h-3.5 w-3.5 text-indigo-700 dark:text-indigo-300" strokeWidth={2.25} />}
              iconColor="indigo"
              title={isSeller ? 'Localização' : 'Zonas de interesse'}
            >
              {sellerLocItems.length > 0 && (
                <div className={cn(zones.length > 0 && 'mb-3')}>
                  <ItemGrid items={sellerLocItems} />
                </div>
              )}
              {zones.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {zones.map((z) => (
                    <span
                      key={z}
                      className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur-sm ring-1 ring-inset ring-indigo-500/25 px-3 py-1 text-[11px] font-medium text-foreground/85"
                    >
                      <MapPin className="h-3 w-3 shrink-0 text-indigo-600 dark:text-indigo-300" strokeWidth={2.25} />
                      {z}
                    </span>
                  ))}
                </div>
              )}
            </GlassSection>
          )}

          {/* Contexto (Comprador / Arrendatário) + Financiamento (Comprador) */}
          {(buyerContextItems.length > 0 || (isBuyerType && financiamento !== null)) && (
            <GlassSection
              icon={<Landmark className="h-3.5 w-3.5 text-violet-700 dark:text-violet-300" strokeWidth={2.25} />}
              iconColor="violet"
              title="Contexto"
            >
              {buyerContextItems.length > 0 && (
                <div className={cn(isBuyerType && financiamento !== null && 'mb-3')}>
                  <ItemGrid items={buyerContextItems} />
                </div>
              )}
              {isBuyerType && financiamento !== null && (
                <div className={cn(buyerContextItems.length > 0 && 'pt-3 border-t border-border/40')}>
                  {financiamento === false ? (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur-sm ring-1 ring-inset ring-emerald-500/25 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                      <Landmark className="h-3 w-3" strokeWidth={2.25} />
                      Capitais próprios
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur-sm ring-1 ring-inset ring-amber-500/30 px-3 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                        <Landmark className="h-3 w-3" strokeWidth={2.25} />
                        Necessita financiamento
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {capitalProprio != null && (
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">Capital próprio</p>
                            <p className="text-sm font-semibold tracking-tight truncate">{eur.format(capitalProprio)}</p>
                          </div>
                        )}
                        {creditoPreAprovado !== null && (
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">Pré-aprovado</p>
                            <p className="text-sm font-semibold tracking-tight truncate">{creditoPreAprovado ? 'Sim' : 'Não'}</p>
                          </div>
                        )}
                        {valorCredito != null && (
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">Valor crédito</p>
                            <p className="text-sm font-semibold tracking-tight truncate">{eur.format(valorCredito)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </GlassSection>
          )}

          {/* Condições (Arrendador / Senhorio) */}
          {arrendadorItems.length > 0 && (
            <GlassSection
              icon={<Building2 className="h-3.5 w-3.5 text-teal-700 dark:text-teal-300" strokeWidth={2.25} />}
              iconColor="teal"
              title="Condições"
            >
              <ItemGrid items={arrendadorItems} />
            </GlassSection>
          )}

          {/* Características / Amenities */}
          {enabledAmenities.length > 0 && (
            <GlassSection
              icon={<span className="text-[13px]" aria-hidden>✨</span>}
              iconColor="rose"
              title="Características"
            >
              <div className="flex flex-wrap gap-1.5">
                {enabledAmenities.map((a) => (
                  <span
                    key={a.field}
                    className="inline-flex items-center gap-1 rounded-full bg-background/60 backdrop-blur-sm ring-1 ring-inset ring-border/40 px-2.5 py-1 text-[11px] font-medium text-foreground/80"
                  >
                    <span aria-hidden>{a.emoji}</span>
                    {a.label}
                  </span>
                ))}
              </div>
            </GlassSection>
          )}

          {!hasAnything && (
            <div className="rounded-2xl border border-dashed border-border/40 bg-background/30 backdrop-blur-xl px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">Sem informação registada sobre o imóvel.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
