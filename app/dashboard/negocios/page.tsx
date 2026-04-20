'use client'


import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/shared/empty-state'
import { MultiSelectFilter } from '@/components/shared/multi-select-filter'
import { MobileFilterSheet } from '@/components/shared/mobile-filter-sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Briefcase,
  Search,
  X,
  MoreHorizontal,
  Trash2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Plus,
  Building2,
  Users,
} from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import { usePersistentState } from '@/hooks/use-persistent-filters'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { DealForm } from '@/components/financial/deal-form'
import {
  getDeals,
  getConsultantsForSelect,
  cancelDeal,
} from '@/app/dashboard/comissoes/deals/actions'
import type { Deal, DealStatus, DealScenario } from '@/types/deal'
import { DEAL_SCENARIOS, DEAL_STATUSES } from '@/types/deal'

const PAGE_SIZE = 25

const fmtCurrency = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const SCENARIO_COLORS: Record<DealScenario, string> = {
  pleno: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30 dark:text-emerald-300',
  comprador_externo: 'bg-blue-500/15 text-blue-700 border-blue-400/30 dark:text-blue-300',
  pleno_agencia: 'bg-indigo-500/15 text-indigo-700 border-indigo-400/30 dark:text-indigo-300',
  angariacao_externa: 'bg-amber-500/15 text-amber-700 border-amber-400/30 dark:text-amber-300',
}

const STATUS_DOTS: Record<DealStatus, string> = {
  draft: 'bg-slate-400',
  submitted: 'bg-amber-500',
  active: 'bg-blue-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-500',
}

const scenarioOptions = (Object.keys(DEAL_SCENARIOS) as DealScenario[]).map((k) => ({
  value: k,
  label: DEAL_SCENARIOS[k].label,
}))

const statusOptions = (Object.keys(DEAL_STATUSES) as DealStatus[]).map((k) => ({
  value: k,
  label: DEAL_STATUSES[k].label,
  dot: STATUS_DOTS[k],
}))

const ALL_STATUS_KEYS = statusOptions.map((o) => o.value)
const DEFAULT_STATUSES: DealStatus[] = ['draft', 'submitted', 'active', 'completed']

function NegociosPageInner() {
  return (
    <Suspense fallback={<NegociosPageSkeleton />}>
      <NegociosPageContent />
    </Suspense>
  )
}

function NegociosPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-10 w-full" />
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-16" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function NegociosPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [deals, setDeals] = useState<Deal[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [viewMode, setViewMode] = usePersistentState<'table' | 'grid'>(
    'negocios-view-mode',
    'table'
  )

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [selectedScenarios, setSelectedScenarios] = usePersistentState<string[]>(
    'negocios-filter-scenarios',
    []
  )
  const [selectedStatuses, setSelectedStatuses] = usePersistentState<string[]>(
    'negocios-filter-statuses',
    DEFAULT_STATUSES as string[]
  )
  const [consultantId, setConsultantId] = usePersistentState<string>(
    'negocios-filter-consultant',
    searchParams.get('consultant_id') || 'all'
  )
  const [dateFrom, setDateFrom] = usePersistentState<string>('negocios-filter-date-from', '')
  const [dateTo, setDateTo] = usePersistentState<string>('negocios-filter-date-to', '')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)

  const debouncedSearch = useDebounce(search, 300)

  const hasStatusFilter = selectedStatuses.length > 0 && selectedStatuses.length < ALL_STATUS_KEYS.length

  const hasActiveFilters =
    debouncedSearch !== '' ||
    selectedScenarios.length > 0 ||
    hasStatusFilter ||
    consultantId !== 'all' ||
    dateFrom !== '' ||
    dateTo !== ''

  const loadDeals = useCallback(async () => {
    setIsLoading(true)
    try {
      // getDeals supports single-value filters — we apply scenario multi/status multi/search client-side
      const { deals: data, total: count, error } = await getDeals({
        consultant_id: consultantId !== 'all' ? consultantId : undefined,
        deal_type: selectedScenarios.length === 1 ? selectedScenarios[0] : undefined,
        status: hasStatusFilter && selectedStatuses.length === 1 ? selectedStatuses[0] : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
      })

      if (error) {
        toast.error(error)
        setDeals([])
        setTotal(0)
        return
      }

      // Client-side refinement when multi-select filters are used or search is set
      let filtered = data
      if (selectedScenarios.length > 1) {
        filtered = filtered.filter((d) => selectedScenarios.includes(d.deal_type))
      }
      if (hasStatusFilter && selectedStatuses.length > 1) {
        filtered = filtered.filter((d) => selectedStatuses.includes(d.status))
      }
      if (hasStatusFilter && selectedStatuses.length === 0) {
        filtered = []
      }
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        filtered = filtered.filter((d) =>
          [d.reference, d.pv_number, d.property?.title, d.property?.external_ref, d.consultant?.commercial_name, d.notes]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
        )
      }

      setDeals(filtered)
      setTotal(count)
    } catch {
      setDeals([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [consultantId, selectedScenarios, selectedStatuses, hasStatusFilter, dateFrom, dateTo, debouncedSearch, page])

  const loadConsultants = useCallback(async () => {
    try {
      const { consultants: data } = await getConsultantsForSelect()
      setConsultants(data)
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    loadDeals()
  }, [loadDeals])

  useEffect(() => {
    loadConsultants()
  }, [loadConsultants])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, selectedScenarios, selectedStatuses, consultantId, dateFrom, dateTo])

  const handleCancel = async () => {
    if (!cancelId) return
    try {
      const res = await cancelDeal(cancelId)
      if (res.error) throw new Error(res.error)
      toast.success('Negócio cancelado')
      loadDeals()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar negócio')
    } finally {
      setCancelId(null)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setSelectedScenarios([])
    setSelectedStatuses(DEFAULT_STATUSES as string[])
    setConsultantId('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const openDetail = (d: Deal) => {
    router.push(`/dashboard/comissoes/deals/${d.id}`)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  const consultantOptions = consultants.map((c) => ({
    value: c.id,
    label: c.commercial_name,
  }))

  const activeFilterCount =
    selectedScenarios.length +
    (hasStatusFilter ? selectedStatuses.length : 0) +
    (consultantId !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)

  const filterButtons = (
    <>
      <MultiSelectFilter
        title="Cenário"
        options={scenarioOptions}
        selected={selectedScenarios}
        onSelectedChange={setSelectedScenarios}
      />
      <MultiSelectFilter
        title="Estado"
        options={statusOptions}
        selected={selectedStatuses}
        onSelectedChange={setSelectedStatuses}
      />
      {consultants.length > 0 && (
        <MultiSelectFilter
          title="Consultor"
          options={consultantOptions}
          selected={consultantId !== 'all' ? [consultantId] : []}
          onSelectedChange={(vals) => setConsultantId(vals[0] || 'all')}
          searchable
        />
      )}
      <Input
        type="date"
        value={dateFrom}
        onChange={(e) => setDateFrom(e.target.value)}
        className="h-9 w-[140px] text-sm rounded-full bg-muted/50 border-0"
        placeholder="De"
      />
      <Input
        type="date"
        value={dateTo}
        onChange={(e) => setDateTo(e.target.value)}
        className="h-9 w-[140px] text-sm rounded-full bg-muted/50 border-0"
        placeholder="Até"
      />
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-1 h-4 w-4" />
          Limpar
        </Button>
      )}
    </>
  )

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900 px-6 sm:px-8 py-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-white/15 backdrop-blur-sm">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Negócios</h1>
              <p className="text-neutral-400 text-sm">
                {total} negócio{total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-full bg-white/10 border border-white/15">
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'inline-flex items-center justify-center h-7 w-7 rounded-full transition-all',
                  viewMode === 'table'
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                )}
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'inline-flex items-center justify-center h-7 w-7 rounded-full transition-all',
                  viewMode === 'grid'
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={() => setNewDealOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white text-neutral-900 px-4 py-2 rounded-full text-xs font-semibold hover:bg-neutral-100 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo Negócio</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por referência, imóvel, consultor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full"
          />
        </div>
        <div className="sm:hidden flex items-center gap-0.5 p-0.5 rounded-full bg-muted border border-border/30">
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'inline-flex items-center justify-center h-7 w-7 rounded-full transition-all',
              viewMode === 'table'
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'text-muted-foreground'
            )}
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'inline-flex items-center justify-center h-7 w-7 rounded-full transition-all',
              viewMode === 'grid'
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'text-muted-foreground'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-wrap">{filterButtons}</div>
        <div className="sm:hidden">
          <MobileFilterSheet activeCount={activeFilterCount}>{filterButtons}</MobileFilterSheet>
        </div>
      </div>

      {isLoading ? (
        viewMode === 'table' ? (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Cenário</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        )
      ) : deals.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nenhum negócio encontrado"
          description={
            hasActiveFilters
              ? 'Tente ajustar os critérios de pesquisa'
              : 'Comece por criar o seu primeiro negócio'
          }
          action={
            !hasActiveFilters
              ? {
                  label: 'Novo Negócio',
                  onClick: () => setNewDealOpen(true),
                }
              : undefined
          }
        />
      ) : viewMode === 'table' ? (
        <>
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Cenário</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((d) => {
                  const scenario = d.deal_type as DealScenario
                  const scenarioInfo = DEAL_SCENARIOS[scenario]
                  const statusInfo = DEAL_STATUSES[d.status]
                  const ref = d.reference || d.pv_number || d.id.slice(0, 8)
                  return (
                    <TableRow
                      key={d.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openDetail(d)}
                    >
                      <TableCell className="font-mono text-xs">{ref}</TableCell>
                      <TableCell className="max-w-[220px]">
                        {d.property ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{d.property.title}</span>
                          </div>
                        ) : d.external_property_link ? (
                          <span className="text-xs text-muted-foreground italic">Imóvel externo</span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full whitespace-nowrap border',
                            SCENARIO_COLORS[scenario] || 'bg-muted text-muted-foreground border-border'
                          )}
                        >
                          {scenarioInfo?.label ?? d.deal_type}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{fmtCurrency(d.deal_value)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtCurrency(d.commission_total)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {d.consultant?.commercial_name || '—'}
                      </TableCell>
                      <TableCell>
                        {statusInfo ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium',
                              statusInfo.color
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOTS[d.status])} />
                            {statusInfo.label}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {fmtDate(d.deal_date)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem
                              className="rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation()
                                openDetail(d)
                              }}
                            >
                              <Briefcase className="mr-2 h-3.5 w-3.5" />
                              Ver Detalhe
                            </DropdownMenuItem>
                            {d.status !== 'cancelled' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive rounded-lg"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setCancelId(d.id)
                                  }}
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                                  Cancelar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {deals.map((d) => {
              const scenario = d.deal_type as DealScenario
              const scenarioInfo = DEAL_SCENARIOS[scenario]
              const statusInfo = DEAL_STATUSES[d.status]
              const ref = d.reference || d.pv_number || d.id.slice(0, 8)
              return (
                <div
                  key={d.id}
                  onClick={() => openDetail(d)}
                  className="group rounded-2xl border border-border/30 bg-card/50 p-5 cursor-pointer transition-all hover:shadow-lg hover:bg-card"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] text-muted-foreground truncate">{ref}</p>
                      <p className="font-semibold text-sm truncate mt-0.5">
                        {d.property?.title || (d.external_property_link ? 'Imóvel externo' : '—')}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full whitespace-nowrap border shrink-0',
                        SCENARIO_COLORS[scenario] || 'bg-muted text-muted-foreground border-border'
                      )}
                    >
                      {scenarioInfo?.label ?? d.deal_type}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {statusInfo && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          statusInfo.color
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOTS[d.status])} />
                        {statusInfo.label}
                      </span>
                    )}
                    {d.consultant?.commercial_name && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-2 py-0.5 rounded-full">
                        <Users className="h-2.5 w-2.5" />
                        {d.consultant.commercial_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-3 border-t border-border/30">
                    <div>
                      <p className="text-muted-foreground text-[10px]">Valor</p>
                      <p className="font-semibold">{fmtCurrency(d.deal_value)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-[10px]">Comissão</p>
                      <p className="font-semibold">{fmtCurrency(d.commission_total)}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 text-right">
                    {fmtDate(d.deal_date)}
                  </p>
                </div>
              )
            })}
          </div>

          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
        </>
      )}

      <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Cancelar negócio
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende cancelar este negócio? O estado será alterado para
              &quot;Cancelado&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancelar Negócio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DealForm
        open={newDealOpen}
        onOpenChange={setNewDealOpen}
        onSuccess={() => {
          setNewDealOpen(false)
          loadDeals()
        }}
      />
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  setPage,
}: {
  page: number
  totalPages: number
  setPage: (fn: (p: number) => number) => void
}) {
  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <button
        disabled={page <= 1}
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        className="inline-flex items-center justify-center h-8 w-8 rounded-full border bg-card shadow-sm disabled:opacity-40 hover:bg-muted transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => setPage((p) => p + 1)}
        className="inline-flex items-center justify-center h-8 w-8 rounded-full border bg-card shadow-sm disabled:opacity-40 hover:bg-muted transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function NegociosPage() {
  return (
    <Suspense fallback={null}>
      <NegociosPageInner />
    </Suspense>
  )
}

