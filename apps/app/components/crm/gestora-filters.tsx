'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, isValid, parseISO, startOfDay, subDays } from 'date-fns'
import { pt } from 'date-fns/locale'
import { CalendarIcon, Search, X, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PeriodPreset = 'all' | 'today' | '7d' | '30d' | 'custom'

export interface GestoraFiltersValue {
  agentId: string // '' = todos
  q: string
  period: PeriodPreset
  from: string | null // YYYY-MM-DD
  to: string | null
  source: string
  campaignId: string
  overdueBucket: string // '' | 'lt_24h' | '1_3d' | '3_7d' | 'gt_7d'
  sector: string
}

export const EMPTY_GESTORA_FILTERS: GestoraFiltersValue = {
  agentId: '',
  q: '',
  period: 'all',
  from: null,
  to: null,
  source: '',
  campaignId: '',
  overdueBucket: '',
  sector: '',
}

const SOURCE_OPTIONS = [
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'website', label: 'Website' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'partner', label: 'Parceiro' },
  { value: 'organic', label: 'Orgânico' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone_call', label: 'Chamada' },
  { value: 'social_media', label: 'Redes Sociais' },
  { value: 'manual', label: 'Manual' },
  { value: 'voice', label: 'Voz' },
  { value: 'other', label: 'Outro' },
]

const SECTOR_OPTIONS = [
  { value: 'real_estate_buy', label: 'Compra' },
  { value: 'real_estate_sell', label: 'Venda' },
  { value: 'real_estate_rent', label: 'Arrendamento' },
  { value: 'recruitment', label: 'Recrutamento' },
  { value: 'credit', label: 'Crédito' },
]

const OVERDUE_BUCKETS = [
  { value: 'lt_24h', label: '< 24h' },
  { value: '1_3d', label: '1 – 3 dias' },
  { value: '3_7d', label: '3 – 7 dias' },
  { value: 'gt_7d', label: '> 7 dias' },
]

interface Agent {
  id: string
  name: string
}

interface Campaign {
  id: string
  name: string
  platform?: string | null
}

interface GestoraFiltersProps {
  value: GestoraFiltersValue
  onChange: (next: GestoraFiltersValue) => void
  agents: Agent[]
  /** When tab does not allow consultor filter (e.g. Pool) hide it. */
  showAgent?: boolean
  /** Overdue bucket only makes sense on the "Em Atraso" tab. */
  showOverdueBucket?: boolean
}

/**
 * Computes preset → (from, to) tuple. Returns nulls for 'all' and 'custom'
 * (caller keeps explicit dates for custom).
 */
function presetRange(preset: PeriodPreset): { from: string | null; to: string | null } {
  const today = startOfDay(new Date())
  const toStr = format(today, 'yyyy-MM-dd')
  if (preset === 'today') return { from: toStr, to: toStr }
  if (preset === '7d') return { from: format(subDays(today, 6), 'yyyy-MM-dd'), to: toStr }
  if (preset === '30d') return { from: format(subDays(today, 29), 'yyyy-MM-dd'), to: toStr }
  return { from: null, to: null }
}

export function GestoraFilters({
  value,
  onChange,
  agents,
  showAgent = true,
  showOverdueBucket = false,
}: GestoraFiltersProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [campaignsOpen, setCampaignsOpen] = useState(false)

  // Debounce search input locally so we don't refire the parent fetch on every
  // keystroke. The displayed value is local; the parent only sees committed q.
  const [qLocal, setQLocal] = useState(value.q)
  useEffect(() => setQLocal(value.q), [value.q])
  useEffect(() => {
    if (qLocal === value.q) return
    const t = setTimeout(() => onChange({ ...value, q: qLocal }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qLocal])

  // Fetch campaigns once. The dropdown is rarely used, so we lazy-load on
  // first open via a small `useEffect` triggered the first time the popover
  // opens — but the simplest UX is to just fetch on mount.
  useEffect(() => {
    let cancelled = false
    setCampaignsLoading(true)
    fetch('/api/crm/campaigns')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return
        setCampaigns(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCampaignsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const periodLabel = useMemo(() => {
    if (value.period === 'today') return 'Hoje'
    if (value.period === '7d') return 'Últimos 7 dias'
    if (value.period === '30d') return 'Últimos 30 dias'
    if (value.period === 'custom') {
      if (value.from && value.to) {
        const f = parseISO(value.from)
        const t = parseISO(value.to)
        if (isValid(f) && isValid(t)) {
          return `${format(f, 'dd/MM/yy', { locale: pt })} – ${format(t, 'dd/MM/yy', { locale: pt })}`
        }
      }
      if (value.from && isValid(parseISO(value.from))) return `A partir de ${format(parseISO(value.from), 'dd/MM/yy', { locale: pt })}`
      if (value.to && isValid(parseISO(value.to))) return `Até ${format(parseISO(value.to), 'dd/MM/yy', { locale: pt })}`
      return 'Personalizado'
    }
    return 'Qualquer período'
  }, [value.period, value.from, value.to])

  const hasActive =
    !!value.agentId ||
    !!value.q ||
    value.period !== 'all' ||
    !!value.source ||
    !!value.campaignId ||
    !!value.overdueBucket ||
    !!value.sector

  // Filters behind the popover (everything except the inline search box).
  const hasPopoverActive =
    !!value.agentId ||
    value.period !== 'all' ||
    !!value.source ||
    !!value.campaignId ||
    !!value.overdueBucket ||
    !!value.sector

  const handlePeriodChange = (preset: PeriodPreset) => {
    if (preset === 'all') {
      onChange({ ...value, period: 'all', from: null, to: null })
      return
    }
    if (preset === 'custom') {
      onChange({ ...value, period: 'custom' }) // keep existing from/to
      return
    }
    const { from, to } = presetRange(preset)
    onChange({ ...value, period: preset, from, to })
  }

  return (
    <div className="flex items-center gap-2">
      {/* Pesquisa — sempre visível */}
      <div className="relative flex-1 min-w-[120px] sm:w-[220px] sm:flex-initial">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={qLocal}
          onChange={(e) => setQLocal(e.target.value)}
          placeholder="Pesquisar..."
          className="h-8 w-full rounded-full pl-8 pr-7 text-xs"
        />
        {qLocal && (
          <button
            type="button"
            onClick={() => setQLocal('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar pesquisa"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filtros — um único botão que abre o popover com todos os filtros */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="relative shrink-0 inline-flex items-center justify-center sm:gap-1.5 h-8 w-8 sm:w-auto sm:px-3 rounded-full bg-card/90 backdrop-blur-sm border border-border/30 shadow-sm text-xs text-muted-foreground hover:bg-card transition-colors"
            aria-label="Filtros"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filtros</span>
            {hasPopoverActive && (
              <span className="absolute sm:static -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sky-400 ring-2 ring-background sm:ring-0" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3 space-y-3">
          {/* Consultor */}
          {showAgent && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Consultor</p>
              <Select
                value={value.agentId || 'all'}
                onValueChange={(v) => onChange({ ...value, agentId: v === 'all' ? '' : v })}
              >
                <SelectTrigger className="h-9 w-full rounded-full text-xs">
                  <SelectValue placeholder="Consultor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os consultores</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Período */}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Período</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-9 w-full rounded-full text-xs justify-start font-normal',
                    value.period !== 'all' && 'border-primary/40 bg-primary/5',
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                  {periodLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { value: 'all', label: 'Qualquer período' },
                        { value: 'today', label: 'Hoje' },
                        { value: '7d', label: 'Últimos 7 dias' },
                        { value: '30d', label: 'Últimos 30 dias' },
                        { value: 'custom', label: 'Personalizado' },
                      ] as { value: PeriodPreset; label: string }[]
                    ).map((p) => (
                      <Button
                        key={p.value}
                        size="sm"
                        variant={value.period === p.value ? 'default' : 'outline'}
                        className="h-7 rounded-full text-[11px]"
                        onClick={() => handlePeriodChange(p.value)}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                  {value.period === 'custom' && (
                    <div className="border-t pt-3 mt-1">
                      <Calendar
                        mode="range"
                        selected={{
                          from: value.from && isValid(parseISO(value.from)) ? parseISO(value.from) : undefined,
                          to: value.to && isValid(parseISO(value.to)) ? parseISO(value.to) : undefined,
                        }}
                        onSelect={(range) => {
                          onChange({
                            ...value,
                            period: 'custom',
                            from: range?.from ? format(range.from, 'yyyy-MM-dd') : null,
                            to: range?.to ? format(range.to, 'yyyy-MM-dd') : null,
                          })
                        }}
                        locale={pt}
                        numberOfMonths={1}
                        captionLayout="dropdown"
                        fromYear={2020}
                        toYear={new Date().getFullYear() + 1}
                      />
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Origem */}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Origem</p>
            <Select
              value={value.source || 'all'}
              onValueChange={(v) => onChange({ ...value, source: v === 'all' ? '' : v })}
            >
              <SelectTrigger className="h-9 w-full rounded-full text-xs">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                {SOURCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campanha */}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Campanha</p>
            <Popover open={campaignsOpen} onOpenChange={setCampaignsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={campaignsOpen}
                  size="sm"
                  className={cn(
                    'h-9 w-full rounded-full text-xs justify-between font-normal',
                    value.campaignId && 'border-primary/40 bg-primary/5',
                  )}
                >
                  <span className="truncate">
                    {value.campaignId
                      ? campaigns.find((c) => c.id === value.campaignId)?.name ?? 'Campanha'
                      : campaignsLoading
                        ? 'A carregar…'
                        : 'Todas as campanhas'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Pesquisar campanha..." className="h-8" />
                  <CommandList>
                    <CommandEmpty>Sem campanhas.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__all__ todas"
                        onSelect={() => { onChange({ ...value, campaignId: '' }); setCampaignsOpen(false) }}
                      >
                        <Check className={cn('mr-2 h-3.5 w-3.5', !value.campaignId ? 'opacity-100' : 'opacity-0')} />
                        Todas as campanhas
                      </CommandItem>
                      {campaigns.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.name} ${c.platform ?? ''}`}
                          onSelect={() => { onChange({ ...value, campaignId: c.id }); setCampaignsOpen(false) }}
                        >
                          <Check className={cn('mr-2 h-3.5 w-3.5', value.campaignId === c.id ? 'opacity-100' : 'opacity-0')} />
                          <span className="truncate">{c.name}</span>
                          {c.platform && (
                            <span className="ml-auto text-[10px] text-muted-foreground capitalize">{c.platform}</span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Tempo em atraso */}
          {showOverdueBucket && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tempo em atraso</p>
              <Select
                value={value.overdueBucket || 'all'}
                onValueChange={(v) => onChange({ ...value, overdueBucket: v === 'all' ? '' : v })}
              >
                <SelectTrigger className="h-9 w-full rounded-full text-xs">
                  <SelectValue placeholder="Tempo em atraso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer atraso</SelectItem>
                  {OVERDUE_BUCKETS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Sector */}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Sector</p>
            <Select
              value={value.sector || 'all'}
              onValueChange={(v) => onChange({ ...value, sector: v === 'all' ? '' : v })}
            >
              <SelectTrigger className="h-9 w-full rounded-full text-xs">
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os sectores</SelectItem>
                {SECTOR_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full rounded-full text-xs text-muted-foreground"
              onClick={() => onChange(EMPTY_GESTORA_FILTERS)}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar filtros
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
