'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Search, Loader2, X, Building2, ClipboardList,
  Image as ImageIcon, Users as UsersIcon, FileWarning, CalendarClock,
  ChevronRight, ChevronDown,
} from 'lucide-react'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES,
  PROPERTY_STATUS,
} from '@/lib/constants'
import { useDebounce } from '@/hooks/use-debounce'
import { useIsMobile } from '@/hooks/use-mobile'

/* ───────── Filter value shape (mirrors page state) ───────── */

export interface AdvancedFiltersValue {
  selectedStatuses: string[]
  selectedPropertyTypes: string[]
  selectedBusinessTypes: string[]
  selectedConditions: string[]
  selectedConsultants: string[]
  selectedEnergyCertificates: string[]
  priceMin: string
  priceMax: string
  bedroomsMin: string
  bathroomsMin: string
  areaUtilMin: string
  areaUtilMax: string
  yearMin: string
  yearMax: string
  hasElevator: boolean
  hasPool: boolean
  parkingMin: string
  zone: string
  addressParish: string
  // Management
  missingCover: boolean
  missingOwners: boolean
  contractExpiringDays: string
}

interface PropertyFiltersPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: AdvancedFiltersValue
  onChange: (patch: Partial<AdvancedFiltersValue>) => void
  onClearAll: () => void
  consultants: { id: string; commercial_name: string }[]
  /** Current result count for the live "Ver N imóveis" footer. */
  liveCount: number | null
  liveLoading?: boolean
}

/* ───────── Bits & helpers ───────── */

const TIPOLOGY_OPTS = ['1', '2', '3', '4', '5'] as const

const STATUS_OPTS = Object.entries(PROPERTY_STATUS).map(([k, v]) => ({ value: k, label: v.label }))
const TYPE_OPTS = Object.entries(PROPERTY_TYPES).map(([k, v]) => ({ value: k, label: v as string }))
const BUSINESS_OPTS = Object.entries(BUSINESS_TYPES).map(([k, v]) => ({ value: k, label: v as string }))
const CONDITION_OPTS = Object.entries(PROPERTY_CONDITIONS).map(([k, v]) => ({ value: k, label: v as string }))
const ENERGY_OPTS = Object.entries(ENERGY_CERTIFICATES).map(([k, v]) => ({ value: k, label: v as string }))
const TIPOLOGY_CHOICES = TIPOLOGY_OPTS.map((v) => ({ value: v, label: `T${v}+` }))

const PRICE_PRESETS = [
  { label: '< 200k€', min: '', max: '200000' },
  { label: '200k – 400k', min: '200000', max: '400000' },
  { label: '400k – 700k', min: '400000', max: '700000' },
  { label: '700k – 1M', min: '700000', max: '1000000' },
  { label: '> 1M€', min: '1000000', max: '' },
] as const

function ChipGroup<T extends string>({
  options, selected, onToggle,
}: {
  options: { value: T; label: string }[]
  selected: T[]
  onToggle: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = selected.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={cn(
              'h-8 px-3 rounded-full text-xs font-medium border transition-colors',
              active
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background/40 text-muted-foreground border-border/50 hover:border-foreground/40 hover:text-foreground',
            )}
            aria-pressed={active}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Section({
  title, hint, children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2 py-4 border-b border-border/30 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </Label>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function RangeInputs({
  min, max, onMinChange, onMaxChange, suffix, placeholderMin = 'Min', placeholderMax = 'Máx',
}: {
  min: string
  max: string
  onMinChange: (v: string) => void
  onMaxChange: (v: string) => void
  suffix?: string
  placeholderMin?: string
  placeholderMax?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="relative">
        <Input
          type="number"
          inputMode="numeric"
          placeholder={placeholderMin}
          value={min}
          onChange={(e) => onMinChange(e.target.value)}
          className="h-9 text-xs pr-7 bg-background/40"
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>
        )}
      </div>
      <div className="relative">
        <Input
          type="number"
          inputMode="numeric"
          placeholder={placeholderMax}
          value={max}
          onChange={(e) => onMaxChange(e.target.value)}
          className="h-9 text-xs pr-7 bg-background/40"
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  )
}

function ToggleRow({
  icon: Icon, label, hint, checked, onChange,
}: {
  icon: React.ElementType
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'w-full flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors',
        checked
          ? 'bg-foreground text-background border-foreground'
          : 'bg-background/40 border-border/50 hover:border-foreground/40',
      )}
    >
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
        checked ? 'bg-background/15' : 'bg-muted/60',
      )}>
        <Icon className={cn('h-4 w-4', checked ? 'text-background' : 'text-muted-foreground')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {hint && (
          <p className={cn('text-[11px] mt-0.5', checked ? 'text-background/70' : 'text-muted-foreground')}>
            {hint}
          </p>
        )}
      </div>
      <div className={cn(
        'h-4 w-4 rounded-full border-2 shrink-0',
        checked ? 'border-background bg-background' : 'border-border',
      )} />
    </button>
  )
}

/* ───────── Consultor pill — single-line popover, persists across tabs ──── */

function ConsultantPill({
  consultants, selected, onChange,
}: {
  consultants: { id: string; commercial_name: string }[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 200)
  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q) return consultants
    return consultants.filter((c) => c.commercial_name.toLowerCase().includes(q))
  }, [consultants, debouncedQuery])

  useEffect(() => { if (!open) setQuery('') }, [open])

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  const summary = selected.length === 0
    ? 'Todos os consultores'
    : selected.length === 1
      ? consultants.find((c) => c.id === selected[0])?.commercial_name ?? '1 selecionado'
      : `${selected.length} selecionados`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-xs transition-colors',
            selected.length > 0
              ? 'bg-foreground text-background border-foreground'
              : 'bg-background/40 text-foreground border-border/50 hover:border-foreground/40',
          )}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <UsersIcon className={cn(
              'h-3.5 w-3.5 shrink-0',
              selected.length > 0 ? 'text-background' : 'text-muted-foreground',
            )} />
            <span className={cn(
              'truncate',
              selected.length === 0 && 'text-muted-foreground',
            )}>
              Consultor: <span className="font-medium">{summary}</span>
            </span>
          </span>
          <ChevronDown className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform',
            open && 'rotate-180',
          )} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-2 rounded-xl"
        align="start"
        sideOffset={4}
      >
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar consultor..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 text-xs pl-8 bg-background/40"
          />
        </div>
        <div className="max-h-56 overflow-y-auto -mx-1 px-1">
          {filtered.length === 0 ? (
            <p className="text-[11px] text-muted-foreground px-3 py-4 text-center">Sem resultados</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filtered.map((c) => {
                const active = selected.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
                      active ? 'bg-muted/60 font-medium' : 'hover:bg-muted/30',
                    )}
                  >
                    <span className="flex-1 text-left truncate">{c.commercial_name}</span>
                    {active && <span className="text-[10px] text-foreground/70">✓</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {selected.length > 0 && (
          <Button
            size="sm" variant="ghost"
            className="w-full h-7 text-xs mt-1"
            onClick={() => onChange([])}
          >
            <X className="mr-1 h-3 w-3" /> Limpar
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}

/* ───────── Inner content (shared by mobile sheet + desktop aside) ───────── */

function FiltersContent({
  value, onChange, consultants, onClearAll, liveCount, liveLoading, onClose,
}: PropertyFiltersPanelProps & { onClose: () => void }) {
  const [tab, setTab] = useState<'imovel' | 'gestao'>('imovel')
  const toggleIn = (arr: string[], v: string) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]

  const matchesPreset = (preset: typeof PRICE_PRESETS[number]) =>
    value.priceMin === preset.min && value.priceMax === preset.max

  return (
    <>
      {/* Header */}
      <div className="shrink-0 px-6 pt-8 pb-3 sm:pt-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[20px] font-semibold leading-tight tracking-tight">Filtros</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Refine a lista de imóveis
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-full"
              onClick={onClearAll}
            >
              Limpar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-full gap-1"
              onClick={onClose}
            >
              Fechar
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Consultor — single-line selector visible across both tabs */}
        {consultants.length > 0 && (
          <div className="mt-4">
            <ConsultantPill
              consultants={consultants}
              selected={value.selectedConsultants}
              onChange={(next) => onChange({ selectedConsultants: next })}
            />
          </div>
        )}

        {/* Tabs — calendar-style pill segmented control */}
        <div className="mt-3 flex w-fit p-0.5 rounded-full bg-muted/60 border border-border/30">
          <button
            type="button"
            onClick={() => setTab('imovel')}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-medium transition-all',
              tab === 'imovel' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Building2 className="h-3.5 w-3.5" />
            Imóvel
          </button>
          <button
            type="button"
            onClick={() => setTab('gestao')}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-medium transition-all',
              tab === 'gestao' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Gestão
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6">
        {tab === 'imovel' ? (
          <>
            <Section title="Localização">
              <div className="grid gap-2">
                <Input
                  placeholder="Zona (ex: Lisboa Centro)"
                  value={value.zone}
                  onChange={(e) => onChange({ zone: e.target.value })}
                  className="h-9 text-xs bg-background/40"
                />
                <Input
                  placeholder="Freguesia"
                  value={value.addressParish}
                  onChange={(e) => onChange({ addressParish: e.target.value })}
                  className="h-9 text-xs bg-background/40"
                />
              </div>
            </Section>

            <Section title="Estado">
              <ChipGroup
                options={STATUS_OPTS}
                selected={value.selectedStatuses}
                onToggle={(v) => onChange({ selectedStatuses: toggleIn(value.selectedStatuses, v) })}
              />
            </Section>

            <Section title="Negócio">
              <ChipGroup
                options={BUSINESS_OPTS}
                selected={value.selectedBusinessTypes}
                onToggle={(v) => onChange({ selectedBusinessTypes: toggleIn(value.selectedBusinessTypes, v) })}
              />
            </Section>

            <Section title="Preço" hint="€">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {PRICE_PRESETS.map((p) => {
                    const active = matchesPreset(p)
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => onChange({
                          priceMin: active ? '' : p.min,
                          priceMax: active ? '' : p.max,
                        })}
                        className={cn(
                          'h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors',
                          active
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-background/40 text-muted-foreground border-border/50 hover:border-foreground/40 hover:text-foreground',
                        )}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
                <RangeInputs
                  min={value.priceMin} max={value.priceMax}
                  onMinChange={(v) => onChange({ priceMin: v })}
                  onMaxChange={(v) => onChange({ priceMax: v })}
                  suffix="€"
                />
              </div>
            </Section>

            <Section title="Tipo de imóvel">
              <ChipGroup
                options={TYPE_OPTS}
                selected={value.selectedPropertyTypes}
                onToggle={(v) => onChange({ selectedPropertyTypes: toggleIn(value.selectedPropertyTypes, v) })}
              />
            </Section>

            <Section title="Tipologia">
              <div className="space-y-2">
                <ChipGroup
                  options={TIPOLOGY_CHOICES}
                  selected={value.bedroomsMin ? [value.bedroomsMin] : []}
                  onToggle={(v) => onChange({ bedroomsMin: value.bedroomsMin === v ? '' : v })}
                />
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Casas-de-banho mínimas</p>
                  <ChipGroup
                    options={[
                      { value: '1', label: '1+' },
                      { value: '2', label: '2+' },
                      { value: '3', label: '3+' },
                      { value: '4', label: '4+' },
                    ]}
                    selected={value.bathroomsMin ? [value.bathroomsMin] : []}
                    onToggle={(v) => onChange({ bathroomsMin: value.bathroomsMin === v ? '' : v })}
                  />
                </div>
              </div>
            </Section>

            <Section title="Área útil" hint="m²">
              <RangeInputs
                min={value.areaUtilMin} max={value.areaUtilMax}
                onMinChange={(v) => onChange({ areaUtilMin: v })}
                onMaxChange={(v) => onChange({ areaUtilMax: v })}
                suffix="m²"
              />
            </Section>

            <Section title="Ano de construção">
              <RangeInputs
                min={value.yearMin} max={value.yearMax}
                onMinChange={(v) => onChange({ yearMin: v })}
                onMaxChange={(v) => onChange({ yearMax: v })}
                placeholderMin="ex: 1990"
                placeholderMax="ex: 2024"
              />
            </Section>

            <Section title="Condição">
              <ChipGroup
                options={CONDITION_OPTS}
                selected={value.selectedConditions}
                onToggle={(v) => onChange({ selectedConditions: toggleIn(value.selectedConditions, v) })}
              />
            </Section>

            <Section title="Características">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onChange({ hasElevator: !value.hasElevator })}
                  className={cn(
                    'h-8 px-3 rounded-full text-xs font-medium border transition-colors',
                    value.hasElevator
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background/40 text-muted-foreground border-border/50 hover:border-foreground/40 hover:text-foreground',
                  )}
                  aria-pressed={value.hasElevator}
                >
                  Elevador
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ hasPool: !value.hasPool })}
                  className={cn(
                    'h-8 px-3 rounded-full text-xs font-medium border transition-colors',
                    value.hasPool
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background/40 text-muted-foreground border-border/50 hover:border-foreground/40 hover:text-foreground',
                  )}
                  aria-pressed={value.hasPool}
                >
                  Piscina
                </button>
                <ChipGroup
                  options={[
                    { value: '1', label: 'Estac. 1+' },
                    { value: '2', label: '2+' },
                    { value: '3', label: '3+' },
                  ]}
                  selected={value.parkingMin ? [value.parkingMin] : []}
                  onToggle={(v) => onChange({ parkingMin: value.parkingMin === v ? '' : v })}
                />
              </div>
            </Section>

            <Section title="Certificado energético">
              <ChipGroup
                options={ENERGY_OPTS}
                selected={value.selectedEnergyCertificates}
                onToggle={(v) => onChange({ selectedEnergyCertificates: toggleIn(value.selectedEnergyCertificates, v) })}
              />
            </Section>

          </>
        ) : (
          /* ── Gestão tab ─────────────────────────────────────────── */
          <>
            <Section title="Documentação">
              <div className="space-y-2">
                <ToggleRow
                  icon={ImageIcon}
                  label="Sem capa"
                  hint="Imóveis sem foto definida como capa"
                  checked={value.missingCover}
                  onChange={(v) => onChange({ missingCover: v })}
                />
                <ToggleRow
                  icon={UsersIcon}
                  label="Sem proprietários"
                  hint="Nenhum owner associado"
                  checked={value.missingOwners}
                  onChange={(v) => onChange({ missingOwners: v })}
                />
              </div>
            </Section>

            <Section title="Contrato a expirar">
              <ChipGroup
                options={[
                  { value: '30', label: '30 dias' },
                  { value: '60', label: '60 dias' },
                  { value: '90', label: '90 dias' },
                ]}
                selected={value.contractExpiringDays ? [value.contractExpiringDays] : []}
                onToggle={(v) => onChange({ contractExpiringDays: value.contractExpiringDays === v ? '' : v })}
              />
              <p className="text-[10px] text-muted-foreground mt-1.5 inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                Próximos N dias, exclui contratos já expirados.
              </p>
            </Section>

            <Section title="Em breve">
              <div className="rounded-2xl border border-dashed border-border/40 px-3 py-3 text-[11px] text-muted-foreground space-y-1">
                <p className="inline-flex items-center gap-1.5">
                  <FileWarning className="h-3 w-3" />
                  Estado do processo · Documentos legais em falta · CPCV pendente
                </p>
              </div>
            </Section>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-6 py-3 border-t border-border/40 flex items-center justify-between gap-3 bg-background/40 backdrop-blur-xl">
        <p className="text-xs text-muted-foreground">
          {liveLoading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              A actualizar...
            </span>
          ) : liveCount === null ? (
            '—'
          ) : (
            <>Ver <span className="font-semibold text-foreground tabular-nums">{liveCount}</span> imóve{liveCount === 1 ? 'l' : 'is'}</>
          )}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full h-8 text-xs"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Fechar
        </Button>
      </div>
    </>
  )
}

/* ───────── Public wrapper ───────── */

export function PropertyFiltersSheet(props: PropertyFiltersPanelProps) {
  const isMobile = useIsMobile()
  const { open, onOpenChange } = props

  // Reset transient state in body when closing on mobile.
  useEffect(() => { if (!open) {/* noop */} }, [open])

  // ── Mobile: classic overlay sheet (above content) ──
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
            'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
            'data-[side=bottom]:h-[85dvh] rounded-t-3xl',
          )}
        >
          <VisuallyHidden>
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Refinar a lista de imóveis</SheetDescription>
          </VisuallyHidden>
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
          <SheetHeader className="sr-only">
            <SheetTitle>Filtros</SheetTitle>
          </SheetHeader>
          <FiltersContent {...props} onClose={() => onOpenChange(false)} />
        </SheetContent>
      </Sheet>
    )
  }

  // ── Desktop: rendered inline by the page (`<PropertyFiltersAside>`) ──
  return null
}

/**
 * Desktop-only push-aside panel. Render alongside the property list inside
 * a flex container so opening it compresses the list, instead of overlaying.
 *
 * Animation: enters by sliding leftwards from the right edge into place
 * (`slide-in-from-right`), exits by sliding rightwards off-screen
 * (`slide-out-to-right`). We delay the unmount with `shouldRender` so the
 * exit animation has time to play before removing the node.
 */
export function PropertyFiltersAside(props: PropertyFiltersPanelProps) {
  const { open, onOpenChange } = props
  const [shouldRender, setShouldRender] = useState(open)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      setIsClosing(false)
    } else if (shouldRender) {
      setIsClosing(true)
      const t = setTimeout(() => {
        setShouldRender(false)
        setIsClosing(false)
      }, 220)
      return () => clearTimeout(t)
    }
  }, [open, shouldRender])

  if (!shouldRender) return null
  return (
    <aside
      className={cn(
        'hidden md:flex shrink-0 w-[400px] lg:w-[440px] flex-col self-start',
        'sticky top-4 max-h-[calc(100dvh-2rem)] overflow-hidden',
        'rounded-3xl border border-border/40 shadow-xl',
        'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
        'duration-200 ease-out',
        isClosing
          ? 'animate-out fade-out slide-out-to-right-12'
          : 'animate-in fade-in slide-in-from-right-12',
      )}
    >
      <FiltersContent {...props} onClose={() => onOpenChange(false)} />
    </aside>
  )
}
