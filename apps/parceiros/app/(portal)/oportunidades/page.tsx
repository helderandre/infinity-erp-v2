'use client'

import { useEffect, useMemo, useState } from 'react'
// Real CRM negocios board, scoped to deals from the partner's referred leads.
import { KanbanBoard } from '@/components/crm/kanban-board'
// Mesmo sheet de detalhe do ERP principal, em modo partnerView (read-only,
// sem Imóveis/Matching, com tab Histórico). Os dados vêm do endpoint bundled
// /api/parceiros/oportunidades/[id], proxied para o ERP via catch-all.
import { NegocioDetailSheet } from '@/components/crm/negocio-detail-sheet'
import { useUser } from '@/hooks/use-user'
import { formatEUR } from '@/hooks/use-partner-ledger'
import type { PipelineType } from '@/types/leads-crm'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { Search, X, SlidersHorizontal, Check, ChevronsUpDown } from 'lucide-react'

export const dynamic = 'force-dynamic'

const TABS: { key: PipelineType; label: string }[] = [
  { key: 'comprador', label: 'Compradores' },
  { key: 'vendedor', label: 'Vendedores' },
  { key: 'arrendatario', label: 'Arrendatários' },
  { key: 'arrendador', label: 'Senhorios' },
]

interface PipelineStageOption {
  id: string
  name: string
  color: string | null
  order_index: number
}

interface ConsultantOption {
  id: string
  commercial_name: string
}

interface OppFilters {
  search: string
  pipelineStageId: string
  temperatura: string
  localizacao: string
  consultantId: string
}

const EMPTY_FILTERS: OppFilters = {
  search: '',
  pipelineStageId: '',
  temperatura: '',
  localizacao: '',
  consultantId: '',
}

export default function OportunidadesPage() {
  const { user } = useUser()
  // Referred Meta-campaign leads are buyer registrations, so default to the
  // Compradores pipeline (where the referred deals live).
  const [tab, setTab] = useState<PipelineType>('comprador')
  const [filters, setFilters] = useState<OppFilters>(EMPTY_FILTERS)
  // Oportunidade aberta no sheet de detalhe (click num card do board).
  const [openNegocioId, setOpenNegocioId] = useState<string | null>(null)

  // Stage options for the active pipeline + the consultores that work the
  // partner's referred deals (drives the Consultor filter).
  const [stages, setStages] = useState<PipelineStageOption[]>([])
  const [consultants, setConsultants] = useState<ConsultantOption[]>([])
  const [consultantPickerOpen, setConsultantPickerOpen] = useState(false)

  // Potential commission (the partner's referrer slice) per pipeline, summed
  // across all in-pipeline deals — recomputed whenever the filters change so
  // the figures at the top always match what the board is showing.
  const [potential, setPotential] = useState<Record<string, number> | null>(null)

  // ── Load stages for the active pipeline (for the Estado filter). ──
  useEffect(() => {
    let cancelled = false
    fetch(`/api/crm/pipeline-stages?pipeline_type=${tab}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PipelineStageOption[]) => {
        if (!cancelled) setStages((data || []).sort((a, b) => a.order_index - b.order_index))
      })
      .catch(() => !cancelled && setStages([]))
    return () => { cancelled = true }
  }, [tab])

  // ── Load consultores once. ──
  useEffect(() => {
    let cancelled = false
    fetch('/api/users/consultants')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ConsultantOption[]) => {
        if (!cancelled) setConsultants(data || [])
      })
      .catch(() => !cancelled && setConsultants([]))
    return () => { cancelled = true }
  }, [])

  // Reset the (pipeline-scoped) stage filter when switching pipeline tab.
  useEffect(() => {
    setFilters((f) => ({ ...f, pipelineStageId: '' }))
  }, [tab])

  // ── Recompute the per-pipeline potential, respecting the active filters. ──
  // Cross-pipeline filters (search/temperatura/localizacao/consultor) apply to
  // every breakdown cell; the stage filter is pipeline-specific so it only
  // touches the active tab's cell. The kanban API already folds these into
  // totals.possible_commission when scoped by referrer_consultant_id.
  const filtersKey = JSON.stringify(filters)
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const buildParams = (key: PipelineType) => {
      const params = new URLSearchParams({ referrer_consultant_id: user.id })
      if (filters.search) params.set('search', filters.search)
      if (filters.temperatura) params.set('temperatura', filters.temperatura)
      if (filters.localizacao) params.set('localizacao', filters.localizacao)
      if (filters.consultantId) params.set('assigned_consultant_id', filters.consultantId)
      // Stage ids are pipeline-scoped — only meaningful on the active tab.
      if (filters.pipelineStageId && key === tab) {
        params.set('pipeline_stage_id', filters.pipelineStageId)
      }
      return params.toString()
    }
    Promise.all(
      TABS.map((t) =>
        fetch(`/api/crm/kanban/${t.key}?${buildParams(t.key)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => [t.key, Number(d?.totals?.possible_commission) || 0] as const)
          .catch(() => [t.key, 0] as const),
      ),
    ).then((pairs) => {
      if (!cancelled) setPotential(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tab, filtersKey])

  const total = potential
    ? Object.values(potential).reduce((s, v) => s + v, 0)
    : null

  const hasActiveFilters = !!(
    filters.search ||
    filters.pipelineStageId ||
    filters.temperatura ||
    filters.localizacao ||
    filters.consultantId
  )
  const clearFilters = () => setFilters(EMPTY_FILTERS)

  // Filters propagated to the board — referrerConsultantId keeps it scoped to
  // the partner's referrals; the rest mirror the main app's CRM filters.
  const boardFilters = useMemo(
    () => ({
      referrerConsultantId: user?.id ?? '',
      consultantId: filters.consultantId || undefined,
      pipelineStageId: filters.pipelineStageId || undefined,
      temperatura: filters.temperatura || undefined,
      localizacao: filters.localizacao || undefined,
      search: filters.search || undefined,
    }),
    [user?.id, filters],
  )

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-neutral-900 px-6 py-7 text-center sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">As minhas oportunidades</h1>
        <p className="mt-1 text-sm text-white/50">Negócios gerados a partir das suas referências</p>

        {/* Potencial total + breakdown per pipeline — compact */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Potencial total</span>
          <span className="text-xl font-bold tabular-nums text-white">
            {total !== null ? formatEUR(total) : '—'}
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {TABS.map((t) => (
            <div
              key={t.key}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 backdrop-blur-sm"
            >
              <p className="truncate text-[8px] font-medium uppercase tracking-wider text-white/40">{t.label}</p>
              <p className="text-xs font-semibold tabular-nums text-white">
                {potential ? formatEUR(potential[t.key] ?? 0) : '—'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline tabs + filter row — tabs on the left, filters on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600 ring-1 ring-black/5 hover:bg-neutral-100',
                )}
              >
                <span className={cn(active ? 'inline' : 'hidden sm:inline')}>{t.label}</span>
                <span className={cn(active ? 'hidden' : 'inline sm:hidden')}>{t.label.slice(0, 1)}</span>
              </button>
            )
          })}
        </div>

        {/* Filtros — mesma estrutura da página Oportunidades do ERP. */}
        <div className="flex items-center gap-1.5">
          {/* Pesquisa */}
          <div className="relative w-[180px] sm:w-[220px]">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2" />
            <Input
              placeholder="Pesquisar por nome..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="pl-8 pr-7 rounded-full h-8 text-xs bg-card/90 backdrop-blur-sm border border-border/30 shadow-sm"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, search: '' }))}
                className="text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2"
                aria-label="Limpar pesquisa"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Filtros popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="relative shrink-0 inline-flex items-center justify-center sm:gap-1.5 h-8 w-8 sm:w-auto sm:px-3 rounded-full bg-card/90 backdrop-blur-sm border border-border/30 shadow-sm text-xs text-muted-foreground hover:bg-card transition-colors"
                aria-label="Filtros"
              >
                <SlidersHorizontal className="h-3 w-3 text-muted-foreground" />
                <span className="hidden sm:inline">Filtros</span>
                {hasActiveFilters && (
                  <span className="absolute sm:static -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sky-400 ring-2 ring-background sm:ring-0" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3 space-y-3">
              {/* Consultor — o filtro mais relevante para o parceiro: qual
                  consultor está a trabalhar a referência. */}
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Consultor</p>
                <Popover open={consultantPickerOpen} onOpenChange={setConsultantPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={consultantPickerOpen}
                      className="h-9 w-full rounded-full text-xs justify-between font-normal"
                    >
                      <span className="truncate">
                        {filters.consultantId
                          ? consultants.find((c) => c.id === filters.consultantId)?.commercial_name ?? 'Consultor'
                          : 'Todos os consultores'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar consultor..." className="h-9" />
                      <CommandList>
                        <CommandEmpty>Nenhum consultor encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="todos"
                            onSelect={() => {
                              setFilters((f) => ({ ...f, consultantId: '' }))
                              setConsultantPickerOpen(false)
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', !filters.consultantId ? 'opacity-100' : 'opacity-0')} />
                            Todos os consultores
                          </CommandItem>
                          {consultants.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.commercial_name}
                              onSelect={() => {
                                setFilters((f) => ({ ...f, consultantId: c.id }))
                                setConsultantPickerOpen(false)
                              }}
                            >
                              <Check
                                className={cn('mr-2 h-4 w-4', filters.consultantId === c.id ? 'opacity-100' : 'opacity-0')}
                              />
                              {c.commercial_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Estado (stage) */}
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Estado</p>
                <Select
                  value={filters.pipelineStageId || 'all'}
                  onValueChange={(v) => setFilters((f) => ({ ...f, pipelineStageId: v === 'all' ? '' : v }))}
                >
                  <SelectTrigger className="h-9 w-full rounded-full text-xs">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os estados</SelectItem>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color || '#94a3b8' }} />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Temperatura */}
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Temperatura</p>
                <Select
                  value={filters.temperatura || 'all'}
                  onValueChange={(v) => setFilters((f) => ({ ...f, temperatura: v === 'all' ? '' : v }))}
                >
                  <SelectTrigger className="h-9 w-full rounded-full text-xs">
                    <SelectValue placeholder="Temperatura" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualquer temperatura</SelectItem>
                    <SelectItem value="Frio">❄️ Frio</SelectItem>
                    <SelectItem value="Morno">🌤️ Morno</SelectItem>
                    <SelectItem value="Quente">🔥 Quente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Localização */}
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Localização</p>
                <div className="relative">
                  <Input
                    placeholder="Ex.: Lisboa, Cascais…"
                    value={filters.localizacao}
                    onChange={(e) => setFilters((f) => ({ ...f, localizacao: e.target.value }))}
                    className="h-9 rounded-full text-xs pr-7"
                  />
                  {filters.localizacao && (
                    <button
                      type="button"
                      onClick={() => setFilters((f) => ({ ...f, localizacao: '' }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Limpar localização"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="rounded-full text-xs w-full h-8 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Limpar filtros
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* referrerConsultantId scopes the board to deals the partner referred;
          read-only with the stripped-down partner card. Only mount once we
          have the user id — otherwise the board fires an initial fetch without
          the referrer filter and flashes an empty/incorrect board on login. */}
      {user?.id ? (
        <KanbanBoard
          pipelineType={tab}
          filters={boardFilters}
          readOnly
          cardVariant="partner"
          onCardClick={(n) => setOpenNegocioId(n.id)}
        />
      ) : (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="min-w-[230px] w-[230px] flex-shrink-0 space-y-2">
              <div className="h-16 w-full rounded-2xl bg-muted/50 animate-pulse" />
              <div className="h-24 w-full rounded-xl bg-muted/40 animate-pulse" />
              <div className="h-24 w-full rounded-xl bg-muted/40 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Detalhe da oportunidade — read-only, sem Imóveis/Matching, com
          a tab Histórico (tudo o que o consultor fez). */}
      <NegocioDetailSheet
        negocioId={openNegocioId}
        open={!!openNegocioId}
        onOpenChange={(o) => {
          if (!o) setOpenNegocioId(null)
        }}
        partnerView
      />
    </div>
  )
}
