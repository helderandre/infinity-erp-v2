'use client'


import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { PropertyCard } from '@/components/properties/property-card'
import { PropertyDetailSheet } from '@/components/properties/property-detail-sheet'
import type { PropertyListItemData } from '@/components/properties/property-list-item'
import { PropertiesTable } from '@/components/properties/properties-table'
import { PropertyActiveChips } from '@/components/properties/property-active-chips'
import { PropertyFiltersSheet, PropertyFiltersAside, type AdvancedFiltersValue } from '@/components/properties/property-filters-sheet'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  Building2,
  Plus,
  MoreHorizontal,
  Trash2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Download,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { CsvExportDialog } from '@/components/shared/csv-export-dialog'
import { useDebounce } from '@/hooks/use-debounce'
import { usePersistentState } from '@/hooks/use-persistent-filters'
import { PROPERTY_STATUS, BUSINESS_TYPES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { PropertyWithRelations } from '@/types/property'

const PAGE_SIZE = 20
const ALL_STATUS_KEYS = Object.keys(PROPERTY_STATUS)
const DEFAULT_STATUSES = ALL_STATUS_KEYS.filter((k) => k !== 'cancelled')

const STATUS_QUICK_OPTIONS = Object.entries(PROPERTY_STATUS).map(([k, v]) => ({
  value: k, label: v.label, dot: v.dot,
}))
const BUSINESS_QUICK_OPTIONS = Object.entries(BUSINESS_TYPES).map(([k, v]) => ({
  value: k, label: v as string,
}))

function shortPrice(v: string): string {
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M€`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k€`
  return `${n}€`
}

/**
 * Inline multi-select pill matching the calendar-style toolbar tokens
 * (rounded-full, solid border, soft active state). Used for Estado and
 * Negócio in the imoveis quick toolbar so all 5 pills look uniform.
 */
function MultiPill({
  label, options, selected, onChange,
}: {
  label: string
  options: { value: string; label: string; dot?: string }[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const isActive = selected.length > 0
  const summary = selected.length === 1
    ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
    : selected.length > 1
      ? `${selected.length} selecionados`
      : null
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={isActive ? 'default' : 'outline'}
          className={cn(
            'h-9 rounded-full text-xs gap-1.5',
            isActive && 'bg-foreground text-background',
          )}
        >
          {label}
          {summary && (
            <span className={cn(
              'inline-flex items-center rounded-full px-1.5 text-[10px] font-medium',
              isActive ? 'bg-background/15 text-background' : 'bg-muted text-muted-foreground',
            )}>
              {summary}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 rounded-xl p-2">
        <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
          {options.map((o) => {
            const active = selected.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
                  active ? 'bg-muted/60 font-medium' : 'hover:bg-muted/30',
                )}
              >
                {o.dot && <span className={cn('h-1.5 w-1.5 rounded-full', o.dot)} />}
                <span className="flex-1 text-left truncate">{o.label}</span>
                {active && <span className="text-[10px] text-foreground/70">✓</span>}
              </button>
            )
          })}
        </div>
        {isActive && (
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

function ImoveisPageInner() {
  return (
    <Suspense fallback={<ImoveisPageSkeleton />}>
      <ImoveisPageContent />
    </Suspense>
  )
}

function ImoveisPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-[104px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

function ImoveisPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [properties, setProperties] = useState<PropertyWithRelations[]>([])
  const [detailPropertyId, setDetailPropertyId] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [viewMode, setViewMode] = usePersistentState<'table' | 'grid'>('imoveis-view-mode', 'table')
  // Default to the numeric-suffix order of `external_ref` so the most recent
  // angariações (highest sequence) come first. The API maps this to the
  // generated `external_ref_seq` column for proper integer ordering.
  const [sortBy, setSortBy] = useState<string>('external_ref')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Filtros (persistidos em localStorage por utilizador)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [selectedStatuses, setSelectedStatuses] = usePersistentState<string[]>('imoveis-filter-statuses', DEFAULT_STATUSES)
  const [selectedPropertyTypes, setSelectedPropertyTypes] = usePersistentState<string[]>('imoveis-filter-types', [])
  const [selectedBusinessTypes, setSelectedBusinessTypes] = usePersistentState<string[]>('imoveis-filter-businesses', [])
  const [selectedConditions, setSelectedConditions] = usePersistentState<string[]>('imoveis-filter-conditions', [])
  const [selectedConsultants, setSelectedConsultants] = usePersistentState<string[]>('imoveis-filter-consultants-multi', [])
  const [priceMin, setPriceMin] = usePersistentState('imoveis-filter-price-min', searchParams.get('price_min') || '')
  const [priceMax, setPriceMax] = usePersistentState('imoveis-filter-price-max', searchParams.get('price_max') || '')
  const [bedroomsMin, setBedroomsMin] = usePersistentState('imoveis-filter-bedrooms-min', searchParams.get('bedrooms_min') || '')
  const [bathroomsMin, setBathroomsMin] = usePersistentState('imoveis-filter-bathrooms-min', '')
  const [areaUtilMin, setAreaUtilMin] = usePersistentState('imoveis-filter-area-util-min', '')
  const [areaUtilMax, setAreaUtilMax] = usePersistentState('imoveis-filter-area-util-max', '')
  const [yearMin, setYearMin] = usePersistentState('imoveis-filter-year-min', '')
  const [yearMax, setYearMax] = usePersistentState('imoveis-filter-year-max', '')
  const [hasElevator, setHasElevator] = usePersistentState<boolean>('imoveis-filter-has-elevator', false)
  const [hasPool, setHasPool] = usePersistentState<boolean>('imoveis-filter-has-pool', false)
  const [parkingMin, setParkingMin] = usePersistentState('imoveis-filter-parking-min', '')
  const [zoneFilter, setZoneFilter] = usePersistentState('imoveis-filter-zone', '')
  const [parishFilter, setParishFilter] = usePersistentState('imoveis-filter-parish', '')
  const [energyCerts, setEnergyCerts] = usePersistentState<string[]>('imoveis-filter-energy', [])
  // Management filters
  const [missingCover, setMissingCover] = usePersistentState<boolean>('imoveis-filter-missing-cover', false)
  const [missingOwners, setMissingOwners] = usePersistentState<boolean>('imoveis-filter-missing-owners', false)
  const [contractExpiringDays, setContractExpiringDays] = usePersistentState('imoveis-filter-contract-expiring', '')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [page, setPage] = useState(Number(searchParams.get('page')) || 0)

  const debouncedSearch = useDebounce(search, 300)

  const hasStatusFilter = selectedStatuses.length > 0 && selectedStatuses.length < ALL_STATUS_KEYS.length

  const hasActiveFilters =
    debouncedSearch !== '' ||
    hasStatusFilter ||
    selectedPropertyTypes.length > 0 ||
    selectedBusinessTypes.length > 0 ||
    selectedConditions.length > 0 ||
    selectedConsultants.length > 0 ||
    priceMin !== '' ||
    priceMax !== '' ||
    bedroomsMin !== '' ||
    bathroomsMin !== '' ||
    areaUtilMin !== '' ||
    areaUtilMax !== '' ||
    yearMin !== '' ||
    yearMax !== '' ||
    hasElevator ||
    hasPool ||
    parkingMin !== '' ||
    zoneFilter !== '' ||
    parishFilter !== '' ||
    energyCerts.length > 0 ||
    missingCover ||
    missingOwners ||
    contractExpiringDays !== ''

  // Count of advanced-only filters (used to badge the "Filtros avançados" button).
  // Excludes the four quick pills (Status / Negócio / Preço / Tipologia) that
  // already live in the inline toolbar so the badge only flags what's hidden.
  const advancedFilterCount =
    selectedPropertyTypes.length +
    selectedConditions.length +
    selectedConsultants.length +
    energyCerts.length +
    (bathroomsMin ? 1 : 0) +
    (areaUtilMin || areaUtilMax ? 1 : 0) +
    (yearMin || yearMax ? 1 : 0) +
    (hasElevator ? 1 : 0) +
    (hasPool ? 1 : 0) +
    (parkingMin ? 1 : 0) +
    (zoneFilter ? 1 : 0) +
    (parishFilter ? 1 : 0) +
    (missingCover ? 1 : 0) +
    (missingOwners ? 1 : 0) +
    (contractExpiringDays ? 1 : 0)

  const loadProperties = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (selectedStatuses.length > 0 && selectedStatuses.length < ALL_STATUS_KEYS.length) {
        params.set('status', selectedStatuses.join(','))
      }
      if (selectedPropertyTypes.length > 0) params.set('property_type', selectedPropertyTypes.join(','))
      if (selectedBusinessTypes.length > 0) params.set('business_type', selectedBusinessTypes.join(','))
      if (selectedConditions.length > 0) params.set('property_condition', selectedConditions.join(','))
      if (selectedConsultants.length > 0) params.set('consultant_id', selectedConsultants.join(','))
      if (priceMin) params.set('price_min', priceMin)
      if (priceMax) params.set('price_max', priceMax)
      if (bedroomsMin) params.set('bedrooms_min', bedroomsMin)
      if (bathroomsMin) params.set('bathrooms_min', bathroomsMin)
      if (areaUtilMin) params.set('area_util_min', areaUtilMin)
      if (areaUtilMax) params.set('area_util_max', areaUtilMax)
      if (yearMin) params.set('construction_year_min', yearMin)
      if (yearMax) params.set('construction_year_max', yearMax)
      if (hasElevator) params.set('has_elevator', 'true')
      if (hasPool) params.set('has_pool', 'true')
      if (parkingMin) params.set('parking_spaces_min', parkingMin)
      if (zoneFilter) params.set('zone', zoneFilter)
      if (parishFilter) params.set('address_parish', parishFilter)
      if (energyCerts.length > 0) params.set('energy_certificate', energyCerts.join(','))
      if (missingCover) params.set('missing_cover', 'true')
      if (missingOwners) params.set('missing_owners', 'true')
      if (contractExpiringDays) params.set('contract_expiring_days', contractExpiringDays)
      params.set('sort_by', sortBy)
      params.set('sort_dir', sortDir)
      params.set('per_page', String(PAGE_SIZE))
      params.set('page', String(page + 1))

      const res = await fetch(`/api/properties?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar imóveis')

      const data = await res.json()
      setProperties(data.data || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Erro ao carregar imóveis:', error)
      setProperties([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [
    debouncedSearch, selectedStatuses,
    selectedPropertyTypes, selectedBusinessTypes, selectedConditions, selectedConsultants,
    priceMin, priceMax, bedroomsMin, bathroomsMin, areaUtilMin, areaUtilMax,
    yearMin, yearMax, hasElevator, hasPool, parkingMin, zoneFilter, parishFilter,
    energyCerts, missingCover, missingOwners, contractExpiringDays,
    page, sortBy, sortDir,
  ])

  const loadConsultants = useCallback(async () => {
    try {
      const res = await fetch('/api/users/consultants')
      if (res.ok) {
        const data = await res.json()
        setConsultants(
          (data || []).map((c: Record<string, unknown>) => ({
            id: c.id as string,
            commercial_name: c.commercial_name as string,
          }))
        )
      }
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    loadProperties()
  }, [loadProperties])

  useEffect(() => {
    loadConsultants()
  }, [loadConsultants])

  // Sync ?property=<slug|id> with the detail sheet so deep links open directly.
  const propertyParam = searchParams.get('property')
  useEffect(() => {
    if (propertyParam && propertyParam !== detailPropertyId) {
      setDetailPropertyId(propertyParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyParam])

  const openPropertySheet = (p: PropertyWithRelations) => {
    const key = p.slug || p.id
    setDetailPropertyId(key)
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('property', key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleSheetOpenChange = (open: boolean) => {
    if (open) return
    setDetailPropertyId(null)
    if (propertyParam) {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.delete('property')
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }
  }

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [
    debouncedSearch, selectedStatuses,
    selectedPropertyTypes, selectedBusinessTypes, selectedConditions, selectedConsultants,
    priceMin, priceMax, bedroomsMin, bathroomsMin, areaUtilMin, areaUtilMax,
    yearMin, yearMax, hasElevator, hasPool, parkingMin, zoneFilter, parishFilter,
    energyCerts, missingCover, missingOwners, contractExpiringDays,
  ])

  const handleCancel = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/properties/${deleteId}?mode=cancel`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao cancelar imóvel')
      toast.success('Imóvel cancelado')
      loadProperties()
    } catch {
      toast.error('Erro ao cancelar imóvel')
    } finally {
      setDeleteId(null)
    }
  }

  const handleDeletePermanent = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/properties/${deleteId}?mode=permanent`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao eliminar imóvel')
      toast.success('Imóvel eliminado permanentemente')
      loadProperties()
    } catch {
      toast.error('Erro ao eliminar imóvel')
    } finally {
      setDeleteId(null)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setSelectedStatuses(DEFAULT_STATUSES)
    setSelectedPropertyTypes([])
    setSelectedBusinessTypes([])
    setSelectedConditions([])
    setSelectedConsultants([])
    setPriceMin('')
    setPriceMax('')
    setBedroomsMin('')
    setBathroomsMin('')
    setAreaUtilMin('')
    setAreaUtilMax('')
    setYearMin('')
    setYearMax('')
    setHasElevator(false)
    setHasPool(false)
    setParkingMin('')
    setZoneFilter('')
    setParishFilter('')
    setEnergyCerts([])
    setMissingCover(false)
    setMissingOwners(false)
    setContractExpiringDays('')
    setPage(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const resetSort = () => {
    setSortBy('external_ref')
    setSortDir('desc')
    setPage(0)
  }

  return (
    <div className="space-y-5">
      {/* ═══ Hero header ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900 px-6 sm:px-8 py-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Imóveis</h1>
            <p className="text-neutral-400 text-sm">{total} imóve{total !== 1 ? 'is' : 'l'}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle — desktop only (inside card) */}
            <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-full bg-white/10 border border-white/15">
              <button onClick={() => setViewMode('table')} className={cn('inline-flex items-center justify-center h-7 w-7 rounded-full transition-all', viewMode === 'table' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-white')}>
                <List className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setViewMode('grid')} className={cn('inline-flex items-center justify-center h-7 w-7 rounded-full transition-all', viewMode === 'grid' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-white')}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
            <button onClick={() => setExportOpen(true)} className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3 py-2 rounded-full text-xs font-medium hover:bg-white/25 transition-colors">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
            <button onClick={() => router.push('/dashboard/imoveis/novo')} className="inline-flex items-center gap-1.5 bg-white text-neutral-900 px-4 py-2 rounded-full text-xs font-semibold hover:bg-neutral-100 transition-colors shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo Imóvel</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Quick toolbar — só os filtros mais usados; resto vai para o sheet ═══ */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por título, ref, cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full"
          />
        </div>

        {/* Status quick-pill */}
        <MultiPill
          label="Estado"
          options={STATUS_QUICK_OPTIONS}
          selected={selectedStatuses}
          onChange={setSelectedStatuses}
        />

        {/* Negócio quick-pill */}
        <MultiPill
          label="Negócio"
          options={BUSINESS_QUICK_OPTIONS}
          selected={selectedBusinessTypes}
          onChange={setSelectedBusinessTypes}
        />

        {/* Preço quick-pill */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={priceMin || priceMax ? 'default' : 'outline'}
              className={cn(
                'h-9 rounded-full text-xs',
                (priceMin || priceMax) && 'bg-foreground text-background',
              )}
            >
              {priceMin || priceMax
                ? `Preço ${priceMin ? `≥${shortPrice(priceMin)}` : '−'}${priceMin && priceMax ? ' · ' : priceMax ? ' ' : ''}${priceMax ? `≤${shortPrice(priceMax)}` : ''}`
                : 'Preço'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 rounded-xl p-3 space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Preço (€)</p>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" inputMode="numeric" placeholder="Min" value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)} className="h-8 text-xs" />
              <Input type="number" inputMode="numeric" placeholder="Máx" value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)} className="h-8 text-xs" />
            </div>
            {(priceMin || priceMax) && (
              <Button size="sm" variant="ghost" className="w-full h-7 text-xs"
                onClick={() => { setPriceMin(''); setPriceMax('') }}>
                <X className="mr-1 h-3 w-3" /> Limpar
              </Button>
            )}
          </PopoverContent>
        </Popover>

        {/* Tipologia quick-pill */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={bedroomsMin ? 'default' : 'outline'}
              className={cn(
                'h-9 rounded-full text-xs',
                bedroomsMin && 'bg-foreground text-background',
              )}
            >
              {bedroomsMin ? `T${bedroomsMin}+` : 'Tipologia'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto rounded-xl p-2">
            <div className="flex flex-wrap gap-1.5">
              {(['1','2','3','4','5'] as const).map((v) => {
                const active = bedroomsMin === v
                return (
                  <button key={v} type="button"
                    onClick={() => setBedroomsMin(active ? '' : v)}
                    className={cn(
                      'h-8 px-3 rounded-full text-xs font-medium border transition-colors',
                      active
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground',
                    )}>
                    T{v}+
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Filtros avançados — abre o sheet com tudo o resto */}
        <Button
          size="sm"
          variant="outline"
          className="h-9 rounded-full text-xs gap-1.5 relative"
          onClick={() => setAdvancedOpen(true)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {advancedFilterCount > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-foreground text-background text-[10px] font-semibold px-1.5">
              {advancedFilterCount}
            </span>
          )}
        </Button>

        {/* View toggle (mobile) */}
        <div className="sm:hidden flex items-center gap-0.5 p-0.5 rounded-full bg-muted border border-border/30">
          <button onClick={() => setViewMode('table')} className={cn('inline-flex items-center justify-center h-7 w-7 rounded-full transition-all', viewMode === 'table' ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground')}>
            <List className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setViewMode('grid')} className={cn('inline-flex items-center justify-center h-7 w-7 rounded-full transition-all', viewMode === 'grid' ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground')}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 rounded-full text-xs">
            <X className="mr-1 h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      {/* Active filter chips — visible feedback for what's currently filtered. */}
      <PropertyActiveChips
        search={debouncedSearch}
        onClearSearch={() => setSearch('')}
        selectedStatuses={selectedStatuses}
        defaultStatuses={DEFAULT_STATUSES}
        onStatusesChange={setSelectedStatuses}
        selectedPropertyTypes={selectedPropertyTypes}
        onPropertyTypesChange={setSelectedPropertyTypes}
        selectedBusinessTypes={selectedBusinessTypes}
        onBusinessTypesChange={setSelectedBusinessTypes}
        selectedConditions={selectedConditions}
        onConditionsChange={setSelectedConditions}
        consultants={consultants}
        selectedConsultants={selectedConsultants}
        onConsultantsChange={setSelectedConsultants}
        priceMin={priceMin}
        priceMax={priceMax}
        onPriceMinChange={setPriceMin}
        onPriceMaxChange={setPriceMax}
        bedroomsMin={bedroomsMin}
        onBedroomsMinChange={setBedroomsMin}
        bathroomsMin={bathroomsMin}
        onBathroomsMinChange={setBathroomsMin}
        areaUtilMin={areaUtilMin}
        areaUtilMax={areaUtilMax}
        onAreaUtilMinChange={setAreaUtilMin}
        onAreaUtilMaxChange={setAreaUtilMax}
        yearMin={yearMin}
        yearMax={yearMax}
        onYearMinChange={setYearMin}
        onYearMaxChange={setYearMax}
        hasElevator={hasElevator}
        onHasElevatorChange={setHasElevator}
        hasPool={hasPool}
        onHasPoolChange={setHasPool}
        parkingMin={parkingMin}
        onParkingMinChange={setParkingMin}
        zone={zoneFilter}
        onZoneChange={setZoneFilter}
        addressParish={parishFilter}
        onAddressParishChange={setParishFilter}
        selectedEnergyCertificates={energyCerts}
        onEnergyCertificatesChange={setEnergyCerts}
        missingCover={missingCover}
        onMissingCoverChange={setMissingCover}
        missingOwners={missingOwners}
        onMissingOwnersChange={setMissingOwners}
        contractExpiringDays={contractExpiringDays}
        onContractExpiringDaysChange={setContractExpiringDays}
        onClearAll={clearFilters}
      />

      <PropertyFiltersSheet
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        consultants={consultants}
        liveCount={isLoading ? null : total}
        liveLoading={isLoading}
        value={{
          selectedStatuses,
          selectedPropertyTypes,
          selectedBusinessTypes,
          selectedConditions,
          selectedConsultants,
          selectedEnergyCertificates: energyCerts,
          priceMin, priceMax,
          bedroomsMin, bathroomsMin,
          areaUtilMin, areaUtilMax,
          yearMin, yearMax,
          hasElevator, hasPool, parkingMin,
          zone: zoneFilter, addressParish: parishFilter,
          missingCover, missingOwners, contractExpiringDays,
        } satisfies AdvancedFiltersValue}
        onChange={(patch) => {
          if ('selectedStatuses' in patch && patch.selectedStatuses) setSelectedStatuses(patch.selectedStatuses)
          if ('selectedPropertyTypes' in patch && patch.selectedPropertyTypes) setSelectedPropertyTypes(patch.selectedPropertyTypes)
          if ('selectedBusinessTypes' in patch && patch.selectedBusinessTypes) setSelectedBusinessTypes(patch.selectedBusinessTypes)
          if ('selectedConditions' in patch && patch.selectedConditions) setSelectedConditions(patch.selectedConditions)
          if ('selectedConsultants' in patch && patch.selectedConsultants) setSelectedConsultants(patch.selectedConsultants)
          if ('selectedEnergyCertificates' in patch && patch.selectedEnergyCertificates) setEnergyCerts(patch.selectedEnergyCertificates)
          if ('priceMin' in patch) setPriceMin(patch.priceMin ?? '')
          if ('priceMax' in patch) setPriceMax(patch.priceMax ?? '')
          if ('bedroomsMin' in patch) setBedroomsMin(patch.bedroomsMin ?? '')
          if ('bathroomsMin' in patch) setBathroomsMin(patch.bathroomsMin ?? '')
          if ('areaUtilMin' in patch) setAreaUtilMin(patch.areaUtilMin ?? '')
          if ('areaUtilMax' in patch) setAreaUtilMax(patch.areaUtilMax ?? '')
          if ('yearMin' in patch) setYearMin(patch.yearMin ?? '')
          if ('yearMax' in patch) setYearMax(patch.yearMax ?? '')
          if ('hasElevator' in patch) setHasElevator(!!patch.hasElevator)
          if ('hasPool' in patch) setHasPool(!!patch.hasPool)
          if ('parkingMin' in patch) setParkingMin(patch.parkingMin ?? '')
          if ('zone' in patch) setZoneFilter(patch.zone ?? '')
          if ('addressParish' in patch) setParishFilter(patch.addressParish ?? '')
          if ('missingCover' in patch) setMissingCover(!!patch.missingCover)
          if ('missingOwners' in patch) setMissingOwners(!!patch.missingOwners)
          if ('contractExpiringDays' in patch) setContractExpiringDays(patch.contractExpiringDays ?? '')
        }}
        onClearAll={clearFilters}
      />

      <div className="flex gap-5 items-start">
        <main className="flex-1 min-w-0 space-y-5">
      {isLoading ? (
        viewMode === 'table' ? (
          <div className="rounded-3xl border border-border/40 shadow-sm p-3 sm:p-4 space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-[104px] w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border overflow-hidden">
                <Skeleton className="aspect-[16/10]" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )
      ) : properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhum imóvel encontrado"
          description={
            hasActiveFilters
              ? 'Tente ajustar os critérios de pesquisa'
              : 'Comece por criar o seu primeiro imóvel'
          }
          action={
            !hasActiveFilters
              ? {
                  label: 'Novo Imóvel',
                  onClick: () => router.push('/dashboard/imoveis/novo'),
                }
              : undefined
          }
        />
      ) : viewMode === 'table' ? (
        <>
          <PropertiesTable
            properties={properties as unknown as PropertyListItemData[]}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={(column, dir) => {
              setSortBy(column)
              setSortDir(dir)
              setPage(0)
            }}
            onResetSort={resetSort}
            onRowClick={(p) => openPropertySheet(p as unknown as PropertyWithRelations)}
            rowActions={(p) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem
                    className="rounded-lg"
                    onClick={() => openPropertySheet(p as unknown as PropertyWithRelations)}
                  >
                    <Building2 className="mr-2 h-3.5 w-3.5" />
                    Ver Detalhe
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive rounded-lg"
                    onClick={() => setDeleteId(p.id)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="inline-flex items-center justify-center h-8 w-8 rounded-full border bg-card shadow-sm disabled:opacity-40 hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center justify-center h-8 w-8 rounded-full border bg-card shadow-sm disabled:opacity-40 hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onClick={() => openPropertySheet(property)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="inline-flex items-center justify-center h-8 w-8 rounded-full border bg-card shadow-sm disabled:opacity-40 hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center justify-center h-8 w-8 rounded-full border bg-card shadow-sm disabled:opacity-40 hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
        </main>

        {/* Desktop push-aside filters panel — Sheet variant handles mobile internally */}
        <PropertyFiltersAside
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          consultants={consultants}
          liveCount={isLoading ? null : total}
          liveLoading={isLoading}
          value={{
            selectedStatuses,
            selectedPropertyTypes,
            selectedBusinessTypes,
            selectedConditions,
            selectedConsultants,
            selectedEnergyCertificates: energyCerts,
            priceMin, priceMax,
            bedroomsMin, bathroomsMin,
            areaUtilMin, areaUtilMax,
            yearMin, yearMax,
            hasElevator, hasPool, parkingMin,
            zone: zoneFilter, addressParish: parishFilter,
            missingCover, missingOwners, contractExpiringDays,
          } satisfies AdvancedFiltersValue}
          onChange={(patch) => {
            if ('selectedStatuses' in patch && patch.selectedStatuses) setSelectedStatuses(patch.selectedStatuses)
            if ('selectedPropertyTypes' in patch && patch.selectedPropertyTypes) setSelectedPropertyTypes(patch.selectedPropertyTypes)
            if ('selectedBusinessTypes' in patch && patch.selectedBusinessTypes) setSelectedBusinessTypes(patch.selectedBusinessTypes)
            if ('selectedConditions' in patch && patch.selectedConditions) setSelectedConditions(patch.selectedConditions)
            if ('selectedConsultants' in patch && patch.selectedConsultants) setSelectedConsultants(patch.selectedConsultants)
            if ('selectedEnergyCertificates' in patch && patch.selectedEnergyCertificates) setEnergyCerts(patch.selectedEnergyCertificates)
            if ('priceMin' in patch) setPriceMin(patch.priceMin ?? '')
            if ('priceMax' in patch) setPriceMax(patch.priceMax ?? '')
            if ('bedroomsMin' in patch) setBedroomsMin(patch.bedroomsMin ?? '')
            if ('bathroomsMin' in patch) setBathroomsMin(patch.bathroomsMin ?? '')
            if ('areaUtilMin' in patch) setAreaUtilMin(patch.areaUtilMin ?? '')
            if ('areaUtilMax' in patch) setAreaUtilMax(patch.areaUtilMax ?? '')
            if ('yearMin' in patch) setYearMin(patch.yearMin ?? '')
            if ('yearMax' in patch) setYearMax(patch.yearMax ?? '')
            if ('hasElevator' in patch) setHasElevator(!!patch.hasElevator)
            if ('hasPool' in patch) setHasPool(!!patch.hasPool)
            if ('parkingMin' in patch) setParkingMin(patch.parkingMin ?? '')
            if ('zone' in patch) setZoneFilter(patch.zone ?? '')
            if ('addressParish' in patch) setParishFilter(patch.addressParish ?? '')
            if ('missingCover' in patch) setMissingCover(!!patch.missingCover)
            if ('missingOwners' in patch) setMissingOwners(!!patch.missingOwners)
            if ('contractExpiringDays' in patch) setContractExpiringDays(patch.contractExpiringDays ?? '')
          }}
          onClearAll={clearFilters}
        />
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" />Eliminar imóvel</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha uma opção. Cancelar marca o imóvel como cancelado mas mantém os dados. Eliminar permanentemente remove todos os dados associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-full">Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="rounded-full bg-amber-600 text-white hover:bg-amber-700">
              Cancelar Imóvel
            </AlertDialogAction>
            <AlertDialogAction onClick={handleDeletePermanent} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CsvExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        endpoint="/api/export/properties"
        title="Imóveis"
      />

      <PropertyDetailSheet
        propertyId={detailPropertyId}
        open={!!detailPropertyId}
        onOpenChange={handleSheetOpenChange}
      />
    </div>
  )
}

export default function ImoveisPage() {
  return (
    <Suspense fallback={null}>
      <ImoveisPageInner />
    </Suspense>
  )
}

